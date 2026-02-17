-- ============================================
-- Tabla: compras_insumos
-- Propósito: Registrar las compras/adquisiciones de insumos
-- ============================================

CREATE TABLE IF NOT EXISTS compras_insumos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relación con el insumo comprado
  insumo_id UUID NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  
  -- Detalles de la compra
  cantidad_comprada DECIMAL(10, 2) NOT NULL CHECK (cantidad_comprada > 0),
  costo_unitario DECIMAL(10, 2) CHECK (costo_unitario >= 0),
  costo_total DECIMAL(10, 2) CHECK (costo_total >= 0),
  
  -- Información del proveedor
  proveedor VARCHAR(255),
  
  -- Fecha de compra
  fecha_compra DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Notas adicionales
  notas TEXT,
  
  -- Usuario que registró la compra
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_compras_insumos_insumo ON compras_insumos(insumo_id);
CREATE INDEX IF NOT EXISTS idx_compras_insumos_fecha ON compras_insumos(fecha_compra);
CREATE INDEX IF NOT EXISTS idx_compras_insumos_proveedor ON compras_insumos(proveedor);

-- Trigger para actualizar updated_at automáticamente
DROP TRIGGER IF EXISTS update_compras_insumos_updated_at ON compras_insumos;
CREATE TRIGGER update_compras_insumos_updated_at
    BEFORE UPDATE ON compras_insumos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentación
COMMENT ON TABLE compras_insumos IS 'Registro de compras/adquisiciones de insumos para producción';
COMMENT ON COLUMN compras_insumos.insumo_id IS 'ID del insumo comprado (referencia a catálogo de insumos)';
COMMENT ON COLUMN compras_insumos.cantidad_comprada IS 'Cantidad comprada en la unidad de medida del insumo';
COMMENT ON COLUMN compras_insumos.costo_unitario IS 'Costo por unidad del insumo';
COMMENT ON COLUMN compras_insumos.costo_total IS 'Costo total de la compra (cantidad × costo_unitario)';
COMMENT ON COLUMN compras_insumos.proveedor IS 'Nombre del proveedor que vendió el insumo';
COMMENT ON COLUMN compras_insumos.fecha_compra IS 'Fecha en que se realizó la compra';
COMMENT ON COLUMN compras_insumos.notas IS 'Notas adicionales sobre la compra (número de factura, condiciones, etc.)';
COMMENT ON COLUMN compras_insumos.usuario_id IS 'Usuario que registró la compra en el sistema';

-- RLS (Row Level Security)
ALTER TABLE compras_insumos ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden ver las compras
CREATE POLICY "Permitir lectura de compras_insumos" ON compras_insumos
    FOR SELECT
    USING (true);

-- Política: Usuarios autenticados pueden insertar compras
CREATE POLICY "Permitir inserción de compras_insumos" ON compras_insumos
    FOR INSERT
    WITH CHECK (true);

-- Política: Usuarios autenticados pueden actualizar compras
CREATE POLICY "Permitir actualización de compras_insumos" ON compras_insumos
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Política: Usuarios autenticados pueden eliminar compras
CREATE POLICY "Permitir eliminación de compras_insumos" ON compras_insumos
    FOR DELETE
    USING (true);
