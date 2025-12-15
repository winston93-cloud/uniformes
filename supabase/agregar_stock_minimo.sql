-- Script para agregar la columna stock_minimo a la tabla costos si no existe
-- Este script es seguro de ejecutar múltiples veces (idempotente)

DO $$
BEGIN
    -- Verificar si la columna stock_minimo existe
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'costos' 
        AND column_name = 'stock_minimo'
    ) THEN
        -- Agregar la columna stock_minimo
        ALTER TABLE costos 
        ADD COLUMN stock_minimo INTEGER DEFAULT 0;
        
        RAISE NOTICE 'Columna stock_minimo agregada exitosamente a la tabla costos';
    ELSE
        RAISE NOTICE 'La columna stock_minimo ya existe en la tabla costos';
    END IF;
END $$;

