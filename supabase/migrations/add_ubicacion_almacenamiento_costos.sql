-- Ubicación física del stock de prenda/talla por sucursal (misma tabla que insumos: ubicaciones_almacenamiento)

ALTER TABLE public.costos
  ADD COLUMN IF NOT EXISTS ubicacion_almacenamiento_id UUID
  REFERENCES public.ubicaciones_almacenamiento(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_costos_ubicacion_almacenamiento
  ON public.costos(ubicacion_almacenamiento_id);

COMMENT ON COLUMN public.costos.ubicacion_almacenamiento_id IS
  'Dónde se almacena el inventario de esta prenda/talla en la sucursal (Taller, Bodega, etc.)';
