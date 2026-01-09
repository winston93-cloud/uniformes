-- Tabla para almacenar los insumos que componen cada talla de una prenda
CREATE TABLE IF NOT EXISTS prenda_talla_insumos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prenda_id UUID NOT NULL REFERENCES prendas(id) ON DELETE CASCADE,
  talla_id UUID NOT NULL REFERENCES tallas(id) ON DELETE CASCADE,
  insumo_id UUID NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  cantidad DECIMAL(10, 2) NOT NULL CHECK (cantidad > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Evitar duplicados: una prenda-talla solo puede tener un insumo una vez
  UNIQUE(prenda_id, talla_id, insumo_id)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_prenda_talla_insumos_prenda ON prenda_talla_insumos(prenda_id);
CREATE INDEX IF NOT EXISTS idx_prenda_talla_insumos_talla ON prenda_talla_insumos(talla_id);
CREATE INDEX IF NOT EXISTS idx_prenda_talla_insumos_insumo ON prenda_talla_insumos(insumo_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_prenda_talla_insumos_updated_at ON prenda_talla_insumos;
CREATE TRIGGER update_prenda_talla_insumos_updated_at
    BEFORE UPDATE ON prenda_talla_insumos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentación
COMMENT ON TABLE prenda_talla_insumos IS 'Almacena los insumos necesarios para fabricar cada talla de una prenda';
COMMENT ON COLUMN prenda_talla_insumos.prenda_id IS 'ID de la prenda';
COMMENT ON COLUMN prenda_talla_insumos.talla_id IS 'ID de la talla';
COMMENT ON COLUMN prenda_talla_insumos.insumo_id IS 'ID del insumo necesario';
COMMENT ON COLUMN prenda_talla_insumos.cantidad IS 'Cantidad del insumo necesario (según su unidad de medida)';
