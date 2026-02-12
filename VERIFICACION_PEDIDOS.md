# ✅ CHECKLIST DE VERIFICACIÓN - MÓDULO DE PEDIDOS

## 🚨 MIGRACIÓN REQUERIDA (EJECUTAR PRIMERO)

**IMPORTANTE:** Antes de probar, ejecuta esta migración en Supabase SQL Editor:

```
supabase/migrations/fix_crear_pedido_final.sql
```

Esta migración incluye:
- ✅ Corrección de tipo de dato usuario_id (SMALLINT → UUID)
- ✅ Función completa con división automática
- ✅ Validaciones robustas
- ✅ Logs detallados para debugging

---

## 📋 CASOS DE PRUEBA

### 1. PEDIDO CON STOCK SUFICIENTE
**Escenario:** Stock = 20, Solicitas = 10

**Pasos:**
1. Seleccionar cliente
2. Agregar prenda con cantidad 10 (stock muestra 20)
3. Verificar columnas:
   - Cantidad: 10
   - Entregado: 10 (verde)
   - Pendiente: 0 (gris)
4. Crear pedido
5. Verificar que el pedido se creó correctamente
6. Ver recibo (click en pedido)

**Resultado Esperado:**
- ✅ Pedido creado exitosamente
- ✅ Stock actualizado: 20 → 10
- ✅ Movimiento registrado: SALIDA -10
- ✅ detalle_pedidos.cantidad = 10
- ✅ detalle_pedidos.pendiente = 0
- ✅ Recibo muestra: 10 entregadas, 0 pendientes
- ✅ Sin advertencias en recibo

---

### 2. PEDIDO CON STOCK INSUFICIENTE (DIVISIÓN AUTOMÁTICA)
**Escenario:** Stock = 5, Solicitas = 10

**Pasos:**
1. Seleccionar cliente
2. Agregar prenda con cantidad 10 (stock muestra 5)
3. Verificar columnas:
   - Cantidad: 10
   - Entregado: 5 (verde)
   - Pendiente: 5 (rojo con badge)
   - Botón 📦+ visible al lado de pendientes
4. Crear pedido
5. Ver recibo

**Resultado Esperado:**
- ✅ Pedido creado exitosamente
- ✅ Stock actualizado: 5 → 0
- ✅ Movimiento registrado: SALIDA -5 (con nota de pendientes)
- ✅ detalle_pedidos.cantidad = 10
- ✅ detalle_pedidos.pendiente = 5
- ✅ Recibo muestra: "⚠️ 5 entregadas, 5 pendientes"
- ✅ Banner rojo: "ESTE PEDIDO TIENE PARTIDAS PENDIENTES"

---

### 3. PEDIDO SIN STOCK (TODO PENDIENTE)
**Escenario:** Stock = 0, Solicitas = 10

**Pasos:**
1. Seleccionar cliente
2. Agregar prenda con cantidad 10 (stock muestra 0 en rojo)
3. Verificar columnas:
   - Cantidad: 10
   - Entregado: 0 (verde pero con 0)
   - Pendiente: 10 (rojo con badge)
   - Botón 📦+ visible
4. Crear pedido
5. Ver recibo

**Resultado Esperado:**
- ✅ Pedido creado exitosamente
- ✅ Stock NO cambia: 0 → 0
- ✅ NO se crea movimiento de inventario
- ✅ detalle_pedidos.cantidad = 10
- ✅ detalle_pedidos.pendiente = 10
- ✅ Recibo muestra: "⚠️ 0 entregadas, 10 pendientes"

---

### 4. AGREGAR STOCK DESDE PEDIDO
**Escenario:** Partida con 5 pendientes, agregar 10 al stock

**Pasos:**
1. En formulario, tener partida con pendientes
2. Click en botón 📦+ al lado de pendientes
3. Modal se abre mostrando:
   - Prenda y talla correctas
   - Stock actual
4. Ingresar cantidad (ej: 10)
5. Guardar
6. Verificar que:
   - Modal de éxito aparece
   - Stock se actualiza en la columna
   - División se recalcula automáticamente
   - Pendientes disminuyen o desaparecen
   - Focus regresa al input de prenda

**Resultado Esperado:**
- ✅ Stock actualizado en BD y UI
- ✅ División recalculada: Si era 5+5, ahora es 10+0
- ✅ Botón 📦+ desaparece si pendiente = 0
- ✅ Focus en input de prenda para continuar

---

### 5. PEDIDO CON MÚLTIPLES PARTIDAS (MIXTO)
**Escenario:** 
- Partida 1: Stock 10, Solicitas 5 → 5 entregadas, 0 pendientes
- Partida 2: Stock 3, Solicitas 10 → 3 entregadas, 7 pendientes
- Partida 3: Stock 0, Solicitas 5 → 0 entregadas, 5 pendientes

**Resultado Esperado:**
- ✅ Pedido creado exitosamente
- ✅ Stock actualizado solo en partidas 1 y 2
- ✅ Movimientos registrados solo para partidas con stock
- ✅ Recibo muestra correctamente cada partida
- ✅ Banner de pendientes en recibo

