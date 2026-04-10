-- Insumo ↔ ubicaciones: solo en qué bodegas/talleres aplica el material (sin cantidad por fila).
-- El stock total sigue en public.insumos (stock / stock_inicial).

ALTER TABLE public.insumo_ubicaciones DROP COLUMN IF EXISTS cantidad;

COMMENT ON TABLE public.insumo_ubicaciones IS
  'Ubicaciones asociadas al insumo; el inventario total está en insumos.stock (sin desglose por ubicación)';
