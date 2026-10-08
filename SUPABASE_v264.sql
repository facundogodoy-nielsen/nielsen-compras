-- ============================================================
-- v264 · Percepciones en la Orden de Compra (IIBB San Juan e IVA RG 2408)
-- Solo AGREGA una columna. No borra ni modifica datos. Idempotente.
-- Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================
alter table public.ordenes_compra add column if not exists percepciones jsonb;
-- Estructura guardada:
-- {"iibb":{"aplica":true,"pct":3,"monto":1234.5,"jurisdiccion":"San Juan","nota":"Sin adicional Lote Hogar"},
--  "iva":{"aplica":true,"pct":3,"monto":2345.6,"norma":"RG 2408","bajo_minimo":false},
--  "total":3580.1}
