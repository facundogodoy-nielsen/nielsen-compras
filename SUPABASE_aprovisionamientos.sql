-- ============================================================
-- APROVISIONAMIENTOS de campamentos (Centro de Control → Abastecimiento)
-- Ejecutar en Supabase → SQL Editor. Idempotente.
-- ============================================================

create table if not exists public.aprovisionamientos (
  id            text primary key,
  campamento    text,
  fecha         text,          -- 'YYYY-MM-DD' (texto para permitir vacío)
  carga         text,
  vehiculo      text,
  chofer        text,
  responsable   text,
  estado        text default 'PLANIFICADO',
  observaciones text,
  fecha_fin     text,          -- fin de la planificación (Gantt), opcional
  pedido_ref    text,          -- N° PA vinculado (planificación logística)
  creado_at     timestamptz default now()
);

-- Por si la tabla ya existía sin alguna columna:
alter table public.aprovisionamientos add column if not exists campamento    text;
alter table public.aprovisionamientos add column if not exists fecha         text;
alter table public.aprovisionamientos add column if not exists carga         text;
alter table public.aprovisionamientos add column if not exists vehiculo      text;
alter table public.aprovisionamientos add column if not exists chofer        text;
alter table public.aprovisionamientos add column if not exists responsable   text;
alter table public.aprovisionamientos add column if not exists estado        text default 'PLANIFICADO';
alter table public.aprovisionamientos add column if not exists observaciones text;
alter table public.aprovisionamientos add column if not exists fecha_fin     text;
alter table public.aprovisionamientos add column if not exists pedido_ref    text;   -- N° PA vinculado (planificación logística)
alter table public.aprovisionamientos add column if not exists creado_at     timestamptz default now();

alter table public.aprovisionamientos enable row level security;

drop policy if exists aprov_all on public.aprovisionamientos;
create policy aprov_all on public.aprovisionamientos
  for all to anon using (true) with check (true);
