-- Bloque 5: RPCs y triggers de negocio (InsForge)

-- Fix: al vender (crear_pedido_atomico) se descuenta stock agregado (costos.stock)
-- pero también debe descontarse el reparto por ubicación (costo_ubicaciones).
-- Regla pedida:
-- 1) Descontar siempre de la ubicación con MENOR cantidad.
-- 2) Si hay empate, descontar primero de "Taller".
--
-- Nota: mantenemos compatibilidad legacy: pedidos.usuario_id / movimientos.usuario_id pueden ser SMALLINT.
-- Insertamos NULL literal para evitar casts (uuid vs smallint) en entornos viejos.

-- ========= helper: descontar costo_ubicaciones (salida) =========
CREATE OR REPLACE FUNCTION public.descontar_costo_ubicaciones_desde_menor(
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
  v_take INTEGER;
  r RECORD;
  v_sum INTEGER;
BEGIN
  IF p_costo_id IS NULL OR p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.costo_ubicaciones WHERE costo_id = p_costo_id) THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(cantidad), 0)::INTEGER INTO v_sum
  FROM public.costo_ubicaciones
  WHERE costo_id = p_costo_id;

  IF v_sum < p_cantidad THEN
    RAISE EXCEPTION
      'Stock por ubicaciones insuficiente para la prenda/talla (costo %): en ubicaciones hay %, se requieren % unidades.',
      p_costo_id,
      v_sum,
      p_cantidad;
  END IF;

  v_rem := p_cantidad;
  FOR r IN
    SELECT cu.id, cu.cantidad
    FROM public.costo_ubicaciones cu
    JOIN public.ubicaciones_almacenamiento ua
      ON ua.id = cu.ubicacion_almacenamiento_id
    WHERE cu.costo_id = p_costo_id
    ORDER BY
      cu.cantidad ASC,
      CASE
        WHEN ua.nombre ILIKE 'taller' THEN 0
        ELSE 1
      END ASC,
      cu.ubicacion_almacenamiento_id ASC
  LOOP
    EXIT WHEN v_rem <= 0;
    v_take := LEAST(r.cantidad, v_rem);
    IF v_take > 0 THEN
      UPDATE public.costo_ubicaciones
      SET cantidad = cantidad - v_take
      WHERE id = r.id;
      v_rem := v_rem - v_take;
    END IF;
  END LOOP;

  IF v_rem > 0 THEN
    RAISE EXCEPTION 'No se pudo completar el descuento por ubicaciones (costo %).', p_costo_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.descontar_costo_ubicaciones_desde_menor(UUID, INTEGER) IS
  'Descuenta unidades en costo_ubicaciones desde la ubicación con menor stock; empate: Taller primero.';

