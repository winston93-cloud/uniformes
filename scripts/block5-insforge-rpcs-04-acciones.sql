CREATE OR REPLACE FUNCTION public.completar_pedido_atomico(
  p_pedido_id UUID,
  p_usuario_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido RECORD;
  v_det RECORD;
  v_costo_id UUID;
  v_qty INTEGER;
  v_stock INTEGER;
  v_descontar INTEGER;
  v_pendientes_total INTEGER;
  v_prenda_nombre TEXT;
  v_talla_nombre TEXT;
  v_warnings JSONB := '[]'::JSONB;
BEGIN
  SELECT id, folio, estado, sucursal_id
  INTO v_pedido
  FROM public.pedidos
  WHERE id = p_pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  IF v_pedido.estado <> 'PENDIENTE' THEN
    RETURN json_build_object('success', false, 'error', 'Solo se puede completar un pedido en PENDIENTE.');
  END IF;

  SELECT COALESCE(SUM(pendiente), 0)::INTEGER
  INTO v_pendientes_total
  FROM public.detalle_pedidos
  WHERE pedido_id = p_pedido_id;

  IF v_pendientes_total <= 0 THEN
    UPDATE public.pedidos
    SET estado = 'COMPLETADO', updated_at = NOW()
    WHERE id = p_pedido_id;
    RETURN json_build_object('success', true, 'message', 'Pedido marcado como COMPLETADO (sin pendientes).');
  END IF;

  FOR v_det IN
    SELECT id, prenda_id, talla_id, pendiente
    FROM public.detalle_pedidos
    WHERE pedido_id = p_pedido_id
      AND pendiente > 0
  LOOP
    v_qty := v_det.pendiente;

    SELECT p.nombre, t.nombre
    INTO v_prenda_nombre, v_talla_nombre
    FROM public.prendas p
    JOIN public.tallas t ON t.id = v_det.talla_id
    WHERE p.id = v_det.prenda_id;

    SELECT c.id, c.stock
    INTO v_costo_id, v_stock
    FROM public.costos c
    WHERE c.prenda_id = v_det.prenda_id
      AND c.talla_id = v_det.talla_id
      AND COALESCE(c.activo, true) = true
      AND (
        v_pedido.sucursal_id IS NULL
        OR c.sucursal_id = v_pedido.sucursal_id
      )
    ORDER BY
      CASE WHEN v_pedido.sucursal_id IS NOT NULL AND c.sucursal_id = v_pedido.sucursal_id THEN 0 ELSE 1 END,
      c.created_at NULLS LAST
    LIMIT 1;

    IF v_costo_id IS NULL THEN
      RAISE EXCEPTION 'No existe costo activo para % / % en la sucursal del pedido',
        COALESCE(v_prenda_nombre, v_det.prenda_id::TEXT),
        COALESCE(v_talla_nombre, v_det.talla_id::TEXT);
    END IF;

    v_stock := COALESCE(v_stock, 0);
    v_descontar := LEAST(v_qty, GREATEST(v_stock, 0));

    IF v_descontar > 0 THEN
      UPDATE public.costos
      SET stock = stock - v_descontar
      WHERE id = v_costo_id
        AND stock >= v_descontar;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock insuficiente para completar: % / % (requiere %, disponible %)',
          COALESCE(v_prenda_nombre, '?'),
          COALESCE(v_talla_nombre, '?'),
          v_descontar,
          v_stock;
      END IF;

      PERFORM public.descontar_costo_ubicaciones_desde_menor(v_costo_id, v_descontar);

      INSERT INTO public.movimientos (tipo, costo_id, cantidad, observaciones, usuario_id)
      VALUES (
        'SALIDA',
        v_costo_id,
        -v_descontar,
        'ENTREGA_PENDIENTE - Pedido ' || COALESCE(v_pedido.folio, v_pedido.id::TEXT),
        NULL
      );
    END IF;

    IF v_descontar < v_qty THEN
      v_warnings := v_warnings || jsonb_build_array(
        format(
          '%s / %s: entregado sin descontar inventario (pendiente %s, stock %s)',
          COALESCE(v_prenda_nombre, '?'),
          COALESCE(v_talla_nombre, '?'),
          v_qty,
          v_stock
        )
      );
    END IF;

    UPDATE public.detalle_pedidos
    SET pendiente = 0
    WHERE id = v_det.id;
  END LOOP;

  UPDATE public.pedidos
  SET estado = 'COMPLETADO',
      updated_at = NOW()
  WHERE id = p_pedido_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Pedido completado.',
    'warnings', v_warnings
  );
END;
$$;

COMMENT ON FUNCTION public.completar_pedido_atomico(UUID, UUID) IS
  'Completa pedido PENDIENTE: descuenta pendientes si hay stock; si no hay, cierra pendiente (pedidos sin inventario).';

