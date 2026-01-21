-- ============================================
-- Modificación: Agregar campo stock_minimo a insumos
-- Propósito: Control de inventario y alertas de reabastecimiento
-- ============================================

-- Agregar columna stock_minimo
ALTER TABLE insumos
ADD COLUMN IF NOT EXISTS stock_minimo DECIMAL(10, 2) DEFAULT 0 CHECK (stock_minimo >= 0);

-- Comentario para documentación
COMMENT ON COLUMN insumos.stock_minimo IS 'Cantidad mínima de stock que debe mantenerse. Si el stock actual cae por debajo, se genera una alerta';

-- Actualizar insumos existentes con valores por defecto razonables
-- (Esto es opcional, puedes ajustar según tus necesidades)
UPDATE insumos SET stock_minimo = 10.00 WHERE stock_minimo = 0;

-- Crear índice para mejorar consultas de alertas
CREATE INDEX IF NOT EXISTS idx_insumos_stock_minimo ON insumos(stock_minimo);
