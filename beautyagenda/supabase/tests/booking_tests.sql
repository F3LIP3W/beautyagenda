-- =============================================================================
-- BeautyAgenda — Testes do banco (disponibilidade, conflitos, RLS, permissões)
-- =============================================================================
-- Como usar: cole tudo no SQL Editor do Supabase e clique em RUN.
-- Tudo roda dentro de uma transação e é DESFEITO no final (ROLLBACK):
-- nenhum dado fica gravado. Cada verificação aprovada aparece como
-- "OK: ..." nas mensagens; qualquer falha interrompe com "FALHOU: ...".
-- Requisitos: migrações aplicadas e um administrador já criado (profiles).
-- =============================================================================

begin;

-- ---------------------------------------------------------------- preparação
do $$
declare
  v_admin uuid;
  v_day   date := (now() at time zone 'America/Sao_Paulo')::date + 2;
  v_p1 uuid; v_p2 uuid; v_svc uuid; d int;
begin
  select id into v_admin from public.profiles where role = 'admin' limit 1;
  if v_admin is null then
    raise exception 'FALHOU: crie o primeiro administrador antes de rodar os testes (veja o README).';
  end if;
  while extract(dow from v_day) = 0 loop v_day := v_day + 1; end loop;   -- evita domingo

  -- Configuração previsível para o teste (desfeita no rollback)
  update public.business_settings set slot_interval_minutes = 30, min_advance_minutes = 60,
         max_advance_days = 60, auto_confirm = true, timezone = 'America/Sao_Paulo' where id = 1;
  delete from public.schedule_exceptions;
  delete from public.time_blocks;
  update public.working_hours set is_open = true, open_time = '09:00', close_time = '19:00',
         break_start = null, break_end = null where weekday = extract(dow from v_day);

  insert into public.services (name, category, price, duration_minutes)
       values ('TESTE Corte 40', 'Teste', 50, 40) returning id into v_svc;
  insert into public.professionals (name) values ('TESTE Prof A') returning id into v_p1;
  insert into public.professionals (name) values ('TESTE Prof B') returning id into v_p2;
  insert into public.professional_services values (v_p1, v_svc), (v_p2, v_svc);
  for d in 0..6 loop
    insert into public.professional_working_hours (professional_id, weekday, start_time, end_time, break_start, break_end)
    values (v_p1, d, '09:00', '18:00', '12:00', '13:00'),
           (v_p2, d, '10:00', '18:00', null, null);
  end loop;

  perform set_config('t.admin', v_admin::text, true);
  perform set_config('t.day', v_day::text, true);
  perform set_config('t.svc', v_svc::text, true);
  perform set_config('t.p1', v_p1::text, true);
  perform set_config('t.p2', v_p2::text, true);
  raise notice 'OK: preparação (dia de teste %)', to_char(v_day, 'DD/MM/YYYY');
end $$;

-- ---------------------------------------------------- normalização WhatsApp
do $$
begin
  assert public.normalize_whatsapp('(11) 98888-7777') = '5511988887777', 'celular com DDD';
  assert public.normalize_whatsapp('+55 11 98888-7777') = '5511988887777', 'com DDI';
  assert public.normalize_whatsapp('011 3333-4444') = '551133334444', 'fixo com 0';
  assert public.normalize_whatsapp('12345') is null, 'curto';
  assert public.normalize_whatsapp('11 88888-7777') is null, 'celular 9 dígitos sem 9 inicial';
  raise notice 'OK: normalização de WhatsApp';
end $$;

-- ======================================================= VISITANTE ANÔNIMO
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
declare n int; ok boolean;
begin
  select count(*) into n from public.services;
  assert n > 0, 'anon deve ver serviços ativos';

  ok := false;
  begin perform 1 from public.clients limit 1; exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon NÃO pode ler clientes';

  ok := false;
  begin perform 1 from public.appointments limit 1; exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon NÃO pode ler agendamentos';

  ok := false;
  begin perform 1 from public.professionals limit 1; exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon NÃO pode ler a tabela de profissionais (telefones)';

  ok := false;
  begin perform public.dashboard_stats(null); exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon NÃO pode chamar dashboard_stats';

  ok := false;
  begin perform public._create_appointment(null, null, null, null, null, null, 'admin', true);
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon NÃO pode chamar a função interna _create_appointment';

  ok := false;
  begin update public.services set price = 0; exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon NÃO pode alterar serviços';

  assert (public.get_booking_catalog() -> 'professionals') is not null, 'catálogo público';
  assert ((public.get_booking_catalog() -> 'professionals')::text not like '%"phone"%'), 'catálogo não expõe telefones de profissionais';
  raise notice 'OK: permissões do visitante anônimo';
