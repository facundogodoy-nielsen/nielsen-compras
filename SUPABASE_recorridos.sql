-- ============================================================
-- CONTROL DE RECORRIDOS (San Juan) — persistencia en Supabase
-- Guarda TODO en la nube (proveedores, vehículos, choferes, historial,
-- configuración) en un único registro JSON. Nada queda en el navegador.
--
-- Ejecutar en el Supabase de la SUITE DE COMPRAS → SQL Editor. Idempotente.
-- ============================================================

create table if not exists public.recorridos (
  id         text primary key,
  data       jsonb,
  updated_at timestamptz default now()
);

alter table public.recorridos enable row level security;

drop policy if exists "allow all" on public.recorridos;
create policy "allow all" on public.recorridos for all using (true) with check (true);
