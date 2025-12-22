-- Migración: Agregar precio_compra a tabla costos
-- Fecha: 2025-12-22
-- Descripción: Permite registrar el costo de adquisición de cada prenda para calcular ganancias

ALTER TABLE costos 
ADD COLUMN IF NOT EXISTS precio_compra DECIMAL(10, 2) DEFAULT 0 NOT NULL;

-- Comentario en la columna para documentación
COMMENT ON COLUMN costos.precio_compra IS 'Precio de compra/costo de adquisición de la prenda';

-- Índice para mejorar consultas de reportes
CREATE INDEX IF NOT EXISTS idx_costos_precio_compra ON costos(precio_compra);

