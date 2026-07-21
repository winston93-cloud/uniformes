-- Completar solo algunas partidas pendientes de un pedido.
-- Solo marca el pedido COMPLETADO cuando ya no quedan pendientes.

CREATE OR REPLACE FUNCTION public.completar_detalles_pedido_atomico(
  p_pedido_id UUID,
  p_detalle_ids UUID[],
  p_usuario_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido RECORD;
  v_det RECORD;
  v_costo_id UUID;
  v_qty INTEGER;
  v_stock INTEGER;
  v_descontar INTEGER;
  v_pendientes_restantes INTEGER;
  v_prenda_nombre TEXT;
  v_talla_nombre TEXT;
  v_warnings JSONB := '[]'::JSONB;
  v_completados INTEGER := 0;
  v_estado_final TEXT;
BEGIN
  IF p_detalle_ids IS NULL OR array_length(p_detalle_ids, 1) IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Selecciona al menos una partida a completar.');
  END IF;

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

  FOR v_det IN
    SELECT id, prenda_id, talla_id, pendiente
    FROM public.detalle_pedidos
    WHERE pedido_id = p_pedido_id
      AND id = ANY (p_detalle_ids)
      AND COALESCE(pendiente, 0) > 0
      AND prenda_id IS NOT NULL
  LOOP
    v_qty := v_det.pendiente;

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

    v_completados := v_completados + 1;
  END LOOP;

  IF v_completados = 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Ninguna de las partidas seleccionadas tiene pendientes por entregar.'
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
      ELSE format('Se completaron %s partida(s). El pedido sigue PENDIENTE.', v_completados)
    END,
    'estado', v_estado_final,
    'completados', v_completados,
    'pendientes_restantes', v_pendientes_restantes,
    'warnings', v_warnings
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.completar_detalles_pedido_atomico(UUID, UUID[], UUID) TO anon, authenticated;
