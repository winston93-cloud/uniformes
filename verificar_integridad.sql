-- Verificar que las funciones atómicas existen
SELECT 
  'Funciones Atómicas' as tipo,
  proname as nombre,
  'EXISTS' as estado
FROM pg_proc 
WHERE proname IN ('crear_pedido_atomico', 'procesar_devolucion_atomica', 'validar_integridad_sistema')
ORDER BY proname;

-- Verificar que las tablas nuevas existen
SELECT 
  'Tablas Nuevas' as tipo,
  table_name as nombre,
  'EXISTS' as estado
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('auditoria', 'snapshot_insumos_pedido')
ORDER BY table_name;

-- Verificar constraints importantes
SELECT 
  'Constraints' as tipo,
  conname as nombre,
  'EXISTS' as estado
FROM pg_constraint
WHERE conname IN ('check_stock_no_negativo', 'check_total_positivo', 'check_cantidad_positiva')
ORDER BY conname;

-- Verificar triggers
SELECT 
  'Triggers' as tipo,
  trigger_name as nombre,
  'EXISTS' as estado
FROM information_schema.triggers
WHERE trigger_name IN ('trigger_validar_total_pedido', 'trigger_audit_costos')
ORDER BY trigger_name;