-- ========= cancelar pedido (total o parcial) =========
CREATE OR REPLACE FUNCTION cancelar_pedido_atomico(
  p_pedido_id UUID,
  p_usuario_id UUID DEFAULT NULL,
  p_items JSONB DEFAULT NULL, -- [{detalle_pedido_id, cantidad_cancelar}]
  p_motivo TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido RECORD;
  v_item JSONB;
  v_det RECORD;
  v_qty_cancel INTEGER;
  v_cancel_from_pending INTEGER;
  v_cancel_from_delivered INTEGER;
  v_costo_id UUID;
  v_restantes INTEGER;
BEGIN
  SELECT id, folio, estado, sucursal_id
  INTO v_pedido
  FROM pedidos
  WHERE id = p_pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  IF v_pedido.estado IN ('CANCELADO') THEN
    RETURN json_build_object('success', false, 'error', 'El pedido ya está CANCELADO.');
  END IF;

  -- Si no vienen items, cancelar todo lo que exista
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    p_items := (
      SELECT jsonb_agg(
        jsonb_build_object(
          'detalle_pedido_id', id,
          'cantidad_cancelar', cantidad
        )
      )
      FROM detalle_pedidos
      WHERE pedido_id = p_pedido_id
    );
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT *
    INTO v_det
    FROM detalle_pedidos
    WHERE id = (v_item->>'detalle_pedido_id')::UUID
      AND pedido_id = p_pedido_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Detalle del pedido no encontrado para cancelar';
    END IF;

    v_qty_cancel := GREATEST(COALESCE((v_item->>'cantidad_cancelar')::INTEGER, 0), 0);
    IF v_qty_cancel <= 0 OR v_qty_cancel > v_det.cantidad THEN
      RAISE EXCEPTION 'Cantidad a cancelar inválida para el detalle %', v_det.id;
    END IF;

    -- Primero se cancela de lo pendiente (no toca stock porque aún no se descontó)
    v_cancel_from_pending := LEAST(v_det.pendiente, v_qty_cancel);
    v_cancel_from_delivered := v_qty_cancel - v_cancel_from_pending;

    -- Si se cancela algo ya entregado/descontado, reponer stock (ENTRADA)
    IF v_cancel_from_delivered > 0 THEN
      SELECT c.id
      INTO v_costo_id
      FROM costos c
      WHERE c.prenda_id = v_det.prenda_id
        AND c.talla_id = v_det.talla_id
        AND c.sucursal_id = v_pedido.sucursal_id;

      IF v_costo_id IS NULL THEN
        RAISE EXCEPTION 'No existe costo para reponer stock (prenda %, talla %)', v_det.prenda_id, v_det.talla_id;
      END IF;

      UPDATE costos
      SET stock = stock + v_cancel_from_delivered
      WHERE id = v_costo_id;

      PERFORM sumar_costo_ubicaciones_desde_menor(v_costo_id, v_cancel_from_delivered);

      INSERT INTO movimientos (tipo, costo_id, cantidad, observaciones, usuario_id)
      VALUES (
        'ENTRADA',
        v_costo_id,
        v_cancel_from_delivered,
        'CANCELACION - Pedido ' || COALESCE(v_pedido.folio, v_pedido.id::TEXT) || COALESCE(' - ' || p_motivo, ''),
        p_usuario_id
      );
    END IF;

    -- Ajustar detalle: reducir cantidad total y pendiente
    IF v_qty_cancel = v_det.cantidad THEN
      DELETE FROM detalle_pedidos WHERE id = v_det.id;
    ELSE
      UPDATE detalle_pedidos
      SET cantidad = cantidad - v_qty_cancel,
          pendiente = GREATEST(pendiente - v_cancel_from_pending, 0),
          subtotal = (cantidad - v_qty_cancel) * precio_unitario
      WHERE id = v_det.id;
    END IF;
  END LOOP;

  -- Recalcular totales del pedido desde detalle_pedidos
  UPDATE pedidos p
  SET subtotal = COALESCE(s.sum_subtotal, 0),
      total = COALESCE(s.sum_subtotal, 0),
      updated_at = NOW()
  FROM (
    SELECT pedido_id, COALESCE(SUM(subtotal), 0) AS sum_subtotal
    FROM detalle_pedidos
    WHERE pedido_id = p_pedido_id
    GROUP BY pedido_id
  ) s
  WHERE p.id = p_pedido_id;

  SELECT COUNT(*)::INTEGER INTO v_restantes
  FROM detalle_pedidos
  WHERE pedido_id = p_pedido_id;

  IF v_restantes = 0 THEN
    UPDATE pedidos SET estado = 'CANCELADO', updated_at = NOW() WHERE id = p_pedido_id;
    RETURN json_build_object('success', true, 'message', 'Pedido cancelado totalmente.');
  ELSE
    UPDATE pedidos SET estado = 'CANCELADO_PARCIAL', updated_at = NOW() WHERE id = p_pedido_id;
    RETURN json_build_object('success', true, 'message', 'Pedido cancelado parcialmente.');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION cancelar_pedido_atomico(UUID, UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cancelar_pedido_atomico(UUID, UUID, JSONB, TEXT) TO anon;

COMMENT ON FUNCTION cancelar_pedido_atomico(UUID, UUID, JSONB, TEXT) IS
  'Cancela pedido total/parcial: reduce detalle(s), repone stock solo de lo ya entregado (cantidad - pendiente), recalcula totales y marca CANCELADO o CANCELADO_PARCIAL.';


-- ========== Cotización → trabajando: insumos por ubicación ==========
