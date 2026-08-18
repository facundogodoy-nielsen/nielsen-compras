-- ============================================================
-- BORRADOS COMPARTIDOS — evita que lo eliminado reaparezca
--
-- PROBLEMA que resuelve: hasta ahora, cuando se eliminaba una SC o un
-- Pedido, la marca de "borrado" quedaba guardada SOLO en el navegador
-- de quien lo borró. Otro equipo que todavía tuviera ese registro en su
-- copia local lo volvía a subir a la nube, y reaparecía en el historial.
--
-- Con esta tabla, el borrado es compartido: todos los equipos consultan
-- la misma lista y ninguno vuelve a subir lo eliminado.
--
-- Ejecutar en el Supabase de la SUITE DE COMPRAS → SQL Editor. Idempotente.
-- ============================================================

create table if not exists public.borrados (
  tipo       text not null,          -- 'sc' | 'pa' | 'comparativa'
  clave      text not null,          -- N° de SC / PA / CCP normalizado
  borrado_en timestamptz default now(),
  borrado_por text,
  primary key (tipo, clave)
);

create index if not exists borrados_tipo_idx on public.borrados (tipo);

alter table public.borrados enable row level security;

drop policy if exists "allow all" on public.borrados;
create policy "allow all" on public.borrados for all using (true) with check (true);
