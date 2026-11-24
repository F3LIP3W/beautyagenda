-- =============================================================================
-- BeautyAgenda — INSTALAÇÃO COMPLETA DO BANCO (cole tudo no SQL Editor e clique RUN)
-- Gerado a partir de supabase/migrations/*.sql. Pode ser executado novamente
-- com segurança (não apaga dados existentes).
-- =============================================================================

-- >>>>> 20261117000001_schema.sql
-- =============================================================================
-- BeautyAgenda — 001: Estrutura do banco (tabelas, restrições, índices, gatilhos)
-- =============================================================================
-- Convenções:
--   * Datas/horas de agendamento são gravadas em timestamptz (UTC internamente).
--   * Horários de expediente (time) são interpretados no fuso de business_settings
--     (padrão America/Sao_Paulo).
--   * weekday: 0 = domingo ... 6 = sábado (igual ao EXTRACT(DOW) do PostgreSQL).
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- -----------------------------------------------------------------------------
-- Função utilitária para manter updated_at
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. profiles — usuários do painel (somente administradores nesta versão)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default 'Administrador',
  role        text not null default 'admin' check (role in ('admin')),
  created_at  timestamptz not null default now()
);
comment on table public.profiles is 'Administradores do painel. Um usuário do Supabase Auth só acessa o painel se tiver linha aqui com role = admin.';

-- -----------------------------------------------------------------------------
-- 6. business_settings — configurações do estabelecimento (linha única id = 1)
-- -----------------------------------------------------------------------------
create table if not exists public.business_settings (
  id                     smallint primary key default 1 check (id = 1),
  name                   text not null default 'BeautyAgenda' check (char_length(btrim(name)) between 2 and 80),
  logo_url               text check (logo_url is null or char_length(logo_url) <= 500),
  phone                  text check (phone is null or char_length(phone) <= 30),
  whatsapp               text check (whatsapp is null or whatsapp ~ '^55[1-9]{2}[0-9]{8,9}$'),
  address                text check (address is null or char_length(address) <= 200),
  welcome_message        text check (welcome_message is null or char_length(welcome_message) <= 300),
  min_advance_minutes    integer not null default 60 check (min_advance_minutes between 0 and 10080),
  max_advance_days       integer not null default 60 check (max_advance_days between 1 and 365),
  slot_interval_minutes  integer not null default 30 check (slot_interval_minutes in (5, 10, 15, 20, 30, 45, 60)),
  auto_confirm           boolean not null default true,
  timezone               text not null default 'America/Sao_Paulo',
  updated_at             timestamptz not null default now()
);
comment on table public.business_settings is 'Configurações gerais. Sempre uma única linha (id = 1).';
comment on column public.business_settings.auto_confirm is 'true: agendamentos online entram como Confirmado. false: entram como Pendente até o administrador confirmar.';

-- -----------------------------------------------------------------------------
-- 7. working_hours — horário de funcionamento do estabelecimento por dia da semana
-- -----------------------------------------------------------------------------
create table if not exists public.working_hours (
  weekday      smallint primary key check (weekday between 0 and 6),
  is_open      boolean not null default true,
  open_time    time not null default '09:00',
  close_time   time not null default '19:00',
  break_start  time,
  break_end    time,
  constraint working_hours_order check (close_time > open_time),
  constraint working_hours_break_pair check ((break_start is null) = (break_end is null)),
  constraint working_hours_break_inside check (
    break_start is null or (break_start >= open_time and break_end <= close_time and break_end > break_start)
  )
);
comment on table public.working_hours is 'Expediente do estabelecimento. weekday 0 = domingo. break_* = intervalo geral (opcional).';

-- -----------------------------------------------------------------------------
-- 2. professionals
-- -----------------------------------------------------------------------------
create table if not exists public.professionals (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 2 and 80),
  phone        text check (phone is null or char_length(phone) <= 30),
  specialties  text check (specialties is null or char_length(specialties) <= 200),
  photo_url    text check (photo_url is null or char_length(photo_url) <= 500),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists professionals_active_idx on public.professionals (active);

-- -----------------------------------------------------------------------------
-- 3. services
-- -----------------------------------------------------------------------------
create table if not exists public.services (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(btrim(name)) between 2 and 80),
  category          text not null default 'Geral' check (char_length(btrim(category)) between 2 and 40),
  description       text check (description is null or char_length(description) <= 500),
  price             numeric(10, 2) not null check (price >= 0),
  duration_minutes  integer not null check (duration_minutes between 5 and 600),
  active            boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists services_active_idx on public.services (active, category, sort_order);

-- -----------------------------------------------------------------------------
-- 4. professional_services — quais serviços cada profissional realiza (N:N)
-- -----------------------------------------------------------------------------
create table if not exists public.professional_services (
  professional_id  uuid not null references public.professionals (id) on delete cascade,
  service_id       uuid not null references public.services (id) on delete cascade,
  primary key (professional_id, service_id)
);
create index if not exists professional_services_service_idx on public.professional_services (service_id);

-- -----------------------------------------------------------------------------
-- 8. professional_working_hours — jornada semanal de cada profissional
--    Sem linha (ou is_working = false) para um dia = folga semanal.
-- -----------------------------------------------------------------------------
create table if not exists public.professional_working_hours (
  professional_id  uuid not null references public.professionals (id) on delete cascade,
  weekday          smallint not null check (weekday between 0 and 6),
  is_working       boolean not null default true,
  start_time       time not null default '09:00',
  end_time         time not null default '18:00',
  break_start      time,
  break_end        time,
  primary key (professional_id, weekday),
  constraint pwh_order check (end_time > start_time),
  constraint pwh_break_pair check ((break_start is null) = (break_end is null)),
  constraint pwh_break_inside check (
    break_start is null or (break_start >= start_time and break_end <= end_time and break_end > break_start)
  )
);
comment on table public.professional_working_hours is 'Jornada semanal do profissional, com intervalo de almoço opcional. Dia sem linha = folga.';

-- -----------------------------------------------------------------------------
-- 10. time_blocks — bloqueios pontuais (folga em data específica, compromisso,
--     feriado). professional_id nulo = bloqueia o estabelecimento inteiro.
-- -----------------------------------------------------------------------------
create table if not exists public.time_blocks (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid references public.professionals (id) on delete cascade,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  reason           text check (reason is null or char_length(reason) <= 200),
  created_at       timestamptz not null default now(),
  constraint time_blocks_order check (ends_at > starts_at)
);
create index if not exists time_blocks_prof_idx on public.time_blocks (professional_id, starts_at);
create index if not exists time_blocks_range_idx on public.time_blocks using gist (tstzrange(starts_at, ends_at, '[)'));

-- -----------------------------------------------------------------------------
-- Extra: schedule_exceptions — exceções de horário em uma data
--   (ex.: abrir num domingo especial, fechar mais cedo na véspera de feriado).
--   professional_id nulo = vale para o estabelecimento.
--   Substitui o horário semanal naquela data.
-- -----------------------------------------------------------------------------
create table if not exists public.schedule_exceptions (
  id               uuid primary key default gen_random_uuid(),
  exception_date   date not null,
  professional_id  uuid references public.professionals (id) on delete cascade,
  is_closed        boolean not null default false,
  start_time       time,
  end_time         time,
  reason           text check (reason is null or char_length(reason) <= 200),
  created_at       timestamptz not null default now(),
  constraint schedule_exceptions_hours check (
    is_closed or (start_time is not null and end_time is not null and end_time > start_time)
  )
);
create unique index if not exists schedule_exceptions_unique_idx
  on public.schedule_exceptions (exception_date, coalesce(professional_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- -----------------------------------------------------------------------------
-- 5. clients — cadastrados automaticamente no agendamento
--    whatsapp normalizado: 55 + DDD + número (12 ou 13 dígitos)
-- -----------------------------------------------------------------------------
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 120),
  whatsapp    text not null unique check (whatsapp ~ '^55[1-9]{2}[0-9]{8,9}$'),
  notes       text check (notes is null or char_length(notes) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists clients_name_idx on public.clients (lower(name));

-- -----------------------------------------------------------------------------
-- 9. appointments
--    A restrição EXCLUDE garante, no próprio banco, que um profissional nunca
--    tenha dois atendimentos ativos sobrepostos — mesmo com requisições
--    simultâneas. Cancelado e "não compareceu" liberam o horário.
-- -----------------------------------------------------------------------------
create table if not exists public.appointments (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  client_id         uuid not null references public.clients (id) on delete restrict,
  professional_id   uuid not null references public.professionals (id) on delete restrict,
  service_id        uuid not null references public.services (id) on delete restrict,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  price             numeric(10, 2) not null check (price >= 0),
  duration_minutes  integer not null check (duration_minutes between 5 and 600),
  status            text not null default 'confirmed'
                    check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  source            text not null default 'online' check (source in ('online', 'admin')),
  notes             text check (notes is null or char_length(notes) <= 500),
  cancelled_at      timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint appointments_duration_match check (ends_at = starts_at + make_interval(mins => duration_minutes)),
  constraint appointments_no_overlap exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed', 'completed'))
);
comment on column public.appointments.price is 'Preço do serviço no momento do agendamento (histórico preservado se o preço mudar).';
comment on column public.appointments.code is 'Identificador curto e único exibido ao cliente (ex.: BA7K3QX2).';

create index if not exists appointments_starts_idx on public.appointments (starts_at);
create index if not exists appointments_prof_idx on public.appointments (professional_id, starts_at);
create index if not exists appointments_client_idx on public.appointments (client_id, starts_at desc);
create index if not exists appointments_status_idx on public.appointments (status, starts_at);

-- Carimbos automáticos de cancelamento/conclusão
create or replace function public.appointments_status_stamps()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.cancelled_at := case when new.status = 'cancelled' then coalesce(new.cancelled_at, now()) else null end;
    new.completed_at := case when new.status = 'completed' then coalesce(new.completed_at, now()) else null end;
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_status_stamps on public.appointments;
create trigger appointments_status_stamps before insert or update on public.appointments
  for each row execute function public.appointments_status_stamps();

-- updated_at
do $$
declare t text;
begin
  foreach t in array array['business_settings', 'professionals', 'services', 'clients', 'appointments'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end;
$$;

-- >>>>> 20261117000002_functions.sql
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

-- >>>>> 20261117000003_security.sql
-- =============================================================================
-- BeautyAgenda — 003: Segurança (RLS, permissões, views)
-- =============================================================================
-- Regras:
--   * Visitante anônimo: lê configurações públicas, horário de funcionamento e
--     serviços ativos. Agenda SOMENTE pela função book_appointment.
--     Não lê clientes, agendamentos, telefones de profissionais etc.
--   * Administrador (linha em profiles com role = admin): acesso total.
--   * Usuário autenticado que não é admin: nenhum acesso aos dados internos.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Views para o painel (security_invoker = respeitam o RLS de quem consulta)
-- -----------------------------------------------------------------------------
create or replace view public.appointment_details
with (security_invoker = true) as
select a.id, a.code, a.starts_at, a.ends_at, a.status, a.source, a.price, a.duration_minutes,
       a.notes, a.created_at, a.updated_at, a.cancelled_at, a.completed_at,
       a.client_id, c.name as client_name, c.whatsapp as client_whatsapp,
       a.professional_id, p.name as professional_name,
       a.service_id, s.name as service_name, s.category as service_category
  from public.appointments a
  join public.clients c on c.id = a.client_id
  join public.professionals p on p.id = a.professional_id
  join public.services s on s.id = a.service_id;

create or replace view public.client_overview
with (security_invoker = true) as
select c.id, c.name, c.whatsapp, c.notes, c.created_at, c.updated_at,
       count(a.id) filter (where a.status <> 'cancelled')                     as total_appointments,
       count(a.id) filter (where a.status = 'completed')                      as completed_appointments,
       coalesce(sum(a.price) filter (where a.status = 'completed'), 0)        as total_spent,
       max(a.starts_at) filter (where a.status = 'completed')                 as last_visit,
       min(a.starts_at) filter (where a.status in ('pending', 'confirmed') and a.starts_at >= now()) as next_appointment
  from public.clients c
  left join public.appointments a on a.client_id = c.id
 group by c.id;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles                   enable row level security;
alter table public.business_settings          enable row level security;
alter table public.working_hours              enable row level security;
alter table public.professionals              enable row level security;
alter table public.services                   enable row level security;
alter table public.professional_services      enable row level security;
alter table public.professional_working_hours enable row level security;
alter table public.time_blocks                enable row level security;
alter table public.schedule_exceptions        enable row level security;
alter table public.clients                    enable row level security;
alter table public.appointments               enable row level security;

-- Remove políticas antigas (permite reaplicar o arquivo)
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end;
$$;

-- profiles: cada usuário vê o próprio perfil; admin vê todos. Sem escrita pela API.
create policy profiles_select on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

-- business_settings: leitura pública, edição só admin
create policy settings_public_read on public.business_settings
  for select to anon, authenticated using (true);
create policy settings_admin_update on public.business_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- working_hours: leitura pública, escrita só admin
create policy working_hours_public_read on public.working_hours
  for select to anon, authenticated using (true);
create policy working_hours_admin_write on public.working_hours
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- services: público vê só ativos; admin vê e edita todos
create policy services_public_read on public.services
  for select to anon, authenticated using (active or public.is_admin());
create policy services_admin_write on public.services
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Tabelas exclusivas do administrador
do $$
declare t text;
begin
  foreach t in array array[
    'professionals', 'professional_services', 'professional_working_hours',
    'time_blocks', 'schedule_exceptions', 'clients', 'appointments'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin_all', t
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissões de tabela (defesa em profundidade além do RLS)
-- -----------------------------------------------------------------------------
-- Concessões explícitas (projetos novos do Supabase podem não concedê-las por padrão).
-- Quem decide o acesso linha a linha continua sendo o RLS acima.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

revoke all on all tables in schema public from anon;
grant select on public.business_settings, public.working_hours, public.services to anon;

revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;

revoke insert, delete on public.business_settings from authenticated;

revoke all on public.appointment_details, public.client_overview from anon;
grant select on public.appointment_details, public.client_overview to authenticated;

-- -----------------------------------------------------------------------------
-- Permissões de funções
-- O Supabase concede EXECUTE a anon/authenticated por padrão: revogamos tudo e
-- liberamos apenas o necessário.
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- Usadas pelas políticas RLS (precisam ser executáveis por quem consulta)
grant execute on function public.is_admin() to anon, authenticated;

-- API pública da página de agendamento
grant execute on function public.get_booking_catalog() to anon, authenticated;
grant execute on function public.get_available_slots(uuid, date, uuid, uuid) to anon, authenticated;
grant execute on function public.get_available_dates(uuid, date, date, uuid) to anon, authenticated;
grant execute on function public.book_appointment(uuid, timestamptz, text, text, uuid, text) to anon, authenticated;

-- API do painel (cada função verifica is_admin() internamente)
grant execute on function public.admin_create_appointment(uuid, timestamptz, text, text, uuid, text, boolean) to authenticated;
grant execute on function public.admin_reschedule_appointment(uuid, timestamptz, uuid, boolean) to authenticated;
grant execute on function public.dashboard_stats(date) to authenticated;
grant execute on function public.report_data(date, date, text) to authenticated;
grant execute on function public.normalize_whatsapp(text) to authenticated;

-- Funções de gatilho/internas continuam sem EXECUTE para a API:
-- _free_ranges, _professional_slots, _day_window, _create_appointment,
-- _new_appointment_code, app_timezone, set_updated_at, appointments_status_stamps

-- >>>>> 20261117000004_storage.sql
-- =============================================================================
-- BeautyAgenda — 004: Supabase Storage (fotos dos profissionais e logo)
-- =============================================================================
-- Bucket público para leitura (as imagens aparecem na página de agendamento).
-- Somente o administrador pode enviar, substituir ou apagar arquivos.
-- Limite: 2 MB por arquivo, apenas PNG, JPG e WEBP.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-assets', 'public-assets', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "beautyagenda_assets_admin_select" on storage.objects;
drop policy if exists "beautyagenda_assets_admin_insert" on storage.objects;
drop policy if exists "beautyagenda_assets_admin_update" on storage.objects;
drop policy if exists "beautyagenda_assets_admin_delete" on storage.objects;

create policy "beautyagenda_assets_admin_select" on storage.objects
  for select to authenticated using (bucket_id = 'public-assets' and public.is_admin());
create policy "beautyagenda_assets_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'public-assets' and public.is_admin());
create policy "beautyagenda_assets_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'public-assets' and public.is_admin())
  with check (bucket_id = 'public-assets' and public.is_admin());
create policy "beautyagenda_assets_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'public-assets' and public.is_admin());

-- >>>>> 20261117000005_initial_data.sql
-- =============================================================================
-- BeautyAgenda — 005: Dados iniciais (configurações, expediente, catálogo)
-- =============================================================================
-- Tudo aqui é editável pelo painel. Preços e durações são apenas valores
-- iniciais sugeridos — ajuste em Painel > Serviços.
-- Só insere se ainda não existir (pode ser executado mais de uma vez).
-- =============================================================================

insert into public.business_settings (id, name, welcome_message)
values (1, 'BeautyAgenda', 'Agende seu horário em poucos passos.')
on conflict (id) do nothing;

-- Expediente padrão: segunda a sábado, 09:00–19:00; domingo fechado
insert into public.working_hours (weekday, is_open, open_time, close_time) values
  (0, false, '09:00', '19:00'),
  (1, true,  '09:00', '19:00'),
  (2, true,  '09:00', '19:00'),
  (3, true,  '09:00', '19:00'),
  (4, true,  '09:00', '19:00'),
  (5, true,  '09:00', '19:00'),
  (6, true,  '09:00', '19:00')
on conflict (weekday) do nothing;

-- Catálogo inicial de serviços (somente se a tabela estiver vazia)
insert into public.services (name, category, description, price, duration_minutes, sort_order)
select v.name, v.category, v.description, v.price, v.duration, v.sort_order
from (values
  ('Corte masculino',  'Barbearia',       'Corte com máquina e/ou tesoura, finalização inclusa.', 45.00,  40, 1),
  ('Barba',            'Barbearia',       'Barba modelada com toalha quente.',                    35.00,  30, 2),
  ('Corte + barba',    'Barbearia',       'Combo de corte masculino e barba.',                    70.00,  60, 3),
  ('Sobrancelha',      'Barbearia',       'Design de sobrancelha na navalha ou pinça.',           20.00,  15, 4),
  ('Corte feminino',   'Cabelo feminino', 'Corte com lavagem e finalização.',                     80.00,  60, 1),
  ('Escova',           'Cabelo feminino', 'Escova modeladora.',                                    60.00,  45, 2),
  ('Hidratação',       'Cabelo feminino', 'Tratamento de hidratação profunda.',                    90.00,  60, 3),
  ('Tintura',          'Cabelo feminino', 'Coloração completa (raiz e comprimento).',              150.00, 120, 4),
  ('Progressiva',      'Cabelo feminino', 'Alisamento progressivo.',                               250.00, 180, 5),
  ('Manicure',         'Manicure',        'Cutilagem e esmaltação das mãos.',                     35.00,  45, 1),
  ('Pedicure',         'Manicure',        'Cutilagem e esmaltação dos pés.',                      40.00,  50, 2),
  ('Mão e pé',         'Manicure',        'Manicure e pedicure.',                                 70.00,  90, 3),
  ('Esmaltação',       'Manicure',        'Somente esmaltação (sem cutilagem).',                  20.00,  20, 4)
) as v(name, category, description, price, duration, sort_order)
where not exists (select 1 from public.services);
