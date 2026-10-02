-- ============================================================
-- RECEPCIÓN POR REMITOS
-- Cada remito registra lo que llegó de una orden de compra para una solicitud.
-- Ejecutar en Supabase → SQL Editor. Idempotente.
-- ============================================================
create extension if not exists pgcrypto;
create table if not exists public.recepciones (
  id          uuid primary key default gen_random_uuid(),
  num_sc      text not null,                 -- solicitud sobre la que se recibe
  num_oc      text,                          -- orden de compra que cubre esos ítems
  remito      text not null,                 -- número de remito del proveedor
  fecha       date not null,
  proveedor   text,
  items       jsonb not null default '[]',   -- [{sc_i, desc, cant, unidad}]
  obs         text,
  creado_en   timestamptz default now(),
  creado_por  text
);
create index if not exists recepciones_sc on public.recepciones (num_sc);
create index if not exists recepciones_oc on public.recepciones (num_oc);
-- Un mismo remito de un proveedor no se carga dos veces para la misma solicitud
create unique index if not exists recepciones_remito_unico on public.recepciones (num_sc, upper(proveedor), upper(remito));
alter table public.recepciones enable row level security;
drop policy if exists "allow all" on public.recepciones;
create policy "allow all" on public.recepciones for all using (true) with check (true);

-- La orden de compra guarda el resumen de su recepción
alter table public.ordenes_compra add column if not exists ultima_recepcion  date;
alter table public.ordenes_compra add column if not exists recepcion_obs     text;
alter table public.ordenes_compra add column if not exists recepcion_completa boolean;
