-- Fix: Permitir lectura de sucursales activas en el login (sin autenticación)
-- Esto es necesario para el dropdown de sucursales en la pantalla de login
-- Idempotente: compatible si ya se ejecutó habilitar_rls_tablas_faltantes.sql (paso 16).

-- SELECT: reemplazar política solo-autenticados por lectura pública de activas
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver sucursales" ON public.sucursales;
DROP POLICY IF EXISTS "Cualquiera puede ver sucursales activas" ON public.sucursales;
CREATE POLICY "Cualquiera puede ver sucursales activas" ON public.sucursales
  FOR SELECT USING (activo = true);

-- INSERT/UPDATE/DELETE: recrear por si ya existían con el mismo nombre (paso 16)
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar sucursales" ON public.sucursales;
CREATE POLICY "Usuarios autenticados pueden insertar sucursales" ON public.sucursales
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar sucursales" ON public.sucursales;
CREATE POLICY "Usuarios autenticados pueden actualizar sucursales" ON public.sucursales
  FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar sucursales" ON public.sucursales;
CREATE POLICY "Usuarios autenticados pueden eliminar sucursales" ON public.sucursales
  FOR DELETE USING (auth.role() = 'authenticated');
