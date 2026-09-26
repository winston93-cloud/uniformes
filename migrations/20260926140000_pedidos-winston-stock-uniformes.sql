-- Pedidos de prendas de Winston atendidos desde Uniformes (Matriz).
-- Completar / cancelar aceptan p_sucursal_stock_id: si viene, el stock se mueve en esa
-- sucursal en lugar de la del pedido. Sin él, el comportamiento es el de siempre.
-- Tenis y remate tenis quedan bloqueados (solo linea_venta = 'prendas').

DROP FUNCTION IF EXISTS public.completar_pedido_atomico(uuid, uuid);
CREATE OR REPLACE FUNCTION public.completar_pedido_atomico(p_pedido_id uuid, p_usuario_id uuid DEFAULT NULL::uuid, p_sucursal_stock_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_suc_stock UUID;
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
  SELECT id, folio, estado, sucursal_id, linea_venta
  INTO v_pedido
  FROM public.pedidos
  WHERE id = p_pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  -- Stock desde otra sucursal (p. ej. Uniformes atendiendo un pedido de Winston):
  -- solo pedidos de la línea prendas; tenis / remate tenis nunca salen de su sucursal.
  v_suc_stock := COALESCE(p_sucursal_stock_id, v_pedido.sucursal_id);
  IF p_sucursal_stock_id IS NOT NULL
     AND p_sucursal_stock_id IS DISTINCT FROM v_pedido.sucursal_id
     AND COALESCE(v_pedido.linea_venta, '') <> 'prendas' THEN
    RAISE EXCEPTION 'Solo los pedidos de prendas se pueden atender con stock de otra sucursal.';
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
        v_suc_stock IS NULL
        OR c.sucursal_id = v_suc_stock
      )
    ORDER BY
      CASE WHEN v_suc_stock IS NOT NULL AND c.sucursal_id = v_suc_stock THEN 0 ELSE 1 END,
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
$function$;

