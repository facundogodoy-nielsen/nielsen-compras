-- ============================================================
-- Migrar el prefijo de las comparativas EXISTENTES:
--   CC-YYYY-NNNN  →  CCP-YYYY-NNNN
-- Ejecutar UNA vez en Supabase → SQL Editor.
-- Solo afecta las filas que empiezan con "CC-" (no toca las que ya son "CCP-").
-- ============================================================

update public.comparativas
set num_comp = 'CCP-' || substring(num_comp from 4)
where num_comp like 'CC-%'
  and num_comp not like 'CCP-%';

-- Verificación (opcional): listar cómo quedaron
-- select num_comp from public.comparativas order by num_comp;
