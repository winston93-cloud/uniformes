-- Unidad en que se mide cantidad_por_presentacion (metros, unidades, kg, rollos, etc.)

ALTER TABLE public.insumos
  ADD COLUMN IF NOT EXISTS unidad_medida VARCHAR(80) NOT NULL DEFAULT 'unidades';

COMMENT ON COLUMN public.insumos.unidad_medida IS
  'Unidad de la cantidad por presentación (ej. metros, unidades, kg); independiente del nombre del catálogo presentaciones';