end $$;

-- Disponibilidade: Prof A 09–18 com almoço 12–13; serviço de 40 min
do $$
declare
  v_day date := current_setting('t.day')::date;
  v_svc uuid := current_setting('t.svc')::uuid;
  v_p1  uuid := current_setting('t.p1')::uuid;
  labels text[];
begin
  select array_agg(slot_label order by slot_start) into labels
    from public.get_available_slots(v_svc, v_day, v_p1);
  assert labels[1] = '09:00', 'primeiro horário 09:00, obtido ' || coalesce(labels[1], 'nenhum');
  assert '11:00' = any(labels), '11:00 cabe antes do almoço (termina 11:40)';
  assert not ('11:30' = any(labels)), '11:30 invadiria o almoço';
  assert not ('12:00' = any(labels)) and not ('12:30' = any(labels)), 'almoço bloqueado';
  assert '13:00' = any(labels), '13:00 disponível após almoço';
  assert not ('17:30' = any(labels)), '17:30 ultrapassaria 18:00';
  assert '17:00' = any(labels), '17:00 termina 17:40';
  raise notice 'OK: horários respeitam jornada, almoço e duração';
end $$;

-- Agendamento público com profissional específico
do $$
declare
  v_day date := current_setting('t.day')::date;
  v_res json;
  v_start timestamptz := (v_day + time '09:00') at time zone 'America/Sao_Paulo';
  labels text[];
begin
  v_res := public.book_appointment(current_setting('t.svc')::uuid, v_start, 'Cliente Teste Um', '(11) 97777-0001',
                                   current_setting('t.p1')::uuid, null);
  assert v_res->>'code' like 'BA%', 'código gerado';
  assert v_res->>'status' = 'confirmed', 'status confirmado';
  perform set_config('t.appt1', v_res->>'id', true);

  select array_agg(slot_label order by slot_start) into labels
    from public.get_available_slots(current_setting('t.svc')::uuid, v_day, current_setting('t.p1')::uuid);
  assert not ('09:00' = any(labels)) and not ('09:30' = any(labels)), 'horário ocupado sumiu (60 min completos considerados)';
  assert '09:40' = any(labels), 'próximo horário logo após o término (09:40)';
  raise notice 'OK: agendamento público com profissional específico (%)', v_res->>'code';
end $$;

-- Conflito: outro cliente no mesmo horário/profissional
do $$
declare ok boolean := false;
begin
  begin
    perform public.book_appointment(current_setting('t.svc')::uuid,
      (current_setting('t.day')::date + time '09:20') at time zone 'America/Sao_Paulo',
      'Cliente Teste Dois', '11977770002', current_setting('t.p1')::uuid, null);
  exception when others then ok := sqlerrm like '%não está mais disponível%'; end;
  assert ok, 'deveria recusar horário sobreposto';
  raise notice 'OK: impede agendamento conflitante para o mesmo profissional';
end $$;

-- Duplicidade: mesmo cliente, mesmo horário, "qualquer profissional"
do $$
declare ok boolean := false;
begin
  begin
    perform public.book_appointment(current_setting('t.svc')::uuid,
      (current_setting('t.day')::date + time '09:00') at time zone 'America/Sao_Paulo',
      'Cliente Teste Um', '11 97777-0001', null, null);
  exception when others then ok := sqlerrm like '%Já existe um agendamento%'; end;
  assert ok, 'deveria recusar duplicidade do mesmo cliente';
  raise notice 'OK: impede agendamento duplicado do mesmo cliente';
end $$;

