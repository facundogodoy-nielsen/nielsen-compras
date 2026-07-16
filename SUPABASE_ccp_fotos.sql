-- ============================================================
-- Fotos por ítem en Comparativo (CCP)
-- Guarda el mapa ítem→fotos y el link de la carpeta de Drive.
-- Ejecutar en Supabase → SQL Editor. Idempotente.
-- ============================================================

alter table public.comparativas add column if not exists fotos_map        jsonb;   -- { "0":[{name,url}], "2":[...] }
alter table public.comparativas add column if not exists drive_fotos_url   text;    -- carpeta COMPARATIVO/CCP-aaaa-xxxx
