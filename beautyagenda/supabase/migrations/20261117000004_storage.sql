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
