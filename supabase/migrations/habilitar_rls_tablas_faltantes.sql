-- Habilitar RLS en tablas del sistema de uniformes que aún no lo tengan.
-- Idempotente y segura si faltan tablas (p. ej. transferencias o snapshot_insumos_pedido).

-- ========== 1. Transferencias (solo si existen) ==========
DO $$
BEGIN
  IF to_regclass('public.transferencias') IS NOT NULL THEN
    ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden ver transferencias" ON public.transferencias;
    CREATE POLICY "Usuarios autenticados pueden ver transferencias" ON public.transferencias
      FOR SELECT USING (auth.role() = 'authenticated');
    DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar transferencias" ON public.transferencias;
    CREATE POLICY "Usuarios autenticados pueden insertar transferencias" ON public.transferencias
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar transferencias" ON public.transferencias;
    CREATE POLICY "Usuarios autenticados pueden actualizar transferencias" ON public.transferencias
      FOR UPDATE USING (auth.role() = 'authenticated');
    DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar transferencias" ON public.transferencias;
    CREATE POLICY "Usuarios autenticados pueden eliminar transferencias" ON public.transferencias
      FOR DELETE USING (auth.role() = 'authenticated');
  ELSE
    RAISE NOTICE 'Omitido RLS: public.transferencias no existe';
  END IF;

  IF to_regclass('public.detalle_transferencias') IS NOT NULL THEN
    ALTER TABLE public.detalle_transferencias ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden ver detalle_transferencias" ON public.detalle_transferencias;
    CREATE POLICY "Usuarios autenticados pueden ver detalle_transferencias" ON public.detalle_transferencias
      FOR SELECT USING (auth.role() = 'authenticated');
    DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar detalle_transferencias" ON public.detalle_transferencias;
    CREATE POLICY "Usuarios autenticados pueden insertar detalle_transferencias" ON public.detalle_transferencias
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar detalle_transferencias" ON public.detalle_transferencias;
    CREATE POLICY "Usuarios autenticados pueden actualizar detalle_transferencias" ON public.detalle_transferencias
      FOR UPDATE USING (auth.role() = 'authenticated');
    DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar detalle_transferencias" ON public.detalle_transferencias;
    CREATE POLICY "Usuarios autenticados pueden eliminar detalle_transferencias" ON public.detalle_transferencias
      FOR DELETE USING (auth.role() = 'authenticated');
  ELSE
    RAISE NOTICE 'Omitido RLS: public.detalle_transferencias no existe';
  END IF;
END $$;

-- ========== 2. Devoluciones (solo si existen) ==========
DO $$
BEGIN
  IF to_regclass('public.devoluciones') IS NOT NULL THEN
    ALTER TABLE public.devoluciones ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden ver devoluciones" ON public.devoluciones;
    CREATE POLICY "Usuarios autenticados pueden ver devoluciones" ON public.devoluciones
      FOR SELECT USING (auth.role() = 'authenticated');
    DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar devoluciones" ON public.devoluciones;
    CREATE POLICY "Usuarios autenticados pueden insertar devoluciones" ON public.devoluciones
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar devoluciones" ON public.devoluciones;
    CREATE POLICY "Usuarios autenticados pueden actualizar devoluciones" ON public.devoluciones
      FOR UPDATE USING (auth.role() = 'authenticated');
    DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar devoluciones" ON public.devoluciones;
    CREATE POLICY "Usuarios autenticados pueden eliminar devoluciones" ON public.devoluciones
      FOR DELETE USING (auth.role() = 'authenticated');
  ELSE
    RAISE NOTICE 'Omitido RLS: public.devoluciones no existe';
  END IF;

  IF to_regclass('public.detalle_devoluciones') IS NOT NULL THEN
    ALTER TABLE public.detalle_devoluciones ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden ver detalle_devoluciones" ON public.detalle_devoluciones;
    CREATE POLICY "Usuarios autenticados pueden ver detalle_devoluciones" ON public.detalle_devoluciones
      FOR SELECT USING (auth.role() = 'authenticated');
    DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar detalle_devoluciones" ON public.detalle_devoluciones;
    CREATE POLICY "Usuarios autenticados pueden insertar detalle_devoluciones" ON public.detalle_devoluciones
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar detalle_devoluciones" ON public.detalle_devoluciones;
    CREATE POLICY "Usuarios autenticados pueden actualizar detalle_devoluciones" ON public.detalle_devoluciones
      FOR UPDATE USING (auth.role() = 'authenticated');
    DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar detalle_devoluciones" ON public.detalle_devoluciones;
    CREATE POLICY "Usuarios autenticados pueden eliminar detalle_devoluciones" ON public.detalle_devoluciones
      FOR DELETE USING (auth.role() = 'authenticated');
  ELSE
    RAISE NOTICE 'Omitido RLS: public.detalle_devoluciones no existe';
  END IF;
