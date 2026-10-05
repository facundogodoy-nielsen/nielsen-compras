-- ============================================================
-- v260 · ORDEN DIRECTA · DEVOLUCIONES Y ANULACIONES · ENTREGA FINAL · VERIFICACIÓN DE FACTURAS
-- Sólo agrega: no borra tablas, columnas ni datos. Se puede ejecutar más de una vez.
-- Ejecutar en Supabase → SQL Editor (después de SUPABASE_recepciones.sql).
-- ============================================================

-- Órdenes de compra: datos de la orden directa, cierre con faltante y estado de la factura
alter table public.ordenes_compra add column if not exists lugar_entrega    text;
alter table public.ordenes_compra add column if not exists plazo_entrega    text;
alter table public.ordenes_compra add column if not exists excepcion_tipo   text;
alter table public.ordenes_compra add column if not exists excepcion_just   text;
alter table public.ordenes_compra add column if not exists regularizar      boolean default false;
alter table public.ordenes_compra add column if not exists tc_usado         numeric(14,4);
alter table public.ordenes_compra add column if not exists total_usd        numeric(16,2);
alter table public.ordenes_compra add column if not exists nivel_aut        text;
alter table public.ordenes_compra add column if not exists emitida_por      text;
alter table public.ordenes_compra add column if not exists proveedor_cuit   text;
alter table public.ordenes_compra add column if not exists motivo_reaut     text;
alter table public.ordenes_compra add column if not exists entrega_final    jsonb;      -- {fecha, motivo, items:[{sc, sc_i, desc, pendiente}]}
alter table public.ordenes_compra add column if not exists cerrada_en       timestamptz;
alter table public.ordenes_compra add column if not exists enviada_en       timestamptz;
alter table public.ordenes_compra add column if not exists confirmada_en    timestamptz;
alter table public.ordenes_compra add column if not exists estado_factura   text;       -- CONFORME · PARCIAL · BLOQUEADA
alter table public.ordenes_compra add column if not exists facturado_total  numeric(16,2);

-- Recepciones: devoluciones (SAP 122), anulaciones (SAP 102) y quién recibió
alter table public.recepciones add column if not exists tipo            text default 'RECEPCION';  -- RECEPCION · DEVOLUCION
alter table public.recepciones add column if not exists ref_remito      text;                       -- remito que se devuelve
alter table public.recepciones add column if not exists anulado         boolean default false;
alter table public.recepciones add column if not exists anulado_motivo  text;
alter table public.recepciones add column if not exists anulado_en      timestamptz;
alter table public.recepciones add column if not exists recibido_por    text;
-- Un remito anulado puede volver a cargarse con el mismo número
drop index if exists public.recepciones_remito_unico;
create unique index if not exists recepciones_remito_unico_vivo
  on public.recepciones (num_sc, upper(proveedor), upper(remito)) where coalesce(anulado,false)=false;

-- Facturas verificadas contra la orden y los remitos (control en tres vías)
create table if not exists public.facturas_oc (
  id               uuid primary key default gen_random_uuid(),
  num_oc           text not null,
  num_factura      text not null,
  fecha            date not null,
  proveedor        text,
  items            jsonb not null default '[]',   -- [{oc_i, desc, cant, precio, iva, precio_oc}]
  total            numeric(16,2),
  total_calculado  numeric(16,2),
  estado           text not null,                 -- CONFORME · BLOQUEADA · LIBERADA
  diferencias      jsonb default '[]',
  verificado_por   text,
  liberado_por     text,
  liberado_motivo  text,
  liberado_en      timestamptz,
  creado_en        timestamptz default now()
);
create index if not exists facturas_oc_oc on public.facturas_oc (num_oc);
create unique index if not exists facturas_oc_unica on public.facturas_oc (num_oc, upper(num_factura));
alter table public.facturas_oc enable row level security;
drop policy if exists "allow all" on public.facturas_oc;
create policy "allow all" on public.facturas_oc for all using (true) with check (true);
