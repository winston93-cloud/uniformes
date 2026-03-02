-- ============================================
-- REINICIALIZAR CATÁLOGOS DE INSUMOS Y PRESENTACIONES
-- ============================================
-- PRECAUCIÓN: Esto eliminará todos los insumos, presentaciones
-- y sus relaciones, pero NO tocará tallas, prendas ni costos.
-- ============================================

DO $$
BEGIN
  -- 1. Eliminar snapshot_insumos_pedido
  BEGIN
    DELETE FROM snapshot_insumos_pedido;
    RAISE NOTICE '✅ snapshot_insumos_pedido eliminado';
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE '⚠️  snapshot_insumos_pedido no existe, omitiendo...';
  END;

  -- 2. Eliminar prenda_talla_insumos (relación entre prendas, tallas e insumos)
  BEGIN
    DELETE FROM prenda_talla_insumos;
    RAISE NOTICE '✅ prenda_talla_insumos eliminado';
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE '⚠️  prenda_talla_insumos no existe, omitiendo...';
  END;

  -- 3. Eliminar detalle_compras_insumos
  BEGIN
    DELETE FROM detalle_compras_insumos;
    RAISE NOTICE '✅ detalle_compras_insumos eliminado';
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE '⚠️  detalle_compras_insumos no existe, omitiendo...';
  END;

  -- 4. Eliminar compras_insumos
  BEGIN
    DELETE FROM compras_insumos;
    RAISE NOTICE '✅ compras_insumos eliminado';
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE '⚠️  compras_insumos no existe, omitiendo...';
  END;

  -- 5. Eliminar todos los insumos
  BEGIN
    DELETE FROM insumos;
    RAISE NOTICE '✅ insumos eliminado';
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE '⚠️  insumos no existe, omitiendo...';
  END;

  -- 6. Eliminar todas las presentaciones
  BEGIN
    DELETE FROM presentaciones;
    RAISE NOTICE '✅ presentaciones eliminado';
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE '⚠️  presentaciones no existe, omitiendo...';
  END;

  RAISE NOTICE '🎉 Catálogos de insumos y presentaciones reinicializados correctamente';
  RAISE NOTICE '⚠️  Verifica que tallas, prendas y costos NO fueron afectados';
END $$;
