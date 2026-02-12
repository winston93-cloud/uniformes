-- ============================================
-- MIGRACIÓN FINAL: PENDIENTE Y COMPLETADO
-- ============================================
-- Cambiar estados de pedidos a PENDIENTE y COMPLETADO
-- PENDIENTE = artículos pendientes de entrega (ya pagado)
-- COMPLETADO = todo entregado correctamente (ya pagado)

-- 1. ACTUALIZAR CONSTRAINT DE LA TABLA PEDIDOS
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_estado_check 
  CHECK (estado IN ('PENDIENTE', 'COMPLETADO', 'CANCELADO'));

-- 2. ACTUALIZAR REGISTROS EXISTENTES
UPDATE pedidos SET estado = 'PENDIENTE' WHERE estado = 'PEDIDO';
UPDATE pedidos SET estado = 'COMPLETADO' WHERE estado = 'ENTREGADO';

-- 3. ELIMINAR TODAS LAS VERSIONES ANTERIORES DE LA FUNCIÓN
DROP FUNCTION IF EXISTS crear_pedido_atomico(VARCHAR, VARCHAR, UUID, SMALLINT, UUID, UUID, VARCHAR, TEXT, JSONB);
DROP FUNCTION IF EXISTS crear_pedido_atomico(VARCHAR, VARCHAR, UUID, UUID, UUID, UUID, VARCHAR, TEXT, JSONB);
DROP FUNCTION IF EXISTS crear_pedido_atomico;

-- 4. CREAR FUNCIÓN FINAL CON ESTADOS CORRECTOS
CREATE OR REPLACE FUNCTION crear_pedido_atomico(
  p_tipo_cliente VARCHAR,
  p_cliente_nombre VARCHAR,
  p_sucursal_id UUID,
  p_usuario_id UUID DEFAULT NULL,
  p_alumno_id UUID DEFAULT NULL,
  p_externo_id UUID DEFAULT NULL,
  p_estado VARCHAR DEFAULT 'PENDIENTE',
  p_notas TEXT DEFAULT NULL,
  p_detalles JSONB DEFAULT '[]'::JSONB
)
RETURNS JSON AS $$
DECLARE
  v_pedido_id UUID;
  v_detalle JSONB;
  v_costo_id UUID;
  v_precio_unitario DECIMAL(10,2);
  v_cantidad_total INTEGER;
  v_cantidad_con_stock INTEGER;
  v_cantidad_pendiente INTEGER;
  v_detalle_pedido_id UUID;
  v_subtotal_calculado DECIMAL(10,2) := 0;
  v_total_calculado DECIMAL(10,2) := 0;
  v_prenda_nombre VARCHAR;
  v_talla_nombre VARCHAR;
  v_insumo_record RECORD;
