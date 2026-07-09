-- ============================================================
-- FLUJO DE AUTORIZACIÓN DE COMPRAS (Aprobar / Stand by / Rechazar)
-- Ejecutar en Supabase → SQL Editor. Idempotente.
-- ============================================================

-- 1) Estado del pedido de autorización en cada comparativa
alter table public.comparativas add column if not exists estado_autorizacion  text;      -- PENDIENTE | APROBADA | STANDBY | RECHAZADA
alter table public.comparativas add column if not exists nivel_autorizacion   text;      -- COMPRAS | GERENCIA | DIRECCION
alter table public.comparativas add column if not exists aprob_requeridas     int;       -- 1 (Gerencia) · 2 de 3 (Dirección)
alter table public.comparativas add column if not exists aprob_contadas       int default 0;
alter table public.comparativas add column if not exists autorizado_por       text;      -- quién(es) aprobaron
alter table public.comparativas add column if not exists autorizado_en        text;      -- fecha de la autorización final
alter table public.comparativas add column if not exists rechazado_por        text;
alter table public.comparativas add column if not exists rechazo_motivo       text;
alter table public.comparativas add column if not exists solicitado_en        text;      -- cuándo se pidió la autorización

-- 2) Una fila por destinatario: su token único, su decisión y su recordatorio
create table if not exists public.ccp_autorizaciones (
  token        text primary key,          -- enlace único (aprobar/standby/rechazar)
  comp_id      text,                      -- id de la comparativa
  num_comp     text,                      -- N° CCP (legible)
  email        text,                      -- destinatario
  nombre       text,
  rol          text,                      -- APROBADOR | COPIA
  decision     text,                      -- PENDIENTE | APROBADO | STANDBY | RECHAZADO
  decidido_en  text,
  motivo       text,                      -- motivo del rechazo
  recordar_el  text,                      -- fecha del recordatorio (stand by)
  creado_at    timestamptz default now()
);

create index if not exists ccp_aut_comp_idx on public.ccp_autorizaciones (comp_id);
create index if not exists ccp_aut_recordar_idx on public.ccp_autorizaciones (recordar_el);

alter table public.ccp_autorizaciones enable row level security;
drop policy if exists ccp_aut_all on public.ccp_autorizaciones;
create policy ccp_aut_all on public.ccp_autorizaciones for all to anon using (true) with check (true);
