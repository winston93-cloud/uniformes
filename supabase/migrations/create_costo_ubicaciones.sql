-- Reparto de stock por ubicación para cada registro de costos (prenda + talla + sucursal)

CREATE TABLE IF NOT EXISTS public.costo_ubicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  costo_id UUID NOT NULL REFERENCES public.costos(id) ON DELETE CASCADE,
  ubicacion_almacenamiento_id UUID NOT NULL REFERENCES public.ubicaciones_almacenamiento(id) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT uq_costo_ubicacion UNIQUE (costo_id, ubicacion_almacenamiento_id)
);

CREATE INDEX IF NOT EXISTS idx_costo_ubicaciones_costo ON public.costo_ubicaciones(costo_id);
CREATE INDEX IF NOT EXISTS idx_costo_ubicaciones_ubicacion ON public.costo_ubicaciones(ubicacion_almacenamiento_id);

COMMENT ON TABLE public.costo_ubicaciones IS 'Cantidad de inventario por ubicación para un mismo costo (puede haber varias filas)';

DROP TRIGGER IF EXISTS update_costo_ubicaciones_updated_at ON public.costo_ubicaciones;
CREATE TRIGGER update_costo_ubicaciones_updated_at
  BEFORE UPDATE ON public.costo_ubicaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.costo_ubicaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todas las operaciones en costo_ubicaciones"
  ON public.costo_ubicaciones FOR ALL USING (true) WITH CHECK (true);

-- Datos previos: una fila por costo que ya tenía una sola ubicación
INSERT INTO public.costo_ubicaciones (costo_id, ubicacion_almacenamiento_id, cantidad)
SELECT c.id, c.ubicacion_almacenamiento_id, GREATEST(COALESCE(c.stock, 0), 0)::integer
FROM public.costos c
WHERE c.ubicacion_almacenamiento_id IS NOT NULL
ON CONFLICT (costo_id, ubicacion_almacenamiento_id) DO NOTHING;
