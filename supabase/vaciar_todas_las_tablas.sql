-- Script para vaciar todas las tablas del sistema de uniformes
-- IMPORTANTE: Este script elimina TODOS los datos de todas las tablas
-- Ejecutar con precaución. No se puede deshacer.

-- Desactivar temporalmente las restricciones de foreign keys para facilitar la limpieza
SET session_replication_role = 'replica';

-- Vaciar tablas en orden (de dependientes a independientes)
-- NOTA: alumnos y externos NO se vacían (se mantienen los datos)
TRUNCATE TABLE detalle_cortes CASCADE;
TRUNCATE TABLE detalle_pedidos CASCADE;
TRUNCATE TABLE movimientos CASCADE;
TRUNCATE TABLE cortes CASCADE;
TRUNCATE TABLE pedidos CASCADE;
TRUNCATE TABLE costos CASCADE;
TRUNCATE TABLE prendas CASCADE;
TRUNCATE TABLE tallas CASCADE;
TRUNCATE TABLE categorias_prendas CASCADE;
-- NOTA: usuarios se mantiene para no perder acceso al sistema
-- NOTA: alumnos y externos se mantienen (no se vacían)

-- Reactivar las restricciones de foreign keys
SET session_replication_role = 'origin';

-- Mensaje de confirmación
DO $$
BEGIN
  RAISE NOTICE 'Todas las tablas han sido vaciadas exitosamente (excepto usuarios, alumnos y externos)';
END $$;