-- "Qualquer profissional": 10:00 com Prof A ocupado → vai para Prof B
do $$
declare v_res json; v_res2 json; ok boolean := false;
begin
  v_res := public.book_appointment(current_setting('t.svc')::uuid,
    (current_setting('t.day')::date + time '10:00') at time zone 'America/Sao_Paulo',
    'Cliente Teste Três', '11977770003', current_setting('t.p1')::uuid, null);
  v_res2 := public.book_appointment(current_setting('t.svc')::uuid,
    (current_setting('t.day')::date + time '10:00') at time zone 'America/Sao_Paulo',
    'Cliente Teste Quatro', '11977770004', null, null);
  assert (v_res2->>'professional_id')::uuid = current_setting('t.p2')::uuid, 'deveria escolher o Prof B';
  begin
    perform public.book_appointment(current_setting('t.svc')::uuid,
      (current_setting('t.day')::date + time '10:00') at time zone 'America/Sao_Paulo',
      'Cliente Teste Cinco', '11977770005', null, null);
  exception when others then ok := sqlerrm like '%não está mais disponível%'; end;
  assert ok, 'sem profissionais livres deveria recusar';
  raise notice 'OK: "qualquer profissional disponível" escolhe outro profissional livre';
end $$;

-- Validações de entrada
do $$
declare ok boolean;
begin
  ok := false;
  begin perform public.book_appointment(current_setting('t.svc')::uuid, now() + interval '3 days', 'X', '11977770009', null, null);
  exception when others then ok := sqlerrm like '%nome%'; end;
  assert ok, 'nome curto';
  ok := false;
  begin perform public.book_appointment(current_setting('t.svc')::uuid, now() + interval '3 days', 'Nome Ok', '123', null, null);
  exception when others then ok := sqlerrm like '%WhatsApp inválido%'; end;
  assert ok, 'telefone inválido';
  ok := false;
  begin perform public.book_appointment(current_setting('t.svc')::uuid, now() + interval '10 minutes', 'Nome Ok', '11977770009', null, null);
  exception when others then ok := sqlerrm like '%não está mais disponível%'; end;
  assert ok, 'antecedência mínima';
  ok := false;
  begin perform public.book_appointment(current_setting('t.svc')::uuid, now() - interval '1 day', 'Nome Ok', '11977770009', null, null);
  exception when others then ok := true; end;
  assert ok, 'data passada';
  raise notice 'OK: validação de nome, WhatsApp, antecedência e datas passadas';
end $$;

-- ============================================ AUTENTICADO SEM PERFIL ADMIN
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000aa","role":"authenticated"}', true);
do $$
declare n int; ok boolean := false;
begin
  select count(*) into n from public.appointments;
  assert n = 0, 'usuário comum não vê agendamentos';
  select count(*) into n from public.clients;
  assert n = 0, 'usuário comum não vê clientes';
  begin perform public.dashboard_stats(null); exception when others then ok := sqlerrm like '%Acesso negado%'; end;
  assert ok, 'usuário comum não acessa dashboard';
  raise notice 'OK: usuário autenticado sem perfil admin não acessa dados';
end $$;

-- ============================================================ ADMINISTRADOR
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('t.admin'), 'role', 'authenticated')::text, true);

do $$
declare n int;
begin
  assert public.is_admin(), 'admin reconhecido';
  select count(*) into n from public.appointment_details where professional_name like 'TESTE%';
  assert n = 3, 'admin vê os 3 agendamentos de teste, viu ' || n;
  raise notice 'OK: administrador vê todos os agendamentos';
end $$;

-- Bloqueio de horário
do $$
declare labels text[]; v_day date := current_setting('t.day')::date;
begin
  insert into public.time_blocks (professional_id, starts_at, ends_at, reason)
  values (current_setting('t.p1')::uuid, (v_day + time '14:00') at time zone 'America/Sao_Paulo',
          (v_day + time '16:00') at time zone 'America/Sao_Paulo', 'Teste');
  select array_agg(slot_label order by slot_start) into labels
    from public.get_available_slots(current_setting('t.svc')::uuid, v_day, current_setting('t.p1')::uuid);
  assert not ('14:00' = any(labels)) and not ('15:30' = any(labels)) and not ('13:30' = any(labels)),
    'bloqueio 14–16 respeitado (13:30 terminaria 14:10)';
  assert '16:00' = any(labels), '16:00 liberado após bloqueio';
  raise notice 'OK: bloqueio de horário';
end $$;

-- Exceção: estabelecimento fechado na data
do $$
declare n int;
begin
  insert into public.schedule_exceptions (exception_date, is_closed, reason)
  values (current_setting('t.day')::date, true, 'Teste fechado');
  select count(*) into n from public.get_available_slots(current_setting('t.svc')::uuid, current_setting('t.day')::date, null);
  assert n = 0, 'dia fechado não tem horários';
  delete from public.schedule_exceptions where reason = 'Teste fechado';
  raise notice 'OK: exceção de horário (dia fechado)';
