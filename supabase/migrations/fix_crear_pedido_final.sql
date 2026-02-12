-- ================================================
-- FUNCIÓN CRÍTICA: crear_pedido_atomico
-- Versión FINAL con todas las correcciones
-- ================================================
-- 
-- Funcionalidad:
-- 1. División automática de partidas (cantidad_con_stock + cantidad_pendiente)
-- 2. Descuento de stock SOLO de cantidad_con_stock
-- 3. Registro correcto de pendientes en detalle_pedidos
-- 4. Transaccionalidad completa (rollback automático en errores)
-- 5. Auditoría completa de operaciones
-- 6. Snapshot de insumos para trazabilidad
-- 
-- Correcciones aplicadas:
-- - p_usuario_id cambiado de SMALLINT a UUID
-- - Soporte para cantidad_con_stock y cantidad_pendiente
-- - Validación robusta de stock
-- - Manejo correcto de errores con mensajes descriptivos
-- ================================================

CREATE OR REPLACE FUNCTION crear_pedido_atomico(
  p_tipo_cliente VARCHAR,
  p_cliente_nombre VARCHAR,
  p_sucursal_id UUID,
  p_usuario_id UUID,
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
  v_cantidad_con_stock INTEGER;
  v_cantidad_pendiente INTEGER;
  v_cantidad_total INTEGER;
  v_prenda_nombre VARCHAR;
  v_talla_nombre VARCHAR;
BEGIN
  -- ========================================
  -- 1. VALIDACIONES INICIALES
  -- ========================================
  
  IF p_sucursal_id IS NULL THEN
    RAISE EXCEPTION 'La sucursal es obligatoria';
  END IF;
  
  IF p_tipo_cliente IS NULL OR p_cliente_nombre IS NULL THEN
    RAISE EXCEPTION 'El tipo de cliente y nombre son obligatorios';
  END IF;
  
  IF jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'El pedido debe tener al menos un artículo';
  END IF;
  
  -- ========================================
  -- 2. PRE-VALIDAR STOCK Y CALCULAR TOTALES
  -- ========================================
  
  v_subtotal_calculado := 0;
  
  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    -- Extraer cantidades (con valores por defecto seguros)
    v_cantidad_total := COALESCE((v_detalle->>'cantidad')::INTEGER, 0);
    v_cantidad_con_stock := COALESCE((v_detalle->>'cantidad_con_stock')::INTEGER, v_cantidad_total);
    v_cantidad_pendiente := COALESCE((v_detalle->>'cantidad_pendiente')::INTEGER, 0);
    
    -- Validar que las cantidades sean coherentes
    IF v_cantidad_total <= 0 THEN
      RAISE EXCEPTION 'La cantidad debe ser mayor a 0';
    END IF;
    
    IF v_cantidad_con_stock + v_cantidad_pendiente != v_cantidad_total THEN
      RAISE WARNING 'Inconsistencia en cantidades: total=%, con_stock=%, pendiente=%', 
        v_cantidad_total, v_cantidad_con_stock, v_cantidad_pendiente;
      -- Recalcular para consistencia
      v_cantidad_pendiente := v_cantidad_total - v_cantidad_con_stock;
    END IF;
    
    -- Buscar el costo y obtener información completa
    SELECT 
      c.id, 
      c.stock, 
      COALESCE(c.precio_menudeo, c.precio_venta, 0) as precio,
      p.nombre as prenda_nombre,
      t.nombre as talla_nombre
    INTO 
      v_costo_id, 
      v_stock_actual, 
      v_precio_unitario,
      v_prenda_nombre,
      v_talla_nombre
    FROM costos c
    JOIN prendas p ON c.prenda_id = p.id
    JOIN tallas t ON c.talla_id = t.id
    WHERE c.prenda_id = (v_detalle->>'prenda_id')::UUID
      AND c.talla_id = (v_detalle->>'talla_id')::UUID
      AND c.sucursal_id = p_sucursal_id
      AND c.activo = true;
    
    -- Si no existe el costo/precio
    IF v_costo_id IS NULL THEN
      RAISE EXCEPTION 'No existe precio para prenda % talla % en esta sucursal', 
        (v_detalle->>'prenda_id'), (v_detalle->>'talla_id');
    END IF;
    
    -- Validar disponibilidad de stock para la cantidad_con_stock
    IF v_cantidad_con_stock > 0 AND v_stock_actual < v_cantidad_con_stock THEN
      RAISE EXCEPTION 'Stock insuficiente para % talla %. Disponible: %, Requerido: %', 
        v_prenda_nombre, v_talla_nombre, v_stock_actual, v_cantidad_con_stock;
    END IF;
    
    -- Acumular subtotal sobre la cantidad TOTAL
    v_subtotal_calculado := v_subtotal_calculado + (v_cantidad_total * v_precio_unitario);
    
    -- Log de validación exitosa
    RAISE NOTICE 'Validado: % talla % - Total:% (Con stock:%, Pendiente:%)', 
      v_prenda_nombre, v_talla_nombre, v_cantidad_total, v_cantidad_con_stock, v_cantidad_pendiente;
  END LOOP;
  
  v_total_calculado := v_subtotal_calculado;
  
  RAISE NOTICE 'Totales calculados: Subtotal=$%, Total=$%', v_subtotal_calculado, v_total_calculado;
  
  -- ========================================
  -- 3. INSERTAR PEDIDO
  -- ========================================
  
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
    UPPER(p_cliente_nombre), -- Guardar en MAYÚSCULAS
    p_sucursal_id,
    p_usuario_id,
    p_alumno_id,
    p_externo_id,
    p_estado,
    v_subtotal_calculado,
    v_total_calculado,
    p_notas
  ) RETURNING id INTO v_pedido_id;
  
  RAISE NOTICE 'Pedido creado con ID: %', v_pedido_id;
  
  -- ========================================
  -- 4. INSERTAR DETALLES Y ACTUALIZAR STOCK
  -- ========================================
  
  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    -- Extraer cantidades
    v_cantidad_total := COALESCE((v_detalle->>'cantidad')::INTEGER, 0);
    v_cantidad_con_stock := COALESCE((v_detalle->>'cantidad_con_stock')::INTEGER, v_cantidad_total);
    v_cantidad_pendiente := COALESCE((v_detalle->>'cantidad_pendiente')::INTEGER, 0);
    
    -- Asegurar consistencia
    IF v_cantidad_con_stock + v_cantidad_pendiente != v_cantidad_total THEN
      v_cantidad_pendiente := v_cantidad_total - v_cantidad_con_stock;
    END IF;
    
    -- Obtener costo_id y precio
    SELECT 
      c.id, 
      COALESCE(c.precio_menudeo, c.precio_venta, 0),
      p.nombre,
      t.nombre
    INTO 
      v_costo_id, 
      v_precio_unitario,
      v_prenda_nombre,
      v_talla_nombre
    FROM costos c
    JOIN prendas p ON c.prenda_id = p.id
    JOIN tallas t ON c.talla_id = t.id
    WHERE c.prenda_id = (v_detalle->>'prenda_id')::UUID
      AND c.talla_id = (v_detalle->>'talla_id')::UUID
      AND c.sucursal_id = p_sucursal_id;
    
    -- Insertar detalle del pedido
    -- IMPORTANTE: cantidad = total, pendiente = solo lo que NO tiene stock
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
      v_cantidad_total, -- CANTIDAD TOTAL solicitada
      v_precio_unitario,
      v_cantidad_total * v_precio_unitario,
      v_cantidad_pendiente, -- SOLO lo pendiente
      UPPER(COALESCE(v_detalle->>'especificaciones', '')) -- Especificaciones en MAYÚSCULAS
    ) RETURNING id INTO v_detalle_pedido_id;
    
    -- ACTUALIZAR STOCK solo si hay cantidad_con_stock > 0
    IF v_cantidad_con_stock > 0 THEN
      -- Descontar SOLO cantidad_con_stock del inventario
      UPDATE costos
      SET stock = stock - v_cantidad_con_stock
      WHERE id = v_costo_id
        AND stock >= v_cantidad_con_stock;
      
      -- Verificar que se actualizó (protección contra race conditions)
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Race condition: Stock insuficiente para % talla % al momento de actualizar', 
          v_prenda_nombre, v_talla_nombre;
      END IF;
      
      -- REGISTRAR MOVIMIENTO DE SALIDA
      INSERT INTO movimientos (tipo, costo_id, cantidad, observaciones, usuario_id)
      VALUES (
        'SALIDA',
        v_costo_id,
        -v_cantidad_con_stock, -- Negativo porque es salida
        'VENTA - Pedido #' || v_pedido_id || 
          CASE 
            WHEN v_cantidad_pendiente > 0 
            THEN ' (' || v_cantidad_con_stock || ' entregadas, ' || v_cantidad_pendiente || ' pendientes)'
            ELSE ' (' || v_cantidad_con_stock || ' entregadas)'
          END,
        p_usuario_id
      );
      
      RAISE NOTICE 'Stock actualizado: % talla % - Descontado: %', 
        v_prenda_nombre, v_talla_nombre, v_cantidad_con_stock;
    END IF;
    
    -- Log de pendientes
    IF v_cantidad_pendiente > 0 THEN
      RAISE NOTICE 'PENDIENTE: % talla % - Cantidad: %',
        v_prenda_nombre, v_talla_nombre, v_cantidad_pendiente;
    END IF;
    
    -- GUARDAR SNAPSHOT de insumos (receta original para trazabilidad)
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
  
  -- ========================================
  -- 5. AUDITAR OPERACIÓN
  -- ========================================
  
  INSERT INTO auditoria (tabla, operacion, registro_id, datos_nuevos, usuario_id)
  VALUES (
    'pedidos',
    'INSERT',
    v_pedido_id,
    jsonb_build_object(
      'pedido_id', v_pedido_id,
      'cliente', p_cliente_nombre,
      'total', v_total_calculado,
      'items', p_detalles
    ),
    p_usuario_id
  );
  
  -- ========================================
  -- 6. RETORNAR ÉXITO
  -- ========================================
  
  RAISE NOTICE '✅ Pedido creado exitosamente: ID=%, Total=$%', v_pedido_id, v_total_calculado;
  
  RETURN json_build_object(
    'success', true,
    'pedido_id', v_pedido_id,
    'total', v_total_calculado,
    'message', 'Pedido creado correctamente'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback automático + mensaje de error detallado
    RAISE WARNING '❌ Error al crear pedido: % - Detalles: %', SQLERRM, SQLSTATE;
    
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE,
      'message', 'Error al crear pedido: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permisos
GRANT EXECUTE ON FUNCTION crear_pedido_atomico TO authenticated;
GRANT EXECUTE ON FUNCTION crear_pedido_atomico TO anon;

-- Documentación
COMMENT ON FUNCTION crear_pedido_atomico IS 
'Función FINAL para crear pedidos con división automática.
- Descuenta stock SOLO de cantidad_con_stock
- Registra pendientes correctamente en detalle_pedidos.pendiente
- Transaccionalidad completa con rollback automático
- Auditoría y trazabilidad completa
- Validaciones robustas de stock y datos
- TODO en MAYÚSCULAS (nombres, especificaciones)
Versión: 1.0 FINAL';
