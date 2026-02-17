-- Modificar función crear_pedido_atomico para permitir pedidos SIN STOCK (pendientes)
-- Solo descontar inventario si tiene_stock = true

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
  v_tiene_stock BOOLEAN;
BEGIN
  -- Iniciar transacción (implícita en función)
  
  -- Validar que haya detalles
  IF jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'El pedido debe tener al menos un artículo';
  END IF;
  
  -- 1. PRE-VALIDAR STOCK de TODOS los items ANTES de insertar nada
  -- SOLO para items que tienen_stock = true
  v_subtotal_calculado := 0;
  
  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    -- Obtener flag tiene_stock (default true si no existe)
    v_tiene_stock := COALESCE((v_detalle->>'tiene_stock')::BOOLEAN, true);
    
    -- Buscar el costo
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
    
    -- SOLO validar stock si tiene_stock = true
    IF v_tiene_stock AND v_stock_actual < (v_detalle->>'cantidad')::INTEGER THEN
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
  
  -- 3. INSERTAR DETALLES Y ACTUALIZAR STOCK ATÓMICAMENTE (solo si tiene_stock = true)
  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    -- Obtener flag tiene_stock
    v_tiene_stock := COALESCE((v_detalle->>'tiene_stock')::BOOLEAN, true);
    
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
    
    -- ACTUALIZAR STOCK Y REGISTRAR MOVIMIENTO SOLO SI tiene_stock = true
    IF v_tiene_stock THEN
      -- ACTUALIZAR STOCK ATÓMICAMENTE
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
    ELSE
      -- Log informativo: pedido SIN STOCK (pendiente)
      RAISE NOTICE 'Partida SIN STOCK: No se descuenta inventario para prenda % talla %',
        (v_detalle->>'prenda_id'), (v_detalle->>'talla_id');
    END IF;
    
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

GRANT EXECUTE ON FUNCTION crear_pedido_atomico TO authenticated;
GRANT EXECUTE ON FUNCTION crear_pedido_atomico TO anon;

COMMENT ON FUNCTION crear_pedido_atomico IS 
'Crea pedido de forma atómica. MODIFICADO: Permite pedidos SIN STOCK (pendientes). Solo descuenta inventario si tiene_stock=true.';
