-- Reconciliación post-migración (InsForge):
-- Si el stock agregado (costos.stock) es correcto pero la suma por ubicaciones (costo_ubicaciones)
-- quedó desajustada, esta rutina alinea costo_ubicaciones a costos.stock.
--
-- Se limita a costos que tuvieron movimientos desde una fecha (por defecto: 2026-04-25),
-- ya que ahí fue cuando se detectó el problema.
--
-- Política de ajuste:
-- - Si falta stock en ubicaciones (sum < stock): se SUMA la diferencia a la ubicación con menor cantidad
--   (empate: "Taller" primero; luego ubicacion_almacenamiento_id).
-- - Si sobra stock en ubicaciones (sum > stock): se DESCUENTA la diferencia usando
--   descontar_costo_ubicaciones_desde_menor (menor primero; empate: "Taller").

-- ========= helper: sumar costo_ubicaciones (entrada) =========
CREATE OR REPLACE FUNCTION public.sumar_costo_ubicaciones_desde_menor(
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

  IF NOT EXISTS (SELECT 1 FROM public.costo_ubicaciones WHERE costo_id = p_costo_id) THEN
    RETURN;
  END IF;

  v_rem := p_cantidad;
  FOR r IN
    SELECT cu.id
    FROM public.costo_ubicaciones cu
    JOIN public.ubicaciones_almacenamiento ua
      ON ua.id = cu.ubicacion_almacenamiento_id
    WHERE cu.costo_id = p_costo_id
    ORDER BY
      cu.cantidad ASC,
      CASE WHEN ua.nombre ILIKE 'taller' THEN 0 ELSE 1 END ASC,
      cu.ubicacion_almacenamiento_id ASC
  LOOP
    EXIT WHEN v_rem <= 0;
    UPDATE public.costo_ubicaciones
    SET cantidad = cantidad + v_rem
    WHERE id = r.id;
    v_rem := 0;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.sumar_costo_ubicaciones_desde_menor(UUID, INTEGER) IS
  'Reponer unidades en costo_ubicaciones sumando en la ubicación con menor stock; empate: Taller primero.';

-- ========= reconciliar por movimientos desde fecha =========
CREATE OR REPLACE FUNCTION public.reconciliar_costo_ubicaciones_desde(
  p_since TIMESTAMPTZ DEFAULT '2026-04-25T00:00:00Z'::timestamptz
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_stock INTEGER;
  v_sum INTEGER;
  v_diff INTEGER;
  v_ajustados INTEGER := 0;
  v_faltantes INTEGER := 0;
  v_sobrantes INTEGER := 0;
  v_saltados INTEGER := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT m.costo_id
    FROM public.movimientos m
    WHERE m.costo_id IS NOT NULL
      AND m.created_at >= COALESCE(p_since, '2026-04-25T00:00:00Z'::timestamptz)
  LOOP
    -- Solo conciliar si ese costo ya usa reparto por ubicaciones
    IF NOT EXISTS (SELECT 1 FROM public.costo_ubicaciones cu WHERE cu.costo_id = r.costo_id) THEN
      v_saltados := v_saltados + 1;
      CONTINUE;
    END IF;

    SELECT COALESCE(c.stock, 0)::INTEGER
    INTO v_stock
    FROM public.costos c
    WHERE c.id = r.costo_id;

    IF NOT FOUND THEN
      v_saltados := v_saltados + 1;
      CONTINUE;
    END IF;

    SELECT COALESCE(SUM(cu.cantidad), 0)::INTEGER
    INTO v_sum
    FROM public.costo_ubicaciones cu
    WHERE cu.costo_id = r.costo_id;

    v_diff := v_stock - v_sum;
    IF v_diff = 0 THEN
      CONTINUE;
    END IF;

    IF v_diff > 0 THEN
      -- Falta stock en ubicaciones: sumar diferencia
      PERFORM public.sumar_costo_ubicaciones_desde_menor(r.costo_id, v_diff);
      v_faltantes := v_faltantes + 1;
    ELSE
      -- Sobra stock en ubicaciones: descontar diferencia
      PERFORM public.descontar_costo_ubicaciones_desde_menor(r.costo_id, (-v_diff));
      v_sobrantes := v_sobrantes + 1;
    END IF;

    v_ajustados := v_ajustados + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'since', COALESCE(p_since, '2026-04-25T00:00:00Z'::timestamptz),
    'ajustados', v_ajustados,
    'faltantes_sumados', v_faltantes,
    'sobrantes_descontados', v_sobrantes,
    'saltados_sin_ubicaciones', v_saltados
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconciliar_costo_ubicaciones_desde(TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconciliar_costo_ubicaciones_desde(TIMESTAMPTZ) TO anon;

COMMENT ON FUNCTION public.reconciliar_costo_ubicaciones_desde(TIMESTAMPTZ) IS
  'Alinea costo_ubicaciones a costos.stock para costos con movimientos desde una fecha.';

