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
