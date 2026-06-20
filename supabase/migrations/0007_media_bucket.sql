-- Bucket público para mídia das conversas (recebida e enviada).
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Leitura pública dos arquivos de mídia.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'media_public_read'
  ) then
    create policy "media_public_read" on storage.objects
      for select using (bucket_id = 'media');
  end if;
end $$;
