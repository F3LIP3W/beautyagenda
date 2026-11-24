-- =============================================================================
-- BeautyAgenda — 002: Funções (disponibilidade, agendamento, painel, relatórios)
-- =============================================================================
-- Funções iniciadas com "_" são internas: não podem ser chamadas pela API
-- (permissões revogadas em 003_security.sql). As funções públicas são
-- SECURITY DEFINER com search_path fixo e validam todos os parâmetros.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.app_timezone()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select timezone from public.business_settings where id = 1), 'America/Sao_Paulo');
$$;

-- Normaliza WhatsApp brasileiro para 55 + DDD + número. Retorna null se inválido.
create or replace function public.normalize_whatsapp(p_value text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  d text := regexp_replace(coalesce(p_value, ''), '\D', '', 'g');
begin
  d := ltrim(d, '0');                         -- remove 0 de operadora/DDD (ex.: 011...)
  if length(d) in (10, 11) then
    d := '55' || d;
  end if;
  if d !~ '^55[1-9]{2}[0-9]{8,9}$' then
    return null;
  end if;
  if length(d) = 13 and substr(d, 5, 1) <> '9' then   -- celular com 9 dígitos começa com 9
    return null;
  end if;
  return d;
end;
$$;

-- Janela de um dia (início/fim menos intervalo) como multirange no fuso informado
create or replace function public._day_window(
  p_date date, p_start time, p_end time, p_break_start time, p_break_end time, p_tz text
)
returns tstzmultirange
language sql
stable
set search_path = public, pg_temp
as $$
  select case
    when p_start is null or p_end is null then '{}'::tstzmultirange
    else
      tstzmultirange(tstzrange((p_date + p_start) at time zone p_tz, (p_date + p_end) at time zone p_tz, '[)'))
      - case
          when p_break_start is null or p_break_end is null then '{}'::tstzmultirange
          else tstzmultirange(tstzrange((p_date + p_break_start) at time zone p_tz, (p_date + p_break_end) at time zone p_tz, '[)'))
        end
  end;
$$;

-- -----------------------------------------------------------------------------
-- Núcleo da disponibilidade:
-- livre = (expediente do estabelecimento ∩ jornada do profissional)
--         − intervalos − bloqueios − agendamentos ativos
-- -----------------------------------------------------------------------------
create or replace function public._free_ranges(
  p_professional_id uuid,
  p_date date,
  p_exclude_appointment uuid default null
)
returns tstzmultirange
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz   text := public.app_timezone();
  v_dow  int  := extract(dow from p_date)::int;
  v_day  tstzrange;
  v_est  tstzmultirange;
  v_pro  tstzmultirange;
  v_busy tstzmultirange;
  ex     public.schedule_exceptions%rowtype;
  wh     public.working_hours%rowtype;
  pwh    public.professional_working_hours%rowtype;
begin
  v_day := tstzrange(p_date::timestamp at time zone v_tz, (p_date + 1)::timestamp at time zone v_tz, '[)');

  -- Estabelecimento: exceção da data tem prioridade sobre o horário semanal
  select * into ex from public.schedule_exceptions
   where exception_date = p_date and professional_id is null;
  if found then
    v_est := case when ex.is_closed then '{}'::tstzmultirange
                  else public._day_window(p_date, ex.start_time, ex.end_time, null, null, v_tz) end;
  else
    select * into wh from public.working_hours where weekday = v_dow;
    if not found or not wh.is_open then
      v_est := '{}'::tstzmultirange;
    else
      v_est := public._day_window(p_date, wh.open_time, wh.close_time, wh.break_start, wh.break_end, v_tz);
    end if;
  end if;

  if isempty(v_est) then
    return '{}'::tstzmultirange;
  end if;

  -- Profissional: exceção da data tem prioridade sobre a jornada semanal
  select * into ex from public.schedule_exceptions
   where exception_date = p_date and professional_id = p_professional_id;
  if found then
    v_pro := case when ex.is_closed then '{}'::tstzmultirange
                  else public._day_window(p_date, ex.start_time, ex.end_time, null, null, v_tz) end;
  else
    select * into pwh from public.professional_working_hours
     where professional_id = p_professional_id and weekday = v_dow;
    if not found or not pwh.is_working then
      v_pro := '{}'::tstzmultirange;
    else
      v_pro := public._day_window(p_date, pwh.start_time, pwh.end_time, pwh.break_start, pwh.break_end, v_tz);
    end if;
  end if;

  -- Ocupado: bloqueios (do profissional ou gerais) + agendamentos ativos
  select coalesce(range_agg(tstzrange(b.starts_at, b.ends_at, '[)')), '{}'::tstzmultirange)
    into v_busy
    from public.time_blocks b
   where (b.professional_id = p_professional_id or b.professional_id is null)
     and tstzrange(b.starts_at, b.ends_at, '[)') && v_day;

  v_busy := v_busy + coalesce((
    select range_agg(tstzrange(a.starts_at, a.ends_at, '[)'))
      from public.appointments a
     where a.professional_id = p_professional_id
       and a.status in ('pending', 'confirmed', 'completed')
       and a.id is distinct from p_exclude_appointment
       and tstzrange(a.starts_at, a.ends_at, '[)') && v_day
  ), '{}'::tstzmultirange);

  return (v_est * v_pro) - v_busy;
end;
$$;

-- Horários de início possíveis de um profissional em uma data.
-- Candidatos: grade regular (slot_interval_minutes) + início de cada janela livre
-- (evita "buracos" depois de serviços com duração quebrada).
create or replace function public._professional_slots(
  p_professional_id uuid,
  p_date date,
  p_duration int,
  p_earliest timestamptz,
  p_exclude_appointment uuid default null
)
returns setof timestamptz
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with cfg as (
    select public.app_timezone() as tz,
           coalesce((select slot_interval_minutes from public.business_settings where id = 1), 30) as step
  ),
  free as (
    select public._free_ranges(p_professional_id, p_date, p_exclude_appointment) as fr
  ),
  candidates as (
    select gs as slot
      from cfg,
           generate_series(p_date::timestamp at time zone cfg.tz,
                           (p_date + 1)::timestamp at time zone cfg.tz - interval '1 minute',
                           make_interval(mins => cfg.step)) as gs
    union
    select lower(r) from free, unnest(free.fr) as r
  )
  select c.slot
    from candidates c, free
   where c.slot >= p_earliest
     and free.fr @> tstzrange(c.slot, c.slot + make_interval(mins => p_duration), '[)')
   order by c.slot;
$$;

-- -----------------------------------------------------------------------------
-- API pública: catálogo para a página /agendar (sem dados pessoais)
-- -----------------------------------------------------------------------------
create or replace function public.get_booking_catalog()
returns json
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select json_build_object(
    'settings', (
      select json_build_object(
        'name', s.name, 'logo_url', s.logo_url, 'phone', s.phone, 'whatsapp', s.whatsapp,
        'address', s.address, 'welcome_message', s.welcome_message,
        'min_advance_minutes', s.min_advance_minutes, 'max_advance_days', s.max_advance_days,
        'timezone', s.timezone
      ) from public.business_settings s where s.id = 1
    ),
    'services', coalesce((
      select json_agg(json_build_object(
        'id', sv.id, 'name', sv.name, 'category', sv.category, 'description', sv.description,
        'price', sv.price, 'duration_minutes', sv.duration_minutes
      ) order by sv.category, sv.sort_order, sv.name)
      from public.services sv
      where sv.active
        and exists (select 1 from public.professional_services ps
                    join public.professionals p on p.id = ps.professional_id and p.active
                    where ps.service_id = sv.id)
    ), '[]'::json),
    'professionals', coalesce((
      select json_agg(json_build_object(
        'id', p.id, 'name', p.name, 'photo_url', p.photo_url, 'specialties', p.specialties,
        'service_ids', (select json_agg(ps.service_id) from public.professional_services ps where ps.professional_id = p.id)
      ) order by p.name)
      from public.professionals p
      where p.active
    ), '[]'::json),
    'working_hours', coalesce((
      select json_agg(json_build_object(
        'weekday', w.weekday, 'is_open', w.is_open,
        'open_time', to_char(w.open_time, 'HH24:MI'), 'close_time', to_char(w.close_time, 'HH24:MI')
      ) order by w.weekday)
      from public.working_hours w
    ), '[]'::json)
  );
$$;

-- -----------------------------------------------------------------------------
-- API pública/admin: horários disponíveis em uma data
-- p_professional_id nulo = "qualquer profissional disponível"
-- Para o administrador, ignora antecedência mínima e limite de dias.
-- -----------------------------------------------------------------------------
create or replace function public.get_available_slots(
  p_service_id uuid,
  p_date date,
  p_professional_id uuid default null,
  p_exclude_appointment uuid default null
)
returns table (slot_start timestamptz, slot_label text, professional_ids uuid[])
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_set      public.business_settings%rowtype;
  v_dur      int;
  v_today    date;
  v_admin    boolean := public.is_admin();
  v_earliest timestamptz;
begin
  select * into v_set from public.business_settings where id = 1;
  select duration_minutes into v_dur from public.services where id = p_service_id and active;
  if v_dur is null or p_date is null then
    return;
  end if;

  v_today := (now() at time zone v_set.timezone)::date;
  if p_date < v_today then
    return;
  end if;
  if not v_admin and p_date > v_today + v_set.max_advance_days then
    return;
  end if;
  if not v_admin then
    p_exclude_appointment := null;  -- só o admin pode reagendar
  end if;

  v_earliest := case when v_admin then now()
                     else now() + make_interval(mins => v_set.min_advance_minutes) end;

  return query
    select sl, to_char(sl at time zone v_set.timezone, 'HH24:MI'), array_agg(p.id order by p.name)
      from public.professionals p
      join public.professional_services ps on ps.professional_id = p.id and ps.service_id = p_service_id
      cross join lateral public._professional_slots(p.id, p_date, v_dur, v_earliest, p_exclude_appointment) as sl
     where p.active
       and (p_professional_id is null or p.id = p_professional_id)
     group by sl
     order by sl;
end;
$$;

-- Dias com pelo menos um horário livre (para colorir o calendário público)
create or replace function public.get_available_dates(
  p_service_id uuid,
  p_from date,
  p_to date,
  p_professional_id uuid default null
)
returns setof date
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_set   public.business_settings%rowtype;
  v_today date;
  v_last  date;
  d       date;
begin
  select * into v_set from public.business_settings where id = 1;
  v_today := (now() at time zone v_set.timezone)::date;
  v_last  := least(p_to, p_from + 62);
  if not public.is_admin() then
    v_last := least(v_last, v_today + v_set.max_advance_days);
  end if;
  d := greatest(p_from, v_today);
  while d <= v_last loop
    if exists (select 1 from public.get_available_slots(p_service_id, d, p_professional_id)) then
      return next d;
    end if;
    d := d + 1;
  end loop;
end;
$$;

-- Código curto, legível e único para cada agendamento
create or replace function public._new_appointment_code()
returns text
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := 'BA';
    for i in 1..6 loop
      v_code := v_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.appointments where code = v_code);
  end loop;
  return v_code;
