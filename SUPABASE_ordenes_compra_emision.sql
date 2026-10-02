-- ============================================================
-- EMISIÓN DE ÓRDENES DE COMPRA: ORIGINAL, DUPLICADO Y TRIPLICADO
-- y autorización por correo de órdenes que requieren nueva firma.
-- Ejecutar en Supabase → SQL Editor (después de SUPABASE_ordenes_compra.sql). Idempotente.
-- ============================================================

-- Control de copias: 0 = sin emitir · 1 = ORIGINAL · 2 = DUPLICADO · 3 = TRIPLICADO
alter table public.ordenes_compra add column if not exists copias_emitidas integer default 0;
alter table public.ordenes_compra add column if not exists emisiones       jsonb   default '[]'::jsonb;  -- [{copia, fecha, por, motivo}]
alter table public.ordenes_compra add column if not exists fecha_emision   timestamptz;

-- Límite duro en la base: nunca más de tres emisiones, aunque se intente saltear la pantalla
alter table public.ordenes_compra drop constraint if exists oc_copias_max;
alter table public.ordenes_compra add  constraint oc_copias_max check (copias_emitidas between 0 and 3);

-- Datos del proveedor que viajan en el documento
alter table public.ordenes_compra add column if not exists proveedor_contacto text;
alter table public.ordenes_compra add column if not exists proveedor_email    text;
alter table public.ordenes_compra add column if not exists proveedor_tel      text;
alter table public.ordenes_compra add column if not exists flete              numeric(16,2);

-- Autorización por correo (los mismos campos que usan las comparativas)
alter table public.ordenes_compra add column if not exists estado_autorizacion text;
alter table public.ordenes_compra add column if not exists aprob_requeridas    integer;
alter table public.ordenes_compra add column if not exists aprob_contadas      integer default 0;
alter table public.ordenes_compra add column if not exists solicitado_en       timestamptz;
alter table public.ordenes_compra add column if not exists rechazado_por       text;
alter table public.ordenes_compra add column if not exists rechazo_motivo      text;
alter table public.ordenes_compra add column if not exists recordar_el         date;

-- Verificación:
-- select num_oc, estado, estado_aut, copias_emitidas, emisiones from public.ordenes_compra order by fecha desc limit 10;
