-- Transferencias atómicas: cada operación (crear, modificar, recibir, recibir partida,
-- cancelar, reenviar complementario) corre en una sola transacción y bloquea la fila
-- de la transferencia (FOR UPDATE), así dos clics o reintentos no pueden duplicar
-- descuentos/abonos de stock. Crear es idempotente vía client_token.

ALTER TABLE public.transferencias ADD COLUMN IF NOT EXISTS client_token UUID;
CREATE UNIQUE INDEX IF NOT EXISTS transferencias_client_token_key
  ON public.transferencias (client_token) WHERE client_token IS NOT NULL;

-- ========= helpers de stock =========

CREATE OR REPLACE FUNCTION public._transfer_descontar_origen(
  p_costo_id UUID,
  p_cantidad INTEGER,
  p_sucursal_origen_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sucursal UUID;
  v_stock INTEGER;
BEGIN
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'Cantidad inválida para transferir.';
  END IF;

  SELECT sucursal_id, stock INTO v_sucursal, v_stock
  FROM costos WHERE id = p_costo_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Costo de origen no encontrado.';
  END IF;
  IF v_sucursal IS DISTINCT FROM p_sucursal_origen_id THEN
    RAISE EXCEPTION 'El costo no pertenece a la sucursal origen.';
  END IF;
  IF COALESCE(v_stock, 0) < p_cantidad THEN
    RAISE EXCEPTION 'Stock insuficiente: hay %, se pidieron %.', COALESCE(v_stock, 0), p_cantidad;
  END IF;

  UPDATE costos
  SET stock = stock - p_cantidad,
      stock_inicial = stock - p_cantidad
  WHERE id = p_costo_id;

  PERFORM descontar_costo_ubicaciones_desde_menor(p_costo_id, p_cantidad);
END;
$$;

CREATE OR REPLACE FUNCTION public._transfer_reponer_origen(
  p_costo_id UUID,
  p_cantidad INTEGER,
  p_sucursal_origen_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sucursal UUID;
BEGIN
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RETURN;
  END IF;

  SELECT sucursal_id INTO v_sucursal FROM costos WHERE id = p_costo_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Costo de origen no encontrado.';
  END IF;
  IF v_sucursal IS DISTINCT FROM p_sucursal_origen_id THEN
    RAISE EXCEPTION 'El costo no pertenece a la sucursal origen.';
  END IF;

  UPDATE costos
  SET stock = stock + p_cantidad,
      stock_inicial = stock + p_cantidad
  WHERE id = p_costo_id;

  PERFORM sumar_costo_ubicaciones_desde_menor(p_costo_id, p_cantidad);
END;
$$;

CREATE OR REPLACE FUNCTION public._transfer_abonar_destino(
  p_costo_origen_id UUID,
  p_sucursal_destino_id UUID,
  p_cantidad INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o RECORD;
  v_destino_id UUID;
BEGIN
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'Cantidad inválida para recibir.';
  END IF;

  SELECT * INTO o FROM costos WHERE id = p_costo_origen_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Costo de origen no encontrado.';
  END IF;

  INSERT INTO costos (
    prenda_id, talla_id, sucursal_id,
    precio_venta, precio_compra, precio_mayoreo, precio_menudeo,
    stock_inicial, stock, stock_minimo, cantidad_venta, activo
  )
  VALUES (
    o.prenda_id, o.talla_id, p_sucursal_destino_id,
    COALESCE(o.precio_venta, 0), COALESCE(o.precio_compra, 0),
    COALESCE(o.precio_mayoreo, 0), COALESCE(o.precio_menudeo, 0),
    p_cantidad, p_cantidad, COALESCE(o.stock_minimo, 0), COALESCE(o.cantidad_venta, 0), TRUE
  )
  ON CONFLICT (prenda_id, talla_id, sucursal_id) DO UPDATE
    SET stock = costos.stock + EXCLUDED.stock,
        stock_inicial = costos.stock + EXCLUDED.stock
  RETURNING id INTO v_destino_id;

  PERFORM sumar_costo_ubicaciones_desde_menor(v_destino_id, p_cantidad);
  RETURN v_destino_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._transferencia_recalcular_estado(p_transferencia_id UUID)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
  v_recibidas INTEGER;
  v_transito INTEGER;
  v_compl INTEGER;
  v_estado VARCHAR := 'EN_TRANSITO';
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE UPPER(COALESCE(estado, 'EN_TRANSITO')) = 'RECIBIDA'),
    COUNT(*) FILTER (WHERE UPPER(COALESCE(estado, 'EN_TRANSITO')) IN ('EN_TRANSITO', 'PENDIENTE')),
    COUNT(*) FILTER (WHERE UPPER(COALESCE(estado, 'EN_TRANSITO')) = 'EN_TRANSITO_COMPLEMENTARIO')
  INTO v_total, v_recibidas, v_transito, v_compl
  FROM detalle_transferencias
  WHERE transferencia_id = p_transferencia_id;

  IF v_total > 0 AND v_recibidas = v_total THEN
    v_estado := 'RECIBIDA';
  ELSIF v_transito > 0 THEN
    v_estado := 'EN_TRANSITO';
  ELSIF v_compl > 0 THEN
    v_estado := 'RECIBIDA_PARCIAL';
  END IF;

  UPDATE transferencias SET estado = v_estado WHERE id = p_transferencia_id;
  RETURN v_estado;
END;
$$;

-- ========= crear (idempotente) =========

CREATE OR REPLACE FUNCTION public.transferencia_crear(
  p_sucursal_origen_id UUID,
  p_sucursal_destino_id UUID,
  p_observaciones TEXT,
  p_detalles JSONB,
  p_client_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  d JSONB;
  v_cantidad INTEGER;
  v_row JSONB;
BEGIN
  IF p_sucursal_origen_id IS NULL OR p_sucursal_destino_id IS NULL THEN
    RAISE EXCEPTION 'Selecciona sucursal origen y destino.';
  END IF;
  IF p_sucursal_origen_id = p_sucursal_destino_id THEN
    RAISE EXCEPTION 'Origen y destino deben ser distintos.';
  END IF;
  IF p_detalles IS NULL OR jsonb_typeof(p_detalles) <> 'array' OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'Agrega al menos una prenda con cantidad.';
  END IF;

  -- Reintento con el mismo token: devolver la transferencia ya creada sin tocar stock.
  -- Si otra petición con el mismo token está en curso, el INSERT espera a que termine.
  INSERT INTO transferencias (
    sucursal_origen_id, sucursal_destino_id, usuario_id, estado, observaciones, folio, client_token
  )
  VALUES (
    p_sucursal_origen_id, p_sucursal_destino_id, NULL, 'EN_TRANSITO',
    NULLIF(BTRIM(COALESCE(p_observaciones, '')), ''), '', p_client_token
  )
  ON CONFLICT (client_token) WHERE client_token IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT to_jsonb(t) INTO v_row FROM transferencias t WHERE t.client_token = p_client_token;
    RETURN v_row || jsonb_build_object('duplicada', TRUE);
  END IF;

  FOR d IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    v_cantidad := TRUNC((d->>'cantidad')::NUMERIC)::INTEGER;
    IF COALESCE(d->>'prenda_id', '') = '' OR COALESCE(d->>'talla_id', '') = ''
       OR COALESCE(d->>'costo_id', '') = '' OR v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cada línea debe tener prenda, talla, costo y cantidad > 0.';
    END IF;

    PERFORM _transfer_descontar_origen((d->>'costo_id')::UUID, v_cantidad, p_sucursal_origen_id);

    INSERT INTO detalle_transferencias (transferencia_id, prenda_id, talla_id, cantidad, costo_id, estado)
    VALUES (v_id, (d->>'prenda_id')::UUID, (d->>'talla_id')::UUID, v_cantidad, (d->>'costo_id')::UUID, 'EN_TRANSITO');
  END LOOP;

  SELECT to_jsonb(t) INTO v_row FROM transferencias t WHERE t.id = v_id;
  RETURN v_row;
END;
$$;

-- ========= modificar (solo origen, en tránsito) =========

CREATE OR REPLACE FUNCTION public.transferencia_modificar(
  p_transferencia_id UUID,
  p_sucursal_id UUID,
  p_observaciones TEXT,
  p_detalles JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t RECORD;
  prev RECORD;
  d JSONB;
  v_cantidad INTEGER;
  v_row JSONB;
BEGIN
  SELECT * INTO t FROM transferencias WHERE id = p_transferencia_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia no encontrada.';
  END IF;
  IF t.sucursal_origen_id IS DISTINCT FROM p_sucursal_id THEN
    RAISE EXCEPTION 'Solo la sucursal origen puede modificar esta transferencia.';
  END IF;
  IF t.estado NOT IN ('EN_TRANSITO', 'PENDIENTE') THEN
    RAISE EXCEPTION 'Solo se pueden modificar transferencias en tránsito (estado: %).', t.estado;
  END IF;
  IF p_detalles IS NULL OR jsonb_typeof(p_detalles) <> 'array' OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'Agrega al menos una prenda con cantidad.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM detalle_transferencias
    WHERE transferencia_id = p_transferencia_id
      AND UPPER(COALESCE(estado, 'EN_TRANSITO')) NOT IN ('EN_TRANSITO', 'PENDIENTE')
  ) THEN
    RAISE EXCEPTION 'No se puede modificar: ya hay partidas recibidas o complementarias.';
  END IF;

  FOR prev IN
    SELECT * FROM detalle_transferencias WHERE transferencia_id = p_transferencia_id FOR UPDATE
  LOOP
    IF prev.costo_id IS NOT NULL AND COALESCE(prev.cantidad, 0) > 0 THEN
      PERFORM _transfer_reponer_origen(prev.costo_id, prev.cantidad, t.sucursal_origen_id);
    END IF;
  END LOOP;

  DELETE FROM detalle_transferencias WHERE transferencia_id = p_transferencia_id;

  FOR d IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    v_cantidad := TRUNC((d->>'cantidad')::NUMERIC)::INTEGER;
    IF COALESCE(d->>'prenda_id', '') = '' OR COALESCE(d->>'talla_id', '') = ''
       OR COALESCE(d->>'costo_id', '') = '' OR v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cada línea debe tener prenda, talla, costo y cantidad > 0.';
    END IF;

    PERFORM _transfer_descontar_origen((d->>'costo_id')::UUID, v_cantidad, t.sucursal_origen_id);

    INSERT INTO detalle_transferencias (transferencia_id, prenda_id, talla_id, cantidad, costo_id, estado)
    VALUES (p_transferencia_id, (d->>'prenda_id')::UUID, (d->>'talla_id')::UUID, v_cantidad, (d->>'costo_id')::UUID, 'EN_TRANSITO');
  END LOOP;

  UPDATE transferencias
  SET observaciones = NULLIF(BTRIM(COALESCE(p_observaciones, '')), ''),
      estado = 'EN_TRANSITO'
  WHERE id = p_transferencia_id;

  SELECT to_jsonb(x) INTO v_row FROM transferencias x WHERE x.id = p_transferencia_id;
  RETURN v_row;
END;
$$;

-- ========= recibir (destino; total o parcial por partidas) =========

CREATE OR REPLACE FUNCTION public.transferencia_recibir(
  p_transferencia_id UUID,
  p_sucursal_id UUID,
  p_detalle_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t RECORD;
  det RECORD;
  v_seleccion BOOLEAN := p_detalle_ids IS NOT NULL AND COALESCE(array_length(p_detalle_ids, 1), 0) > 0;
  v_recibidas INTEGER := 0;
  v_no_recibidas INTEGER := 0;
  v_estado VARCHAR;
  v_row JSONB;
BEGIN
  SELECT * INTO t FROM transferencias WHERE id = p_transferencia_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia no encontrada.';
  END IF;
  IF t.sucursal_destino_id IS DISTINCT FROM p_sucursal_id THEN
    RAISE EXCEPTION 'Solo la sucursal destino puede confirmar la recepción.';
  END IF;
  IF t.estado IN ('RECIBIDA', 'CANCELADA') THEN
    RAISE EXCEPTION 'Esta transferencia ya no admite recepción.';
  END IF;
  IF t.estado NOT IN ('EN_TRANSITO', 'PENDIENTE', 'RECIBIDA_PARCIAL') THEN
    RAISE EXCEPTION 'Estado no válido: %', t.estado;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM detalle_transferencias
    WHERE transferencia_id = p_transferencia_id
      AND UPPER(COALESCE(estado, 'EN_TRANSITO')) IN ('EN_TRANSITO', 'PENDIENTE')
  ) THEN
    RAISE EXCEPTION 'No hay partidas pendientes por recibir.';
  END IF;

  IF v_seleccion AND NOT EXISTS (
    SELECT 1 FROM detalle_transferencias
    WHERE transferencia_id = p_transferencia_id
      AND UPPER(COALESCE(estado, 'EN_TRANSITO')) IN ('EN_TRANSITO', 'PENDIENTE')
      AND id = ANY (p_detalle_ids)
  ) THEN
    RAISE EXCEPTION 'Selecciona al menos una prenda para recibir.';
  END IF;

  FOR det IN
    SELECT * FROM detalle_transferencias
    WHERE transferencia_id = p_transferencia_id
      AND UPPER(COALESCE(estado, 'EN_TRANSITO')) IN ('EN_TRANSITO', 'PENDIENTE')
    FOR UPDATE
  LOOP
    IF det.costo_id IS NULL THEN
      RAISE EXCEPTION 'Detalle sin costo de origen.';
    END IF;

    IF NOT v_seleccion OR det.id = ANY (p_detalle_ids) THEN
      IF COALESCE(det.cantidad, 0) > 0 THEN
        PERFORM _transfer_abonar_destino(det.costo_id, t.sucursal_destino_id, det.cantidad);
      END IF;
      UPDATE detalle_transferencias SET estado = 'RECIBIDA' WHERE id = det.id;
      v_recibidas := v_recibidas + 1;
    ELSE
      IF COALESCE(det.cantidad, 0) > 0 THEN
        PERFORM _transfer_reponer_origen(det.costo_id, det.cantidad, t.sucursal_origen_id);
      END IF;
      UPDATE detalle_transferencias SET estado = 'EN_TRANSITO_COMPLEMENTARIO' WHERE id = det.id;
      v_no_recibidas := v_no_recibidas + 1;
    END IF;
  END LOOP;

  v_estado := _transferencia_recalcular_estado(p_transferencia_id);
  SELECT to_jsonb(x) INTO v_row FROM transferencias x WHERE x.id = p_transferencia_id;
  RETURN jsonb_build_object(
    'transferencia', v_row,
    'recibidas', v_recibidas,
    'noRecibidas', v_no_recibidas,
    'estado', v_estado
  );
END;
$$;

-- ========= recibir una partida (destino) =========

CREATE OR REPLACE FUNCTION public.transferencia_recibir_partida(
  p_transferencia_id UUID,
  p_detalle_id UUID,
  p_sucursal_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t RECORD;
  det RECORD;
  v_est VARCHAR;
  v_estado VARCHAR;
  v_row JSONB;
BEGIN
  SELECT * INTO t FROM transferencias WHERE id = p_transferencia_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia no encontrada.';
  END IF;
  IF t.sucursal_destino_id IS DISTINCT FROM p_sucursal_id THEN
    RAISE EXCEPTION 'Solo la sucursal destino puede recibir partidas.';
  END IF;
  IF t.estado IN ('RECIBIDA', 'CANCELADA') THEN
    RAISE EXCEPTION 'Esta transferencia ya no admite recepción.';
  END IF;

  SELECT * INTO det FROM detalle_transferencias
  WHERE id = p_detalle_id AND transferencia_id = p_transferencia_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partida no encontrada.';
  END IF;

  v_est := UPPER(COALESCE(det.estado, 'EN_TRANSITO'));
  IF v_est NOT IN ('EN_TRANSITO_COMPLEMENTARIO', 'EN_TRANSITO', 'PENDIENTE') THEN
    RAISE EXCEPTION 'Esta partida no se puede recibir (estado: %).', v_est;
  END IF;
  IF det.costo_id IS NULL OR COALESCE(det.cantidad, 0) <= 0 THEN
    RAISE EXCEPTION 'Partida incompleta.';
  END IF;

  -- Complementario: el stock ya había vuelto al origen → descontar de nuevo al recibir
  IF v_est = 'EN_TRANSITO_COMPLEMENTARIO' THEN
    PERFORM _transfer_descontar_origen(det.costo_id, det.cantidad, t.sucursal_origen_id);
  END IF;

  PERFORM _transfer_abonar_destino(det.costo_id, t.sucursal_destino_id, det.cantidad);
  UPDATE detalle_transferencias SET estado = 'RECIBIDA' WHERE id = det.id;

  v_estado := _transferencia_recalcular_estado(p_transferencia_id);
  SELECT to_jsonb(x) INTO v_row FROM transferencias x WHERE x.id = p_transferencia_id;
  RETURN jsonb_build_object('transferencia', v_row, 'estado', v_estado, 'detalle_id', p_detalle_id);
END;
$$;

-- ========= cancelar (origen) =========

CREATE OR REPLACE FUNCTION public.transferencia_cancelar(
  p_transferencia_id UUID,
  p_sucursal_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t RECORD;
  det RECORD;
  v_repuestas INTEGER := 0;
  v_row JSONB;
BEGIN
  SELECT * INTO t FROM transferencias WHERE id = p_transferencia_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia no encontrada.';
  END IF;
  IF t.estado = 'CANCELADA' THEN
    RAISE EXCEPTION 'Esta transferencia ya está cancelada.';
  END IF;
  IF t.estado = 'RECIBIDA' THEN
    RAISE EXCEPTION 'No se puede cancelar una transferencia ya recibida.';
  END IF;
  IF t.estado NOT IN ('EN_TRANSITO', 'PENDIENTE', 'RECIBIDA_PARCIAL') THEN
    RAISE EXCEPTION 'No se puede cancelar en estado %.', t.estado;
  END IF;
  IF t.sucursal_origen_id IS DISTINCT FROM p_sucursal_id THEN
    RAISE EXCEPTION 'Solo la sucursal origen puede cancelar esta transferencia.';
  END IF;

  FOR det IN
    SELECT * FROM detalle_transferencias WHERE transferencia_id = p_transferencia_id FOR UPDATE
  LOOP
    -- RECIBIDA: ya está en destino. COMPLEMENTARIO: el stock ya volvió al origen.
    CONTINUE WHEN UPPER(COALESCE(det.estado, 'EN_TRANSITO')) IN ('RECIBIDA', 'EN_TRANSITO_COMPLEMENTARIO');
    CONTINUE WHEN det.costo_id IS NULL OR COALESCE(det.cantidad, 0) <= 0;
    PERFORM _transfer_reponer_origen(det.costo_id, det.cantidad, t.sucursal_origen_id);
    v_repuestas := v_repuestas + det.cantidad;
  END LOOP;

  UPDATE transferencias SET estado = 'CANCELADA' WHERE id = p_transferencia_id;
  SELECT to_jsonb(x) INTO v_row FROM transferencias x WHERE x.id = p_transferencia_id;
  RETURN jsonb_build_object('transferencia', v_row, 'unidades_repuestas', v_repuestas);
END;
$$;

-- ========= reenviar partida complementaria (origen) =========

CREATE OR REPLACE FUNCTION public.transferencia_reenviar_complementario(
  p_transferencia_id UUID,
  p_detalle_id UUID,
  p_sucursal_id UUID,
  p_linea JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t RECORD;
  det RECORD;
  v_prenda UUID;
  v_talla UUID;
  v_costo UUID;
  v_cantidad INTEGER;
  v_estado VARCHAR;
  v_row JSONB;
BEGIN
  SELECT * INTO t FROM transferencias WHERE id = p_transferencia_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia no encontrada.';
  END IF;
  IF t.sucursal_origen_id IS DISTINCT FROM p_sucursal_id THEN
    RAISE EXCEPTION 'Solo la sucursal origen puede corregir y reenviar.';
  END IF;
  IF t.estado IN ('RECIBIDA', 'CANCELADA') THEN
    RAISE EXCEPTION 'Estado no válido: %', t.estado;
  END IF;

  SELECT * INTO det FROM detalle_transferencias
  WHERE id = p_detalle_id AND transferencia_id = p_transferencia_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partida no encontrada.';
  END IF;
  IF UPPER(COALESCE(det.estado, '')) <> 'EN_TRANSITO_COMPLEMENTARIO' THEN
    RAISE EXCEPTION 'Solo se pueden reenviar partidas en tránsito complementario.';
  END IF;

  v_prenda := det.prenda_id;
  v_talla := det.talla_id;
  v_costo := det.costo_id;
  v_cantidad := det.cantidad;

  IF p_linea IS NOT NULL AND jsonb_typeof(p_linea) = 'object' THEN
    v_cantidad := TRUNC((p_linea->>'cantidad')::NUMERIC)::INTEGER;
    IF COALESCE(p_linea->>'prenda_id', '') = '' OR COALESCE(p_linea->>'talla_id', '') = ''
       OR COALESCE(p_linea->>'costo_id', '') = '' OR v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'La línea corregida debe tener prenda, talla, costo y cantidad > 0.';
    END IF;
    v_prenda := (p_linea->>'prenda_id')::UUID;
    v_talla := (p_linea->>'talla_id')::UUID;
    v_costo := (p_linea->>'costo_id')::UUID;
  END IF;

  IF v_costo IS NULL OR COALESCE(v_cantidad, 0) <= 0 THEN
    RAISE EXCEPTION 'Partida incompleta para reenviar.';
  END IF;

  PERFORM _transfer_descontar_origen(v_costo, v_cantidad, t.sucursal_origen_id);

  UPDATE detalle_transferencias
  SET prenda_id = v_prenda, talla_id = v_talla, costo_id = v_costo,
      cantidad = v_cantidad, estado = 'EN_TRANSITO'
  WHERE id = det.id;

  v_estado := _transferencia_recalcular_estado(p_transferencia_id);
  SELECT to_jsonb(x) INTO v_row FROM transferencias x WHERE x.id = p_transferencia_id;
  RETURN jsonb_build_object('transferencia', v_row, 'estado', v_estado, 'detalle_id', p_detalle_id);
END;
$$;

REVOKE ALL ON FUNCTION public._transfer_descontar_origen(UUID, INTEGER, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._transfer_reponer_origen(UUID, INTEGER, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._transfer_abonar_destino(UUID, UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._transferencia_recalcular_estado(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.transferencia_crear(UUID, UUID, TEXT, JSONB, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transferencia_modificar(UUID, UUID, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transferencia_recibir(UUID, UUID, UUID[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transferencia_recibir_partida(UUID, UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transferencia_cancelar(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transferencia_reenviar_complementario(UUID, UUID, UUID, JSONB) TO anon, authenticated;