END $$;

-- ========== 3. Sucursales ==========
ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver sucursales" ON public.sucursales;
CREATE POLICY "Usuarios autenticados pueden ver sucursales" ON public.sucursales
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar sucursales" ON public.sucursales;
CREATE POLICY "Usuarios autenticados pueden insertar sucursales" ON public.sucursales
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar sucursales" ON public.sucursales;
CREATE POLICY "Usuarios autenticados pueden actualizar sucursales" ON public.sucursales
  FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar sucursales" ON public.sucursales;
CREATE POLICY "Usuarios autenticados pueden eliminar sucursales" ON public.sucursales
  FOR DELETE USING (auth.role() = 'authenticated');

-- ========== 4. Prenda-Talla-Insumos ==========
ALTER TABLE public.prenda_talla_insumos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver prenda_talla_insumos" ON public.prenda_talla_insumos;
CREATE POLICY "Usuarios autenticados pueden ver prenda_talla_insumos" ON public.prenda_talla_insumos
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar prenda_talla_insumos" ON public.prenda_talla_insumos;
CREATE POLICY "Usuarios autenticados pueden insertar prenda_talla_insumos" ON public.prenda_talla_insumos
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar prenda_talla_insumos" ON public.prenda_talla_insumos;
CREATE POLICY "Usuarios autenticados pueden actualizar prenda_talla_insumos" ON public.prenda_talla_insumos
  FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar prenda_talla_insumos" ON public.prenda_talla_insumos;
CREATE POLICY "Usuarios autenticados pueden eliminar prenda_talla_insumos" ON public.prenda_talla_insumos
  FOR DELETE USING (auth.role() = 'authenticated');

-- ========== 5. Ciclos escolares (lectura pública de activos; resto autenticado) ==========
ALTER TABLE public.ciclos_escolares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver ciclos_escolares" ON public.ciclos_escolares;
DROP POLICY IF EXISTS "Cualquiera puede ver ciclos_escolares activos" ON public.ciclos_escolares;
CREATE POLICY "Cualquiera puede ver ciclos_escolares activos" ON public.ciclos_escolares
  FOR SELECT USING (activo = true);

DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar ciclos_escolares" ON public.ciclos_escolares;
CREATE POLICY "Usuarios autenticados pueden insertar ciclos_escolares" ON public.ciclos_escolares
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar ciclos_escolares" ON public.ciclos_escolares;
CREATE POLICY "Usuarios autenticados pueden actualizar ciclos_escolares" ON public.ciclos_escolares
  FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar ciclos_escolares" ON public.ciclos_escolares;
CREATE POLICY "Usuarios autenticados pueden eliminar ciclos_escolares" ON public.ciclos_escolares
  FOR DELETE USING (auth.role() = 'authenticated');

-- ========== 6. Snapshot insumos pedido (solo si existe) ==========
DO $$
BEGIN
  IF to_regclass('public.snapshot_insumos_pedido') IS NULL THEN
    RAISE NOTICE 'Omitido RLS: public.snapshot_insumos_pedido no existe';
    RETURN;
  END IF;
  ALTER TABLE public.snapshot_insumos_pedido ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Usuarios autenticados pueden ver snapshot_insumos_pedido" ON public.snapshot_insumos_pedido;
  CREATE POLICY "Usuarios autenticados pueden ver snapshot_insumos_pedido" ON public.snapshot_insumos_pedido
    FOR SELECT USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar snapshot_insumos_pedido" ON public.snapshot_insumos_pedido;
  CREATE POLICY "Usuarios autenticados pueden insertar snapshot_insumos_pedido" ON public.snapshot_insumos_pedido
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar snapshot_insumos_pedido" ON public.snapshot_insumos_pedido;
  CREATE POLICY "Usuarios autenticados pueden actualizar snapshot_insumos_pedido" ON public.snapshot_insumos_pedido
    FOR UPDATE USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar snapshot_insumos_pedido" ON public.snapshot_insumos_pedido;
  CREATE POLICY "Usuarios autenticados pueden eliminar snapshot_insumos_pedido" ON public.snapshot_insumos_pedido
    FOR DELETE USING (auth.role() = 'authenticated');
END $$;
