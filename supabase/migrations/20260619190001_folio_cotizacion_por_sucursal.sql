-- Cotización terminada: folio de pedido por sucursal
CREATE OR REPLACE FUNCTION public.trg_pedido_desde_cotizacion_terminada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido_id UUID;
  v_sucursal_id UUID;
  v_folio TEXT;
  v_cliente_nombre TEXT;
  d RECORD;
  v_prenda_id UUID;
  v_talla_id UUID;
  v_pendiente INTEGER;
  v_lines INTEGER := 0;
  v_sum_sub NUMERIC(12, 2);
  v_ins_sub NUMERIC(12, 2);
  v_ins_tot NUMERIC(12, 2);
BEGIN
  IF NEW.estado IS DISTINCT FROM 'terminado' THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'terminado' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM pedidos p WHERE p.cotizacion_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT c.sucursal_id INTO v_sucursal_id
  FROM detalle_cotizacion dc
  JOIN costos c ON c.id = dc.costo_id
  WHERE dc.cotizacion_id = NEW.id
  LIMIT 1;

  IF v_sucursal_id IS NULL THEN
    SELECT s.id INTO v_sucursal_id
    FROM sucursales s
    WHERE s.es_matriz = true AND s.activo = true
    LIMIT 1;
  END IF;

  IF v_sucursal_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró sucursal para registrar el pedido (defina una sucursal matriz).';
  END IF;

  IF NEW.tipo_cliente = 'alumno' AND NEW.alumno_id IS NOT NULL THEN
    SELECT UPPER(TRIM(COALESCE(a.alumno_nombre_completo, a.alumno_nombre, ''))) INTO v_cliente_nombre FROM public.alumno a WHERE a.alumno_id::text = TRIM(NEW.alumno_id);
  ELSIF NEW.tipo_cliente = 'externo' AND NEW.externo_id IS NOT NULL THEN
    SELECT UPPER(TRIM(e.nombre)) INTO v_cliente_nombre FROM externos e WHERE e.id = NEW.externo_id;
  END IF;

  v_cliente_nombre := COALESCE(v_cliente_nombre, 'CLIENTE');

  v_folio := public.generar_folio_pedido(v_sucursal_id);

  v_ins_sub := GREATEST(COALESCE(NEW.subtotal, 0), 0.01);
  v_ins_tot := GREATEST(COALESCE(NEW.total, NEW.subtotal, 0), 0.01);

  INSERT INTO pedidos (
    tipo_cliente,
    cliente_nombre,
    sucursal_id,
    usuario_id,
    alumno_id,
    externo_id,
    estado,
    subtotal,
    total,
    notas,
    folio,
    cotizacion_id
  ) VALUES (
    NEW.tipo_cliente,
    v_cliente_nombre,
    v_sucursal_id,
    NEW.usuario_id,
    NEW.alumno_id,
    NEW.externo_id,
    'COMPLETADO',
    v_ins_sub,
    v_ins_tot,
    'Venta por cotización terminada ' || NEW.folio
      || '. Sin salida de inventario de prendas desde almacén.',
    v_folio,
    NEW.id
  )
  RETURNING id INTO v_pedido_id;

  FOR d IN
    SELECT *
    FROM detalle_cotizacion
    WHERE cotizacion_id = NEW.id
    ORDER BY orden
  LOOP
    v_prenda_id := NULL;
    v_talla_id := NULL;

    IF d.costo_id IS NOT NULL THEN
      SELECT c.prenda_id, c.talla_id
      INTO v_prenda_id, v_talla_id
      FROM costos c
      WHERE c.id = d.costo_id;
    ELSIF d.prenda_id IS NOT NULL THEN
      SELECT c.prenda_id, c.talla_id
      INTO v_prenda_id, v_talla_id
      FROM costos c
      JOIN tallas t ON t.id = c.talla_id
      WHERE c.prenda_id = d.prenda_id
        AND c.sucursal_id = v_sucursal_id
        AND UPPER(TRIM(t.nombre)) = UPPER(TRIM(d.talla))
      LIMIT 1;
    END IF;

    IF v_prenda_id IS NULL OR v_talla_id IS NULL THEN
      CONTINUE;
    END IF;

    v_pendiente := 0;

    INSERT INTO detalle_pedidos (
      pedido_id,
      prenda_id,
      talla_id,
      cantidad,
      precio_unitario,
      subtotal,
      pendiente,
      especificaciones
    ) VALUES (
      v_pedido_id,
      v_prenda_id,
      v_talla_id,
      d.cantidad,
      d.precio_unitario,
      d.subtotal,
      v_pendiente,
      UPPER(COALESCE(NULLIF(TRIM(d.especificaciones), ''), ''))
    );

    v_lines := v_lines + 1;
  END LOOP;

  IF v_lines = 0 THEN
    DELETE FROM pedidos WHERE id = v_pedido_id;
    RAISE EXCEPTION
      'No se pudo generar el pedido: ninguna partida tiene costo vinculado (costo_id) o prenda+talla reconocibles en esta sucursal.';
  END IF;

  SELECT COALESCE(SUM(subtotal), 0)::NUMERIC(12, 2)
  INTO v_sum_sub
  FROM detalle_pedidos
  WHERE pedido_id = v_pedido_id;

  UPDATE pedidos
  SET
    subtotal = v_sum_sub,
    total = v_sum_sub,
    notas = TRIM(
      COALESCE(notas, '')
      || CASE
          WHEN COALESCE(NEW.incluir_iva, false) OR COALESCE(NEW.incluir_isr, false)
          THEN ' Total documento cotización (impuestos): ' || NEW.total::TEXT
          ELSE ''
        END
    )
  WHERE id = v_pedido_id;

  RETURN NEW;
END;
$$;