-- ========= crear pedido (auto-split + descuento ubicaciones) =========
CREATE OR REPLACE FUNCTION public.crear_pedido_atomico(
  p_tipo_cliente VARCHAR,
  p_cliente_nombre VARCHAR,
  p_sucursal_id UUID,
  p_usuario_id UUID DEFAULT NULL,
  p_alumno_id TEXT DEFAULT NULL,
  p_externo_id UUID DEFAULT NULL,
  p_estado VARCHAR DEFAULT 'PENDIENTE',
  p_notas TEXT DEFAULT NULL,
  p_detalles JSONB DEFAULT '[]'::JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido_id UUID;
  v_detalle JSONB;
  v_costo_id UUID;
  v_stock_actual INTEGER;
  v_precio_unitario DECIMAL(10,2);
  v_cantidad_total INTEGER;
  v_cantidad_con_stock INTEGER;
  v_cantidad_pendiente INTEGER;
  v_detalle_pedido_id UUID;
  v_subtotal_calculado DECIMAL(10,2) := 0;
  v_total_calculado DECIMAL(10,2) := 0;
  v_any_pending BOOLEAN := false;
  v_estado_final VARCHAR;
BEGIN
  IF p_tipo_cliente IS NULL OR p_cliente_nombre IS NULL OR p_sucursal_id IS NULL THEN
    RAISE EXCEPTION 'Faltan datos obligatorios';
  END IF;

  IF jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'No se pueden crear pedidos sin detalles';
  END IF;

  -- 1) Calcular totales (sobre cantidad TOTAL) y detectar si habrá pendientes
  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    v_cantidad_total := COALESCE((v_detalle->>'cantidad')::INTEGER, 0);
    IF v_cantidad_total <= 0 THEN
      RAISE EXCEPTION 'La cantidad debe ser mayor a 0';
    END IF;

    SELECT c.id, c.stock, COALESCE(c.precio_menudeo, c.precio_venta, 0)
    INTO v_costo_id, v_stock_actual, v_precio_unitario
    FROM public.costos c
    WHERE c.prenda_id = (v_detalle->>'prenda_id')::UUID
      AND c.talla_id = (v_detalle->>'talla_id')::UUID
      AND c.sucursal_id = p_sucursal_id
      AND c.activo = true;

    IF v_costo_id IS NULL THEN
      RAISE EXCEPTION 'No existe precio para prenda % talla % en esta sucursal', (v_detalle->>'prenda_id'), (v_detalle->>'talla_id');
    END IF;

    v_cantidad_con_stock := LEAST(GREATEST(COALESCE(v_stock_actual, 0), 0), v_cantidad_total);
    v_cantidad_pendiente := v_cantidad_total - v_cantidad_con_stock;
    IF v_cantidad_pendiente > 0 THEN
      v_any_pending := true;
    END IF;

    v_subtotal_calculado := v_subtotal_calculado + (v_cantidad_total * v_precio_unitario);
  END LOOP;

  v_total_calculado := v_subtotal_calculado;
  v_estado_final := CASE WHEN v_any_pending THEN 'PENDIENTE' ELSE COALESCE(p_estado, 'COMPLETADO') END;

  -- 2) Insertar pedido (usuario_id como NULL literal por compatibilidad legacy)
  INSERT INTO public.pedidos (
    tipo_cliente, cliente_nombre, sucursal_id, usuario_id,
    alumno_id, externo_id, estado, subtotal, total, notas
  ) VALUES (
    p_tipo_cliente, UPPER(p_cliente_nombre), p_sucursal_id, NULL,
    p_alumno_id, p_externo_id, v_estado_final, v_subtotal_calculado, v_total_calculado, p_notas
  ) RETURNING id INTO v_pedido_id;

  -- 3) Insertar detalles y descontar SOLO lo entregado (cantidad_con_stock)
  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    v_cantidad_total := COALESCE((v_detalle->>'cantidad')::INTEGER, 0);

    SELECT c.id, c.stock, COALESCE(c.precio_menudeo, c.precio_venta, 0)
    INTO v_costo_id, v_stock_actual, v_precio_unitario
    FROM public.costos c
    WHERE c.prenda_id = (v_detalle->>'prenda_id')::UUID
      AND c.talla_id = (v_detalle->>'talla_id')::UUID
      AND c.sucursal_id = p_sucursal_id;

    v_cantidad_con_stock := LEAST(GREATEST(COALESCE(v_stock_actual, 0), 0), v_cantidad_total);
    v_cantidad_pendiente := v_cantidad_total - v_cantidad_con_stock;

    INSERT INTO public.detalle_pedidos (
      pedido_id, prenda_id, talla_id, cantidad, precio_unitario,
      subtotal, pendiente, especificaciones
    ) VALUES (
      v_pedido_id,
      (v_detalle->>'prenda_id')::UUID,
      (v_detalle->>'talla_id')::UUID,
      v_cantidad_total,
      v_precio_unitario,
      v_cantidad_total * v_precio_unitario,
      v_cantidad_pendiente,
      UPPER(COALESCE(v_detalle->>'especificaciones', ''))
    ) RETURNING id INTO v_detalle_pedido_id;

    IF v_cantidad_con_stock > 0 THEN
      UPDATE public.costos
      SET stock = stock - v_cantidad_con_stock
      WHERE id = v_costo_id
        AND stock >= v_cantidad_con_stock;

      IF FOUND THEN
        -- Descontar también el reparto por ubicación (si existe)
        PERFORM public.descontar_costo_ubicaciones_desde_menor(v_costo_id, v_cantidad_con_stock);

        INSERT INTO public.movimientos (tipo, costo_id, cantidad, observaciones, usuario_id)
        VALUES (
          'SALIDA',
          v_costo_id,
          -v_cantidad_con_stock,
          'VENTA - Pedido #' || v_pedido_id ||
            CASE
              WHEN v_cantidad_pendiente > 0
              THEN ' (' || v_cantidad_con_stock || ' entregadas, ' || v_cantidad_pendiente || ' pendientes)'
              ELSE ' (' || v_cantidad_con_stock || ' entregadas)'
            END,
          NULL
        );
      ELSE
        -- Race condition: si ya no alcanzó stock al descontar, degradar a todo pendiente
        UPDATE public.detalle_pedidos
        SET pendiente = cantidad
        WHERE id = v_detalle_pedido_id;

        UPDATE public.pedidos
        SET estado = 'PENDIENTE'
        WHERE id = v_pedido_id;
      END IF;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'pedido_id', v_pedido_id,
    'total', v_total_calculado,
    'estado', (SELECT estado FROM public.pedidos WHERE id = v_pedido_id),
    'message', 'Pedido creado correctamente'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Error al crear pedido: ' || SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_pedido_atomico(VARCHAR, VARCHAR, UUID, UUID, TEXT, UUID, VARCHAR, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_pedido_atomico(VARCHAR, VARCHAR, UUID, UUID, TEXT, UUID, VARCHAR, TEXT, JSONB) TO anon;

