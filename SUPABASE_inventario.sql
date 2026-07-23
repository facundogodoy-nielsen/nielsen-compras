-- ============================================================
-- INVENTARIO (Central de Depósitos) en el Supabase de la SUITE
-- Crea la tabla que hoy vive en el Supabase separado del inventario,
-- para unificar todo en una sola base.
--
-- Ejecutar en el Supabase de la SUITE DE COMPRAS (qivvewvgqlsptydftlhx)
-- → SQL Editor. Idempotente: no borra nada si ya existe.
-- ============================================================

create table if not exists public.inventario (
  id         text primary key,
  data       jsonb,
  updated_at timestamptz default now()
);

alter table public.inventario enable row level security;

drop policy if exists "allow all" on public.inventario;
create policy "allow all" on public.inventario for all using (true) with check (true);
