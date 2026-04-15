-- Ajuste: procesar_devolucion_atomica debe
-- - devolver stock solo de piezas realmente entregadas (cantidad - pendiente del detalle_pedidos)
-- - si es cambio, descontar stock del nuevo artículo y actualizar el detalle_pedidos (prenda/talla) para reflejar el cambio
-- - registrar movimientos ENTRADA/SALIDA

-- Dependencia: helper para reponer costo_ubicaciones (entrada)
-- (se redefine aquí para que esta migración sea independiente del orden)
CREATE OR REPLACE FUNCTION sumar_costo_ubicaciones_desde_menor(
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
  r RECORD;
BEGIN
  IF p_costo_id IS NULL OR p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM costo_ubicaciones WHERE costo_id = p_costo_id) THEN
    RETURN;
  END IF;

  v_rem := p_cantidad;
  FOR r IN
    SELECT id
    FROM costo_ubicaciones
    WHERE costo_id = p_costo_id
    ORDER BY cantidad ASC, ubicacion_almacenamiento_id ASC
  LOOP
    EXIT WHEN v_rem <= 0;
    UPDATE costo_ubicaciones
    SET cantidad = cantidad + v_rem
    WHERE id = r.id;
    v_rem := 0;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION sumar_costo_ubicaciones_desde_menor(UUID, INTEGER) IS
  'Reponer unidades en costo_ubicaciones sumando en la ubicación con menor stock (primera por ORDER BY).';

CREATE OR REPLACE FUNCTION procesar_devolucion_atomica(
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
BEGIN
  SELECT id, pedido_id, sucursal_id, estado
  INTO v_dev
  FROM devoluciones
  WHERE id = p_devolucion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Devolución no encontrada';
  END IF;

  IF v_dev.estado <> 'PENDIENTE' THEN
    RETURN json_build_object('success', false, 'error', 'La devolución ya fue procesada o cancelada.');
  END IF;

  FOR v_det IN
    SELECT * FROM detalle_devoluciones WHERE devolucion_id = p_devolucion_id
  LOOP
    SELECT *
    INTO v_det_pedido
    FROM detalle_pedidos
    WHERE id = v_det.detalle_pedido_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Detalle del pedido no encontrado para devolución';
    END IF;

    v_max_entregado := GREATEST(v_det_pedido.cantidad - COALESCE(v_det_pedido.pendiente, 0), 0);
    v_dev_qty := LEAST(v_det.cantidad_devuelta, v_max_entregado);

    IF v_dev_qty <= 0 THEN
      RAISE EXCEPTION 'No hay piezas entregadas para devolver en la partida %', v_det_pedido.id;
    END IF;

    -- costo original
    SELECT c.id
    INTO v_costo_id
    FROM costos c
    WHERE c.prenda_id = v_det.prenda_id
      AND c.talla_id = v_det.talla_id
      AND c.sucursal_id = v_dev.sucursal_id;

    IF v_costo_id IS NULL THEN
      RAISE EXCEPTION 'Costo no encontrado para prenda/talla de devolución';
    END IF;

    -- Reponer stock (ENTRADA) solo de lo entregado
    UPDATE costos
    SET stock = stock + v_dev_qty
    WHERE id = v_costo_id;

    PERFORM sumar_costo_ubicaciones_desde_menor(v_costo_id, v_dev_qty);

    INSERT INTO movimientos (tipo, costo_id, cantidad, observaciones)
    VALUES ('ENTRADA', v_costo_id, v_dev_qty, 'Devolución #' || p_devolucion_id);

    -- Si es cambio: descontar del artículo nuevo y actualizar el detalle del pedido
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
      FROM costos c
      WHERE c.prenda_id = v_det.prenda_cambio_id
        AND c.talla_id = v_det.talla_cambio_id
        AND c.sucursal_id = v_dev.sucursal_id;

      IF v_costo_cambio_id IS NULL THEN
        RAISE EXCEPTION 'Costo no encontrado para artículo de cambio';
      END IF;

      UPDATE costos
      SET stock = stock - v_cambio_qty
      WHERE id = v_costo_cambio_id
        AND stock >= v_cambio_qty;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock insuficiente para el artículo de cambio';
      END IF;

      PERFORM descontar_costo_ubicaciones_desde_menor(v_costo_cambio_id, v_cambio_qty);

      INSERT INTO movimientos (tipo, costo_id, cantidad, observaciones)
      VALUES ('SALIDA', v_costo_cambio_id, -v_cambio_qty, 'Cambio - Devolución #' || p_devolucion_id);

      -- Reflejar cambio en el pedido: actualizar prenda/talla de la partida
      UPDATE detalle_pedidos
      SET prenda_id = v_det.prenda_cambio_id,
          talla_id = v_det.talla_cambio_id
      WHERE id = v_det_pedido.id;
    END IF;
  END LOOP;

  UPDATE devoluciones
  SET estado = 'PROCESADA',
      updated_at = NOW()
  WHERE id = p_devolucion_id;

  RETURN json_build_object('success', true, 'message', 'Devolución procesada correctamente');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION procesar_devolucion_atomica(UUID) TO authenticated;

COMMENT ON FUNCTION procesar_devolucion_atomica(UUID) IS
  'Procesa devolución: repone stock solo de entregado (cantidad-pendiente). Si es cambio, descuenta stock del nuevo artículo y actualiza detalle_pedidos.';

