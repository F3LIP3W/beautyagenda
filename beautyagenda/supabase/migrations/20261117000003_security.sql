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
