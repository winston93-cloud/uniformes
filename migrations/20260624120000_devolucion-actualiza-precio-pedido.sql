
CREATE OR REPLACE FUNCTION public.procesar_devolucion_atomica(
  p_devolucion_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_det RECORD;
  v_dev RECORD;
  v_det_pedido RECORD;
  v_costo_id UUID;
  v_costo_cambio_id UUID;
  v_max_entregado INTEGER;
  v_dev_qty INTEGER;
  v_cambio_qty INTEGER;
  v_nuevo_precio DECIMAL(10, 2);
  v_nuevo_total DECIMAL(10, 2);
  v_nueva_cantidad INTEGER;
BEGIN
  SELECT id, pedido_id, sucursal_id, estado
  INTO v_dev
  FROM public.devoluciones
  WHERE id = p_devolucion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Devolución no encontrada';
  END IF;

  IF v_dev.estado <> 'PENDIENTE' THEN
    RETURN json_build_object('success', false, 'error', 'La devolución ya fue procesada o cancelada.');
  END IF;

  FOR v_det IN
    SELECT * FROM public.detalle_devoluciones WHERE devolucion_id = p_devolucion_id
  LOOP
    SELECT *
    INTO v_det_pedido
    FROM public.detalle_pedidos
    WHERE id = v_det.detalle_pedido_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Detalle del pedido no encontrado para devolución';
    END IF;

    v_max_entregado := GREATEST(v_det_pedido.cantidad - COALESCE(v_det_pedido.pendiente, 0), 0);
    v_dev_qty := LEAST(v_det.cantidad_devuelta, v_max_entregado);

    IF v_dev_qty <= 0 THEN
      RAISE EXCEPTION 'No hay piezas entregadas para devolver en la partida %', v_det_pedido.id;
    END IF;

    SELECT c.id
    INTO v_costo_id
    FROM public.costos c
    WHERE c.prenda_id = v_det.prenda_id
      AND c.talla_id = v_det.talla_id
      AND c.sucursal_id = v_dev.sucursal_id;

    IF v_costo_id IS NULL THEN
      RAISE EXCEPTION 'Costo no encontrado para prenda/talla de devolución';
    END IF;

    UPDATE public.costos
    SET stock = stock + v_dev_qty
    WHERE id = v_costo_id;

    PERFORM public.sumar_costo_ubicaciones_desde_menor(v_costo_id, v_dev_qty);

    INSERT INTO public.movimientos (tipo, costo_id, cantidad, observaciones)
    VALUES ('ENTRADA', v_costo_id, v_dev_qty, 'Devolución #' || p_devolucion_id);

    IF v_det.es_cambio
      AND v_det.prenda_cambio_id IS NOT NULL
      AND v_det.talla_cambio_id IS NOT NULL
    THEN
      v_cambio_qty := COALESCE(v_det.cantidad_cambio, v_dev_qty);
      IF v_cambio_qty <= 0 THEN
        v_cambio_qty := v_dev_qty;
      END IF;

      SELECT c.id
      INTO v_costo_cambio_id
      FROM public.costos c
      WHERE c.prenda_id = v_det.prenda_cambio_id
        AND c.talla_id = v_det.talla_cambio_id
        AND c.sucursal_id = v_dev.sucursal_id;

      IF v_costo_cambio_id IS NULL THEN
        RAISE EXCEPTION 'Costo no encontrado para artículo de cambio';
      END IF;

      UPDATE public.costos
      SET stock = stock - v_cambio_qty
      WHERE id = v_costo_cambio_id
        AND stock >= v_cambio_qty;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock insuficiente para el artículo de cambio';
      END IF;

      PERFORM public.descontar_costo_ubicaciones_desde_menor(v_costo_cambio_id, v_cambio_qty);

      INSERT INTO public.movimientos (tipo, costo_id, cantidad, observaciones)
      VALUES ('SALIDA', v_costo_cambio_id, -v_cambio_qty, 'Cambio - Devolución #' || p_devolucion_id);

      SELECT COALESCE(
        v_det.precio_cambio,
        c.precio_menudeo,
        c.precio_venta,
        v_det_pedido.precio_unitario
      )
      INTO v_nuevo_precio
      FROM public.costos c
      WHERE c.id = v_costo_cambio_id;

      UPDATE public.detalle_pedidos
      SET prenda_id = v_det.prenda_cambio_id,
          talla_id = v_det.talla_cambio_id,
          costo_id = v_costo_cambio_id,
          precio_unitario = v_nuevo_precio,
          subtotal = v_det_pedido.cantidad * v_nuevo_precio
      WHERE id = v_det_pedido.id;
    ELSE
      v_nueva_cantidad := v_det_pedido.cantidad - v_dev_qty;

      IF v_nueva_cantidad <= 0 THEN
        DELETE FROM public.detalle_pedidos WHERE id = v_det_pedido.id;
      ELSE
        UPDATE public.detalle_pedidos
        SET cantidad = v_nueva_cantidad,
            pendiente = GREATEST(COALESCE(pendiente, 0) - LEAST(v_dev_qty, COALESCE(pendiente, 0)), 0),
            subtotal = v_nueva_cantidad * precio_unitario
        WHERE id = v_det_pedido.id;
      END IF;
    END IF;
  END LOOP;

  SELECT COALESCE(SUM(subtotal), 0)
  INTO v_nuevo_total
  FROM public.detalle_pedidos
  WHERE pedido_id = v_dev.pedido_id;

  IF NOT EXISTS (SELECT 1 FROM public.detalle_pedidos WHERE pedido_id = v_dev.pedido_id) THEN
    UPDATE public.pedidos
    SET estado = 'CANCELADO',
        updated_at = NOW()
    WHERE id = v_dev.pedido_id;
  ELSIF v_nuevo_total > 0 THEN
    UPDATE public.pedidos
    SET subtotal = v_nuevo_total,
        total = v_nuevo_total,
        updated_at = NOW()
    WHERE id = v_dev.pedido_id;
  END IF;

  UPDATE public.devoluciones
  SET estado = 'PROCESADA',
      updated_at = NOW()
  WHERE id = p_devolucion_id;

  RETURN json_build_object('success', true, 'message', 'Devolución procesada correctamente');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.procesar_devolucion_atomica(UUID) IS
  'Procesa devolución: stock, actualiza detalle_pedidos (precio/cantidad en cambio o devolución) y recalcula total del pedido.';
