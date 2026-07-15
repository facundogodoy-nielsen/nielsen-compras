-- ============================================================
-- Trazabilidad SC ↔ Proyecto
-- Vincula una Solicitud de Compra con un proyecto (Presupuestos → Proyectos)
-- Ejecutar en Supabase → SQL Editor. Idempotente.
-- ============================================================

-- N° de proyecto al que se asocia la SC (desde el Formulario SC o el panel del proyecto)
alter table public.solicitudes_compra add column if not exists proyecto_asociado text;

-- Las SC asociadas manualmente desde el panel del proyecto se guardan dentro del
-- JSON del propio proyecto (proyectos.data.scs_asociadas), así que no requieren columna extra.
