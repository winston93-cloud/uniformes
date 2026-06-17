-- Bloque 4: triggers updated_at + RLS permisiva (InsForge)

DROP TRIGGER IF EXISTS update_externos_updated_at ON public.externos;
CREATE TRIGGER update_externos_updated_at
  BEFORE UPDATE ON public.externos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_datos_fiscales_cliente_updated_at ON public.datos_fiscales_cliente;
CREATE TRIGGER update_datos_fiscales_cliente_updated_at
  BEFORE UPDATE ON public.datos_fiscales_cliente
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.alumno ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.externos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datos_fiscales_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acceso total a alumno" ON public.alumno;
CREATE POLICY "Permitir acceso total a alumno" ON public.alumno
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acceso total a externos" ON public.externos;
CREATE POLICY "Permitir acceso total a externos" ON public.externos
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acceso total datos_fiscales_cliente" ON public.datos_fiscales_cliente;
CREATE POLICY "Permitir acceso total datos_fiscales_cliente" ON public.datos_fiscales_cliente
  FOR ALL USING (true) WITH CHECK (true);
