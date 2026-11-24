-- =============================================================================
-- BeautyAgenda — Transformar um usuário do Supabase Auth em ADMINISTRADOR
-- =============================================================================
-- 1) Crie o usuário em: Authentication > Users > Add user > Create new user
--    (marque "Auto Confirm User").
-- 2) Troque o e-mail abaixo pelo que você cadastrou e clique em RUN.
-- =============================================================================
insert into public.profiles (id, full_name, role)
select id, 'Administrador', 'admin'
from auth.users
where lower(email) = lower('COLOQUE-SEU-EMAIL-AQUI@exemplo.com')
on conflict (id) do update set role = 'admin';

-- Conferência: deve aparecer 1 linha com o seu e-mail
select u.email, p.role
from public.profiles p join auth.users u on u.id = p.id;
