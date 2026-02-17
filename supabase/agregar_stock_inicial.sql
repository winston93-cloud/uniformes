-- Script para agregar la columna stock_inicial a la tabla costos si no existe
-- Este script es seguro de ejecutar múltiples veces (idempotente)

DO $$
BEGIN
    -- Verificar si la columna stock_inicial existe
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'costos' 
        AND column_name = 'stock_inicial'
    ) THEN
        -- Agregar la columna stock_inicial
        ALTER TABLE costos 
        ADD COLUMN stock_inicial INTEGER DEFAULT 0;
        
        -- Actualizar los registros existentes para que stock_inicial sea igual a stock
        UPDATE costos 
        SET stock_inicial = stock 
        WHERE stock_inicial IS NULL OR stock_inicial = 0;
        
        RAISE NOTICE 'Columna stock_inicial agregada exitosamente a la tabla costos';
    ELSE
        RAISE NOTICE 'La columna stock_inicial ya existe en la tabla costos';
    END IF;
END $$;