---

## 🗄️ VERIFICACIÓN EN BASE DE DATOS

Después de crear un pedido, ejecuta estas queries en Supabase:

### Verificar Pedido
```sql
SELECT * FROM pedidos WHERE id = 'TU_PEDIDO_ID';
```
**Verificar:**
- ✅ cliente_nombre en MAYÚSCULAS
- ✅ subtotal correcto
- ✅ total correcto
- ✅ usuario_id es UUID (no NULL)

### Verificar Detalles
```sql
SELECT 
  dp.*,
  p.nombre as prenda,
  t.nombre as talla
FROM detalle_pedidos dp
JOIN prendas p ON dp.prenda_id = p.id
JOIN tallas t ON dp.talla_id = t.id
WHERE dp.pedido_id = 'TU_PEDIDO_ID';
```
**Verificar:**
- ✅ cantidad = total solicitado
- ✅ pendiente = cantidad sin stock
- ✅ subtotal = cantidad × precio_unitario
- ✅ especificaciones en MAYÚSCULAS

### Verificar Movimientos
```sql
SELECT * FROM movimientos 
WHERE observaciones LIKE '%Pedido #TU_PEDIDO_ID%'
ORDER BY created_at DESC;
```
**Verificar:**
- ✅ tipo = 'SALIDA'
- ✅ cantidad negativa (ej: -5)
- ✅ Solo movimientos para partidas con stock
- ✅ Observaciones incluyen info de pendientes

### Verificar Stock Actualizado
```sql
SELECT 
  c.stock,
  p.nombre as prenda,
  t.nombre as talla
FROM costos c
JOIN prendas p ON c.prenda_id = p.id
JOIN tallas t ON c.talla_id = t.id
WHERE c.id = 'TU_COSTO_ID';
```
**Verificar:**
- ✅ Stock descontado correctamente
- ✅ Solo descontado lo que tenía stock

---

## 📊 VERIFICACIÓN DEL RECIBO

### Al ver el recibo (pedidos/[id]):

**Encabezado:**
- ✅ Nombre de sucursal
- ✅ Dirección y teléfono
- ✅ "TICKET DE VENTA"

**Información:**
- ✅ Folio del pedido
- ✅ Fecha y hora
- ✅ Nombre del cliente
- ✅ Estado del pedido

**Detalles:**
- ✅ Nombre de prenda
- ✅ Talla
- ✅ Especificaciones (si aplica)
- ✅ Cantidad total
- ✅ Precio unitario
- ✅ Subtotal por partida
- ✅ Badge "X entregadas, Y pendientes" si aplica

**Totales:**
- ✅ Subtotal correcto
- ✅ Total correcto (en grande y negrita)

**Advertencia:**
- ✅ Banner rojo si hay pendientes
- ✅ Mensaje claro de recoger después

**Impresión:**
- ✅ Botón "Imprimir" funciona
- ✅ Solo se imprime el recibo (no botones)
- ✅ Formato profesional

---

## 🐛 DEBUGGING

Si algo falla, revisa los logs en:

### Console del navegador:
```javascript
// Busca estos mensajes:
"📦 Creando pedido con función atómica..."
"💾 Llamando a crearPedido..."
"📦 Resultado:"
"✅ Pedido creado exitosamente"
```

### Supabase Logs:
```sql
-- Ver logs de la función
SELECT * FROM pg_stat_statements 
WHERE query LIKE '%crear_pedido_atomico%'
ORDER BY last_exec DESC
LIMIT 10;
```

### Mensajes de la función SQL (RAISE NOTICE):
- Busca en logs de Supabase Dashboard
- Aparecen como "NOTICE"
- Incluyen:
  - "Validado: [prenda] talla [X]..."
  - "Totales calculados..."
  - "Pedido creado con ID..."
  - "Stock actualizado..."
  - "PENDIENTE:..."

---

## ✅ CHECKLIST FINAL

Antes de dar por terminado, verifica:

- [ ] Migración SQL ejecutada sin errores
- [ ] Pedido con stock suficiente funciona
- [ ] Pedido con división automática funciona
- [ ] Pedido sin stock (todo pendiente) funciona
- [ ] Agregar stock desde partida funciona
- [ ] Recibo se genera correctamente
- [ ] Recibo se imprime correctamente
- [ ] Stock se descuenta solo de lo entregado
- [ ] Movimientos se registran correctamente
- [ ] TODO en MAYÚSCULAS
- [ ] Sin errores en consola
- [ ] Sin alertas/confirms nativas (solo modales custom)

---

## 📞 SOPORTE

Si encuentras algún problema:
1. Revisa los logs (consola + Supabase)
2. Verifica que ejecutaste la migración
3. Comprueba datos en BD directamente
4. Compara con casos de prueba aquí documentados

**Nota:** Este módulo es crítico. Cualquier error debe ser reportado y corregido inmediatamente.
