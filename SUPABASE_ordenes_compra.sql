-- ============================================================
-- ÓRDENES DE COMPRA (OC)
--
-- Cierra el circuito: SC → Comparativa → Autorización → OC → Recepción
--
-- Criterios acordados:
--  · La OC hereda la autorización de la comparativa aprobada.
--  · Vuelve a requerir firma si cambia el proveedor, si el monto supera
--    en más del 5% lo autorizado, si cambian las cantidades, o si
--    pasaron más de 30 días desde la aprobación.
--  · Estados: BORRADOR → EMITIDA → ENVIADA → CONFIRMADA → RECIBIDA → CERRADA
--             + STANDBY (posterga sin cerrar, recordatorio a los 15 días)
--             + RECHAZADA / ANULADA (con motivo)
--  · Una OC puede referenciar VARIAS solicitudes (compra consolidada) y una
--    solicitud puede terminar en varias OC (pedido repartido).
--
-- Ejecutar en Supabase → SQL Editor. Idempotente.
-- ============================================================

create table if not exists public.ordenes_compra (
  id                uuid primary key default gen_random_uuid(),
  num_oc            text unique not null,          -- OC-2026-0001
  fecha             date default current_date,

  -- Origen
  num_comp          text,                          -- comparativa que la originó (si la hubo)
  scs               jsonb default '[]'::jsonb,     -- ["SCTR-2026-0006", ...]
  via               text default 'COMPARATIVA',    -- COMPARATIVA | DIRECTA | URGENCIA

  -- Proveedor y condiciones
  proveedor         text,
  proveedor_cuit    text,
  condicion_pago    text,
  plazo_entrega     text,
  lugar_entrega     text,
  moneda            text default 'ARS',

  -- Importes
  items             jsonb default '[]'::jsonb,     -- [{desc, cant, unidad, precio, iva, subtotal}]
  neto              numeric(16,2) default 0,
  iva               numeric(16,2) default 0,
  total             numeric(16,2) default 0,
  total_usd         numeric(16,2),                 -- para comparar con los umbrales
  tc_usado          numeric(12,4),

  -- Autorización (heredada o propia)
  autorizacion      text default 'HEREDADA',       -- HEREDADA | REQUERIDA | NO_REQUIERE
  estado_aut        text,                          -- PENDIENTE | APROBADA | RECHAZADA | STANDBY
  nivel_aut         text,                          -- COMPRAS | GERENCIA | DIRECCION
  autorizado_por    text,
  autorizado_en     timestamptz,
  motivo_reaut      text,                          -- por qué volvió a requerir firma

  -- Stand by: posterga sin cerrar
  standby_desde     timestamptz,
  standby_motivo    text,
  standby_recordar  date,                          -- recordatorio a los 15 días
  standby_avisado   boolean default false,

  -- Excepción a la comparativa (cuando via <> 'COMPARATIVA')
  excepcion_tipo    text,                          -- PROVEEDOR_UNICO | URGENCIA | ACUERDO_VIGENTE
  excepcion_just    text,                          -- justificación obligatoria

  -- Urgencia: se compra primero y se regulariza después
  regularizar       boolean default false,
  regularizada_en   timestamptz,

  -- Ciclo de vida
  estado            text default 'BORRADOR',
  enviada_en        timestamptz,
  confirmada_en     timestamptz,

  -- Recepción (alimenta el OTIF y el lead time del SRM)
  recibida_en       date,
  recepcion_completa boolean,
  recepcion_obs     text,
  recibido_por      text,

  -- Cierre
  motivo_anulacion  text,
  emitida_por       text,
  obs               text,
  creado_at         timestamptz default now(),
  actualizado_en    timestamptz default now()
);

create index if not exists oc_estado_idx     on public.ordenes_compra (estado);
create index if not exists oc_fecha_idx      on public.ordenes_compra (fecha desc);
create index if not exists oc_comp_idx       on public.ordenes_compra (num_comp);
create index if not exists oc_proveedor_idx  on public.ordenes_compra (proveedor);
create index if not exists oc_standby_idx    on public.ordenes_compra (standby_recordar)
  where estado_aut = 'STANDBY';

alter table public.ordenes_compra enable row level security;
drop policy if exists "allow all" on public.ordenes_compra;
create policy "allow all" on public.ordenes_compra for all using (true) with check (true);

-- Estado del circuito en la solicitud de compra
alter table public.solicitudes_compra add column if not exists estado_circuito text;
alter table public.solicitudes_compra add column if not exists ocs             jsonb;

-- Stand by también en las comparativas (el correo ya ofrece esa opción)
alter table public.comparativas add column if not exists standby_desde    timestamptz;
alter table public.comparativas add column if not exists standby_motivo   text;
alter table public.comparativas add column if not exists standby_recordar date;
alter table public.comparativas add column if not exists standby_avisado  boolean default false;

-- ── Verificación (quitar los "--" para ejecutar) ──
-- select num_oc, estado, estado_aut, total, proveedor from public.ordenes_compra order by fecha desc limit 10;
