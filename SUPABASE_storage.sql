-- ============================================================
-- SUPABASE STORAGE — depósito de archivos del sistema Nielsen
-- (fotos de muestra y presupuestos de las Solicitudes de Compra)
--
-- ⚠️ IMPORTANTE — LEER ANTES DE EJECUTAR
-- El SQL Editor de Supabase corre TODO el script como UNA SOLA
-- transacción: si UNA línea falla, se revierte TODO (incluida la
-- creación del depósito). Por eso este archivo está dividido en
-- PASOS: ejecutá UN PASO POR VEZ (seleccionás el bloque y Run).
--
-- ✅ FORMA MÁS SEGURA de crear el depósito: hacerlo desde la
--    pantalla de Supabase, sin SQL:
--      Storage → New bucket
--        Name:   nielsen-archivos
--        Public bucket: ACTIVADO
--      → Save
--    Y después ejecutar acá solamente el PASO 2 y el PASO 3.
--
-- Estructura de carpetas dentro del depósito:
--   sc/<N° SC>/fotos/archivo.jpg
--   sc/<N° SC>/presupuestos/archivo.pdf
--   comparativo/<N° CCP>/archivo.jpg
--   proyectos/<N° PR>/archivo.pdf
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- PASO 1 — Crear el depósito (bucket) público
-- Seleccioná SOLO estas líneas y tocá Run.
-- Si da error de permisos, crealo desde Storage → New bucket
-- (nombre: nielsen-archivos, con "Public bucket" activado).
-- ════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('nielsen-archivos', 'nielsen-archivos', true)
on conflict (id) do update set public = true;


-- ════════════════════════════════════════════════════════════
-- PASO 2 — Permisos para que la app pueda subir y leer archivos
-- Seleccioná SOLO estas líneas y tocá Run.
--
-- Si diera el error «must be owner of table objects», NO insistas
-- con el SQL: cargá los permisos desde la pantalla de Supabase, en
--   Storage → Policies → nielsen-archivos → New policy
--     → "For full customization"
--     → Allowed operations: SELECT, INSERT, UPDATE, DELETE
--     → Target roles: anon, authenticated
--     → Policy definition:  bucket_id = 'nielsen-archivos'
-- ════════════════════════════════════════════════════════════

drop policy if exists "nielsen_arch_read"   on storage.objects;
drop policy if exists "nielsen_arch_insert" on storage.objects;
drop policy if exists "nielsen_arch_update" on storage.objects;
drop policy if exists "nielsen_arch_delete" on storage.objects;

create policy "nielsen_arch_read"   on storage.objects for select using  (bucket_id = 'nielsen-archivos');
create policy "nielsen_arch_insert" on storage.objects for insert with check (bucket_id = 'nielsen-archivos');
create policy "nielsen_arch_update" on storage.objects for update using  (bucket_id = 'nielsen-archivos') with check (bucket_id = 'nielsen-archivos');
create policy "nielsen_arch_delete" on storage.objects for delete using  (bucket_id = 'nielsen-archivos');


-- ════════════════════════════════════════════════════════════
-- PASO 3 — Columnas donde se guardan los enlaces de los archivos
-- Seleccioná SOLO estas líneas y tocá Run.
-- (Independiente: no toca Storage, solo tablas propias.)
-- ════════════════════════════════════════════════════════════

alter table public.solicitudes_compra add column if not exists fotos_map   jsonb;
alter table public.solicitudes_compra add column if not exists presup_map  jsonb;
alter table public.comparativas       add column if not exists fotos_map   jsonb;
alter table public.proyectos          add column if not exists planos_urls jsonb;   -- [{name,url}]


-- ════════════════════════════════════════════════════════════
-- VERIFICACIÓN — ejecutá esta línea al final (sin el "--")
-- Debe devolver una fila con public = true
-- ════════════════════════════════════════════════════════════

-- select id, name, public from storage.buckets where id = 'nielsen-archivos';
