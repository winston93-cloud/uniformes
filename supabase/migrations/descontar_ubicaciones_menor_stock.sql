-- Al descontar stock agregado (costos.stock / insumos.stock), repartir la salida en
-- costo_ubicaciones / insumo_ubicaciones descontando siempre primero de la fila con
-- MENOR cantidad (empate: ubicacion_almacenamiento_id) para alinear total con suma por ubicación.

CREATE OR REPLACE FUNCTION descontar_costo_ubicaciones_desde_menor(
  p_costo_id UUID,
  p_cantidad INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rem INTEGER;
  v_take INTEGER;
  r RECORD;
  v_sum INTEGER;
BEGIN
  IF p_costo_id IS NULL OR p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM costo_ubicaciones WHERE costo_id = p_costo_id) THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(cantidad), 0)::INTEGER INTO v_sum
  FROM costo_ubicaciones
  WHERE costo_id = p_costo_id;

  IF v_sum < p_cantidad THEN
    RAISE EXCEPTION
      'Stock por ubicaciones insuficiente para la prenda/talla (costo %): en ubicaciones hay %, se requieren % unidades.',
      p_costo_id,
      v_sum,
      p_cantidad;
  END IF;

  v_rem := p_cantidad;
  FOR r IN
    SELECT id, cantidad
    FROM costo_ubicaciones
    WHERE costo_id = p_costo_id
    ORDER BY cantidad ASC, ubicacion_almacenamiento_id ASC
  LOOP
    EXIT WHEN v_rem <= 0;
    v_take := LEAST(r.cantidad, v_rem);
    IF v_take > 0 THEN
      UPDATE costo_ubicaciones
      SET cantidad = cantidad - v_take
      WHERE id = r.id;
      v_rem := v_rem - v_take;
    END IF;
  END LOOP;

  IF v_rem > 0 THEN
    RAISE EXCEPTION 'No se pudo completar el descuento por ubicaciones (costo %).', p_costo_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION descontar_insumo_ubicaciones_desde_menor(
  p_insumo_id UUID,
  p_cantidad NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rem NUMERIC(14, 4);
  v_take NUMERIC(14, 4);
  r RECORD;
  v_sum NUMERIC(14, 4);
BEGIN
  IF p_insumo_id IS NULL OR p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM insumo_ubicaciones WHERE insumo_id = p_insumo_id) THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(cantidad), 0)::NUMERIC(14, 4) INTO v_sum
  FROM insumo_ubicaciones
  WHERE insumo_id = p_insumo_id;

  IF v_sum < p_cantidad THEN
    RAISE EXCEPTION
      'Stock por ubicaciones insuficiente para el insumo %: en ubicaciones hay %, se requiere %.',
      p_insumo_id,
      v_sum,
      p_cantidad;
  END IF;

  v_rem := ROUND(p_cantidad, 4);
  FOR r IN
    SELECT id, cantidad
    FROM insumo_ubicaciones
    WHERE insumo_id = p_insumo_id
    ORDER BY cantidad ASC, ubicacion_almacenamiento_id ASC
  LOOP
    EXIT WHEN v_rem <= 0;
    v_take := LEAST(r.cantidad, v_rem);
    IF v_take > 0 THEN
      UPDATE insumo_ubicaciones
      SET cantidad = cantidad - v_take
      WHERE id = r.id;
      v_rem := ROUND(v_rem - v_take, 4);
    END IF;
  END LOOP;

  IF v_rem > 0.0001 THEN
    RAISE EXCEPTION 'No se pudo completar el descuento por ubicaciones (insumo %).', p_insumo_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION descontar_costo_ubicaciones_desde_menor(UUID, INTEGER) IS
  'Descuenta unidades en costo_ubicaciones empezando por la ubicación con menor stock.';
COMMENT ON FUNCTION descontar_insumo_ubicaciones_desde_menor(UUID, NUMERIC) IS
  'Descuenta cantidad en insumo_ubicaciones empezando por la ubicación con menor stock.';

-- ========== crear_pedido_atomico: ubicaciones alineadas con costos / insumos ==========
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
  v_cons_insumo NUMERIC(14,4);
