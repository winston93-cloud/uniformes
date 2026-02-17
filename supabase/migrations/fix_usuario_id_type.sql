-- Corregir tipo de dato de usuario_id en función crear_pedido_atomico
-- La columna usuario_id en pedidos es UUID, pero la función esperaba SMALLINT

CREATE OR REPLACE FUNCTION crear_pedido_atomico(
  p_tipo_cliente VARCHAR,
  p_cliente_nombre VARCHAR,
  p_sucursal_id UUID,
  p_usuario_id UUID, -- CAMBIO: De SMALLINT a UUID
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
BEGIN
  -- Iniciar transacción (implícita en función)
  
  -- Validar que haya detalles
  IF jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'El pedido debe tener al menos un artículo';
  END IF;
  
  -- 1. PRE-VALIDAR Y CALCULAR TOTALES
  v_subtotal_calculado := 0;
  
  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    -- Obtener cantidades (con valores por defecto para compatibilidad)
    v_cantidad_total := (v_detalle->>'cantidad')::INTEGER;
    v_cantidad_con_stock := COALESCE((v_detalle->>'cantidad_con_stock')::INTEGER, v_cantidad_total);
    v_cantidad_pendiente := COALESCE((v_detalle->>'cantidad_pendiente')::INTEGER, 0);
    
    -- Buscar el costo y precio
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
    
    -- Validar que hay suficiente stock para la cantidad_con_stock
    IF v_cantidad_con_stock > 0 AND v_stock_actual < v_cantidad_con_stock THEN
      RAISE EXCEPTION 'Stock insuficiente. Disponible: %, Solicitado con stock: %', 
        v_stock_actual, v_cantidad_con_stock;
    END IF;
    
    -- Acumular subtotal (sobre la cantidad TOTAL, no solo la que tiene stock)
    v_subtotal_calculado := v_subtotal_calculado + 
      (v_cantidad_total * v_precio_unitario);
  END LOOP;
  
  -- Calcular total
  v_total_calculado := v_subtotal_calculado;
  
  -- 2. INSERTAR PEDIDO
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
  
  -- 3. INSERTAR DETALLES Y ACTUALIZAR STOCK (solo cantidad_con_stock)
  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    -- Obtener cantidades
    v_cantidad_total := (v_detalle->>'cantidad')::INTEGER;
    v_cantidad_con_stock := COALESCE((v_detalle->>'cantidad_con_stock')::INTEGER, v_cantidad_total);
    v_cantidad_pendiente := COALESCE((v_detalle->>'cantidad_pendiente')::INTEGER, 0);
    
    -- Obtener costo_id y precio actual
    SELECT id, COALESCE(precio_menudeo, precio_venta, 0)
    INTO v_costo_id, v_precio_unitario
    FROM costos
    WHERE prenda_id = (v_detalle->>'prenda_id')::UUID
      AND talla_id = (v_detalle->>'talla_id')::UUID
      AND sucursal_id = p_sucursal_id;
    
    -- Insertar detalle (cantidad total, pendiente lo que no tiene stock)
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
      v_cantidad_total,
      v_precio_unitario,
      v_cantidad_total * v_precio_unitario,
      v_cantidad_pendiente, -- Solo lo que no tiene stock
      v_detalle->>'especificaciones'
    ) RETURNING id INTO v_detalle_pedido_id;
    
    -- ACTUALIZAR STOCK solo si cantidad_con_stock > 0
    IF v_cantidad_con_stock > 0 THEN
      -- DESCONTAR SOLO cantidad_con_stock del inventario
      UPDATE costos
      SET stock = stock - v_cantidad_con_stock
      WHERE id = v_costo_id
        AND stock >= v_cantidad_con_stock;
      
      -- Verificar que se actualizó
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Race condition detectada: stock insuficiente al momento de actualizar';
      END IF;
      
      -- REGISTRAR MOVIMIENTO
      INSERT INTO movimientos (tipo, costo_id, cantidad, observaciones, usuario_id)
      VALUES (
        'SALIDA',
        v_costo_id,
        -v_cantidad_con_stock, -- Solo lo que tiene stock
        'Venta - Pedido #' || v_pedido_id || 
          CASE 
            WHEN v_cantidad_pendiente > 0 
            THEN ' (' || v_cantidad_con_stock || ' entregadas, ' || v_cantidad_pendiente || ' pendientes)'
            ELSE ''
          END,
        p_usuario_id
      );
    END IF;
    
    -- Si hay cantidad pendiente, registrar en log
    IF v_cantidad_pendiente > 0 THEN
      RAISE NOTICE 'Partida con % pendientes: prenda %, talla %',
        v_cantidad_pendiente, (v_detalle->>'prenda_id'), (v_detalle->>'talla_id');
    END IF;
    
    -- GUARDAR SNAPSHOT de insumos
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

GRANT EXECUTE ON FUNCTION crear_pedido_atomico TO authenticated;
GRANT EXECUTE ON FUNCTION crear_pedido_atomico TO anon;

COMMENT ON FUNCTION crear_pedido_atomico IS 
'Crea pedido con división automática. CORREGIDO: p_usuario_id ahora es UUID en lugar de SMALLINT.';
