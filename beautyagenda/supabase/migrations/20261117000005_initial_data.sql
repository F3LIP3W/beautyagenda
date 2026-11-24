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
