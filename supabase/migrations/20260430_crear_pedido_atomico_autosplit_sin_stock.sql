-- Permitir crear pedidos aunque no haya stock suficiente:
-- - Auto-dividir cada partida según stock disponible en costos
-- - Registrar lo faltante en detalle_pedidos.pendiente
-- - Descontar stock SOLO de la parte entregada (cantidad_con_stock)
-- - Si hay cualquier pendiente, forzar estado PENDIENTE

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
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido_id UUID;
  v_detalle JSONB;
  v_costo_id UUID;
  v_stock_actual INTEGER;
  v_precio_unitario DECIMAL(10,2);
  v_cantidad_total INTEGER;
  v_cantidad_con_stock INTEGER;
  v_cantidad_pendiente INTEGER;
  v_detalle_pedido_id UUID;
  v_subtotal_calculado DECIMAL(10,2) := 0;
  v_total_calculado DECIMAL(10,2) := 0;
  v_prenda_nombre VARCHAR;
  v_talla_nombre VARCHAR;
  v_any_pending BOOLEAN := false;
  v_estado_final VARCHAR;
  v_insumo_record RECORD;
  v_cons_insumo NUMERIC(14,4);
BEGIN
  IF p_tipo_cliente IS NULL OR p_cliente_nombre IS NULL OR p_sucursal_id IS NULL THEN
    RAISE EXCEPTION 'Faltan datos obligatorios';
  END IF;

  IF jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'No se pueden crear pedidos sin detalles';
  END IF;

  -- 1) Calcular totales (sobre cantidad TOTAL) y detectar si habrá pendientes
  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    v_cantidad_total := COALESCE((v_detalle->>'cantidad')::INTEGER, 0);
    IF v_cantidad_total <= 0 THEN
      RAISE EXCEPTION 'La cantidad debe ser mayor a 0';
    END IF;

    SELECT
      c.id,
      c.stock,
      COALESCE(c.precio_menudeo, c.precio_venta, 0),
      p.nombre,
      t.nombre
    INTO v_costo_id, v_stock_actual, v_precio_unitario, v_prenda_nombre, v_talla_nombre
    FROM costos c
    JOIN prendas p ON c.prenda_id = p.id
    JOIN tallas t ON c.talla_id = t.id
    WHERE c.prenda_id = (v_detalle->>'prenda_id')::UUID
      AND c.talla_id = (v_detalle->>'talla_id')::UUID
      AND c.sucursal_id = p_sucursal_id
      AND c.activo = true;

    IF v_costo_id IS NULL THEN
      RAISE EXCEPTION 'No existe precio para % talla % en esta sucursal', (v_detalle->>'prenda_id'), (v_detalle->>'talla_id');
    END IF;

    v_cantidad_con_stock := LEAST(GREATEST(COALESCE(v_stock_actual, 0), 0), v_cantidad_total);
    v_cantidad_pendiente := v_cantidad_total - v_cantidad_con_stock;
    IF v_cantidad_pendiente > 0 THEN
      v_any_pending := true;
    END IF;

    v_subtotal_calculado := v_subtotal_calculado + (v_cantidad_total * v_precio_unitario);
  END LOOP;

  v_total_calculado := v_subtotal_calculado;
  v_estado_final := CASE WHEN v_any_pending THEN 'PENDIENTE' ELSE COALESCE(p_estado, 'COMPLETADO') END;

  -- 2) Insertar pedido
  INSERT INTO pedidos (
    tipo_cliente, cliente_nombre, sucursal_id, usuario_id,
    alumno_id, externo_id, estado, subtotal, total, notas
  ) VALUES (
    p_tipo_cliente, UPPER(p_cliente_nombre), p_sucursal_id, p_usuario_id,
    p_alumno_id, p_externo_id, v_estado_final, v_subtotal_calculado, v_total_calculado, p_notas
  ) RETURNING id INTO v_pedido_id;

  -- 3) Insertar detalles y descontar SOLO lo entregado (cantidad_con_stock)
  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    v_cantidad_total := COALESCE((v_detalle->>'cantidad')::INTEGER, 0);

    SELECT
      c.id,
      c.stock,
      COALESCE(c.precio_menudeo, c.precio_venta, 0),
      p.nombre,
      t.nombre
    INTO v_costo_id, v_stock_actual, v_precio_unitario, v_prenda_nombre, v_talla_nombre
    FROM costos c
    JOIN prendas p ON c.prenda_id = p.id
    JOIN tallas t ON c.talla_id = t.id
    WHERE c.prenda_id = (v_detalle->>'prenda_id')::UUID
      AND c.talla_id = (v_detalle->>'talla_id')::UUID
      AND c.sucursal_id = p_sucursal_id;

    v_cantidad_con_stock := LEAST(GREATEST(COALESCE(v_stock_actual, 0), 0), v_cantidad_total);
    v_cantidad_pendiente := v_cantidad_total - v_cantidad_con_stock;

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

    IF v_cantidad_con_stock > 0 THEN
      UPDATE costos
      SET stock = stock - v_cantidad_con_stock
      WHERE id = v_costo_id
        AND stock >= v_cantidad_con_stock;

      IF FOUND THEN
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

        -- Si existe receta, descontar insumos SOLO por piezas entregadas (no por pendientes)
        FOR v_insumo_record IN
          SELECT pti.insumo_id, i.nombre, pti.cantidad
          FROM prenda_talla_insumos pti
          JOIN insumos i ON pti.insumo_id = i.id
          WHERE pti.prenda_id = (v_detalle->>'prenda_id')::UUID
            AND pti.talla_id = (v_detalle->>'talla_id')::UUID
        LOOP
          v_cons_insumo := ROUND((v_insumo_record.cantidad * v_cantidad_con_stock::NUMERIC), 4);
          IF v_cons_insumo > 0 THEN
            UPDATE insumos
            SET stock = stock - v_cons_insumo
            WHERE id = v_insumo_record.insumo_id
              AND stock >= v_cons_insumo;

            IF NOT FOUND THEN
              RAISE EXCEPTION
                'Stock insuficiente del insumo "%" para esta venta. Requerido: % (receta × % pieza(s)).',
                v_insumo_record.nombre,
                v_cons_insumo,
                v_cantidad_con_stock;
            END IF;

            INSERT INTO snapshot_insumos_pedido (
              detalle_pedido_id, prenda_id, talla_id,
              insumo_id, insumo_nombre, cantidad_insumo
            ) VALUES (
              v_detalle_pedido_id,
              (v_detalle->>'prenda_id')::UUID,
              (v_detalle->>'talla_id')::UUID,
              v_insumo_record.insumo_id,
              v_insumo_record.nombre,
              v_cons_insumo
            );
          END IF;
        END LOOP;
      ELSE
        -- Race condition: si ya no alcanzó stock al descontar, degradar a todo pendiente
        UPDATE detalle_pedidos
        SET pendiente = cantidad
        WHERE id = v_detalle_pedido_id;

        UPDATE pedidos
        SET estado = 'PENDIENTE'
        WHERE id = v_pedido_id;
      END IF;
    END IF;
  END LOOP;

  -- 4) Auditoría (si aplica / existe la tabla con columnas esperadas)
  BEGIN
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
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN
      -- No bloquear creación del pedido si el esquema de auditoría difiere en este entorno.
      NULL;
  END;

  RETURN json_build_object(
    'success', true,
    'pedido_id', v_pedido_id,
    'total', v_total_calculado,
    'estado', (SELECT estado FROM pedidos WHERE id = v_pedido_id),
    'message', 'Pedido creado correctamente'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Error al crear pedido: ' || SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION crear_pedido_atomico TO authenticated;
GRANT EXECUTE ON FUNCTION crear_pedido_atomico TO anon;

COMMENT ON FUNCTION crear_pedido_atomico IS
'Crea pedidos con auto-split por stock disponible: descuenta SOLO lo entregado y marca lo faltante como pendiente. Si cualquier partida queda pendiente, fuerza estado PENDIENTE.';

