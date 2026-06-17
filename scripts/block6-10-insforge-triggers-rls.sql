-- Bloques 6–10: índices, triggers updated_at/folio, RLS permisiva

CREATE INDEX IF NOT EXISTS idx_cortes_fecha ON public.cortes(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_detalle_cortes_corte ON public.detalle_cortes(corte_id);
CREATE INDEX IF NOT EXISTS idx_detalle_cortes_pedido ON public.detalle_cortes(pedido_id);

CREATE INDEX IF NOT EXISTS idx_transferencias_origen ON public.transferencias(sucursal_origen_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_destino ON public.transferencias(sucursal_destino_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_estado ON public.transferencias(estado);
CREATE INDEX IF NOT EXISTS idx_transferencias_fecha ON public.transferencias(fecha_transferencia DESC);
CREATE INDEX IF NOT EXISTS idx_detalle_transferencias_trans ON public.detalle_transferencias(transferencia_id);

CREATE INDEX IF NOT EXISTS idx_devoluciones_pedido_id ON public.devoluciones(pedido_id);
CREATE INDEX IF NOT EXISTS idx_devoluciones_sucursal_id ON public.devoluciones(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_devoluciones_usuario_id ON public.devoluciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_devoluciones_created_at ON public.devoluciones(created_at);
CREATE INDEX IF NOT EXISTS idx_detalle_devoluciones_devolucion_id ON public.detalle_devoluciones(devolucion_id);

DROP TRIGGER IF EXISTS update_usuarios_updated_at ON public.usuarios;
CREATE TRIGGER update_usuarios_updated_at
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cortes_updated_at ON public.cortes;
CREATE TRIGGER update_cortes_updated_at
  BEFORE UPDATE ON public.cortes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transferencias_updated_at ON public.transferencias;
CREATE TRIGGER update_transferencias_updated_at
  BEFORE UPDATE ON public.transferencias
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION public.update_devoluciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_devoluciones_updated_at ON public.devoluciones;
CREATE TRIGGER trigger_update_devoluciones_updated_at
  BEFORE UPDATE ON public.devoluciones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_devoluciones_updated_at();

CREATE OR REPLACE FUNCTION public.generate_folio_transferencia()
RETURNS TRIGGER AS $$
DECLARE
  new_folio VARCHAR(20);
  year_part VARCHAR(4);
  count_part INTEGER;
BEGIN
  year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(COUNT(*) + 1, 1)
  INTO count_part
  FROM public.transferencias
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
  new_folio := 'TRANS-' || year_part || '-' || LPAD(count_part::TEXT, 3, '0');
  NEW.folio := new_folio;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_folio_transferencia ON public.transferencias;
CREATE TRIGGER trigger_generate_folio_transferencia
  BEFORE INSERT ON public.transferencias
  FOR EACH ROW
  WHEN (NEW.folio IS NULL OR NEW.folio = '')
  EXECUTE FUNCTION public.generate_folio_transferencia();

ALTER TABLE public.usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cortes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_cortes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_transferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devoluciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_devoluciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acceso total usuario" ON public.usuario;
CREATE POLICY "Permitir acceso total usuario" ON public.usuario
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acceso total usuarios" ON public.usuarios;
CREATE POLICY "Permitir acceso total usuarios" ON public.usuarios
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acceso total cortes" ON public.cortes;
CREATE POLICY "Permitir acceso total cortes" ON public.cortes
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acceso total detalle_cortes" ON public.detalle_cortes;
CREATE POLICY "Permitir acceso total detalle_cortes" ON public.detalle_cortes
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acceso total transferencias" ON public.transferencias;
CREATE POLICY "Permitir acceso total transferencias" ON public.transferencias
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acceso total detalle_transferencias" ON public.detalle_transferencias;
CREATE POLICY "Permitir acceso total detalle_transferencias" ON public.detalle_transferencias
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acceso total devoluciones" ON public.devoluciones;
CREATE POLICY "Permitir acceso total devoluciones" ON public.devoluciones
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acceso total detalle_devoluciones" ON public.detalle_devoluciones;
CREATE POLICY "Permitir acceso total detalle_devoluciones" ON public.detalle_devoluciones
  FOR ALL USING (true) WITH CHECK (true);
