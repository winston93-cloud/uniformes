-- Complemento: recalcular precio/cantidad del pedido tras procesar_devolucion_atomica.
-- (La función principal no se puede reemplazar por permisos de owner en InsForge.)

CREATE OR REPLACE FUNCTION public.ajustar_precio_pedido_tras_devolucion(
  p_devolucion_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dev RECORD;
  v_det RECORD;
  v_det_pedido RECORD;
  v_nuevo_precio DECIMAL(10, 2);
  v_nuevo_total DECIMAL(10, 2);
  v_nueva_cantidad INTEGER;
  v_dev_qty INTEGER;
  v_max_entregado INTEGER;
BEGIN
  SELECT id, pedido_id, sucursal_id, estado
  INTO v_dev
  FROM public.devoluciones
  WHERE id = p_devolucion_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Devolución no encontrada');
  END IF;

  FOR v_det IN
    SELECT * FROM public.detalle_devoluciones WHERE devolucion_id = p_devolucion_id
  LOOP
    SELECT *
    INTO v_det_pedido
    FROM public.detalle_pedidos
    WHERE id = v_det.detalle_pedido_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF v_det.es_cambio
      AND v_det.prenda_cambio_id IS NOT NULL
      AND v_det.talla_cambio_id IS NOT NULL
    THEN
      SELECT COALESCE(
        v_det.precio_cambio,
        c.precio_menudeo,
        c.precio_venta,
        v_det_pedido.precio_unitario
      )
      INTO v_nuevo_precio
      FROM public.costos c
      WHERE c.prenda_id = v_det.prenda_cambio_id
        AND c.talla_id = v_det.talla_cambio_id
        AND c.sucursal_id = v_dev.sucursal_id;

      UPDATE public.detalle_pedidos
      SET precio_unitario = v_nuevo_precio,
          subtotal = cantidad * v_nuevo_precio,
          costo_id = (
            SELECT id
            FROM public.costos
            WHERE prenda_id = v_det.prenda_cambio_id
              AND talla_id = v_det.talla_cambio_id
              AND sucursal_id = v_dev.sucursal_id
            LIMIT 1
          )
      WHERE id = v_det_pedido.id;
    ELSE
      v_max_entregado := GREATEST(v_det_pedido.cantidad - COALESCE(v_det_pedido.pendiente, 0), 0);
      v_dev_qty := LEAST(v_det.cantidad_devuelta, v_max_entregado);
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

  RETURN json_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.ajustar_precio_pedido_tras_devolucion(UUID) IS
  'Tras procesar_devolucion_atomica: actualiza precio/cantidad en detalle_pedidos y recalcula total del pedido.';
