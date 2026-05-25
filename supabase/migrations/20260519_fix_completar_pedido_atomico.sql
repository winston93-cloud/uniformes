-- Completar pedido: compat usuario_id (NULL en movimientos), buscar costo con fallback de sucursal,
-- descontar ubicaciones con la misma regla que ventas.

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
  v_pendientes_total INTEGER;
  v_prenda_nombre TEXT;
  v_talla_nombre TEXT;
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

    SELECT c.id
    INTO v_costo_id
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

    UPDATE public.costos
    SET stock = stock - v_qty
    WHERE id = v_costo_id
      AND stock >= v_qty;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuficiente para completar: % / % (requiere %, disponible en inventario)',
        COALESCE(v_prenda_nombre, '?'),
        COALESCE(v_talla_nombre, '?'),
        v_qty;
    END IF;

    PERFORM public.descontar_costo_ubicaciones_desde_menor(v_costo_id, v_qty);

    INSERT INTO public.movimientos (tipo, costo_id, cantidad, observaciones, usuario_id)
    VALUES (
      'SALIDA',
      v_costo_id,
      -v_qty,
      'ENTREGA_PENDIENTE - Pedido ' || COALESCE(v_pedido.folio, v_pedido.id::TEXT),
      NULL
    );

    UPDATE public.detalle_pedidos
    SET pendiente = 0
    WHERE id = v_det.id;
  END LOOP;

  UPDATE public.pedidos
  SET estado = 'COMPLETADO',
      updated_at = NOW()
  WHERE id = p_pedido_id;

  RETURN json_build_object('success', true, 'message', 'Pedido completado y stock descontado de pendientes.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.completar_pedido_atomico(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.completar_pedido_atomico(UUID, UUID) TO anon;

COMMENT ON FUNCTION public.completar_pedido_atomico(UUID, UUID) IS
  'Completa pedido PENDIENTE: descuenta pendientes, ubicaciones (menor primero) y movimientos con usuario_id NULL (compat legacy).';