COMMENT ON FUNCTION public.crear_pedido_atomico(VARCHAR, VARCHAR, UUID, UUID, TEXT, UUID, VARCHAR, TEXT, JSONB) IS
  'Auto-split por stock disponible. Descuenta SOLO lo entregado de costos.stock y costo_ubicaciones (menor primero; empate: Taller). Mantiene compatibilidad legacy de usuario_id insertando NULL literal.';


CREATE OR REPLACE FUNCTION descontar_insumo_ubicaciones_desde_menor(
  p_insumo_id UUID,
  p_cantidad NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rem NUMERIC(14, 4);
  v_take NUMERIC(14, 4);
  r RECORD;
  v_sum NUMERIC(14, 4);
BEGIN
  IF p_insumo_id IS NULL OR p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM insumo_ubicaciones WHERE insumo_id = p_insumo_id) THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(cantidad), 0)::NUMERIC(14, 4) INTO v_sum
  FROM insumo_ubicaciones
  WHERE insumo_id = p_insumo_id;

  IF v_sum < p_cantidad THEN
    RAISE EXCEPTION
      'Stock por ubicaciones insuficiente para el insumo %: en ubicaciones hay %, se requiere %.',
      p_insumo_id,
      v_sum,
      p_cantidad;
  END IF;

  v_rem := ROUND(p_cantidad, 4);
  FOR r IN
    SELECT id, cantidad
    FROM insumo_ubicaciones
    WHERE insumo_id = p_insumo_id
    ORDER BY cantidad ASC, ubicacion_almacenamiento_id ASC
  LOOP
    EXIT WHEN v_rem <= 0;
    v_take := LEAST(r.cantidad, v_rem);
    IF v_take > 0 THEN
      UPDATE insumo_ubicaciones
      SET cantidad = cantidad - v_take
      WHERE id = r.id;
      v_rem := ROUND(v_rem - v_take, 4);
    END IF;
  END LOOP;

  IF v_rem > 0.0001 THEN
    RAISE EXCEPTION 'No se pudo completar el descuento por ubicaciones (insumo %).', p_insumo_id;
  END IF;
END;
$$;


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

  -- Política: sumar primero a la ubicación con menor cantidad (desempate por ubicacion_almacenamiento_id)
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
  'Reponer unidades en costo_ubicaciones sumando en la ubicación con menor stock.';


-- Folio de cotizaciones: contador global incremental (no se reinicia por día/mes)
-- Problema actual: generar_folio_cotizacion() usa MAX(...) por prefijo de periodo, lo cual reinicia y además puede colisionar en concurrencia.
-- Solución: usar una SEQUENCE global y formatear el folio con prefijo de fecha + número global.

-- 1) Crear secuencia si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S'
      AND n.nspname = 'public'
      AND c.relname = 'cotizacion_folio_seq'
  ) THEN
    CREATE SEQUENCE public.cotizacion_folio_seq;
  END IF;
END $$;

-- 2) Inicializar secuencia a partir del máximo folio existente (solo la parte numérica final)
DO $$
DECLARE
  v_max bigint;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(folio, '.*-([0-9]+)$', '\1'), folio)::bigint), 0)
  INTO v_max
  FROM public.cotizaciones
  WHERE folio IS NOT NULL AND folio <> '';

  IF v_max <= 0 THEN
    PERFORM setval('public.cotizacion_folio_seq', 1, false);
  ELSE
    PERFORM setval('public.cotizacion_folio_seq', v_max, true);
  END IF;
END $$;

-- 3) Reemplazar función para generar folio (global)
CREATE OR REPLACE FUNCTION public.generar_folio_cotizacion()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  anio text;
  mes text;
  n bigint;
