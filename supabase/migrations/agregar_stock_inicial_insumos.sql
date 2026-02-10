-- Agregar columna stock_inicial a la tabla insumos
-- Este script es seguro de ejecutar múltiples veces (idempotente)

DO $$
BEGIN
    -- Verificar si la columna stock_inicial existe
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'insumos' 
        AND column_name = 'stock_inicial'
    ) THEN
        -- Agregar la columna stock_inicial
        ALTER TABLE insumos 
        ADD COLUMN stock_inicial DECIMAL(10, 2) DEFAULT 0;
        
        -- Agregar columna stock si no existe
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'insumos' 
            AND column_name = 'stock'
        ) THEN
            ALTER TABLE insumos 
            ADD COLUMN stock DECIMAL(10, 2) DEFAULT 0;
        END IF;
        
        RAISE NOTICE 'Columnas stock_inicial y stock agregadas exitosamente a la tabla insumos';
    ELSE
        RAISE NOTICE 'La columna stock_inicial ya existe en la tabla insumos';
    END IF;
END $$;
