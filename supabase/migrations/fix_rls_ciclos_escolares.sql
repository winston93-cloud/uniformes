-- Fix: Permitir lectura de ciclos escolares activos
-- Necesario para el selector de ciclo escolar en el header

-- Eliminar política restrictiva anterior
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver ciclos_escolares" ON public.ciclos_escolares;

-- Crear política que permita VER ciclos escolares activos
-- Esto es seguro porque solo muestra información básica de ciclos
CREATE POLICY "Usuarios autenticados pueden ver ciclos_escolares" ON public.ciclos_escolares
  FOR SELECT USING (auth.role() = 'authenticated');

-- Realmente, para el selector necesitamos acceso público de lectura:
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver ciclos_escolares" ON public.ciclos_escolares;

CREATE POLICY "Cualquiera puede ver ciclos_escolares activos" ON public.ciclos_escolares
  FOR SELECT USING (activo = true);

-- Las demás operaciones siguen requiriendo autenticación
CREATE POLICY "Usuarios autenticados pueden insertar ciclos_escolares" ON public.ciclos_escolares
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden actualizar ciclos_escolares" ON public.ciclos_escolares
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden eliminar ciclos_escolares" ON public.ciclos_escolares
  FOR DELETE USING (auth.role() = 'authenticated');
