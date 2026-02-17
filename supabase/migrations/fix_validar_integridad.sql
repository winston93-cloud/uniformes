-- Corregir función validar_integridad_sistema
DROP FUNCTION IF EXISTS validar_integridad_sistema();

CREATE OR REPLACE FUNCTION validar_integridad_sistema()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  details TEXT
) AS $$
BEGIN
  -- Check 1: Pedidos sin detalles
  RETURN QUERY
  SELECT 
    'Pedidos sin detalles'::TEXT as check_name,
    CASE 
      WHEN COUNT(*) = 0 THEN 'OK'::TEXT
      ELSE 'ERROR'::TEXT
    END as status,
    ('Encontrados: ' || COUNT(*)::TEXT)::TEXT as details
  FROM pedidos p
  WHERE NOT EXISTS (
    SELECT 1 FROM detalle_pedidos dp WHERE dp.pedido_id = p.id
  );
  
  -- Check 2: Stock negativo
  RETURN QUERY
  SELECT 
    'Stock negativo'::TEXT,
    CASE 
      WHEN COUNT(*) = 0 THEN 'OK'::TEXT
      ELSE 'ERROR'::TEXT
    END,
    ('Encontrados: ' || COUNT(*)::TEXT)::TEXT
  FROM costos
  WHERE stock < 0;
  
  -- Check 3: Totales incorrectos
  RETURN QUERY
  SELECT 
    'Totales de pedidos incorrectos'::TEXT,
    CASE 
      WHEN COUNT(*) = 0 THEN 'OK'::TEXT
      ELSE 'WARNING'::TEXT
    END,
    ('Encontrados: ' || COUNT(*)::TEXT)::TEXT
  FROM (
    SELECT p.id
    FROM pedidos p
    LEFT JOIN detalle_pedidos dp ON p.id = dp.pedido_id
    GROUP BY p.id, p.total
    HAVING ABS(p.total - COALESCE(SUM(dp.subtotal), 0)) > 0.01
  ) sub;
  
  -- Check 4: Pedidos sin sucursal
  RETURN QUERY
  SELECT 
    'Pedidos sin sucursal_id'::TEXT,
    CASE 
      WHEN COUNT(*) = 0 THEN 'OK'::TEXT
      ELSE 'ERROR'::TEXT
    END,
    ('Encontrados: ' || COUNT(*)::TEXT)::TEXT
  FROM pedidos
  WHERE sucursal_id IS NULL;
  
  -- Check 5: Costos sin sucursal
  RETURN QUERY
  SELECT 
    'Costos sin sucursal_id'::TEXT,
    CASE 
      WHEN COUNT(*) = 0 THEN 'OK'::TEXT
      ELSE 'ERROR'::TEXT
    END,
    ('Encontrados: ' || COUNT(*)::TEXT)::TEXT
  FROM costos
  WHERE sucursal_id IS NULL;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION validar_integridad_sistema TO authenticated;
GRANT EXECUTE ON FUNCTION validar_integridad_sistema TO anon;

COMMENT ON FUNCTION validar_integridad_sistema IS 'Ejecuta checks de integridad y retorna tabla con resultados. Usar para auditorías periódicas.';