BEGIN
  anio := to_char(current_date, 'YYYY');
  mes := to_char(current_date, 'MM');
  n := nextval('public.cotizacion_folio_seq');

  -- Mantener el formato visible COT-YYYYMM-0001, pero el número ya es global y no se reinicia.
  RETURN 'COT-' || anio || mes || '-' || lpad(n::text, 4, '0');
END;
$$;

-- 4) (Opcional) helper para re-foliar cotizaciones existentes
--    NO se ejecuta automáticamente; úsalo solo si decides corregir el historial.
--    Advertencia: puede afectar PDFs/URLs si dependen del folio.
CREATE OR REPLACE FUNCTION public.refoliar_cotizaciones_existentes()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_n bigint;
  v_count int := 0;
BEGIN
  -- Reiniciar secuencia en base al orden cronológico real
  -- Nota: las sequences de Postgres empiezan en 1; 0 es inválido.
  -- setval(seq, 1, false) hace que el siguiente nextval() retorne 1.
  PERFORM setval('public.cotizacion_folio_seq', 1, false);

  FOR r IN
    SELECT id, fecha_cotizacion, created_at
    FROM public.cotizaciones
    ORDER BY
      COALESCE(fecha_cotizacion, created_at::date) ASC,
      created_at ASC,
      id ASC
  LOOP
    v_n := nextval('public.cotizacion_folio_seq');
    UPDATE public.cotizaciones
    SET folio = 'COT-' || to_char(COALESCE(r.fecha_cotizacion, r.created_at::date), 'YYYYMM') || '-' || lpad(v_n::text, 4, '0')
    WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'updated', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.refoliar_cotizaciones_existentes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refoliar_cotizaciones_existentes() TO anon;


-- Al marcar una cotización como "terminado", crear un registro en pedidos con folio
-- para el historial de ventas, sin movimiento de inventario de prendas (ni insumos:
-- los insumos se descontaron al pasar a "trabajando" si aplica).

-- Folio de pedido (misma idea que cotización: PED-YYYYMM-0001)
CREATE OR REPLACE FUNCTION generar_folio_pedido()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  anio TEXT;
  mes TEXT;
  siguiente_numero INTEGER;
  nuevo_folio TEXT;
BEGIN
  anio := TO_CHAR(CURRENT_DATE, 'YYYY');
  mes := TO_CHAR(CURRENT_DATE, 'MM');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(folio FROM '[0-9]+$') AS INTEGER)
  ), 0) + 1
  INTO siguiente_numero
  FROM pedidos
  WHERE folio IS NOT NULL
    AND folio LIKE 'PED-' || anio || mes || '%';

  nuevo_folio := 'PED-' || anio || mes || '-' || LPAD(siguiente_numero::TEXT, 4, '0');
  RETURN nuevo_folio;
END;
$$;

COMMENT ON FUNCTION generar_folio_pedido() IS
  'Folio secuencial mensual para pedidos: PED-YYYYMM-0001.';

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS folio VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_folio_unique
  ON pedidos (folio)
  WHERE folio IS NOT NULL;

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS cotizacion_id UUID REFERENCES cotizaciones(id) ON DELETE SET NULL;

COMMENT ON COLUMN pedidos.folio IS 'Folio de venta (PED-YYYYMM-0001); puede generarse al cerrar cotización.';
COMMENT ON COLUMN pedidos.cotizacion_id IS 'Si la venta proviene de una cotización terminada.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_cotizacion_id_unique
  ON pedidos (cotizacion_id)
  WHERE cotizacion_id IS NOT NULL;

-- Función de trigger (idempotente por pedidos.cotizacion_id)
CREATE OR REPLACE FUNCTION trg_pedido_desde_cotizacion_terminada()
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
  -- check_total_positivo en pedidos exige subtotal > 0 y total > 0 antes de existir detalles
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

  -- Sucursal: primer costo de una partida con costo_id; si no hay, matriz
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

  v_folio := generar_folio_pedido();

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

COMMENT ON FUNCTION trg_pedido_desde_cotizacion_terminada() IS
  'Crea pedido COMPLETADO con folio PED-* al pasar cotización a terminado, sin movimiento de stock de prendas ni insumos.';

DROP TRIGGER IF EXISTS pedido_desde_cotizacion_terminada ON cotizaciones;
CREATE TRIGGER pedido_desde_cotizacion_terminada
  BEFORE UPDATE OF estado ON cotizaciones
  FOR EACH ROW
  WHEN (NEW.estado = 'terminado' AND OLD.estado IS DISTINCT FROM 'terminado')
  EXECUTE FUNCTION trg_pedido_desde_cotizacion_terminada();

