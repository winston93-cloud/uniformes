-- Migración para eliminar precio_compra de la tabla costos

-- Eliminar la columna precio_compra
ALTER TABLE costos DROP COLUMN IF EXISTS precio_compra;

