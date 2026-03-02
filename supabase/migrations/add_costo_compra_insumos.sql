-- Migración: Agregar costo_compra a tabla insumos
-- Fecha: 2026-02-13
-- Descripción: Permite registrar el costo de compra de cada insumo para control de inventario y costos

ALTER TABLE insumos 
ADD COLUMN IF NOT EXISTS costo_compra DECIMAL(10, 2) DEFAULT 0 NOT NULL;

-- Comentario en la columna para documentación
COMMENT ON COLUMN insumos.costo_compra IS 'Costo de compra del insumo por presentación (ej: costo de una bolsa de 500 botones)';

-- Índice para mejorar consultas de reportes
CREATE INDEX IF NOT EXISTS idx_insumos_costo_compra ON insumos(costo_compra);
