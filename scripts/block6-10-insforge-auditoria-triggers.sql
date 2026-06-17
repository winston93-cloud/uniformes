-- Bloque 10: triggers de auditoría en tablas Uniformes (InsForge es backend activo)

CREATE OR REPLACE FUNCTION public.trg_auditoria_generic()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pk_col TEXT;
  v_pk_text TEXT;
  v_pk_uuid UUID;
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
  ELSE
    v_old := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
    v_new := to_jsonb(NEW);
  END IF;

  SELECT a.attname
  INTO v_pk_col
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[1]
  WHERE i.indrelid = TG_RELID
    AND i.indisprimary
  LIMIT 1;

  IF v_pk_col IS NOT NULL THEN
    v_pk_text := COALESCE(v_new->>v_pk_col, v_old->>v_pk_col);
  END IF;

  IF v_pk_text IS NULL OR v_pk_text = '' THEN
    v_pk_col := NULL;
    v_pk_text := COALESCE(
      v_new->>'id',
      v_old->>'id',
      v_new->>'usuario_id',
      v_old->>'usuario_id'
    );
  END IF;

  BEGIN
    v_pk_uuid := NULLIF(v_pk_text, '')::uuid;
  EXCEPTION
    WHEN others THEN
      v_pk_uuid := NULL;
  END;

  INSERT INTO public.auditoria (tabla, operacion, registro_id, registro_pk_col, registro_pk, datos_anteriores, datos_nuevos, usuario_id, timestamp)
  VALUES (TG_TABLE_NAME, TG_OP, v_pk_uuid, v_pk_col, v_pk_text, v_old, v_new, NULL, NOW());

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
  trig_name TEXT;
  tablas TEXT[] := ARRAY[
    'usuario_perfil', 'roles_uniformes', 'tallas', 'categorias_prendas', 'presentaciones',
    'ubicaciones_almacenamiento', 'sucursales', 'ciclos_escolares', 'usuario', 'usuarios',
    'usuarios_uniformes', 'alumno', 'externos', 'prendas', 'insumos', 'costos',
    'prenda_talla_insumos', 'compras_insumos', 'costo_ubicaciones', 'insumo_ubicaciones',
    'datos_fiscales_cliente', 'sat_metodos_pago', 'sat_formas_pago', 'cotizaciones',
    'detalle_cotizacion', 'pedidos', 'detalle_pedidos', 'movimientos', 'cortes',
    'detalle_cortes', 'transferencias', 'detalle_transferencias', 'devoluciones',
    'detalle_devoluciones', 'snapshot_insumos_pedido'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t
    ) THEN
      trig_name := 'trg_auditoria_' || t;
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I;', trig_name, t);
      EXECUTE format(
        'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.trg_auditoria_generic();',
        trig_name,
        t
      );
    END IF;
  END LOOP;
END $$;
