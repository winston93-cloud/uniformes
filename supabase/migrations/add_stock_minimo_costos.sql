-- Agregar campo stock_minimo a la tabla costos
-- Este campo permite definir el stock mínimo requerido para cada prenda-talla
-- y generar alertas cuando el inventario está bajo

ALTER TABLE costos 
ADD COLUMN IF NOT EXISTS stock_minimo INTEGER DEFAULT 0;

-- Agregar comentario explicativo
COMMENT ON COLUMN costos.stock_minimo IS 'Stock mínimo requerido para esta prenda-talla. Genera alertas cuando stock < stock_minimo';

-- Agregar índice para mejorar performance de consultas de alertas
CREATE INDEX IF NOT EXISTS idx_costos_stock_minimo ON costos(stock_minimo) WHERE stock_minimo > 0;

-- Agregar índice compuesto para búsquedas de alertas
CREATE INDEX IF NOT EXISTS idx_costos_alertas ON costos(stock, stock_minimo, activo) WHERE activo = true AND stock_minimo > 0;
