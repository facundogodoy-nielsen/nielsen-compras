-- ============================================================
-- CONTROL DE RECORRIDOS — una fila POR recorrido (evita sobreescritura)
--
-- PROBLEMA que resuelve: antes TODO el historial se guardaba en una sola
-- fila JSON. Si dos dispositivos guardaban, el último pisaba al otro y se
-- perdían recorridos. Ahora cada recorrido es su propia fila: guardar uno
-- nuevo es un INSERT, nunca reemplaza a los demás.
--
-- La tabla 'recorridos' (fila única) se sigue usando SOLO para la
-- configuración compartida: vehículos, choferes, proveedores, base, cfg.
--
-- Ejecutar en el Supabase de la SUITE DE COMPRAS → SQL Editor. Idempotente.
-- ============================================================

create table if not exists public.recorridos_items (
  id         text primary key,          -- id del recorrido (uid del front)
  codigo     text,                      -- RC-2026-####
  fecha      text,                      -- fecha del recorrido (yyyy-mm-dd)
  data       jsonb,                     -- el recorrido completo
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists recorridos_items_fecha_idx on public.recorridos_items (fecha);
create index if not exists recorridos_items_codigo_idx on public.recorridos_items (codigo);

alter table public.recorridos_items enable row level security;

drop policy if exists "allow all" on public.recorridos_items;
create policy "allow all" on public.recorridos_items for all using (true) with check (true);
