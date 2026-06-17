-- Bloque 5: índices, updated_at, RLS permisiva (InsForge)

CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_folio_unique
  ON public.pedidos (folio) WHERE folio IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_cotizacion_id_unique
  ON public.pedidos (cotizacion_id) WHERE cotizacion_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_folio ON public.cotizaciones(folio);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_alumno ON public.cotizaciones(alumno_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_externo ON public.cotizaciones(externo_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_fecha ON public.cotizaciones(fecha_cotizacion);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado ON public.cotizaciones(estado);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_metodo_pago ON public.cotizaciones(metodo_pago_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_forma_pago ON public.cotizaciones(forma_pago_id);

CREATE INDEX IF NOT EXISTS idx_detalle_cotizacion_cotizacion ON public.detalle_cotizacion(cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_detalle_tipo_precio ON public.detalle_cotizacion(tipo_precio_usado);
CREATE INDEX IF NOT EXISTS idx_detalle_prenda_id ON public.detalle_cotizacion(prenda_id);
CREATE INDEX IF NOT EXISTS idx_detalle_costo_id ON public.detalle_cotizacion(costo_id);

CREATE INDEX IF NOT EXISTS idx_pedidos_alumno ON public.pedidos(alumno_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_externo ON public.pedidos(externo_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON public.pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_sucursal ON public.pedidos(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_detalle_pedidos_pedido ON public.detalle_pedidos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_detalle_pedidos_prenda ON public.detalle_pedidos(prenda_id);
CREATE INDEX IF NOT EXISTS idx_detalle_pedidos_talla ON public.detalle_pedidos(talla_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_costo ON public.movimientos(costo_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo ON public.movimientos(tipo);
CREATE INDEX IF NOT EXISTS idx_snapshot_detalle ON public.snapshot_insumos_pedido(detalle_pedido_id);

DROP TRIGGER IF EXISTS update_cotizaciones_updated_at ON public.cotizaciones;
CREATE TRIGGER update_cotizaciones_updated_at
  BEFORE UPDATE ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pedidos_updated_at ON public.pedidos;
CREATE TRIGGER update_pedidos_updated_at
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sat_metodos_pago_updated_at ON public.sat_metodos_pago;
CREATE TRIGGER update_sat_metodos_pago_updated_at
  BEFORE UPDATE ON public.sat_metodos_pago
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sat_formas_pago_updated_at ON public.sat_formas_pago;
CREATE TRIGGER update_sat_formas_pago_updated_at
  BEFORE UPDATE ON public.sat_formas_pago
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.sat_metodos_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sat_formas_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_cotizacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snapshot_insumos_pedido ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acceso total sat_metodos_pago" ON public.sat_metodos_pago;
CREATE POLICY "Permitir acceso total sat_metodos_pago" ON public.sat_metodos_pago
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acceso total sat_formas_pago" ON public.sat_formas_pago;
CREATE POLICY "Permitir acceso total sat_formas_pago" ON public.sat_formas_pago
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acceso total cotizaciones" ON public.cotizaciones;
CREATE POLICY "Permitir acceso total cotizaciones" ON public.cotizaciones
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acceso total detalle_cotizacion" ON public.detalle_cotizacion;
CREATE POLICY "Permitir acceso total detalle_cotizacion" ON public.detalle_cotizacion
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acceso total pedidos" ON public.pedidos;
CREATE POLICY "Permitir acceso total pedidos" ON public.pedidos
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acceso total detalle_pedidos" ON public.detalle_pedidos;
CREATE POLICY "Permitir acceso total detalle_pedidos" ON public.detalle_pedidos
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acceso total movimientos" ON public.movimientos;
CREATE POLICY "Permitir acceso total movimientos" ON public.movimientos
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acceso total snapshot_insumos_pedido" ON public.snapshot_insumos_pedido;
CREATE POLICY "Permitir acceso total snapshot_insumos_pedido" ON public.snapshot_insumos_pedido
  FOR ALL USING (true) WITH CHECK (true);
