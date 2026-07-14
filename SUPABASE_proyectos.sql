-- ============================================================
-- PROYECTOS (Centro de Control → Presupuestos → Proyectos)
-- Cada proyecto se guarda completo: datos + rubros + planos + etapas.
-- Ejecutar en Supabase → SQL Editor. Idempotente.
-- ============================================================

create table if not exists public.proyectos (
  id         text primary key,     -- id interno del proyecto (uid)
  num        text,                 -- N° correlativo (PROY-2026-0001)
  nombre     text,
  estado     text default 'planificacion',
  data       jsonb,                -- proyecto completo (rubros, planos, etapas, notas, fechas…)
  creado_at  timestamptz default now(),
  actualizado_at timestamptz default now()
);

-- Por si la tabla ya existía:
alter table public.proyectos add column if not exists num            text;
alter table public.proyectos add column if not exists nombre         text;
alter table public.proyectos add column if not exists estado         text default 'planificacion';
alter table public.proyectos add column if not exists data           jsonb;
alter table public.proyectos add column if not exists creado_at      timestamptz default now();
alter table public.proyectos add column if not exists actualizado_at timestamptz default now();

alter table public.proyectos enable row level security;
drop policy if exists proyectos_all on public.proyectos;
create policy proyectos_all on public.proyectos for all to anon using (true) with check (true);