BEGIN
  RAISE NOTICE '======================================== CREANDO PEDIDO ========================================';

  IF p_tipo_cliente IS NULL OR p_cliente_nombre IS NULL OR p_sucursal_id IS NULL THEN
    RAISE EXCEPTION 'Faltan datos obligatorios';
  END IF;

  IF jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'No se pueden crear pedidos sin detalles';
  END IF;

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

  INSERT INTO pedidos (
    tipo_cliente, cliente_nombre, sucursal_id, usuario_id,
    alumno_id, externo_id, estado, subtotal, total, notas
  ) VALUES (
    p_tipo_cliente, UPPER(p_cliente_nombre), p_sucursal_id, p_usuario_id,
    p_alumno_id, p_externo_id, p_estado, v_subtotal_calculado, v_total_calculado, p_notas
  ) RETURNING id INTO v_pedido_id;

  RAISE NOTICE 'Pedido creado: %', v_pedido_id;

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
      WHERE id = v_costo_id AND stock >= v_cantidad_con_stock;

      IF NOT FOUND THEN
        RAISE NOTICE 'Race condition detectada: ajustando cantidades para % talla %', v_prenda_nombre, v_talla_nombre;
      ELSE
        PERFORM descontar_costo_ubicaciones_desde_menor(v_costo_id, v_cantidad_con_stock);

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

        FOR v_insumo_record IN
          SELECT pti.insumo_id, i.nombre, pti.cantidad
          FROM prenda_talla_insumos pti
          JOIN insumos i ON pti.insumo_id = i.id
          WHERE pti.prenda_id = (v_detalle->>'prenda_id')::UUID
            AND pti.talla_id = (v_detalle->>'talla_id')::UUID
        LOOP
          v_cons_insumo := ROUND(
            (v_insumo_record.cantidad * v_cantidad_con_stock::NUMERIC),
            4
          );
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

            PERFORM descontar_insumo_ubicaciones_desde_menor(v_insumo_record.insumo_id, v_cons_insumo);

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

        RAISE NOTICE 'Stock actualizado: % - %', v_prenda_nombre, v_talla_nombre;
      END IF;
    END IF;
  END LOOP;

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

COMMENT ON FUNCTION crear_pedido_atomico IS
'Crea pedidos con división automática. Descuenta stock de prenda y ubicaciones (menor primero), insumos e insumo_ubicaciones (menor primero).';

-- ========== Cotización → trabajando: insumos por ubicación ==========
CREATE OR REPLACE FUNCTION trg_cotizacion_insumos_al_trabajar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_det RECORD;
  v_prenda_id UUID;
  v_talla_id UUID;
  v_insumo_record RECORD;
  v_cons NUMERIC(14, 4);
  v_cant INTEGER;
BEGIN
  IF NEW.estado IS DISTINCT FROM 'trabajando' THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'trabajando' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(OLD.insumos_trabajando_aplicado, false) THEN
    RETURN NEW;
  END IF;

  FOR v_det IN
    SELECT id, cantidad, costo_id
    FROM detalle_cotizacion
    WHERE cotizacion_id = NEW.id
      AND costo_id IS NOT NULL
  LOOP
    SELECT c.prenda_id, c.talla_id
    INTO v_prenda_id, v_talla_id
    FROM costos c
    WHERE c.id = v_det.costo_id;

    IF v_prenda_id IS NULL OR v_talla_id IS NULL THEN
      RAISE EXCEPTION
        'Partida de cotización % sin prenda/talla en costos (costo_id %).',
        v_det.id,
        v_det.costo_id;
    END IF;

    v_cant := GREATEST(COALESCE(v_det.cantidad, 0), 0);
    IF v_cant = 0 THEN
      CONTINUE;
    END IF;

    FOR v_insumo_record IN
      SELECT pti.insumo_id, i.nombre, pti.cantidad
      FROM prenda_talla_insumos pti
      JOIN insumos i ON pti.insumo_id = i.id
      WHERE pti.prenda_id = v_prenda_id
        AND pti.talla_id = v_talla_id
    LOOP
      v_cons := ROUND((v_insumo_record.cantidad * v_cant::NUMERIC), 4);
      IF v_cons > 0 THEN
        UPDATE insumos
        SET stock = stock - v_cons
        WHERE id = v_insumo_record.insumo_id
          AND stock >= v_cons;

        IF NOT FOUND THEN
          RAISE EXCEPTION
            'Stock insuficiente del insumo "%" para pasar la cotización % a trabajando. Requerido: % (receta × % u.).',
            v_insumo_record.nombre,
            COALESCE(NEW.folio, NEW.id::TEXT),
            v_cons,
            v_cant;
        END IF;

        PERFORM descontar_insumo_ubicaciones_desde_menor(v_insumo_record.insumo_id, v_cons);
      END IF;
    END LOOP;
  END LOOP;

  NEW.insumos_trabajando_aplicado := true;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trg_cotizacion_insumos_al_trabajar() IS
  'Descuenta insumos.stock e insumo_ubicaciones (menor primero) al pasar cotización a trabajando.';
