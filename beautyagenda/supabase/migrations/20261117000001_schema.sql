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
