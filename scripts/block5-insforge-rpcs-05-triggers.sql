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
