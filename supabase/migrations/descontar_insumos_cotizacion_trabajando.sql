-- Al pasar una cotización a estado "trabajando", descontar insumos según
-- prenda_talla_insumos × detalle_cotizacion.cantidad (misma lógica que ventas,
-- usando prenda/talla vía detalle.costo_id → costos).
-- Idempotente: columna insumos_trabajando_aplicado evita doble descuento.

ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS insumos_trabajando_aplicado BOOLEAN DEFAULT false NOT NULL;

COMMENT ON COLUMN cotizaciones.insumos_trabajando_aplicado IS
  'True si ya se descontaron insumos al entrar en trabajando (evita aplicar dos veces).';

-- Cotizaciones ya en "trabajando" antes de esta migración: marcar sin mover stock
-- (no hay forma segura de reconstruir el consumo histórico).
UPDATE cotizaciones
SET insumos_trabajando_aplicado = true
WHERE estado = 'trabajando'
  AND insumos_trabajando_aplicado = false;

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
      END IF;
    END LOOP;
  END LOOP;

  NEW.insumos_trabajando_aplicado := true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cotizacion_insumos_al_trabajar ON cotizaciones;
CREATE TRIGGER cotizacion_insumos_al_trabajar
  BEFORE UPDATE OF estado ON cotizaciones
  FOR EACH ROW
  EXECUTE FUNCTION trg_cotizacion_insumos_al_trabajar();

COMMENT ON FUNCTION trg_cotizacion_insumos_al_trabajar() IS
  'Descuenta insumos.stock al pasar cotización a trabajando (receta prenda+talla × cantidad de partida).';
