-- Validación: el stock agregado de costos debe cuadrar con la suma por ubicación (costo_ubicaciones).
-- Se implementa en 2 capas:
-- 1) RPC transaccional para configurar stock + ubicaciones en un solo paso.
-- 2) Constraint trigger DEFERRABLE para evitar inconsistencias si alguien escribe directo a tablas.

-- ========= helper: validar suma =========
CREATE OR REPLACE FUNCTION public.validar_costo_ubicaciones_cuadran(p_costo_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock INTEGER;
  v_sum INTEGER;
BEGIN
  IF p_costo_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(stock, 0)::INTEGER
  INTO v_stock
  FROM public.costos
  WHERE id = p_costo_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Si no hay filas de ubicaciones, no forzar (modo legacy / sin reparto).
  IF NOT EXISTS (SELECT 1 FROM public.costo_ubicaciones WHERE costo_id = p_costo_id) THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(cantidad), 0)::INTEGER
  INTO v_sum
  FROM public.costo_ubicaciones
  WHERE costo_id = p_costo_id;

  IF v_sum <> v_stock THEN
    RAISE EXCEPTION
      'El stock existente (%) no cuadra con la suma por ubicaciones (%).',
      v_stock,
      v_sum
      USING ERRCODE = '23514';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.validar_costo_ubicaciones_cuadran(UUID) IS
  'Lanza error si costos.stock != SUM(costo_ubicaciones.cantidad) (cuando existen ubicaciones para ese costo).';

-- ========= constraint trigger: validar al final de transacción =========
CREATE OR REPLACE FUNCTION public.trg_validar_costo_ubicaciones_cuadran()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.validar_costo_ubicaciones_cuadran(COALESCE(NEW.costo_id, OLD.costo_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS validar_costo_ubicaciones_cuadran ON public.costo_ubicaciones;
CREATE CONSTRAINT TRIGGER validar_costo_ubicaciones_cuadran
AFTER INSERT OR UPDATE OR DELETE ON public.costo_ubicaciones
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.trg_validar_costo_ubicaciones_cuadran();

COMMENT ON TRIGGER validar_costo_ubicaciones_cuadran ON public.costo_ubicaciones IS
  'Evita que costos.stock y la suma por ubicaciones se desincronicen (check diferido al commit).';

-- ========= RPC: configurar stock + ubicaciones (atómico) =========
CREATE OR REPLACE FUNCTION public.configurar_stock_costo_atomico(
  p_costo_id UUID,
  p_stock INTEGER,
  p_stock_minimo INTEGER,
  p_partidas JSONB DEFAULT '[]'::JSONB -- [{ubicacion_almacenamiento_id, cantidad}]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
  v_sum INTEGER;
  v_partida JSONB;
BEGIN
  IF p_costo_id IS NULL THEN
    RAISE EXCEPTION 'Falta costo_id';
  END IF;

  v_total := GREATEST(COALESCE(p_stock, 0), 0);
  v_sum := 0;

  IF p_partidas IS NULL OR jsonb_typeof(p_partidas) <> 'array' THEN
    p_partidas := '[]'::JSONB;
  END IF;

  -- Validación de forma
  IF v_total = 0 AND jsonb_array_length(p_partidas) > 0 THEN
    RAISE EXCEPTION 'Con stock en 0 no debe haber cantidades por ubicación.';
  END IF;

  IF v_total > 0 AND jsonb_array_length(p_partidas) = 0 THEN
    RAISE EXCEPTION 'Con stock mayor a 0, agrega al menos una ubicación y reparte la cantidad.';
  END IF;

  FOR v_partida IN SELECT * FROM jsonb_array_elements(p_partidas)
  LOOP
    v_sum := v_sum + GREATEST(COALESCE((v_partida->>'cantidad')::INTEGER, 0), 0);
  END LOOP;

  IF v_total > 0 AND v_sum <> v_total THEN
    RAISE EXCEPTION 'La suma por ubicación (%) debe ser igual al stock existente (%).', v_sum, v_total;
  END IF;

  -- Actualizar costos + reemplazar costo_ubicaciones en la MISMA transacción
  UPDATE public.costos
  SET stock_inicial = v_total,
      stock_minimo = GREATEST(COALESCE(p_stock_minimo, 0), 0),
      stock = v_total,
      ubicacion_almacenamiento_id = NULL
  WHERE id = p_costo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el costo';
  END IF;

  DELETE FROM public.costo_ubicaciones WHERE costo_id = p_costo_id;

  IF v_total > 0 AND jsonb_array_length(p_partidas) > 0 THEN
    INSERT INTO public.costo_ubicaciones (costo_id, ubicacion_almacenamiento_id, cantidad)
    SELECT
      p_costo_id,
      (x->>'ubicacion_almacenamiento_id')::UUID,
      GREATEST(COALESCE((x->>'cantidad')::INTEGER, 0), 0)
    FROM jsonb_array_elements(p_partidas) AS x
    WHERE GREATEST(COALESCE((x->>'cantidad')::INTEGER, 0), 0) > 0;
  END IF;

  -- Re-validar explícitamente (el trigger también valida al commit)
  PERFORM public.validar_costo_ubicaciones_cuadran(p_costo_id);

  RETURN json_build_object('success', true);

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.configurar_stock_costo_atomico(UUID, INTEGER, INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.configurar_stock_costo_atomico(UUID, INTEGER, INTEGER, JSONB) TO anon;

COMMENT ON FUNCTION public.configurar_stock_costo_atomico(UUID, INTEGER, INTEGER, JSONB) IS
  'Configura stock y reparto por ubicaciones de un costo de forma atómica y validada.';

