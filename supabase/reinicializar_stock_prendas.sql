-- ============================================
-- REINICIALIZAR STOCK DE PRENDAS A CERO
-- ============================================
-- Esto pondrá en 0 el stock inicial, stock mínimo y stock actual
-- de todas las prendas en la tabla costos.
-- NO afecta precios, tallas, prendas ni otros datos.
-- ============================================

DO $$
DECLARE
  registros_actualizados INTEGER;
BEGIN
  -- Actualizar todos los costos poniendo stock en 0
  UPDATE costos
  SET 
    stock_inicial = 0,
    stock_minimo = 0,
    stock = 0
  WHERE 
    stock_inicial != 0 
    OR stock_minimo != 0 
    OR stock != 0;
  
  GET DIAGNOSTICS registros_actualizados = ROW_COUNT;
  
  RAISE NOTICE '✅ Stock inicializado a 0 en % registros', registros_actualizados;
  RAISE NOTICE '📊 stock_inicial = 0';
  RAISE NOTICE '📊 stock_minimo = 0';
  RAISE NOTICE '📊 stock = 0';
  RAISE NOTICE '⚠️  Los precios, tallas y prendas NO fueron afectados';
END $$;
