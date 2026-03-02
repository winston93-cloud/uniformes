-- ============================================
-- REINICIALIZAR HISTORIAL DE PEDIDOS
-- ============================================
-- Esto eliminará todos los pedidos y su historial,
-- pero NO afectará tallas, prendas, costos, insumos ni presentaciones.
-- Use esto antes de lanzar a producción para limpiar datos de prueba.
-- ============================================

DO $$
DECLARE
  total_pedidos INTEGER;
  total_detalles INTEGER;
  total_snapshots INTEGER;
BEGIN
  -- 1. Contar registros antes de eliminar
  SELECT COUNT(*) INTO total_pedidos FROM pedidos;
  SELECT COUNT(*) INTO total_detalles FROM detalle_pedidos;
  
  BEGIN
    SELECT COUNT(*) INTO total_snapshots FROM snapshot_insumos_pedido;
  EXCEPTION WHEN undefined_table THEN
    total_snapshots := 0;
  END;
  
  RAISE NOTICE '📊 Registros encontrados:';
  RAISE NOTICE '   - Pedidos: %', total_pedidos;
  RAISE NOTICE '   - Detalle pedidos: %', total_detalles;
  RAISE NOTICE '   - Snapshots insumos: %', total_snapshots;
  RAISE NOTICE '';

  -- 2. Eliminar snapshot_insumos_pedido
  BEGIN
    DELETE FROM snapshot_insumos_pedido;
    RAISE NOTICE '✅ snapshot_insumos_pedido eliminado';
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE '⚠️  snapshot_insumos_pedido no existe, omitiendo...';
  END;

  -- 3. Eliminar detalle_pedidos
  DELETE FROM detalle_pedidos;
  RAISE NOTICE '✅ detalle_pedidos eliminado';

  -- 4. Eliminar pedidos
  DELETE FROM pedidos;
  RAISE NOTICE '✅ pedidos eliminado';

  RAISE NOTICE '';
  RAISE NOTICE '🎉 Historial de pedidos reinicializado correctamente';
  RAISE NOTICE '⚠️  Verifica que tallas, prendas, costos e insumos NO fueron afectados';
  RAISE NOTICE '📝 Los stocks de las prendas permanecen como estaban';
END $$;
