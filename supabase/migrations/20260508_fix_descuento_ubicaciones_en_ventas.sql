-- Fix: al vender (crear_pedido_atomico) se descuenta stock agregado (costos.stock)
-- pero también debe descontarse el reparto por ubicación (costo_ubicaciones).
-- Regla pedida:
-- 1) Descontar siempre de la ubicación con MENOR cantidad.
-- 2) Si hay empate, descontar primero de "Taller".
--
-- Nota: mantenemos compatibilidad legacy: pedidos.usuario_id / movimientos.usuario_id pueden ser SMALLINT.
-- Insertamos NULL literal para evitar casts (uuid vs smallint) en entornos viejos.

-- ========= helper: descontar costo_ubicaciones (salida) =========
CREATE OR REPLACE FUNCTION public.descontar_costo_ubicaciones_desde_menor(
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

  IF NOT EXISTS (SELECT 1 FROM public.costo_ubicaciones WHERE costo_id = p_costo_id) THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(cantidad), 0)::INTEGER INTO v_sum
  FROM public.costo_ubicaciones
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
    SELECT cu.id, cu.cantidad
    FROM public.costo_ubicaciones cu
    JOIN public.ubicaciones_almacenamiento ua
      ON ua.id = cu.ubicacion_almacenamiento_id
    WHERE cu.costo_id = p_costo_id
    ORDER BY
      cu.cantidad ASC,
      CASE
        WHEN ua.nombre ILIKE 'taller' THEN 0
        ELSE 1
      END ASC,
      cu.ubicacion_almacenamiento_id ASC
  LOOP
    EXIT WHEN v_rem <= 0;
    v_take := LEAST(r.cantidad, v_rem);
    IF v_take > 0 THEN
      UPDATE public.costo_ubicaciones
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

COMMENT ON FUNCTION public.descontar_costo_ubicaciones_desde_menor(UUID, INTEGER) IS
  'Descuenta unidades en costo_ubicaciones desde la ubicación con menor stock; empate: Taller primero.';

-- ========= crear pedido (auto-split + descuento ubicaciones) =========
CREATE OR REPLACE FUNCTION public.crear_pedido_atomico(
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
  v_any_pending BOOLEAN := false;
  v_estado_final VARCHAR;
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

    SELECT c.id, c.stock, COALESCE(c.precio_menudeo, c.precio_venta, 0)
    INTO v_costo_id, v_stock_actual, v_precio_unitario
    FROM public.costos c
    WHERE c.prenda_id = (v_detalle->>'prenda_id')::UUID
      AND c.talla_id = (v_detalle->>'talla_id')::UUID
      AND c.sucursal_id = p_sucursal_id
      AND c.activo = true;

    IF v_costo_id IS NULL THEN
      RAISE EXCEPTION 'No existe precio para prenda % talla % en esta sucursal', (v_detalle->>'prenda_id'), (v_detalle->>'talla_id');
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

  -- 2) Insertar pedido (usuario_id como NULL literal por compatibilidad legacy)
  INSERT INTO public.pedidos (
    tipo_cliente, cliente_nombre, sucursal_id, usuario_id,
    alumno_id, externo_id, estado, subtotal, total, notas
  ) VALUES (
    p_tipo_cliente, UPPER(p_cliente_nombre), p_sucursal_id, NULL,
    p_alumno_id, p_externo_id, v_estado_final, v_subtotal_calculado, v_total_calculado, p_notas
  ) RETURNING id INTO v_pedido_id;

  -- 3) Insertar detalles y descontar SOLO lo entregado (cantidad_con_stock)
  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    v_cantidad_total := COALESCE((v_detalle->>'cantidad')::INTEGER, 0);

    SELECT c.id, c.stock, COALESCE(c.precio_menudeo, c.precio_venta, 0)
    INTO v_costo_id, v_stock_actual, v_precio_unitario
    FROM public.costos c
    WHERE c.prenda_id = (v_detalle->>'prenda_id')::UUID
      AND c.talla_id = (v_detalle->>'talla_id')::UUID
      AND c.sucursal_id = p_sucursal_id;

    v_cantidad_con_stock := LEAST(GREATEST(COALESCE(v_stock_actual, 0), 0), v_cantidad_total);
    v_cantidad_pendiente := v_cantidad_total - v_cantidad_con_stock;

    INSERT INTO public.detalle_pedidos (
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
      UPDATE public.costos
      SET stock = stock - v_cantidad_con_stock
      WHERE id = v_costo_id
        AND stock >= v_cantidad_con_stock;

      IF FOUND THEN
        -- Descontar también el reparto por ubicación (si existe)
        PERFORM public.descontar_costo_ubicaciones_desde_menor(v_costo_id, v_cantidad_con_stock);

        INSERT INTO public.movimientos (tipo, costo_id, cantidad, observaciones, usuario_id)
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
          NULL
        );
      ELSE
        -- Race condition: si ya no alcanzó stock al descontar, degradar a todo pendiente
        UPDATE public.detalle_pedidos
        SET pendiente = cantidad
        WHERE id = v_detalle_pedido_id;

        UPDATE public.pedidos
        SET estado = 'PENDIENTE'
        WHERE id = v_pedido_id;
      END IF;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'pedido_id', v_pedido_id,
    'total', v_total_calculado,
    'estado', (SELECT estado FROM public.pedidos WHERE id = v_pedido_id),
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

GRANT EXECUTE ON FUNCTION public.crear_pedido_atomico(VARCHAR, VARCHAR, UUID, UUID, UUID, UUID, VARCHAR, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_pedido_atomico(VARCHAR, VARCHAR, UUID, UUID, UUID, UUID, VARCHAR, TEXT, JSONB) TO anon;

COMMENT ON FUNCTION public.crear_pedido_atomico(VARCHAR, VARCHAR, UUID, UUID, UUID, UUID, VARCHAR, TEXT, JSONB) IS
  'Auto-split por stock disponible. Descuenta SOLO lo entregado de costos.stock y costo_ubicaciones (menor primero; empate: Taller). Mantiene compatibilidad legacy de usuario_id insertando NULL literal.';

