-- Completar partidas pendientes indicando cuántas piezas se entregan por partida.
-- Recibe p_items = [{ "id": <detalle_uuid>, "cantidad": <int> }, ...].
-- Descuenta stock solo por las piezas entregadas y reduce el pendiente de cada partida.
-- El pedido pasa a COMPLETADO cuando ya no quedan pendientes.

CREATE OR REPLACE FUNCTION public.completar_detalles_pedido_por_piezas_atomico(
  p_pedido_id UUID,
  p_items JSONB,
  p_usuario_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido RECORD;
  v_item RECORD;
  v_det RECORD;
  v_costo_id UUID;
  v_solicitado INTEGER;
  v_entregar INTEGER;
  v_stock INTEGER;
  v_descontar INTEGER;
  v_pendientes_restantes INTEGER;
  v_prenda_nombre TEXT;
  v_talla_nombre TEXT;
  v_warnings JSONB := '[]'::JSONB;
  v_partidas INTEGER := 0;
  v_piezas INTEGER := 0;
  v_estado_final TEXT;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
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

  FOR v_item IN
    SELECT
      (elem->>'id')::UUID AS detalle_id,
      GREATEST(COALESCE((elem->>'cantidad')::INTEGER, 0), 0) AS cantidad
    FROM jsonb_array_elements(p_items) AS elem
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

    v_solicitado := v_item.cantidad;
    v_entregar := LEAST(v_solicitado, v_det.pendiente);

    IF v_entregar <= 0 THEN
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
    v_descontar := LEAST(v_entregar, GREATEST(v_stock, 0));

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

    IF v_descontar < v_entregar THEN
      v_warnings := v_warnings || jsonb_build_array(
        format(
          '%s / %s: entregado sin descontar inventario (entrega %s, stock %s)',
          COALESCE(v_prenda_nombre, '?'),
          COALESCE(v_talla_nombre, '?'),
          v_entregar,
          v_stock
        )
      );
    END IF;

    UPDATE public.detalle_pedidos
    SET pendiente = GREATEST(COALESCE(pendiente, 0) - v_entregar, 0)
    WHERE id = v_det.id;

    v_partidas := v_partidas + 1;
    v_piezas := v_piezas + v_entregar;
  END LOOP;

  IF v_partidas = 0 THEN
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
      ELSE format('Se entregaron %s pieza(s) en %s partida(s). El pedido sigue PENDIENTE.', v_piezas, v_partidas)
    END,
    'estado', v_estado_final,
    'partidas', v_partidas,
    'piezas', v_piezas,
    'pendientes_restantes', v_pendientes_restantes,
    'warnings', v_warnings
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.completar_detalles_pedido_por_piezas_atomico(UUID, JSONB, UUID) TO anon, authenticated;
