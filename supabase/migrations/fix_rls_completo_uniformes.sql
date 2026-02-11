-- Fix COMPLETO de RLS para Sistema de Uniformes
-- Permite funcionamiento normal del sistema con seguridad adecuada

-- =====================================================
-- PARTE 1: TABLAS DE CATÁLOGO/REFERENCIA
-- Permiten lectura pública para formularios y selects
-- =====================================================

-- Sucursales (ya arreglado, solo confirmar)
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver sucursales" ON public.sucursales;
DROP POLICY IF EXISTS "Cualquiera puede ver sucursales activas" ON public.sucursales;
DROP POLICY IF EXISTS "Usuarios autenticados gestionan sucursales" ON public.sucursales;

CREATE POLICY "Lectura pública de sucursales activas" ON public.sucursales
  FOR SELECT USING (activo = true);

CREATE POLICY "Usuarios autenticados gestionan sucursales" ON public.sucursales
  FOR ALL USING (auth.role() = 'authenticated');

-- Ciclos Escolares (ya arreglado, solo confirmar)
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver ciclos_escolares" ON public.ciclos_escolares;
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar ciclos_escolares" ON public.ciclos_escolares;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar ciclos_escolares" ON public.ciclos_escolares;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar ciclos_escolares" ON public.ciclos_escolares;
DROP POLICY IF EXISTS "Cualquiera puede ver ciclos_escolares activos" ON public.ciclos_escolares;
DROP POLICY IF EXISTS "Usuarios autenticados gestionan ciclos_escolares" ON public.ciclos_escolares;

CREATE POLICY "Lectura pública de ciclos escolares activos" ON public.ciclos_escolares
  FOR SELECT USING (activo = true);

CREATE POLICY "Usuarios autenticados gestionan ciclos_escolares" ON public.ciclos_escolares
  FOR ALL USING (auth.role() = 'authenticated');

-- =====================================================
-- PARTE 2: TABLAS TRANSACCIONALES/SENSIBLES
-- Solo usuarios autenticados
-- =====================================================

-- Transferencias
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver transferencias" ON public.transferencias;
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar transferencias" ON public.transferencias;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar transferencias" ON public.transferencias;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar transferencias" ON public.transferencias;
DROP POLICY IF EXISTS "Usuarios autenticados acceden a transferencias" ON public.transferencias;

CREATE POLICY "Usuarios autenticados acceden a transferencias" ON public.transferencias
  FOR ALL USING (auth.role() = 'authenticated');

-- Detalle Transferencias
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver detalle_transferencias" ON public.detalle_transferencias;
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar detalle_transferencias" ON public.detalle_transferencias;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar detalle_transferencias" ON public.detalle_transferencias;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar detalle_transferencias" ON public.detalle_transferencias;
DROP POLICY IF EXISTS "Usuarios autenticados acceden a detalle_transferencias" ON public.detalle_transferencias;

CREATE POLICY "Usuarios autenticados acceden a detalle_transferencias" ON public.detalle_transferencias
  FOR ALL USING (auth.role() = 'authenticated');

-- Devoluciones
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver devoluciones" ON public.devoluciones;
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar devoluciones" ON public.devoluciones;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar devoluciones" ON public.devoluciones;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar devoluciones" ON public.devoluciones;
DROP POLICY IF EXISTS "Usuarios autenticados acceden a devoluciones" ON public.devoluciones;

CREATE POLICY "Usuarios autenticados acceden a devoluciones" ON public.devoluciones
  FOR ALL USING (auth.role() = 'authenticated');

-- Detalle Devoluciones
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver detalle_devoluciones" ON public.detalle_devoluciones;
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar detalle_devoluciones" ON public.detalle_devoluciones;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar detalle_devoluciones" ON public.detalle_devoluciones;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar detalle_devoluciones" ON public.detalle_devoluciones;
DROP POLICY IF EXISTS "Usuarios autenticados acceden a detalle_devoluciones" ON public.detalle_devoluciones;

CREATE POLICY "Usuarios autenticados acceden a detalle_devoluciones" ON public.detalle_devoluciones
  FOR ALL USING (auth.role() = 'authenticated');

-- Prenda Talla Insumos
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver prenda_talla_insumos" ON public.prenda_talla_insumos;
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar prenda_talla_insumos" ON public.prenda_talla_insumos;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar prenda_talla_insumos" ON public.prenda_talla_insumos;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar prenda_talla_insumos" ON public.prenda_talla_insumos;
DROP POLICY IF EXISTS "Usuarios autenticados acceden a prenda_talla_insumos" ON public.prenda_talla_insumos;

CREATE POLICY "Usuarios autenticados acceden a prenda_talla_insumos" ON public.prenda_talla_insumos
  FOR ALL USING (auth.role() = 'authenticated');

-- Snapshot Insumos Pedido
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver snapshot_insumos_pedido" ON public.snapshot_insumos_pedido;
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar snapshot_insumos_pedido" ON public.snapshot_insumos_pedido;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar snapshot_insumos_pedido" ON public.snapshot_insumos_pedido;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar snapshot_insumos_pedido" ON public.snapshot_insumos_pedido;
DROP POLICY IF EXISTS "Usuarios autenticados acceden a snapshot_insumos_pedido" ON public.snapshot_insumos_pedido;

CREATE POLICY "Usuarios autenticados acceden a snapshot_insumos_pedido" ON public.snapshot_insumos_pedido
  FOR ALL USING (auth.role() = 'authenticated');