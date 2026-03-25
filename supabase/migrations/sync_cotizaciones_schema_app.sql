-- Sincroniza cotizaciones / detalle_cotizacion con lo que usa la app (Next.js).
-- Ejecutar en Supabase SQL Editor si ves:
--   "Could not find the 'fecha_entrega' column of 'cotizaciones' in the schema cache"
-- o errores similares al crear cotización o partidas.

-- ========== cotizaciones ==========
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS fecha_entrega DATE;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS tiempo_entrega VARCHAR(100);
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS pdf_url TEXT;

COMMENT ON COLUMN cotizaciones.fecha_entrega IS 'Fecha comprometida de entrega al cliente';

-- ========== detalle_cotizacion (partidas) ==========
ALTER TABLE detalle_cotizacion
  ADD COLUMN IF NOT EXISTS tipo_precio_usado VARCHAR(10) DEFAULT 'menudeo' NOT NULL;
ALTER TABLE detalle_cotizacion
  ADD COLUMN IF NOT EXISTS prenda_id UUID REFERENCES prendas(id) ON DELETE SET NULL;
ALTER TABLE detalle_cotizacion
  ADD COLUMN IF NOT EXISTS costo_id UUID REFERENCES costos(id) ON DELETE SET NULL;
ALTER TABLE detalle_cotizacion
  ADD COLUMN IF NOT EXISTS es_manual BOOLEAN DEFAULT false NOT NULL;

UPDATE detalle_cotizacion SET tipo_precio_usado = 'menudeo' WHERE tipo_precio_usado IS NULL;

CREATE INDEX IF NOT EXISTS idx_detalle_tipo_precio ON detalle_cotizacion(tipo_precio_usado);
CREATE INDEX IF NOT EXISTS idx_detalle_prenda_id ON detalle_cotizacion(prenda_id);
CREATE INDEX IF NOT EXISTS idx_detalle_costo_id ON detalle_cotizacion(costo_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_tipo_precio_usado'
  ) THEN
    ALTER TABLE detalle_cotizacion
      ADD CONSTRAINT chk_tipo_precio_usado
      CHECK (tipo_precio_usado IN ('mayoreo', 'menudeo'));
  END IF;
END $$;