DROP FUNCTION IF EXISTS public.completar_detalles_pedido_por_piezas_atomico(uuid, jsonb, uuid);
CREATE OR REPLACE FUNCTION public.completar_detalles_pedido_por_piezas_atomico(p_pedido_id uuid, p_items jsonb, p_usuario_id uuid DEFAULT NULL::uuid, p_sucursal_stock_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_suc_stock UUID;
  v_pedido RECORD;
  v_item RECORD;
  v_det RECORD;
  v_costo_id UUID;
  v_solicitado INTEGER;
  v_entregar INTEGER;
  v_stock INTEGER;
  v_pendientes_restantes INTEGER;
  v_prenda_nombre TEXT;
  v_talla_nombre TEXT;
  v_warnings JSONB := '[]'::JSONB;
  v_omitidas JSONB := '[]'::JSONB;
  v_partidas INTEGER := 0;
  v_piezas INTEGER := 0;
  v_estado_final TEXT;
  v_items JSONB;
BEGIN
  v_items := p_items;
  IF v_items IS NOT NULL AND jsonb_typeof(v_items) = 'string' THEN
    BEGIN
      v_items := (v_items #>> '{}')::jsonb;
    EXCEPTION WHEN OTHERS THEN
      v_items := p_items;
    END;
  END IF;

  IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Selecciona al menos una partida a completar.');
  END IF;

  SELECT id, folio, estado, sucursal_id, linea_venta
  INTO v_pedido
  FROM public.pedidos
  WHERE id = p_pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  -- Stock desde otra sucursal (p. ej. Uniformes atendiendo un pedido de Winston):
  -- solo pedidos de la línea prendas; tenis / remate tenis nunca salen de su sucursal.
  v_suc_stock := COALESCE(p_sucursal_stock_id, v_pedido.sucursal_id);
  IF p_sucursal_stock_id IS NOT NULL
     AND p_sucursal_stock_id IS DISTINCT FROM v_pedido.sucursal_id
     AND COALESCE(v_pedido.linea_venta, '') <> 'prendas' THEN
    RAISE EXCEPTION 'Solo los pedidos de prendas se pueden atender con stock de otra sucursal.';
  END IF;

  IF v_pedido.estado <> 'PENDIENTE' THEN
    RETURN json_build_object('success', false, 'error', 'Solo se puede completar un pedido en PENDIENTE.');
  END IF;

  FOR v_item IN
    SELECT
      (elem->>'id')::UUID AS detalle_id,
      GREATEST(COALESCE((elem->>'cantidad')::INTEGER, 0), 0) AS cantidad
    FROM jsonb_array_elements(v_items) AS elem
  LOOP
    IF v_item.cantidad <= 0 THEN
      CONTINUE;
    END IF;

    SELECT id, prenda_id, talla_id, pendiente
    INTO v_det
    FROM public.detalle_pedidos
    WHERE id = v_item.detalle_id
      AND pedido_id = p_pedido_id
      AND COALESCE(pendiente, 0) > 0
      AND prenda_id IS NOT NULL;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    SELECT p.nombre, t.nombre
    INTO v_prenda_nombre, v_talla_nombre
    FROM public.prendas p
    LEFT JOIN public.tallas t ON t.id = v_det.talla_id
    WHERE p.id = v_det.prenda_id;

    SELECT c.id, c.stock
    INTO v_costo_id, v_stock
    FROM public.costos c
    WHERE c.prenda_id = v_det.prenda_id
      AND c.talla_id = v_det.talla_id
      AND COALESCE(c.activo, true) = true
      AND (
        v_suc_stock IS NULL
        OR c.sucursal_id = v_suc_stock
      )
    ORDER BY
      CASE WHEN v_suc_stock IS NOT NULL AND c.sucursal_id = v_suc_stock THEN 0 ELSE 1 END,
      c.created_at NULLS LAST
    LIMIT 1;

    IF v_costo_id IS NULL THEN
      RAISE EXCEPTION 'No existe costo activo para % / % en la sucursal del pedido',
        COALESCE(v_prenda_nombre, v_det.prenda_id::TEXT),
        COALESCE(v_talla_nombre, v_det.talla_id::TEXT);
    END IF;

    v_stock := COALESCE(v_stock, 0);
    -- Tope estricto: no entregar más de lo que hay en stock
    v_solicitado := v_item.cantidad;
    v_entregar := LEAST(v_solicitado, v_det.pendiente, GREATEST(v_stock, 0));

    IF v_entregar <= 0 THEN
      v_omitidas := v_omitidas || jsonb_build_array(
        format(
          '%s / %s: sin stock (solicitó %s, pendiente %s, stock %s)',
          COALESCE(v_prenda_nombre, '?'),
          COALESCE(v_talla_nombre, '?'),
          v_solicitado,
          v_det.pendiente,
          v_stock
        )
      );
      CONTINUE;
    END IF;

    IF v_entregar < v_solicitado THEN
      v_warnings := v_warnings || jsonb_build_array(
        format(
          '%s / %s: solo se entregaron %s de %s (stock disponible %s)',
          COALESCE(v_prenda_nombre, '?'),
          COALESCE(v_talla_nombre, '?'),
          v_entregar,
          v_solicitado,
          v_stock
        )
      );
    END IF;

    UPDATE public.costos
    SET stock = stock - v_entregar
    WHERE id = v_costo_id
      AND stock >= v_entregar;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuficiente para completar: % / % (requiere %, disponible %)',
        COALESCE(v_prenda_nombre, '?'),
        COALESCE(v_talla_nombre, '?'),
        v_entregar,
        v_stock;
    END IF;

    PERFORM public.descontar_costo_ubicaciones_desde_menor(v_costo_id, v_entregar);

    INSERT INTO public.movimientos (tipo, costo_id, cantidad, observaciones, usuario_id)
    VALUES (
      'SALIDA',
      v_costo_id,
      -v_entregar,
      'ENTREGA_PENDIENTE - Pedido ' || COALESCE(v_pedido.folio, v_pedido.id::TEXT),
      NULL
    );

    UPDATE public.detalle_pedidos
    SET pendiente = GREATEST(COALESCE(pendiente, 0) - v_entregar, 0)
    WHERE id = v_det.id;

    v_partidas := v_partidas + 1;
    v_piezas := v_piezas + v_entregar;
  END LOOP;

  IF v_partidas = 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', CASE
        WHEN jsonb_array_length(v_omitidas) > 0 THEN
          'No se pudo entregar: sin stock en las partidas marcadas. Mete inventario e intenta de nuevo.'
        ELSE
          'Ninguna de las partidas seleccionadas tiene pendientes por entregar.'
      END,
      'omitidas', v_omitidas
    );
  END IF;

  SELECT COALESCE(SUM(pendiente), 0)::INTEGER
  INTO v_pendientes_restantes
  FROM public.detalle_pedidos
  WHERE pedido_id = p_pedido_id
    AND prenda_id IS NOT NULL;

  IF v_pendientes_restantes <= 0 THEN
    UPDATE public.pedidos
    SET estado = 'COMPLETADO', updated_at = NOW()
    WHERE id = p_pedido_id;
    v_estado_final := 'COMPLETADO';
  ELSE
    UPDATE public.pedidos
    SET updated_at = NOW()
    WHERE id = p_pedido_id;
    v_estado_final := 'PENDIENTE';
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', CASE
      WHEN v_estado_final = 'COMPLETADO' THEN 'Pedido completado: ya no quedan pendientes.'
      ELSE format('Se entregaron %s pieza(s) en %s partida(s). El pedido sigue PENDIENTE.', v_piezas, v_partidas)
    END,
    'estado', v_estado_final,
    'partidas', v_partidas,
    'piezas', v_piezas,
    'pendientes_restantes', v_pendientes_restantes,
    'warnings', v_warnings || v_omitidas
  );