BEGIN
  RAISE NOTICE '======================================== CREANDO PEDIDO ========================================';
  
  -- VALIDACIONES
  IF p_tipo_cliente IS NULL OR p_cliente_nombre IS NULL OR p_sucursal_id IS NULL THEN
    RAISE EXCEPTION 'Faltan datos obligatorios';
  END IF;
  
  IF jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'No se pueden crear pedidos sin detalles';
  END IF;
  
  -- CALCULAR TOTALES
  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    v_cantidad_total := COALESCE((v_detalle->>'cantidad')::INTEGER, 0);
    
    SELECT COALESCE(c.precio_menudeo, c.precio_venta, 0)
    INTO v_precio_unitario
    FROM costos c
    WHERE c.prenda_id = (v_detalle->>'prenda_id')::UUID
      AND c.talla_id = (v_detalle->>'talla_id')::UUID
      AND c.sucursal_id = p_sucursal_id;
    
    v_subtotal_calculado := v_subtotal_calculado + (v_cantidad_total * v_precio_unitario);
  END LOOP;
  
  v_total_calculado := v_subtotal_calculado;
  
  -- INSERTAR PEDIDO
  INSERT INTO pedidos (
    tipo_cliente, cliente_nombre, sucursal_id, usuario_id,
    alumno_id, externo_id, estado, subtotal, total, notas
  ) VALUES (
    p_tipo_cliente, UPPER(p_cliente_nombre), p_sucursal_id, p_usuario_id,
    p_alumno_id, p_externo_id, p_estado, v_subtotal_calculado, v_total_calculado, p_notas
  ) RETURNING id INTO v_pedido_id;
  
  RAISE NOTICE 'Pedido creado: %', v_pedido_id;
  
  -- INSERTAR DETALLES Y ACTUALIZAR STOCK
  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    v_cantidad_total := COALESCE((v_detalle->>'cantidad')::INTEGER, 0);
    v_cantidad_con_stock := COALESCE((v_detalle->>'cantidad_con_stock')::INTEGER, v_cantidad_total);
    v_cantidad_pendiente := COALESCE((v_detalle->>'cantidad_pendiente')::INTEGER, 0);
    
    IF v_cantidad_con_stock + v_cantidad_pendiente != v_cantidad_total THEN
      v_cantidad_pendiente := v_cantidad_total - v_cantidad_con_stock;
    END IF;
    
    SELECT c.id, COALESCE(c.precio_menudeo, c.precio_venta, 0), p.nombre, t.nombre
    INTO v_costo_id, v_precio_unitario, v_prenda_nombre, v_talla_nombre
    FROM costos c
    JOIN prendas p ON c.prenda_id = p.id
    JOIN tallas t ON c.talla_id = t.id
    WHERE c.prenda_id = (v_detalle->>'prenda_id')::UUID
      AND c.talla_id = (v_detalle->>'talla_id')::UUID
      AND c.sucursal_id = p_sucursal_id;
    
    -- INSERTAR DETALLE
    INSERT INTO detalle_pedidos (
      pedido_id, prenda_id, talla_id, cantidad, precio_unitario,
      subtotal, pendiente, especificaciones
    ) VALUES (
      v_pedido_id,
      (v_detalle->>'prenda_id')::UUID,
      (v_detalle->>'talla_id')::UUID,
      v_cantidad_total,
      v_precio_unitario,
      v_cantidad_total * v_precio_unitario,
      v_cantidad_pendiente,
      UPPER(COALESCE(v_detalle->>'especificaciones', ''))
    ) RETURNING id INTO v_detalle_pedido_id;
    
    -- ACTUALIZAR STOCK Y REGISTRAR MOVIMIENTO
    IF v_cantidad_con_stock > 0 THEN
      UPDATE costos
      SET stock = stock - v_cantidad_con_stock
      WHERE id = v_costo_id AND stock >= v_cantidad_con_stock;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock insuficiente para % talla %', v_prenda_nombre, v_talla_nombre;
      END IF;
      
      INSERT INTO movimientos (tipo, costo_id, cantidad, observaciones, usuario_id)
      VALUES (
        'SALIDA',
        v_costo_id,
        -v_cantidad_con_stock,
        'VENTA - Pedido #' || v_pedido_id || 
          CASE 
            WHEN v_cantidad_pendiente > 0 
            THEN ' (' || v_cantidad_con_stock || ' entregadas, ' || v_cantidad_pendiente || ' pendientes)'
            ELSE ' (' || v_cantidad_con_stock || ' entregadas)'
          END,
        p_usuario_id
      );
      
      RAISE NOTICE 'Stock actualizado: % - %', v_prenda_nombre, v_talla_nombre;
    END IF;
    
    -- SNAPSHOT DE INSUMOS
    FOR v_insumo_record IN 
      SELECT pti.insumo_id, i.nombre, pti.cantidad
      FROM prenda_talla_insumos pti
      JOIN insumos i ON pti.insumo_id = i.id
      WHERE pti.prenda_id = (v_detalle->>'prenda_id')::UUID
        AND pti.talla_id = (v_detalle->>'talla_id')::UUID
    LOOP
      INSERT INTO snapshot_insumos_pedido (
        detalle_pedido_id, prenda_id, talla_id,
        insumo_id, insumo_nombre, cantidad_insumo
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
  
  -- AUDITORÍA
  IF p_usuario_id IS NOT NULL THEN
    INSERT INTO auditoria (tabla_afectada, accion, registro_id, usuario_id, detalles)
    VALUES (
      'pedidos', 'INSERT', v_pedido_id, p_usuario_id,
      jsonb_build_object(
        'pedido_id', v_pedido_id,
        'cliente', p_cliente_nombre,
        'total', v_total_calculado,
        'num_detalles', jsonb_array_length(p_detalles)
      )
    );
  END IF;
  
  RAISE NOTICE '======================================== PEDIDO CREADO OK ========================================';
  
  RETURN json_build_object(
    'success', true,
    'pedido_id', v_pedido_id,
    'message', 'Pedido creado correctamente'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR: %', SQLERRM;
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Error al crear pedido'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. PERMISOS
GRANT EXECUTE ON FUNCTION crear_pedido_atomico TO authenticated;
GRANT EXECUTE ON FUNCTION crear_pedido_atomico TO anon;

-- 6. COMENTARIO
COMMENT ON FUNCTION crear_pedido_atomico IS 'Crea pedidos con división automática. PENDIENTE = pendientes de entrega. COMPLETADO = todo entregado.';
