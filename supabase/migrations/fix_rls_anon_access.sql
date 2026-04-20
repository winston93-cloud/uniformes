-- ============================================
-- FIX: Permitir acceso con la anon key (RLS permisivo)
-- ============================================
-- Útil mientras el cliente usa solo `anon` sin sesión Supabase Auth.
-- Tablas opcionales (snapshot, transferencias, devoluciones): solo si existen.

-- 1. PRENDA_TALLA_INSUMOS
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver prenda_talla_insumos" ON public.prenda_talla_insumos;
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar prenda_talla_insumos" ON public.prenda_talla_insumos;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar prenda_talla_insumos" ON public.prenda_talla_insumos;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar prenda_talla_insumos" ON public.prenda_talla_insumos;
DROP POLICY IF EXISTS "Usuarios autenticados acceden a prenda_talla_insumos" ON public.prenda_talla_insumos;
DROP POLICY IF EXISTS "Permitir acceso total a prenda_talla_insumos" ON public.prenda_talla_insumos;

CREATE POLICY "Permitir acceso total a prenda_talla_insumos" ON public.prenda_talla_insumos
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON POLICY "Permitir acceso total a prenda_talla_insumos" ON public.prenda_talla_insumos IS
  'Permite acceso completo con anon key mientras no haya auth Supabase en el cliente';

-- 2. SNAPSHOT_INSUMOS_PEDIDO (si existe)
DO $$
BEGIN
  IF to_regclass('public.snapshot_insumos_pedido') IS NULL THEN
    RAISE NOTICE 'Omitido fix_rls_anon_access: public.snapshot_insumos_pedido no existe';
    RETURN;
  END IF;
  DROP POLICY IF EXISTS "Usuarios autenticados pueden ver snapshot_insumos_pedido" ON public.snapshot_insumos_pedido;
  DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar snapshot_insumos_pedido" ON public.snapshot_insumos_pedido;
  DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar snapshot_insumos_pedido" ON public.snapshot_insumos_pedido;
  DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar snapshot_insumos_pedido" ON public.snapshot_insumos_pedido;
  DROP POLICY IF EXISTS "Usuarios autenticados acceden a snapshot_insumos_pedido" ON public.snapshot_insumos_pedido;
  DROP POLICY IF EXISTS "Permitir acceso total a snapshot_insumos_pedido" ON public.snapshot_insumos_pedido;
  CREATE POLICY "Permitir acceso total a snapshot_insumos_pedido" ON public.snapshot_insumos_pedido
    FOR ALL USING (true) WITH CHECK (true);
  COMMENT ON POLICY "Permitir acceso total a snapshot_insumos_pedido" ON public.snapshot_insumos_pedido IS
    'Permite acceso completo con anon key mientras no haya auth Supabase en el cliente';
END $$;

