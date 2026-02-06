-- =====================================================
-- CORRECCIONES DE INTEGRIDAD Y ATOMICIDAD
-- =====================================================
-- Garantiza que los datos se guarden y consulten correctamente
-- sin posibilidad de errores o inconsistencias
-- =====================================================

-- 1. AGREGAR CONSTRAINTS FALTANTES PARA PREVENIR DATOS INVÁLIDOS
-- =====================================================

-- Prevenir stock negativo (si no existe ya)
DO $$
BEGIN
    ALTER TABLE costos DROP CONSTRAINT IF EXISTS check_stock_no_negativo;
    ALTER TABLE costos ADD CONSTRAINT check_stock_no_negativo CHECK (stock >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Prevenir totales negativos o cero en pedidos
DO $$
BEGIN
    ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS check_total_positivo;
    ALTER TABLE pedidos ADD CONSTRAINT check_total_positivo CHECK (total > 0 AND subtotal > 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Prevenir cantidades negativas o cero
DO $$
BEGIN
    ALTER TABLE detalle_pedidos DROP CONSTRAINT IF EXISTS check_cantidad_positiva;
    ALTER TABLE detalle_pedidos ADD CONSTRAINT check_cantidad_positiva CHECK (cantidad > 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Prevenir que cantidad devuelta sea mayor que cantidad original
-- (se validará en trigger porque necesita comparar con detalle_pedidos)


-- 2. TABLA DE AUDITORÍA PARA TRAZABILIDAD
-- =====================================================

CREATE TABLE IF NOT EXISTS auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla VARCHAR(100) NOT NULL,
  operacion VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
  registro_id UUID,
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  usuario_id SMALLINT REFERENCES usuario(usuario_id),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON auditoria(tabla);
CREATE INDEX IF NOT EXISTS idx_auditoria_timestamp ON auditoria(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);

COMMENT ON TABLE auditoria IS 'Registro de cambios en tablas críticas para trazabilidad';


-- 3. SNAPSHOT DE INSUMOS EN PEDIDOS (HISTORIAL)
-- =====================================================
-- Cuando se crea un pedido, guardar snapshot de los insumos
-- para que si cambian después, el pedido mantenga su receta original

CREATE TABLE IF NOT EXISTS snapshot_insumos_pedido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  detalle_pedido_id UUID NOT NULL REFERENCES detalle_pedidos(id) ON DELETE CASCADE,
  prenda_id UUID NOT NULL,
  talla_id UUID NOT NULL,
  insumo_id UUID NOT NULL,
  insumo_nombre VARCHAR(255) NOT NULL,
  cantidad_insumo DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_snapshot_detalle ON snapshot_insumos_pedido(detalle_pedido_id);

COMMENT ON TABLE snapshot_insumos_pedido IS 'Snapshot de insumos en el momento de crear pedido. Preserva receta original aunque cambien los insumos después.';


-- 4. FUNCIÓN ATÓMICA PARA CREAR PEDIDO CON VALIDACIÓN DE STOCK
-- =====================================================

CREATE OR REPLACE FUNCTION crear_pedido_atomico(
  p_tipo_cliente VARCHAR,
  p_cliente_nombre VARCHAR,
  p_sucursal_id UUID,
  p_usuario_id SMALLINT,
  p_alumno_id UUID DEFAULT NULL,
  p_externo_id UUID DEFAULT NULL,
  p_estado VARCHAR DEFAULT 'PEDIDO',
  p_notas TEXT DEFAULT NULL,
  p_detalles JSONB DEFAULT '[]'::JSONB
)
RETURNS JSON AS $$
DECLARE
  v_pedido_id UUID;
  v_detalle JSONB;
  v_stock_actual INTEGER;
  v_subtotal_calculado DECIMAL(10, 2);
  v_total_calculado DECIMAL(10, 2);
  v_costo_id UUID;
  v_precio_unitario DECIMAL(10, 2);
  v_detalle_pedido_id UUID;
  v_insumo_record RECORD;
BEGIN
  -- Iniciar transacción (implícita en función)
  
  -- Validar que haya detalles
  IF jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'El pedido debe tener al menos un artículo';
  END IF;
  
  -- 1. PRE-VALIDAR STOCK de TODOS los items ANTES de insertar nada
  v_subtotal_calculado := 0;
  
  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    -- Buscar el costo y validar stock
    SELECT id, stock, 
           COALESCE(precio_menudeo, precio_venta, 0) as precio
    INTO v_costo_id, v_stock_actual, v_precio_unitario
    FROM costos
    WHERE prenda_id = (v_detalle->>'prenda_id')::UUID
      AND talla_id = (v_detalle->>'talla_id')::UUID
      AND sucursal_id = p_sucursal_id
      AND activo = true;
    
    -- Si no existe el costo
    IF v_costo_id IS NULL THEN
      RAISE EXCEPTION 'No existe precio para prenda % talla % en esta sucursal', 
        (v_detalle->>'prenda_id'), (v_detalle->>'talla_id');
    END IF;
    
    -- Validar stock suficiente ANTES de proceder
    IF v_stock_actual < (v_detalle->>'cantidad')::INTEGER THEN
      RAISE EXCEPTION 'Stock insuficiente. Disponible: %, Solicitado: %', 
        v_stock_actual, (v_detalle->>'cantidad')::INTEGER;
    END IF;
    
    -- Acumular subtotal
    v_subtotal_calculado := v_subtotal_calculado + 
      ((v_detalle->>'cantidad')::INTEGER * v_precio_unitario);
  END LOOP;
  
  -- Calcular total (por ahora igual a subtotal, puede incluir impuestos después)
  v_total_calculado := v_subtotal_calculado;
  
  -- 2. INSERTAR PEDIDO con totales calculados en BD (no del frontend)
  INSERT INTO pedidos (
    tipo_cliente,
    cliente_nombre,
    sucursal_id,
    usuario_id,
    alumno_id,
    externo_id,
    estado,
    subtotal,
    total,
    notas
  ) VALUES (
    p_tipo_cliente,
    p_cliente_nombre,
    p_sucursal_id,
    p_usuario_id,
    p_alumno_id,
    p_externo_id,
    p_estado,
    v_subtotal_calculado,
    v_total_calculado,
    p_notas
  ) RETURNING id INTO v_pedido_id;
  
  -- 3. INSERTAR DETALLES Y ACTUALIZAR STOCK ATÓMICAMENTE
  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    -- Obtener costo_id y precio actual
    SELECT id, COALESCE(precio_menudeo, precio_venta, 0)
    INTO v_costo_id, v_precio_unitario
    FROM costos
    WHERE prenda_id = (v_detalle->>'prenda_id')::UUID
      AND talla_id = (v_detalle->>'talla_id')::UUID
      AND sucursal_id = p_sucursal_id;
    
    -- Insertar detalle
    INSERT INTO detalle_pedidos (
      pedido_id,
      prenda_id,
      talla_id,
      cantidad,
      precio_unitario,
      subtotal,
      pendiente,
      especificaciones
    ) VALUES (
      v_pedido_id,
      (v_detalle->>'prenda_id')::UUID,
      (v_detalle->>'talla_id')::UUID,
      (v_detalle->>'cantidad')::INTEGER,
      v_precio_unitario,
      (v_detalle->>'cantidad')::INTEGER * v_precio_unitario,
      (v_detalle->>'cantidad')::INTEGER,
      v_detalle->>'especificaciones'
    ) RETURNING id INTO v_detalle_pedido_id;
    
    -- ACTUALIZAR STOCK ATÓMICAMENTE
    -- Si no hay stock suficiente, la transacción completa hace rollback
    UPDATE costos
    SET stock = stock - (v_detalle->>'cantidad')::INTEGER
    WHERE id = v_costo_id
      AND stock >= (v_detalle->>'cantidad')::INTEGER;
    
    -- Verificar que se actualizó (si no, significa stock insuficiente)
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Race condition detectada: stock insuficiente al momento de actualizar';
    END IF;
    
    -- REGISTRAR MOVIMIENTO para trazabilidad
    INSERT INTO movimientos (tipo, costo_id, cantidad, observaciones, usuario_id)
    VALUES (
      'SALIDA',
      v_costo_id,
      -(v_detalle->>'cantidad')::INTEGER,
      'Venta - Pedido #' || v_pedido_id,
      p_usuario_id
    );
    
    -- GUARDAR SNAPSHOT de insumos (preservar receta original)
    FOR v_insumo_record IN 
      SELECT pti.insumo_id, i.nombre, pti.cantidad
      FROM prenda_talla_insumos pti
      JOIN insumos i ON pti.insumo_id = i.id
      WHERE pti.prenda_id = (v_detalle->>'prenda_id')::UUID
        AND pti.talla_id = (v_detalle->>'talla_id')::UUID
    LOOP
      INSERT INTO snapshot_insumos_pedido (
        detalle_pedido_id,
        prenda_id,
        talla_id,
        insumo_id,
        insumo_nombre,
        cantidad_insumo
      ) VALUES (
        v_detalle_pedido_id,
        (v_detalle->>'prenda_id')::UUID,
        (v_detalle->>'talla_id')::UUID,
        v_insumo_record.insumo_id,
        v_insumo_record.nombre,
        v_insumo_record.cantidad
      );
    END LOOP;
    
  END LOOP;
  
  -- 4. AUDITAR operación
  INSERT INTO auditoria (tabla, operacion, registro_id, datos_nuevos, usuario_id)
  VALUES (
    'pedidos',
    'INSERT',
    v_pedido_id,
    jsonb_build_object(
      'pedido_id', v_pedido_id,
      'total', v_total_calculado,
      'items', p_detalles
    ),
    p_usuario_id
  );
  
  -- Retornar resultado exitoso
  RETURN json_build_object(
    'success', true,
    'pedido_id', v_pedido_id,
    'total', v_total_calculado,
    'message', 'Pedido creado correctamente'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- En caso de cualquier error, rollback automático
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Error al crear pedido: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos de ejecución
GRANT EXECUTE ON FUNCTION crear_pedido_atomico TO authenticated;
GRANT EXECUTE ON FUNCTION crear_pedido_atomico TO anon;

COMMENT ON FUNCTION crear_pedido_atomico IS 'Crea pedido de forma atómica: valida stock, inserta pedido+detalles, actualiza inventario, registra movimientos, guarda snapshot de insumos. TODO-O-NADA.';


-- 5. FUNCIÓN ATÓMICA PARA DEVOLUCIONES
-- =====================================================

CREATE OR REPLACE FUNCTION procesar_devolucion_atomica(
  p_devolucion_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_detalle RECORD;
  v_pedido_id UUID;
  v_sucursal_id UUID;
BEGIN
  -- Obtener datos de la devolución
  SELECT pedido_id, sucursal_id 
  INTO v_pedido_id, v_sucursal_id
  FROM devoluciones
  WHERE id = p_devolucion_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Devolución no encontrada';
  END IF;
  
  -- Procesar cada detalle de devolución
  FOR v_detalle IN 
    SELECT * FROM detalle_devoluciones WHERE devolucion_id = p_devolucion_id
  LOOP
    -- DEVOLVER STOCK (sumar cantidad devuelta) ATÓMICAMENTE
    UPDATE costos
    SET stock = stock + v_detalle.cantidad_devuelta
    WHERE prenda_id = v_detalle.prenda_id
      AND talla_id = v_detalle.talla_id
      AND sucursal_id = v_sucursal_id;
    
    -- Registrar movimiento de ENTRADA
    INSERT INTO movimientos (tipo, costo_id, cantidad, observaciones)
    SELECT 
      'ENTRADA',
      c.id,
      v_detalle.cantidad_devuelta,
      'Devolución #' || p_devolucion_id
    FROM costos c
    WHERE c.prenda_id = v_detalle.prenda_id
      AND c.talla_id = v_detalle.talla_id
      AND c.sucursal_id = v_sucursal_id;
    
    -- Si es CAMBIO: restar del nuevo artículo
    IF v_detalle.es_cambio AND v_detalle.prenda_cambio_id IS NOT NULL THEN
      UPDATE costos
      SET stock = stock - v_detalle.cantidad_cambio
      WHERE prenda_id = v_detalle.prenda_cambio_id
        AND talla_id = v_detalle.talla_cambio_id
        AND sucursal_id = v_sucursal_id
        AND stock >= v_detalle.cantidad_cambio;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock insuficiente para el artículo de cambio';
      END IF;
      
      -- Registrar movimiento de SALIDA para el cambio
      INSERT INTO movimientos (tipo, costo_id, cantidad, observaciones)
      SELECT 
        'SALIDA',
        c.id,
        -v_detalle.cantidad_cambio,
        'Cambio - Devolución #' || p_devolucion_id
      FROM costos c
      WHERE c.prenda_id = v_detalle.prenda_cambio_id
        AND c.talla_id = v_detalle.talla_cambio_id
        AND c.sucursal_id = v_sucursal_id;
    END IF;
  END LOOP;
  
  -- Marcar devolución como procesada
  UPDATE devoluciones
  SET estado = 'PROCESADA',
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_devolucion_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Devolución procesada correctamente'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION procesar_devolucion_atomica TO authenticated;

COMMENT ON FUNCTION procesar_devolucion_atomica IS 'Procesa devolución atómicamente: devuelve stock, registra movimientos, maneja cambios. TODO-O-NADA.';


-- 6. TRIGGER PARA VALIDAR TOTALES AUTOMÁTICAMENTE
-- =====================================================

CREATE OR REPLACE FUNCTION validar_total_pedido()
RETURNS TRIGGER AS $$
DECLARE
  v_total_calculado DECIMAL(10, 2);
BEGIN
  -- Calcular total desde detalles
  SELECT COALESCE(SUM(subtotal), 0)
  INTO v_total_calculado
  FROM detalle_pedidos
  WHERE pedido_id = NEW.id;
  
  -- Si el total calculado difiere del total guardado por más de 0.01
  IF ABS(v_total_calculado - COALESCE(NEW.total, 0)) > 0.01 THEN
    RAISE WARNING 'Total del pedido % no coincide: calculado %, guardado %', 
      NEW.id, v_total_calculado, NEW.total;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validar_total_pedido
  AFTER INSERT OR UPDATE ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION validar_total_pedido();


-- 7. TRIGGER PARA AUDITAR CAMBIOS EN COSTOS (STOCK)
-- =====================================================

CREATE OR REPLACE FUNCTION audit_costos_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo auditar si cambió el stock
  IF OLD.stock IS DISTINCT FROM NEW.stock THEN
    INSERT INTO auditoria (tabla, operacion, registro_id, datos_anteriores, datos_nuevos)
    VALUES (
      'costos',
      'UPDATE',
      NEW.id,
      jsonb_build_object(
        'stock', OLD.stock,
        'prenda_id', OLD.prenda_id,
        'talla_id', OLD.talla_id,
        'sucursal_id', OLD.sucursal_id
      ),
      jsonb_build_object(
        'stock', NEW.stock,
        'diferencia', NEW.stock - OLD.stock
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_costos
  AFTER UPDATE ON costos
  FOR EACH ROW
  EXECUTE FUNCTION audit_costos_changes();


-- 8. FUNCIÓN PARA VALIDAR INTEGRIDAD DE DATOS
-- =====================================================

CREATE OR REPLACE FUNCTION validar_integridad_sistema()
RETURNS TABLE (
  check_name VARCHAR,
  status VARCHAR,
  details TEXT
) AS $$
BEGIN
  -- Check 1: Pedidos sin detalles
  RETURN QUERY
  SELECT 
    'Pedidos sin detalles'::VARCHAR as check_name,
    CASE 
      WHEN COUNT(*) = 0 THEN 'OK'
      ELSE 'ERROR'
    END as status,
    'Encontrados: ' || COUNT(*)::TEXT as details
  FROM pedidos p
  WHERE NOT EXISTS (
    SELECT 1 FROM detalle_pedidos dp WHERE dp.pedido_id = p.id
  );
  
  -- Check 2: Stock negativo
  RETURN QUERY
  SELECT 
    'Stock negativo'::VARCHAR,
    CASE 
      WHEN COUNT(*) = 0 THEN 'OK'
      ELSE 'ERROR'
    END,
    'Encontrados: ' || COUNT(*)::TEXT
  FROM costos
  WHERE stock < 0;
  
  -- Check 3: Totales incorrectos
  RETURN QUERY
  SELECT 
    'Totales de pedidos incorrectos'::VARCHAR,
    CASE 
      WHEN COUNT(*) = 0 THEN 'OK'
      ELSE 'WARNING'
    END,
    'Encontrados: ' || COUNT(*)::TEXT
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
    'Pedidos sin sucursal_id'::VARCHAR,
    CASE 
      WHEN COUNT(*) = 0 THEN 'OK'
      ELSE 'ERROR'
    END,
    'Encontrados: ' || COUNT(*)::TEXT
  FROM pedidos
  WHERE sucursal_id IS NULL;
  
  -- Check 5: Costos sin sucursal
  RETURN QUERY
  SELECT 
    'Costos sin sucursal_id'::VARCHAR,
    CASE 
      WHEN COUNT(*) = 0 THEN 'OK'
      ELSE 'ERROR'
    END,
    'Encontrados: ' || COUNT(*)::TEXT
  FROM costos
  WHERE sucursal_id IS NULL;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION validar_integridad_sistema TO authenticated;

COMMENT ON FUNCTION validar_integridad_sistema IS 'Ejecuta checks de integridad y retorna tabla con resultados. Usar para auditorías periódicas.';


-- 9. VISTA MATERIALIZADA PARA REPORTES RÁPIDOS
-- =====================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_ventas_por_sucursal AS
SELECT 
  s.id as sucursal_id,
  s.nombre as sucursal_nombre,
  DATE_TRUNC('day', p.created_at) as fecha,
  COUNT(p.id) as total_pedidos,
  SUM(p.total) as total_ventas,
  SUM(dp.cantidad) as total_prendas_vendidas
FROM sucursales s
LEFT JOIN pedidos p ON s.id = p.sucursal_id AND p.estado = 'LIQUIDADO'
LEFT JOIN detalle_pedidos dp ON p.id = dp.pedido_id
GROUP BY s.id, s.nombre, DATE_TRUNC('day', p.created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_ventas_sucursal_fecha 
  ON mv_ventas_por_sucursal(sucursal_id, fecha);

COMMENT ON MATERIALIZED VIEW mv_ventas_por_sucursal IS 'Vista precalculada de ventas por sucursal y fecha. Refresh diario para reportes rápidos.';


-- 10. FUNCIÓN PARA REFRESCAR VISTAS MATERIALIZADAS
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_reportes()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ventas_por_sucursal;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_reportes IS 'Refresca vistas materializadas para reportes. Ejecutar diariamente (cron job).';


-- =====================================================
-- SCRIPT COMPLETADO
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Correcciones de integridad aplicadas correctamente';
  RAISE NOTICE '📋 Nuevas funciones disponibles:';
  RAISE NOTICE '   - crear_pedido_atomico() - Crear pedidos con validación de stock';
  RAISE NOTICE '   - procesar_devolucion_atomica() - Procesar devoluciones con validación';
  RAISE NOTICE '   - validar_integridad_sistema() - Ejecutar checks de integridad';
  RAISE NOTICE '   - refresh_reportes() - Actualizar vistas materializadas';
  RAISE NOTICE '📊 Nuevas tablas:';
  RAISE NOTICE '   - auditoria - Trazabilidad de cambios';
  RAISE NOTICE '   - snapshot_insumos_pedido - Historial de recetas';
  RAISE NOTICE '🔒 Nuevos constraints:';
  RAISE NOTICE '   - check_stock_no_negativo';
  RAISE NOTICE '   - check_total_positivo';
  RAISE NOTICE '   - check_cantidad_positiva';
END $$;
