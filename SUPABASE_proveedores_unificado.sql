-- ============================================================
-- BASE DE PROVEEDORES UNIFICADA
--
-- Hasta ahora cada módulo guardaba sus propios datos del proveedor:
--   · Centro de Control → nombre, CUIT, rubro, email, teléfono, dirección,
--     contacto, condición de pago, tipo
--   · Recorridos        → nombre, rubro, dirección, coordenadas del mapa,
--     horarios de atención, tiempo promedio de atención
--   · Comparativo       → localidad, días de entrega, notas
--
-- Este script agrega a la tabla compartida `proveedores` las columnas que
-- faltaban, para que los tres módulos trabajen sobre UNA sola ficha.
--
-- Ejecutar en Supabase → SQL Editor. Es idempotente: se puede correr
-- varias veces sin romper nada ni perder datos.
-- ============================================================

-- ── Ubicación en el mapa (la usa Recorridos para armar la ruta) ──
alter table public.proveedores add column if not exists lat            double precision;
alter table public.proveedores add column if not exists lng            double precision;

-- ── Atención (Recorridos: estimación de tiempos del recorrido) ──
alter table public.proveedores add column if not exists t_atencion     integer;   -- minutos promedio
alter table public.proveedores add column if not exists hm1            text;      -- mañana desde
alter table public.proveedores add column if not exists hm2            text;      -- mañana hasta
alter table public.proveedores add column if not exists ht1            text;      -- tarde desde
alter table public.proveedores add column if not exists ht2            text;      -- tarde hasta
alter table public.proveedores add column if not exists corrido        boolean;   -- horario corrido

-- ── Datos del Comparativo ──
alter table public.proveedores add column if not exists localidad      text;
alter table public.proveedores add column if not exists dias_entrega   text;
alter table public.proveedores add column if not exists notas          text;

-- ── Clasificación geográfica (Base de Datos del Centro de Control) ──
alter table public.proveedores add column if not exists ambito         text;      -- local | nacional | internacional
alter table public.proveedores add column if not exists geo_zona       text;      -- gsj | comunidades | noa | cuyo | ...
alter table public.proveedores add column if not exists geo_sub        text;      -- departamento / provincia / continente

-- ── Trazabilidad ──
alter table public.proveedores add column if not exists origen         text;      -- de dónde se cargó
alter table public.proveedores add column if not exists actualizado_en timestamptz default now();

-- Evita duplicados por nombre al sincronizar entre módulos
create unique index if not exists proveedores_nombre_uniq
  on public.proveedores (upper(trim(nombre)));

-- ── Verificación: ejecutar al final (sin el "--") ──
-- select column_name, data_type from information_schema.columns
--   where table_name = 'proveedores' order by ordinal_position;
