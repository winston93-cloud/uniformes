-- ============================================
-- REINICIALIZAR CATÁLOGOS DE INSUMOS Y PRESENTACIONES
-- ============================================
-- PRECAUCIÓN: Esto eliminará todos los insumos, presentaciones
-- y sus relaciones, pero NO tocará tallas, prendas ni costos.
-- ============================================

DO $$
BEGIN
  -- 1. Eliminar snapshot_insumos_pedido (si existe y tiene relación con insumos)
  DELETE FROM snapshot_insumos_pedido;
  RAISE NOTICE '✅ snapshot_insumos_pedido eliminado';

  -- 2. Eliminar prenda_talla_insumos (relación entre prendas, tallas e insumos)
  DELETE FROM prenda_talla_insumos;
  RAISE NOTICE '✅ prenda_talla_insumos eliminado';

  -- 3. Eliminar compras_insumos (si existe)
  DELETE FROM compras_insumos;
  RAISE NOTICE '✅ compras_insumos eliminado';

  -- 4. Eliminar detalle_compras_insumos (si existe)
  DELETE FROM detalle_compras_insumos;
  RAISE NOTICE '✅ detalle_compras_insumos eliminado';

  -- 5. Eliminar movimientos relacionados con insumos (si aplica)
  -- Solo si existe una tabla de movimientos de insumos
  -- DELETE FROM movimientos_insumos;

  -- 6. Eliminar todos los insumos
  DELETE FROM insumos;
  RAISE NOTICE '✅ insumos eliminado';

  -- 7. Eliminar todas las presentaciones (debe ser después de insumos)
  DELETE FROM presentaciones;
  RAISE NOTICE '✅ presentaciones eliminado';

  -- Resetear secuencias si es necesario
  -- ALTER SEQUENCE IF EXISTS insumos_id_seq RESTART WITH 1;
  -- ALTER SEQUENCE IF EXISTS presentaciones_id_seq RESTART WITH 1;

  RAISE NOTICE '🎉 Catálogos de insumos y presentaciones reinicializados correctamente';
  RAISE NOTICE '⚠️  Verifica que tallas, prendas y costos NO fueron afectados';
END $$;
