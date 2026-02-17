-- Script para agregar la columna cantidad_venta a la tabla costos si no existe
-- Este script es seguro de ejecutar múltiples veces (idempotente)

DO $$
BEGIN
    -- Verificar si la columna cantidad_venta existe
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'costos' 
        AND column_name = 'cantidad_venta'
    ) THEN
        -- Agregar la columna cantidad_venta
        ALTER TABLE costos 
        ADD COLUMN cantidad_venta INTEGER DEFAULT 0;
        
        RAISE NOTICE 'Columna cantidad_venta agregada exitosamente a la tabla costos';
    ELSE
        RAISE NOTICE 'La columna cantidad_venta ya existe en la tabla costos';
    END IF;
END $$;

