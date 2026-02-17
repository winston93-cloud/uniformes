# 🔧 Instrucciones para Aplicar Migración de Integridad

## ⚠️ IMPORTANTE: Aplicar esta migración cuanto antes

Esta migración corrige problemas críticos de integridad de datos que podrían causar:
- Ventas con stock insuficiente
- Totales incorrectos en pedidos
- Pérdida de trazabilidad de cambios
- Información errónea en reportes

## 📋 Pasos para Aplicar la Migración

### Opción 1: Dashboard de Supabase (Recomendado)

1. **Acceder al Dashboard**
   - Ir a: https://supabase.com/dashboard
   - Seleccionar el proyecto `nmxrccrbnoenkahefrrw`

2. **Abrir SQL Editor**
   - En el menú lateral, clic en "SQL Editor"
   - Clic en "New query"

3. **Copiar y Ejecutar el SQL**
   - Abrir el archivo: `supabase/migrations/fix_integridad_datos.sql`
   - Copiar TODO el contenido
   - Pegarlo en el editor
   - Clic en "Run" (o Ctrl+Enter)

4. **Verificar Ejecución**
   - Deberías ver mensajes con ✅ indicando éxito
   - Si hay errores, copiar el mensaje completo y reportar

### Opción 2: CLI de Supabase

```bash
# Instalar Supabase CLI (si no está instalado)
npm install -g supabase

# Ejecutar migración
cd sistema-uniformes
supabase db push
```

### Opción 3: psql directo

```bash
cd sistema-uniformes
psql "postgresql://postgres.nmxrccrbnoenkahefrrw:MarioArnulfo8515@db.nmxrccrbnoenkahefrrw.supabase.co:5432/postgres" -f supabase/migrations/fix_integridad_datos.sql
```

## ✅ Verificación Post-Migración

Después de aplicar la migración, ejecutar esta consulta para verificar:

```sql
SELECT * FROM validar_integridad_sistema();
```

**Todos los checks deberían mostrar status = 'OK'**

Si alguno muestra 'ERROR' o 'WARNING', revisar los detalles y corregir.

## 📊 Nuevas Funciones Disponibles

Una vez aplicada la migración, el sistema tendrá:

### 1. `crear_pedido_atomico()` 
- ✅ Valida stock ANTES de crear pedido
- ✅ Inserta pedido + detalles en una sola transacción
- ✅ Actualiza inventario automáticamente
- ✅ Guarda snapshot de insumos (historial)
- ✅ Registra auditoría
- ✅ TODO-O-NADA: Si algo falla, se revierte todo

### 2. `procesar_devolucion_atomica()`
- ✅ Procesa devoluciones de forma atómica
- ✅ Devuelve stock correctamente
- ✅ Maneja cambios de talla/prenda
- ✅ Registra movimientos

### 3. `validar_integridad_sistema()`
- ✅ Ejecuta checks de integridad
- ✅ Detecta datos inconsistentes
- ✅ Genera reporte de estado

### 4. `refresh_reportes()`
- ✅ Actualiza vistas materializadas
- ✅ Mejora velocidad de reportes

## 🔒 Nuevas Protecciones

### Constraints CHECK
- ❌ No permite stock negativo
- ❌ No permite totales negativos o cero
- ❌ No permite cantidades negativas o cero

### Triggers Automáticos
- ✅ Valida totales de pedidos automáticamente
- ✅ Audita cambios en stock
- ✅ Actualiza timestamps

### Tablas de Auditoría
- 📝 `auditoria`: Registra todos los cambios críticos
- 📝 `snapshot_insumos_pedido`: Preserva recetas originales

## 🎯 Impacto en el Sistema

### ✅ Lo que MEJORA
1. **Integridad de datos garantizada** - No más errores de stock
2. **Trazabilidad completa** - Saber quién cambió qué y cuándo
3. **Reportes confiables** - Información siempre correcta
4. **Historial preservado** - Aunque cambien insumos, los pedidos mantienen su receta original

### ⚠️ Lo que NO cambia
- Frontend sigue funcionando igual
- No se pierden datos existentes
- No afecta pedidos anteriores
- Usuarios no notarán diferencia (excepto que todo funciona mejor)

## 🐛 En Caso de Errores

Si la migración falla, revisar:

1. **Error de permisos**: Asegurarse de estar conectado como `postgres` o con rol `service_role`

2. **Tablas ya existen**: Si alguna tabla ya existe (ej: `auditoria`), comentar esa sección

3. **Constraints duplicados**: Los bloques `DO $$ ... END $$` ya manejan esto, pero si falla, revisar

4. **Funciones duplicadas**: `CREATE OR REPLACE FUNCTION` sobrescribe, no debería dar error

## 📞 Soporte

Si hay problemas al aplicar la migración, guardar:
- Mensaje de error completo
- Línea donde falló
- Consultar con el equipo de desarrollo
