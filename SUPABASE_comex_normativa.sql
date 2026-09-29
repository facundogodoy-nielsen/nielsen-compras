-- ============================================================
-- NORMATIVA VIGENTE DE COMERCIO INTERNACIONAL
-- Alícuotas que usa la calculadora del Tablero COMEX.
-- Se administran desde Centro de Control → Comercio Internacional → Normativa vigente.
-- Ejecutar en Supabase → SQL Editor. Es idempotente: no pisa valores ya actualizados.
-- ============================================================
create table if not exists public.comex_normativa (
  clave          text primary key,
  pais           text,
  concepto       text,
  valor          numeric(8,3),
  unidad         text,
  norma          text,
  vigente_hasta  date,
  fuente_url     text,
  estado         text default 'verificado',   -- verificado | a_verificar
  notas          text,
  revisado_en    timestamptz default now(),
  revisado_por   text
);
alter table public.comex_normativa enable row level security;
drop policy if exists "allow all" on public.comex_normativa;
create policy "allow all" on public.comex_normativa for all using (true) with check (true);

-- Valores verificados al 29/09/2026 (on conflict do nothing: no pisa lo que ya se haya actualizado)
insert into public.comex_normativa (clave,pais,concepto,valor,unidad,norma,vigente_hasta,estado,notas,revisado_por) values
 ('ar_tasa_estadistica','AR','Tasa de estadística',3,'% CIF','Decreto 1140/2024','2027-12-31','verificado','Tope USD 150.000 por operación','Carga inicial'),
 ('ar_perc_iva_adic_general','AR','Percepción IVA adicional (bienes al 21 %)',20,'% base','RG 2937',null,'verificado',null,'Carga inicial'),
 ('ar_perc_iva_adic_reducida','AR','Percepción IVA adicional (bienes al 10,5 %)',10,'% base','RG 2937 art. 7 (RG 4461/2019)',null,'verificado',null,'Carga inicial'),
 ('ar_perc_ganancias','AR','Percepción Ganancias (importador inscripto)',6,'% base','RG 2281',null,'verificado','11 % para no inscriptos','Carga inicial'),
 ('ar_perc_iva_afip','AR','Percepción IVA AFIP (heredada del tablero)',3.5,'% base','Sin norma identificada',null,'a_verificar','Confirmar con el despachante si corresponde','Carga inicial'),
 ('ar_seguro_presunto','AR','Seguro presunto sin póliza',1,'% FOB','A confirmar',null,'a_verificar',null,'Carga inicial'),
 ('cl_iva','CL','IVA de importación',19,'% CIF + arancel','DL 825',null,'verificado',null,'Carga inicial'),
 ('cl_arancel_general','CL','Arancel general ad valorem',6,'% CIF','Arancel Aduanero Nacional',null,'verificado','0 % con TLC y certificado de origen','Carga inicial'),
 ('cl_seguro_estimado','CL','Seguro de carga estimado',0.8,'% FOB','Costo de póliza',null,'verificado','Sin póliza, la Aduana presume 2 % del FOB','Carga inicial'),
 ('seguro_tramo_cl_ar','CL→AR','Seguro tramo Chile → Argentina',0.8,'% factura','Costo de póliza',null,'verificado',null,'Carga inicial')
on conflict (clave) do nothing;

-- Verificación:
-- select pais, concepto, valor, unidad, norma, estado from public.comex_normativa order by pais, clave;
