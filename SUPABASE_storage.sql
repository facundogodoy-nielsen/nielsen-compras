-- ============================================================
-- SUPABASE STORAGE — almacenamiento de archivos del sistema Nielsen
-- Reemplaza el guardado en Google Drive por Supabase Storage.
--
-- Estructura dentro del bucket «nielsen-archivos»:
--   sc/<N° SC>/fotos/archivo.jpg
--   sc/<N° SC>/presupuestos/archivo.pdf
--   comparativo/<N° CCP>/archivo.jpg
--   proyectos/<N° PR>/archivo.pdf
--
-- Ejecutar en Supabase → SQL Editor. Idempotente.
-- ============================================================

-- 1) Crear el bucket público (lectura por link; escritura vía anon key)
insert into storage.buckets (id, name, public)
values ('nielsen-archivos', 'nielsen-archivos', true)
on conflict (id) do update set public = true;

-- 2) Políticas de acceso para el rol anónimo (la app usa la anon key)
--    Lectura pública, y subida/actualización/borrado permitidos para la app.
drop policy if exists "nielsen_arch_read"   on storage.objects;
drop policy if exists "nielsen_arch_insert" on storage.objects;
drop policy if exists "nielsen_arch_update" on storage.objects;
drop policy if exists "nielsen_arch_delete" on storage.objects;

create policy "nielsen_arch_read"   on storage.objects for select using  (bucket_id = 'nielsen-archivos');
create policy "nielsen_arch_insert" on storage.objects for insert with check (bucket_id = 'nielsen-archivos');
create policy "nielsen_arch_update" on storage.objects for update using  (bucket_id = 'nielsen-archivos') with check (bucket_id = 'nielsen-archivos');
create policy "nielsen_arch_delete" on storage.objects for delete using  (bucket_id = 'nielsen-archivos');

-- 3) Columnas donde se guardan los mapas ítem→archivos (por si faltaran)
alter table public.solicitudes_compra add column if not exists fotos_map        jsonb;
alter table public.solicitudes_compra add column if not exists presup_map        jsonb;
alter table public.comparativas       add column if not exists fotos_map         jsonb;
alter table public.proyectos          add column if not exists planos_urls       jsonb;   -- [{name,url}]
