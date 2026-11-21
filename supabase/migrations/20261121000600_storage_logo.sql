-- =====================================================================
-- Fase 2 — Storage: bucket público (somente leitura) para a logomarca do evento
-- PNG/SVG/JPG até 2 MB. Upload/remoção apenas pelo Administrador do Polo.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/svg+xml', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy logos_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and (select public.is_polo_admin()));
create policy logos_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'logos' and (select public.is_polo_admin()))
  with check (bucket_id = 'logos' and (select public.is_polo_admin()));
create policy logos_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and (select public.is_polo_admin()));
