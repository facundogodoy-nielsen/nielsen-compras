-- ============================================================
-- Sincronización total en la nube (disponible desde cualquier dispositivo)
-- Tablas: tc_overrides, aprov_campamentos, ordenes_pedido
-- Ejecutar en Supabase → SQL Editor. Idempotente.
-- ============================================================

-- 1) TC USD manual por fecha de CCP (override de la Cotización Divisas Venta)
create table if not exists public.tc_overrides (
  fecha     text primary key,     -- 'YYYY-MM-DD'
  venta     numeric,
  creado_at timestamptz default now()
);
alter table public.tc_overrides enable row level security;
drop policy if exists tc_overrides_all on public.tc_overrides;
create policy tc_overrides_all on public.tc_overrides for all to anon using (true) with check (true);

-- 2) Campamentos de Aprovisionamientos (pestañas)
create table if not exists public.aprov_campamentos (
  nombre    text primary key,
  creado_at timestamptz default now()
);
alter table public.aprov_campamentos enable row level security;
drop policy if exists aprov_campamentos_all on public.aprov_campamentos;
create policy aprov_campamentos_all on public.aprov_campamentos for all to anon using (true) with check (true);

-- 3) Historial de Órdenes de Pedido (OP)
create table if not exists public.ordenes_pedido (
  id             text primary key,
  num            text,
  fecha          text,
  area           text,
  subarea        text,
  solicitante    text,
  os             text,
  asunto         text,
  destino        text,
  items_original text,
  resultado      text,
  sc_vinculada   text,
  creado_at      timestamptz default now()
);
alter table public.ordenes_pedido enable row level security;
drop policy if exists ordenes_pedido_all on public.ordenes_pedido;
create policy ordenes_pedido_all on public.ordenes_pedido for all to anon using (true) with check (true);
