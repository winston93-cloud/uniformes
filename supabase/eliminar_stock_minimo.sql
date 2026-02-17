-- Migración para eliminar stock_minimo de la tabla costos

-- Eliminar la columna stock_minimo
ALTER TABLE costos DROP COLUMN IF EXISTS stock_minimo;

