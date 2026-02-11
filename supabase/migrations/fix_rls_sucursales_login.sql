-- Fix: Permitir lectura de sucursales activas en el login (sin autenticación)
-- Esto es necesario para el dropdown de sucursales en la pantalla de login

-- Eliminar política restrictiva anterior
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver sucursales" ON public.sucursales;

-- Crear política que permita VER sucursales activas (sin autenticación)
-- Esto es seguro porque solo muestra las sucursales activas, no datos sensibles
CREATE POLICY "Cualquiera puede ver sucursales activas" ON public.sucursales
  FOR SELECT USING (activo = true);

-- Las demás operaciones siguen requiriendo autenticación
CREATE POLICY "Usuarios autenticados pueden insertar sucursales" ON public.sucursales
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden actualizar sucursales" ON public.sucursales
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden eliminar sucursales" ON public.sucursales
  FOR DELETE USING (auth.role() = 'authenticated');
