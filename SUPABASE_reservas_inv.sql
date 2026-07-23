-- ============================================================
-- Reservas de Pañol (Central de Depósitos) vinculadas a una SC
-- Guarda en la SC el resumen de artículos reservados en Nielsen Inventario.
-- (La reserva completa vive en el Supabase del inventario, tabla «inventario»,
--  dentro de data.reservas, con scNumero = N° de la SC.)
-- Ejecutar en el Supabase de la SUITE DE COMPRAS → SQL Editor. Idempotente.
-- ============================================================

alter table public.solicitudes_compra add column if not exists reservas_inv jsonb;  -- [{nombre,cantidad,unidad}]
