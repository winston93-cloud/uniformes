-- Habilitar RLS en todas las tablas del sistema de uniformes que no lo tienen
-- Migración de seguridad crítica

-- 1. Transferencias
ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_transferencias ENABLE ROW LEVEL SECURITY;

-- 2. Devoluciones
ALTER TABLE public.devoluciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_devoluciones ENABLE ROW LEVEL SECURITY;

-- 3. Sucursales
ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;

-- 4. Prenda-Talla-Insumos
ALTER TABLE public.prenda_talla_insumos ENABLE ROW LEVEL SECURITY;

-- 5. Ciclos Escolares
ALTER TABLE public.ciclos_escolares ENABLE ROW LEVEL SECURITY;

-- 6. Snapshot de Insumos
ALTER TABLE public.snapshot_insumos_pedido ENABLE ROW LEVEL SECURITY;

-- Crear políticas básicas de acceso autenticado para todas estas tablas

-- Políticas para transferencias
CREATE POLICY "Usuarios autenticados pueden ver transferencias" ON public.transferencias
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden insertar transferencias" ON public.transferencias
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden actualizar transferencias" ON public.transferencias
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden eliminar transferencias" ON public.transferencias
  FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas para detalle_transferencias
CREATE POLICY "Usuarios autenticados pueden ver detalle_transferencias" ON public.detalle_transferencias
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden insertar detalle_transferencias" ON public.detalle_transferencias
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden actualizar detalle_transferencias" ON public.detalle_transferencias
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden eliminar detalle_transferencias" ON public.detalle_transferencias
  FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas para devoluciones
CREATE POLICY "Usuarios autenticados pueden ver devoluciones" ON public.devoluciones
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden insertar devoluciones" ON public.devoluciones
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden actualizar devoluciones" ON public.devoluciones
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden eliminar devoluciones" ON public.devoluciones
  FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas para detalle_devoluciones
CREATE POLICY "Usuarios autenticados pueden ver detalle_devoluciones" ON public.detalle_devoluciones
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden insertar detalle_devoluciones" ON public.detalle_devoluciones
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden actualizar detalle_devoluciones" ON public.detalle_devoluciones
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden eliminar detalle_devoluciones" ON public.detalle_devoluciones
  FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas para sucursales
CREATE POLICY "Usuarios autenticados pueden ver sucursales" ON public.sucursales
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden insertar sucursales" ON public.sucursales
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden actualizar sucursales" ON public.sucursales
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden eliminar sucursales" ON public.sucursales
  FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas para prenda_talla_insumos
CREATE POLICY "Usuarios autenticados pueden ver prenda_talla_insumos" ON public.prenda_talla_insumos
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden insertar prenda_talla_insumos" ON public.prenda_talla_insumos
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden actualizar prenda_talla_insumos" ON public.prenda_talla_insumos
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden eliminar prenda_talla_insumos" ON public.prenda_talla_insumos
  FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas para ciclos_escolares
CREATE POLICY "Usuarios autenticados pueden ver ciclos_escolares" ON public.ciclos_escolares
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden insertar ciclos_escolares" ON public.ciclos_escolares
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden actualizar ciclos_escolares" ON public.ciclos_escolares
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden eliminar ciclos_escolares" ON public.ciclos_escolares
  FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas para snapshot_insumos_pedido
CREATE POLICY "Usuarios autenticados pueden ver snapshot_insumos_pedido" ON public.snapshot_insumos_pedido
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden insertar snapshot_insumos_pedido" ON public.snapshot_insumos_pedido
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden actualizar snapshot_insumos_pedido" ON public.snapshot_insumos_pedido
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden eliminar snapshot_insumos_pedido" ON public.snapshot_insumos_pedido
  FOR DELETE USING (auth.role() = 'authenticated');