END;
$function$;

DROP FUNCTION IF EXISTS public.cancelar_pedido_atomico(uuid, uuid, jsonb, text);
CREATE OR REPLACE FUNCTION public.cancelar_pedido_atomico(p_pedido_id uuid, p_usuario_id uuid DEFAULT NULL::uuid, p_items jsonb DEFAULT NULL::jsonb, p_motivo text DEFAULT NULL::text, p_sucursal_stock_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_suc_stock UUID;
  v_pedido RECORD;
  v_item JSONB;
  v_det RECORD;
  v_qty_cancel INTEGER;
  v_cancel_from_pending INTEGER;
  v_cancel_from_delivered INTEGER;
  v_costo_id UUID;
  v_restantes INTEGER;
BEGIN
  SELECT id, folio, estado, sucursal_id, linea_venta
  INTO v_pedido
  FROM pedidos
  WHERE id = p_pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  -- Stock desde otra sucursal (p. ej. Uniformes atendiendo un pedido de Winston):
  -- solo pedidos de la línea prendas; tenis / remate tenis nunca salen de su sucursal.
  v_suc_stock := COALESCE(p_sucursal_stock_id, v_pedido.sucursal_id);
  IF p_sucursal_stock_id IS NOT NULL
     AND p_sucursal_stock_id IS DISTINCT FROM v_pedido.sucursal_id
     AND COALESCE(v_pedido.linea_venta, '') <> 'prendas' THEN
    RAISE EXCEPTION 'Solo los pedidos de prendas se pueden atender con stock de otra sucursal.';
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
        AND c.sucursal_id = v_suc_stock;

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
$function$;

GRANT EXECUTE ON FUNCTION public.completar_pedido_atomico(UUID, UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.completar_detalles_pedido_por_piezas_atomico(UUID, JSONB, UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_pedido_atomico(UUID, UUID, JSONB, TEXT, UUID) TO anon, authenticated;
