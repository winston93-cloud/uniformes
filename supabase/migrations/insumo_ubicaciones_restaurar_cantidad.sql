-- Migracion: columna cantidad en insumo_ubicaciones (reparto por bodega, validacion en app)

ALTER TABLE public.insumo_ubicaciones
  ADD COLUMN IF NOT EXISTS cantidad DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- CHECK cantidad >= 0 solo si aun no existe esta restriccion
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
  'Unidades en esta ubicacion; la suma por insumo debe coincidir con insumos.stock';

COMMENT ON TABLE public.insumo_ubicaciones IS
  'Cantidad por ubicacion por insumo; el total sigue en insumos.stock';
