-- Sincroniza costo_ubicaciones.cantidad con costos.stock (Matriz / Uniformes).
-- Corrige stock "fantasma": total > 0 pero todas las ubicaciones en 0.

CREATE OR REPLACE FUNCTION public.reconciliar_costo_ubicaciones_desde_stock(p_costo_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_stock INTEGER;
  v_sum INTEGER;
  v_diff INTEGER;
  v_rem INTEGER;
  v_take INTEGER;
  r RECORD;
  v_target_id UUID;
  v_cur INTEGER;
BEGIN
  IF p_costo_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'costo_id requerido');
  END IF;

  SELECT GREATEST(COALESCE(stock, 0), 0)::INTEGER INTO v_stock
  FROM public.costos WHERE id = p_costo_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Costo no encontrado');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.costo_ubicaciones WHERE costo_id = p_costo_id) THEN
    IF v_stock > 0 THEN
      INSERT INTO public.costo_ubicaciones (costo_id, ubicacion_almacenamiento_id, cantidad)
      SELECT p_costo_id, ua.id, v_stock
      FROM public.ubicaciones_almacenamiento ua
      WHERE ua.activo = true
      ORDER BY CASE WHEN ua.nombre ILIKE 'taller' THEN 0 ELSE 1 END, ua.nombre
      LIMIT 1;
      RETURN json_build_object('success', true, 'adjusted', true, 'note', 'Ubicación creada en Taller');
    END IF;
    RETURN json_build_object('success', true, 'adjusted', false, 'note', 'Sin ubicaciones');
  END IF;

  SELECT COALESCE(SUM(GREATEST(cantidad, 0)), 0)::INTEGER INTO v_sum
  FROM public.costo_ubicaciones WHERE costo_id = p_costo_id;

  v_diff := v_stock - v_sum;
  IF v_diff = 0 THEN
    RETURN json_build_object('success', true, 'adjusted', false, 'stock', v_stock, 'sum', v_sum);
  END IF;

  IF v_diff > 0 THEN
    SELECT cu.id, GREATEST(cu.cantidad, 0)::INTEGER
    INTO v_target_id, v_cur
    FROM public.costo_ubicaciones cu
    JOIN public.ubicaciones_almacenamiento ua ON ua.id = cu.ubicacion_almacenamiento_id
    WHERE cu.costo_id = p_costo_id
    ORDER BY
      GREATEST(cu.cantidad, 0) ASC,
      CASE WHEN ua.nombre ILIKE 'taller' THEN 0 ELSE 1 END ASC,
      cu.ubicacion_almacenamiento_id ASC
    LIMIT 1;

    UPDATE public.costo_ubicaciones
    SET cantidad = v_cur + v_diff, updated_at = NOW()
    WHERE id = v_target_id;
  ELSE
    v_rem := -v_diff;
    FOR r IN
      SELECT cu.id, GREATEST(cu.cantidad, 0)::INTEGER AS cantidad
      FROM public.costo_ubicaciones cu
      JOIN public.ubicaciones_almacenamiento ua ON ua.id = cu.ubicacion_almacenamiento_id
      WHERE cu.costo_id = p_costo_id
      ORDER BY
        GREATEST(cu.cantidad, 0) ASC,
        CASE WHEN ua.nombre ILIKE 'taller' THEN 0 ELSE 1 END ASC,
        cu.ubicacion_almacenamiento_id ASC
    LOOP
      EXIT WHEN v_rem <= 0;
      v_take := LEAST(r.cantidad, v_rem);
      IF v_take > 0 THEN
        UPDATE public.costo_ubicaciones
        SET cantidad = r.cantidad - v_take, updated_at = NOW()
        WHERE id = r.id;
        v_rem := v_rem - v_take;
      END IF;
    END LOOP;

    IF v_rem > 0 THEN
      RAISE EXCEPTION 'No alcanzó stock en ubicaciones para descontar sobrante (costo %)', p_costo_id;
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'adjusted', true, 'stock', v_stock, 'sum_before', v_sum);
END;
$function$;

-- Reparar desincronizados en Matriz Madero (Uniformes)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.id
    FROM public.costos c
    JOIN public.sucursales s ON s.id = c.sucursal_id
    WHERE s.codigo = 'MAT-MAD'
      AND c.stock > 0
      AND COALESCE((
        SELECT SUM(GREATEST(cu.cantidad, 0))
        FROM public.costo_ubicaciones cu
        WHERE cu.costo_id = c.id
      ), 0) <> c.stock
  LOOP
    PERFORM public.reconciliar_costo_ubicaciones_desde_stock(r.id);
  END LOOP;
END;
$$;
