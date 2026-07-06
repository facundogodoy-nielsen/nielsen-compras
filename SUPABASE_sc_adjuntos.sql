-- ============================================================
-- Adjuntos de la SC (Formulario SC → Centro de Control)
-- Asocia qué ítems tienen foto muestra / presupuesto y los links de Drive.
-- Ejecutar en Supabase → SQL Editor. Es idempotente.
-- ============================================================

alter table public.solicitudes_compra add column if not exists fotos_items      jsonb;   -- [0,2,3] índices de ítems con foto
alter table public.solicitudes_compra add column if not exists presup_items     jsonb;   -- [1,4]   índices de ítems con presupuesto
alter table public.solicitudes_compra add column if not exists drive_fotos_url  text;    -- carpeta Drive de fotos de esa SC
alter table public.solicitudes_compra add column if not exists drive_presup_url text;    -- carpeta Drive de presupuestos de esa SC
alter table public.solicitudes_compra add column if not exists fotos_map        jsonb;   -- { "0":[{name,url}], "2":[...] } link directo por ítem
alter table public.solicitudes_compra add column if not exists presup_map       jsonb;   -- { "1":[{name,url}] } link directo por ítem