-- 3–6. TRANSFERENCIAS / DEVOLUCIONES (si existen)
DO $$
BEGIN
  IF to_regclass('public.transferencias') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Usuarios autenticados pueden ver transferencias" ON public.transferencias;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar transferencias" ON public.transferencias;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar transferencias" ON public.transferencias;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar transferencias" ON public.transferencias;
    DROP POLICY IF EXISTS "Usuarios autenticados acceden a transferencias" ON public.transferencias;
    DROP POLICY IF EXISTS "Permitir acceso total a transferencias" ON public.transferencias;
    CREATE POLICY "Permitir acceso total a transferencias" ON public.transferencias
      FOR ALL USING (true) WITH CHECK (true);
  ELSE
    RAISE NOTICE 'Omitido: public.transferencias no existe';
  END IF;

  IF to_regclass('public.detalle_transferencias') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Usuarios autenticados pueden ver detalle_transferencias" ON public.detalle_transferencias;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar detalle_transferencias" ON public.detalle_transferencias;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar detalle_transferencias" ON public.detalle_transferencias;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar detalle_transferencias" ON public.detalle_transferencias;
    DROP POLICY IF EXISTS "Usuarios autenticados acceden a detalle_transferencias" ON public.detalle_transferencias;
    DROP POLICY IF EXISTS "Permitir acceso total a detalle_transferencias" ON public.detalle_transferencias;
    CREATE POLICY "Permitir acceso total a detalle_transferencias" ON public.detalle_transferencias
      FOR ALL USING (true) WITH CHECK (true);
  ELSE
    RAISE NOTICE 'Omitido: public.detalle_transferencias no existe';
  END IF;

  IF to_regclass('public.devoluciones') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Usuarios autenticados pueden ver devoluciones" ON public.devoluciones;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar devoluciones" ON public.devoluciones;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar devoluciones" ON public.devoluciones;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar devoluciones" ON public.devoluciones;
    DROP POLICY IF EXISTS "Usuarios autenticados acceden a devoluciones" ON public.devoluciones;
    DROP POLICY IF EXISTS "Permitir acceso total a devoluciones" ON public.devoluciones;
    CREATE POLICY "Permitir acceso total a devoluciones" ON public.devoluciones
      FOR ALL USING (true) WITH CHECK (true);
  ELSE
    RAISE NOTICE 'Omitido: public.devoluciones no existe';
  END IF;

  IF to_regclass('public.detalle_devoluciones') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Usuarios autenticados pueden ver detalle_devoluciones" ON public.detalle_devoluciones;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar detalle_devoluciones" ON public.detalle_devoluciones;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar detalle_devoluciones" ON public.detalle_devoluciones;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar detalle_devoluciones" ON public.detalle_devoluciones;
    DROP POLICY IF EXISTS "Usuarios autenticados acceden a detalle_devoluciones" ON public.detalle_devoluciones;
    DROP POLICY IF EXISTS "Permitir acceso total a detalle_devoluciones" ON public.detalle_devoluciones;
    CREATE POLICY "Permitir acceso total a detalle_devoluciones" ON public.detalle_devoluciones
      FOR ALL USING (true) WITH CHECK (true);
  ELSE
    RAISE NOTICE 'Omitido: public.detalle_devoluciones no existe';
  END IF;
END $$;

-- 7. SUCURSALES
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver sucursales" ON public.sucursales;
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar sucursales" ON public.sucursales;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar sucursales" ON public.sucursales;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar sucursales" ON public.sucursales;
DROP POLICY IF EXISTS "Usuarios autenticados acceden a sucursales" ON public.sucursales;
DROP POLICY IF EXISTS "Cualquiera puede ver sucursales activas" ON public.sucursales;
DROP POLICY IF EXISTS "Lectura pública de sucursales activas" ON public.sucursales;
DROP POLICY IF EXISTS "Usuarios autenticados gestionan sucursales" ON public.sucursales;
DROP POLICY IF EXISTS "Permitir acceso total a sucursales" ON public.sucursales;

CREATE POLICY "Permitir acceso total a sucursales" ON public.sucursales
  FOR ALL USING (true) WITH CHECK (true);

-- 8. CICLOS_ESCOLARES
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver ciclos_escolares" ON public.ciclos_escolares;
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar ciclos_escolares" ON public.ciclos_escolares;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar ciclos_escolares" ON public.ciclos_escolares;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar ciclos_escolares" ON public.ciclos_escolares;
DROP POLICY IF EXISTS "Usuarios autenticados acceden a ciclos_escolares" ON public.ciclos_escolares;
DROP POLICY IF EXISTS "Cualquiera puede ver ciclos_escolares activos" ON public.ciclos_escolares;
DROP POLICY IF EXISTS "Lectura pública de ciclos escolares activos" ON public.ciclos_escolares;
DROP POLICY IF EXISTS "Usuarios autenticados gestionan ciclos_escolares" ON public.ciclos_escolares;
DROP POLICY IF EXISTS "Permitir acceso total a ciclos_escolares" ON public.ciclos_escolares;

CREATE POLICY "Permitir acceso total a ciclos_escolares" ON public.ciclos_escolares
  FOR ALL USING (true) WITH CHECK (true);
