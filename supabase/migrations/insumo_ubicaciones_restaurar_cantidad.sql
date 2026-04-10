-- Restaurar cantidad por ubicación (misma idea que costo_ubicaciones / Prendas → Configurar stock).

ALTER TABLE public.insumo_ubicaciones
  ADD COLUMN IF NOT EXISTS cantidad DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Si la columna ya existía sin CHECK, añadir solo si no hay restricción en cantidad
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'insumo_ubicaciones'
      AND c.conname = 'insumo_ubicaciones_cantidad_non_negative'
  ) THEN
    ALTER TABLE public.insumo_ubicaciones
      ADD CONSTRAINT insumo_ubicaciones_cantidad_non_negative CHECK (cantidad >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.insumo_ubicaciones.cantidad IS
  'Unidades en esta ubicación; la suma por insumo debe coincidir con insumos.stock (validación en la app)';

COMMENT ON TABLE public.insumo_ubicaciones IS
  'Cantidad por ubicación por insumo; el total de inventario sigue en insumos.stock';
