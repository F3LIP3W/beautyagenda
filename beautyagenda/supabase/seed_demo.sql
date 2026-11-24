-- =============================================================================
-- BeautyAgenda — DADOS DE DEMONSTRAÇÃO (OPCIONAL)
-- =============================================================================
-- Cria 3 profissionais de exemplo (João, Maria e Ana) com jornada de
-- segunda a sábado, 09:00–19:00, almoço 12:00–13:00, e associa cada um aos
-- serviços da sua categoria. Use para testar o sistema; depois edite ou
-- desative pelo painel. NÃO cria clientes nem agendamentos fictícios.
-- =============================================================================

do $$
declare
  v_joao  uuid;
  v_maria uuid;
  v_ana   uuid;
  d       int;
begin
  if exists (select 1 from public.professionals) then
    raise notice 'Já existem profissionais cadastrados — demonstração não aplicada.';
    return;
  end if;

  insert into public.professionals (name, specialties) values ('João', 'Barbeiro') returning id into v_joao;
  insert into public.professionals (name, specialties) values ('Maria', 'Cabeleireira') returning id into v_maria;
  insert into public.professionals (name, specialties) values ('Ana', 'Manicure') returning id into v_ana;

  insert into public.professional_services (professional_id, service_id)
  select v_joao, id from public.services where category = 'Barbearia'
  union all
  select v_maria, id from public.services where category = 'Cabelo feminino'
  union all
  select v_ana, id from public.services where category = 'Manicure';

  for d in 1..6 loop
    insert into public.professional_working_hours (professional_id, weekday, is_working, start_time, end_time, break_start, break_end)
    values (v_joao, d, true, '09:00', '19:00', '12:00', '13:00'),
           (v_maria, d, true, '09:00', '19:00', '12:00', '13:00'),
           (v_ana, d, true, '09:00', '19:00', '12:00', '13:00');
  end loop;
end;
$$;
