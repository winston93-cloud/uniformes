-- Reparto de stock por ubicación para cada insumo (misma idea que costo_ubicaciones)

CREATE TABLE IF NOT EXISTS public.insumo_ubicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  ubicacion_almacenamiento_id UUID NOT NULL REFERENCES public.ubicaciones_almacenamiento(id) ON DELETE RESTRICT,
  cantidad DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT uq_insumo_ubicacion UNIQUE (insumo_id, ubicacion_almacenamiento_id)
);

CREATE INDEX IF NOT EXISTS idx_insumo_ubicaciones_insumo ON public.insumo_ubicaciones(insumo_id);
CREATE INDEX IF NOT EXISTS idx_insumo_ubicaciones_ubicacion ON public.insumo_ubicaciones(ubicacion_almacenamiento_id);

COMMENT ON TABLE public.insumo_ubicaciones IS 'Cantidad de inventario por ubicación para un insumo (varias filas por insumo)';

DROP TRIGGER IF EXISTS update_insumo_ubicaciones_updated_at ON public.insumo_ubicaciones;
CREATE TRIGGER update_insumo_ubicaciones_updated_at
  BEFORE UPDATE ON public.insumo_ubicaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.insumo_ubicaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todas las operaciones en insumo_ubicaciones"
  ON public.insumo_ubicaciones FOR ALL USING (true) WITH CHECK (true);

-- Datos previos: una fila por insumo que ya tenía una sola ubicación y stock > 0
INSERT INTO public.insumo_ubicaciones (insumo_id, ubicacion_almacenamiento_id, cantidad)
SELECT i.id, i.ubicacion_almacenamiento_id, GREATEST(COALESCE(i.stock, i.stock_inicial, 0), 0)::decimal(10,2)
FROM public.insumos i
WHERE i.ubicacion_almacenamiento_id IS NOT NULL
  AND GREATEST(COALESCE(i.stock, i.stock_inicial, 0), 0) > 0
ON CONFLICT (insumo_id, ubicacion_almacenamiento_id) DO NOTHING;

-- Dejar de usar la columna única en insumos cuando ya hay reparto en insumo_ubicaciones
UPDATE public.insumos i
SET ubicacion_almacenamiento_id = NULL
WHERE EXISTS (
  SELECT 1 FROM public.insumo_ubicaciones u WHERE u.insumo_id = i.id
);