end;
$$;

-- -----------------------------------------------------------------------------
-- Núcleo transacional de criação de agendamento (interno)
-- -----------------------------------------------------------------------------
create or replace function public._create_appointment(
  p_service_id uuid,
  p_professional_id uuid,
  p_starts_at timestamptz,
  p_client_name text,
  p_client_whatsapp text,
  p_notes text,
  p_source text,
  p_force boolean
)
returns json
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_set        public.business_settings%rowtype;
  v_svc        public.services%rowtype;
  v_name       text := btrim(regexp_replace(coalesce(p_client_name, ''), '\s+', ' ', 'g'));
  v_phone      text := public.normalize_whatsapp(p_client_whatsapp);
  v_notes      text := nullif(btrim(coalesce(p_notes, '')), '');
  v_end        timestamptz;
  v_date       date;
  v_client     uuid;
  v_prof       uuid;
  v_candidates uuid[];
  v_status     text;
  v_lock_key   bigint;
  v_appt       public.appointments%rowtype;
begin
  select * into v_set from public.business_settings where id = 1;

  -- Validação dos campos
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Informe o nome completo.' using errcode = 'P0001', hint = 'INVALID_NAME';
  end if;
  if v_phone is null then
    raise exception 'Número de WhatsApp inválido. Informe DDD + número.' using errcode = 'P0001', hint = 'INVALID_PHONE';
  end if;
  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'Observação muito longa (máximo 500 caracteres).' using errcode = 'P0001', hint = 'INVALID_NOTES';
  end if;
  if p_starts_at is null then
    raise exception 'Escolha um horário.' using errcode = 'P0001', hint = 'INVALID_TIME';
  end if;

  select * into v_svc from public.services where id = p_service_id and active;
  if not found then
    raise exception 'Serviço indisponível.' using errcode = 'P0001', hint = 'INVALID_SERVICE';
  end if;

  v_end  := p_starts_at + make_interval(mins => v_svc.duration_minutes);
  v_date := (p_starts_at at time zone v_set.timezone)::date;

  if p_source = 'online' then
    if p_starts_at < now() + make_interval(mins => v_set.min_advance_minutes) then
      raise exception 'Este horário não está mais disponível para agendamento online.' using errcode = 'P0001', hint = 'TOO_SOON';
    end if;
    if v_date > (now() at time zone v_set.timezone)::date + v_set.max_advance_days then
      raise exception 'Data além do limite permitido para agendamento.' using errcode = 'P0001', hint = 'TOO_FAR';
    end if;
  end if;

  -- Profissionais candidatos
  if p_professional_id is not null then
    if not exists (
      select 1 from public.professionals p
        join public.professional_services ps on ps.professional_id = p.id
       where p.id = p_professional_id and p.active and ps.service_id = p_service_id
    ) then
      raise exception 'Este profissional não realiza o serviço escolhido.' using errcode = 'P0001', hint = 'INVALID_PROFESSIONAL';
    end if;
    v_candidates := array[p_professional_id];
  else
    -- "Qualquer profissional": prioriza quem tem menos atendimentos no dia
    select array_agg(x.id order by x.load, random())
      into v_candidates
      from (
        select p.id,
               (select count(*) from public.appointments a
                 where a.professional_id = p.id
                   and a.status in ('pending', 'confirmed')
                   and (a.starts_at at time zone v_set.timezone)::date = v_date) as load
          from public.professionals p
          join public.professional_services ps on ps.professional_id = p.id and ps.service_id = p_service_id
         where p.active
      ) x;
    if v_candidates is null then
      raise exception 'Nenhum profissional disponível para este serviço.' using errcode = 'P0001', hint = 'NO_PROFESSIONAL';
    end if;
  end if;

  -- Serializa pedidos do mesmo cliente (evita duplicidade por clique duplo)
  perform pg_advisory_xact_lock(hashtextextended('client:' || v_phone, 0));

  -- Cria ou atualiza o cliente
  if p_source = 'admin' then
    insert into public.clients (name, whatsapp) values (v_name, v_phone)
    on conflict (whatsapp) do update set name = excluded.name
    returning id into v_client;
  else
    -- Online: não sobrescreve o nome de um cadastro existente
    insert into public.clients (name, whatsapp) values (v_name, v_phone)
    on conflict (whatsapp) do update set updated_at = now()
    returning id into v_client;
  end if;

  -- Impede duplicidade: o mesmo cliente com horário sobreposto
  if exists (
    select 1 from public.appointments
     where client_id = v_client
       and status in ('pending', 'confirmed')
       and tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, v_end, '[)')
  ) then
    raise exception 'Já existe um agendamento para este WhatsApp neste horário.' using errcode = 'P0001', hint = 'DUPLICATE';
  end if;

  if p_source = 'online' and (
    select count(*) from public.appointments
     where client_id = v_client and status in ('pending', 'confirmed') and starts_at > now()
  ) >= 3 then
    raise exception 'Você já possui 3 agendamentos futuros. Fale com o estabelecimento para marcar mais.' using errcode = 'P0001', hint = 'TOO_MANY';
  end if;

  v_status := case when p_source = 'admin' or v_set.auto_confirm then 'confirmed' else 'pending' end;

  -- Trava todos os candidatos SEMPRE na mesma ordem (evita deadlock entre
  -- pedidos simultâneos) e depois tenta cada um na ordem de preferência.
  -- A restrição EXCLUDE continua sendo a garantia final.
  for v_lock_key in
    select distinct hashtextextended('prof:' || c::text, 0) as k from unnest(v_candidates) c order by k
  loop
    perform pg_advisory_xact_lock(v_lock_key);
  end loop;

  foreach v_prof in array v_candidates loop
    if p_force or public._free_ranges(v_prof, v_date) @> tstzrange(p_starts_at, v_end, '[)') then
      begin
        insert into public.appointments (
          code, client_id, professional_id, service_id, starts_at, ends_at,
          price, duration_minutes, status, source, notes
        ) values (
          public._new_appointment_code(), v_client, v_prof, p_service_id, p_starts_at, v_end,
          v_svc.price, v_svc.duration_minutes, v_status, p_source, v_notes
        )
        returning * into v_appt;
        exit;
      exception when exclusion_violation then
        v_appt := null;
      end;
    end if;
  end loop;

  if v_appt.id is null then
    raise exception 'Este horário não está mais disponível. Escolha outro horário.' using errcode = 'P0001', hint = 'SLOT_UNAVAILABLE';
  end if;

  return json_build_object(
    'id', v_appt.id,
    'code', v_appt.code,
    'status', v_appt.status,
    'starts_at', v_appt.starts_at,
    'ends_at', v_appt.ends_at,
    'price', v_appt.price,
    'duration_minutes', v_appt.duration_minutes,
    'service_id', v_svc.id,
    'service_name', v_svc.name,
    'professional_id', v_appt.professional_id,
    'professional_name', (select name from public.professionals where id = v_appt.professional_id),
    'client_id', v_client,
    'client_name', (select name from public.clients where id = v_client),
    'client_whatsapp', v_phone
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- API pública: agendamento online (usuário anônimo)
-- -----------------------------------------------------------------------------
create or replace function public.book_appointment(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_client_name text,
  p_client_whatsapp text,
  p_professional_id uuid default null,
  p_notes text default null
)
returns json
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  return public._create_appointment(
    p_service_id, p_professional_id, p_starts_at, p_client_name, p_client_whatsapp, p_notes, 'online', false
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- API admin: criar agendamento manual. p_force = encaixe fora do expediente
-- (nunca permite sobreposição com outro atendimento ativo).
-- -----------------------------------------------------------------------------
create or replace function public.admin_create_appointment(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_client_name text,
  p_client_whatsapp text,
  p_professional_id uuid default null,
  p_notes text default null,
  p_force boolean default false
)
returns json
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if p_force and p_professional_id is null then
    raise exception 'Para encaixe, escolha o profissional.' using errcode = 'P0001', hint = 'INVALID_PROFESSIONAL';
  end if;
  return public._create_appointment(
    p_service_id, p_professional_id, p_starts_at, p_client_name, p_client_whatsapp, p_notes, 'admin', coalesce(p_force, false)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- API admin: reagendar (novo horário e/ou novo profissional)
-- -----------------------------------------------------------------------------
create or replace function public.admin_reschedule_appointment(
  p_appointment_id uuid,
  p_starts_at timestamptz,
  p_professional_id uuid default null,
  p_force boolean default false
)
returns json
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_appt public.appointments%rowtype;
  v_prof uuid;
  v_end  timestamptz;
  v_date date;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'Agendamento não encontrado.' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;
  if v_appt.status not in ('pending', 'confirmed') then
    raise exception 'Somente agendamentos pendentes ou confirmados podem ser reagendados.' using errcode = 'P0001', hint = 'INVALID_STATUS';
  end if;
  if p_starts_at is null then
    raise exception 'Escolha o novo horário.' using errcode = 'P0001', hint = 'INVALID_TIME';
  end if;

  v_prof := coalesce(p_professional_id, v_appt.professional_id);
  if not exists (
    select 1 from public.professionals p
      join public.professional_services ps on ps.professional_id = p.id
     where p.id = v_prof and p.active and ps.service_id = v_appt.service_id
  ) then
    raise exception 'Este profissional não realiza o serviço do agendamento.' using errcode = 'P0001', hint = 'INVALID_PROFESSIONAL';
  end if;

  v_end  := p_starts_at + make_interval(mins => v_appt.duration_minutes);
  v_date := (p_starts_at at time zone public.app_timezone())::date;

  perform pg_advisory_xact_lock(hashtextextended('prof:' || v_prof::text, 0));
  if not coalesce(p_force, false)
     and not (public._free_ranges(v_prof, v_date, v_appt.id) @> tstzrange(p_starts_at, v_end, '[)')) then
    raise exception 'O novo horário não está disponível.' using errcode = 'P0001', hint = 'SLOT_UNAVAILABLE';
  end if;

  begin
    update public.appointments
       set starts_at = p_starts_at, ends_at = v_end, professional_id = v_prof
     where id = v_appt.id
    returning * into v_appt;
  exception when exclusion_violation then
    raise exception 'O novo horário conflita com outro atendimento.' using errcode = 'P0001', hint = 'SLOT_UNAVAILABLE';
  end;

  return json_build_object('id', v_appt.id, 'code', v_appt.code, 'starts_at', v_appt.starts_at,
                           'ends_at', v_appt.ends_at, 'professional_id', v_appt.professional_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- API admin: indicadores do dashboard
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_stats(p_date date default null)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz   text := public.app_timezone();
  v_date date;
  v_from timestamptz;
  v_to   timestamptz;
  v_res  json;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  v_date := coalesce(p_date, (now() at time zone v_tz)::date);
  v_from := v_date::timestamp at time zone v_tz;
  v_to   := (v_date + 1)::timestamp at time zone v_tz;

  select json_build_object(
    'date', v_date,
    'total',            count(*) filter (where a.status <> 'cancelled'),
    'pending',          count(*) filter (where a.status = 'pending'),
    'confirmed',        count(*) filter (where a.status = 'confirmed'),
    'completed',        count(*) filter (where a.status = 'completed'),
    'cancelled',        count(*) filter (where a.status = 'cancelled'),
    'no_show',          count(*) filter (where a.status = 'no_show'),
    'expected_revenue', coalesce(sum(a.price) filter (where a.status in ('pending', 'confirmed', 'completed')), 0),
    'realized_revenue', coalesce(sum(a.price) filter (where a.status = 'completed'), 0),
    'clients_count',    (select count(*) from public.clients),
    'upcoming', coalesce((
      select json_agg(u order by u.starts_at) from (
        select a2.id, a2.code, a2.starts_at, a2.ends_at, a2.status, a2.price,
               c.name as client_name, c.whatsapp as client_whatsapp,
               p.name as professional_name, s.name as service_name
          from public.appointments a2
          join public.clients c on c.id = a2.client_id
          join public.professionals p on p.id = a2.professional_id
          join public.services s on s.id = a2.service_id
         where a2.status in ('pending', 'confirmed') and a2.ends_at >= now()
         order by a2.starts_at
         limit 8
      ) u
    ), '[]'::json),
    'top_services', coalesce((
      select json_agg(t) from (
        select s.name, count(*) as total
          from public.appointments a3
          join public.services s on s.id = a3.service_id
         where a3.status in ('confirmed', 'completed')
           and a3.starts_at >= now() - interval '30 days'
         group by s.name
         order by count(*) desc, s.name
         limit 5
      ) t
    ), '[]'::json)
  ) into v_res
  from public.appointments a
  where a.starts_at >= v_from and a.starts_at < v_to;

  return v_res;
end;
$$;

-- -----------------------------------------------------------------------------
-- API admin: relatórios por período
-- Faturamento realizado = somente atendimentos CONCLUÍDOS.
-- Faturamento previsto  = pendentes + confirmados.
-- -----------------------------------------------------------------------------
create or replace function public.report_data(
  p_from date,
  p_to date,
  p_group text default 'day'
)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz  text := public.app_timezone();
  v_res json;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Período inválido.' using errcode = 'P0001', hint = 'INVALID_PERIOD';
  end if;
  if p_to - p_from > 731 then
    raise exception 'Período máximo: 2 anos.' using errcode = 'P0001', hint = 'INVALID_PERIOD';
  end if;
  if p_group not in ('day', 'week', 'month') then
    p_group := 'day';
  end if;

  with a as (
    select ap.*, (ap.starts_at at time zone v_tz)::date as local_date,
           s.name as service_name, p.name as professional_name,
           c.name as client_name, c.whatsapp as client_whatsapp
      from public.appointments ap
      join public.services s on s.id = ap.service_id
      join public.professionals p on p.id = ap.professional_id
      join public.clients c on c.id = ap.client_id
     where ap.starts_at >= p_from::timestamp at time zone v_tz
       and ap.starts_at < (p_to + 1)::timestamp at time zone v_tz
  )
  select json_build_object(
    'from', p_from, 'to', p_to, 'group', p_group,
    'summary', (
      select json_build_object(
        'realized_revenue', coalesce(sum(price) filter (where status = 'completed'), 0),
        'forecast_revenue', coalesce(sum(price) filter (where status in ('pending', 'confirmed')), 0),
        'average_ticket',   coalesce(round(avg(price) filter (where status = 'completed'), 2), 0),
        'total',            count(*),
        'completed',        count(*) filter (where status = 'completed'),
        'confirmed',        count(*) filter (where status = 'confirmed'),
        'pending',          count(*) filter (where status = 'pending'),
        'cancelled',        count(*) filter (where status = 'cancelled'),
        'no_show',          count(*) filter (where status = 'no_show')
      ) from a
    ),
    'series', coalesce((
      select json_agg(x order by x.period) from (
        select date_trunc(p_group, local_date::timestamp)::date as period,
               coalesce(sum(price) filter (where status = 'completed'), 0) as realized,
               coalesce(sum(price) filter (where status in ('pending', 'confirmed')), 0) as forecast,
               count(*) filter (where status = 'completed') as completed,
               count(*) filter (where status <> 'cancelled') as appointments
          from a group by 1
      ) x
    ), '[]'::json),
    'services', coalesce((
      select json_agg(x) from (
        select service_name as name,
               count(*) filter (where status = 'completed') as completed,
               count(*) filter (where status <> 'cancelled') as booked,
               coalesce(sum(price) filter (where status = 'completed'), 0) as revenue
          from a group by service_name
         order by 2 desc, 3 desc, 1
         limit 10
      ) x
    ), '[]'::json),
    'professionals', coalesce((
      select json_agg(x) from (
        select professional_name as name,
               count(*) filter (where status = 'completed') as completed,
               count(*) filter (where status <> 'cancelled') as booked,
               coalesce(sum(price) filter (where status = 'completed'), 0) as revenue
          from a group by professional_name
         order by 2 desc, 3 desc, 1
         limit 10
      ) x
    ), '[]'::json),
    'clients', coalesce((
      select json_agg(x) from (
        select client_name as name, client_whatsapp as whatsapp,
               count(*) filter (where status = 'completed') as completed,
               count(*) filter (where status <> 'cancelled') as booked,
               coalesce(sum(price) filter (where status = 'completed'), 0) as revenue
          from a group by client_name, client_whatsapp
         order by 3 desc, 4 desc, 1
         limit 10
      ) x
    ), '[]'::json)
  ) into v_res;

  return v_res;
end;
$$;