GRANT EXECUTE ON FUNCTION generar_folio_pedido() TO authenticated;
GRANT EXECUTE ON FUNCTION generar_folio_pedido() TO anon;

-- Completar pedido PENDIENTE: alinear con pedidos creados sin stock (pendiente).
-- Si hay stock suficiente, descuenta; si no hay, cierra pendiente sin bloquear la entrega.

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
CREATE OR REPLACE FUNCTION trg_cotizacion_insumos_al_trabajar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_det RECORD;
  v_prenda_id UUID;
  v_talla_id UUID;
  v_insumo_record RECORD;
  v_cons NUMERIC(14, 4);
  v_cant INTEGER;
BEGIN
  IF NEW.estado IS DISTINCT FROM 'trabajando' THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'trabajando' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(OLD.insumos_trabajando_aplicado, false) THEN
    RETURN NEW;
  END IF;

  FOR v_det IN
    SELECT id, cantidad, costo_id
    FROM detalle_cotizacion
    WHERE cotizacion_id = NEW.id
      AND costo_id IS NOT NULL
  LOOP
    SELECT c.prenda_id, c.talla_id
    INTO v_prenda_id, v_talla_id
    FROM costos c
    WHERE c.id = v_det.costo_id;

    IF v_prenda_id IS NULL OR v_talla_id IS NULL THEN
      RAISE EXCEPTION
        'Partida de cotización % sin prenda/talla en costos (costo_id %).',
        v_det.id,
        v_det.costo_id;
    END IF;

    v_cant := GREATEST(COALESCE(v_det.cantidad, 0), 0);
    IF v_cant = 0 THEN
      CONTINUE;
    END IF;

    FOR v_insumo_record IN
      SELECT pti.insumo_id, i.nombre, pti.cantidad
      FROM prenda_talla_insumos pti
      JOIN insumos i ON pti.insumo_id = i.id
      WHERE pti.prenda_id = v_prenda_id
        AND pti.talla_id = v_talla_id
    LOOP
      v_cons := ROUND((v_insumo_record.cantidad * v_cant::NUMERIC), 4);
      IF v_cons > 0 THEN
        UPDATE insumos
        SET stock = stock - v_cons
        WHERE id = v_insumo_record.insumo_id
          AND stock >= v_cons;

        IF NOT FOUND THEN
          RAISE EXCEPTION
            'Stock insuficiente del insumo "%" para pasar la cotización % a trabajando. Requerido: % (receta × % u.).',
            v_insumo_record.nombre,
            COALESCE(NEW.folio, NEW.id::TEXT),
            v_cons,
            v_cant;
        END IF;

        PERFORM descontar_insumo_ubicaciones_desde_menor(v_insumo_record.insumo_id, v_cons);
      END IF;
    END LOOP;
  END LOOP;

  NEW.insumos_trabajando_aplicado := true;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trg_cotizacion_insumos_al_trabajar() IS
  'Descuenta insumos.stock e insumo_ubicaciones (menor primero) al pasar cotización a trabajando.';

DROP TRIGGER IF EXISTS cotizacion_insumos_al_trabajar ON public.cotizaciones;
CREATE TRIGGER cotizacion_insumos_al_trabajar
  BEFORE UPDATE OF estado ON public.cotizaciones
  FOR EACH ROW
  WHEN (NEW.estado = 'trabajando' AND OLD.estado IS DISTINCT FROM 'trabajando')
  EXECUTE FUNCTION trg_cotizacion_insumos_al_trabajar();

CREATE OR REPLACE FUNCTION validar_total_pedido()
RETURNS TRIGGER AS $$
DECLARE
  v_total_calculado DECIMAL(10, 2);
BEGIN
  -- Calcular total desde detalles
  SELECT COALESCE(SUM(subtotal), 0)
  INTO v_total_calculado
  FROM detalle_pedidos
  WHERE pedido_id = NEW.id;
  
  -- Si el total calculado difiere del total guardado por más de 0.01
  IF ABS(v_total_calculado - COALESCE(NEW.total, 0)) > 0.01 THEN
    RAISE WARNING 'Total del pedido % no coincide: calculado %, guardado %', 
      NEW.id, v_total_calculado, NEW.total;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validar_total_pedido
  AFTER INSERT OR UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION validar_total_pedido();