end $$;

-- Cancelamento libera horário
do $$
declare labels text[];
begin
  update public.appointments set status = 'cancelled' where id = current_setting('t.appt1')::uuid;
  assert (select cancelled_at from public.appointments where id = current_setting('t.appt1')::uuid) is not null, 'cancelled_at preenchido';
  select array_agg(slot_label) into labels
    from public.get_available_slots(current_setting('t.svc')::uuid, current_setting('t.day')::date, current_setting('t.p1')::uuid);
  assert '09:00' = any(labels), '09:00 voltou a ficar livre';
  raise notice 'OK: cancelamento libera o horário';
end $$;

-- Restrição EXCLUDE: inserção direta sobreposta é barrada pelo banco
do $$
declare ok boolean := false; r record;
begin
  select * into r from public.appointments where professional_id = current_setting('t.p1')::uuid and status = 'confirmed' limit 1;
  begin
    insert into public.appointments (code, client_id, professional_id, service_id, starts_at, ends_at, price, duration_minutes)
    values ('BATESTE1', r.client_id, r.professional_id, r.service_id, r.starts_at + interval '10 minutes',
            r.ends_at + interval '10 minutes', 0, r.duration_minutes);
  exception when exclusion_violation then ok := true; end;
  assert ok, 'EXCLUDE deveria impedir sobreposição';
  raise notice 'OK: restrição no banco impede sobreposição mesmo fora das funções';
end $$;

-- Reagendamento e agendamento manual
do $$
declare v_res json; v_id uuid; ok boolean := false;
begin
  select id into v_id from public.appointments where professional_id = current_setting('t.p2')::uuid and status = 'confirmed' limit 1;
  v_res := public.admin_reschedule_appointment(v_id, (current_setting('t.day')::date + time '15:00') at time zone 'America/Sao_Paulo', null, false);
  assert (v_res->>'starts_at')::timestamptz = (current_setting('t.day')::date + time '15:00') at time zone 'America/Sao_Paulo', 'reagendado';
  begin
    perform public.admin_reschedule_appointment(v_id, (current_setting('t.day')::date + time '14:30') at time zone 'America/Sao_Paulo',
                                                current_setting('t.p1')::uuid, false);
  exception when others then ok := sqlerrm like '%não está disponível%'; end;
  assert ok, 'reagendar para horário bloqueado deve falhar';

  v_res := public.admin_create_appointment(current_setting('t.svc')::uuid,
    (current_setting('t.day')::date + time '18:30') at time zone 'America/Sao_Paulo',
    'Cliente Encaixe', '11977770010', current_setting('t.p1')::uuid, 'encaixe após expediente', true);
  assert v_res->>'code' is not null, 'encaixe manual criado';
  raise notice 'OK: reagendamento e agendamento manual (encaixe)';
end $$;

-- Relatório: só concluídos contam como faturamento realizado
do $$
declare v_rep json; v_id uuid;
begin
  select id into v_id from public.appointments where professional_id = current_setting('t.p2')::uuid and status = 'confirmed' limit 1;
  update public.appointments set status = 'completed' where id = v_id;
  v_rep := public.report_data(current_setting('t.day')::date, current_setting('t.day')::date, 'day');
  assert (v_rep->'summary'->>'realized_revenue')::numeric >= 50, 'faturamento realizado inclui o concluído';
  assert (v_rep->'summary'->>'forecast_revenue')::numeric >= 50, 'previsto inclui confirmados';
  assert json_array_length(v_rep->'services') >= 1, 'ranking de serviços';
  assert (public.dashboard_stats(current_setting('t.day')::date)->>'total')::int >= 1, 'dashboard';
  raise notice 'OK: relatórios e dashboard';
end $$;

-- Histórico do cliente
do $$
declare r record;
begin
  select * into r from public.client_overview where whatsapp = '5511977770004';
  assert r.completed_appointments = 1 and r.last_visit is not null, 'histórico do cliente';
  raise notice 'OK: histórico do cliente (atendimentos e último atendimento)';
end $$;

reset role;
do $$ begin raise notice '=== TODOS OS TESTES PASSARAM (nada foi gravado: rollback) ==='; end $$;
rollback;
