# 💰 Sistema de Compras de Insumos

## 🎯 Descripción

Módulo completo de gestión de compras de insumos integrado en el Dashboard principal. Permite a la dirección ver qué insumos necesita comprar, registrar las compras realizadas, y hacer seguimiento del estado de cumplimiento.

---

## 🌟 Características Principales

### 1. **Cálculo Automático de Necesidades**
- ✅ Calcula automáticamente qué insumos y cuánto se necesita
- ✅ Basado en pedidos pendientes (estado "PEDIDO")
- ✅ Considera la configuración de insumos por talla de cada prenda

### 2. **Registro de Compras (CRUD Completo)**
- ✅ **Crear**: Registrar nuevas compras de insumos
- ✅ **Leer**: Ver historial de compras por insumo
- ✅ **Actualizar**: Modificar datos de compras existentes
- ✅ **Eliminar**: Borrar registros de compras

### 3. **Seguimiento en Tiempo Real**
- ✅ **Cantidad Necesaria**: Lo que se requiere para producir
- ✅ **Cantidad Comprada**: Lo que ya se ha adquirido
- ✅ **Cantidad Faltante**: Lo que aún falta por comprar
- ✅ **Porcentaje de Completado**: Estado visual del progreso

### 4. **Estados Visuales**
- 🔴 **Pendiente (0%)**: No se ha comprado nada
- 🟡 **Parcial (1-99%)**: Se ha comprado una parte
- 🟢 **Completo (100%+)**: Ya se compró todo lo necesario

---

## 📊 Estructura de Datos

### **Nueva Tabla: `compras_insumos`**

```sql
CREATE TABLE compras_insumos (
  id UUID PRIMARY KEY,
  insumo_id UUID REFERENCES insumos(id),
  cantidad_comprada DECIMAL(10,2),
  costo_unitario DECIMAL(10,2),
  costo_total DECIMAL(10,2),
  proveedor VARCHAR(255),
  fecha_compra DATE,
  notas TEXT,
  usuario_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### **Relaciones:**
- `compras_insumos.insumo_id` → `insumos.id` (CASCADE)
- `compras_insumos.usuario_id` → `usuarios.id` (SET NULL)

---

## 🔄 Flujo de Uso

### **Paso 1: Ver Necesidades**
1. Entrar al Dashboard
2. Ver la tarjeta "Insumos Necesarios para Producción"
3. Hacer clic para expandir

### **Paso 2: Analizar Información**
```
┌────────────────────────────────────────────────────────┐
│ # │ Insumo      │ Necesario │ Comprado │ Falta │ Estado│
├───┼─────────────┼───────────┼──────────┼───────┼───────┤
│ 1 │ Tela Blanca │ 14.40 m   │ 10.00 m  │ 4.40  │ 🟡 69%│
│ 2 │ Botones     │ 21.00 pz  │ 0.00 pz  │ 21.00 │ 🔴 0% │
└────────────────────────────────────────────────────────┘
```

**Interpretación:**
- **Tela Blanca**: Se necesitan 14.40m, ya se compraron 10m, faltan 4.40m
- **Botones**: Se necesitan 21 piezas, no se ha comprado nada aún

### **Paso 3: Registrar Compra**
1. Hacer clic en botón **"💰 Registrar Compra"** del insumo deseado
2. Se abre un modal con formulario:
   - **Cantidad Comprada**: Cuánto se compró (sugerido: cantidad faltante)
   - **Costo Unitario**: Precio por unidad
   - **Costo Total**: Se calcula automáticamente
   - **Proveedor**: Nombre del proveedor
   - **Fecha de Compra**: Fecha de la adquisición
   - **Notas**: Información adicional (factura, condiciones, etc.)
3. Hacer clic en **"💾 Registrar Compra"**

### **Paso 4: Verificar Actualización**
- El sistema recalcula automáticamente
- El estado del insumo se actualiza
- Si se completó el 100%, aparece 🟢 Completo

---

## 💡 Casos de Uso

### **Caso 1: Compra Completa**
**Situación:** Se necesitan 14.40 metros de tela blanca

**Acción:**
1. Ver que faltan 14.40m
2. Ir al proveedor y comprar 15m (un poco más por seguridad)
3. Registrar compra:
   - Cantidad: 15m
   - Costo: $50/m = $750 total
   - Proveedor: "Telas del Norte"
   - Fecha: Hoy
4. Sistema muestra: ✅ **104% completado** (sobran 0.60m)

### **Caso 2: Compra Parcial**
**Situación:** Se necesitan 21 botones pero solo hay disponibles 10

**Acción:**
1. Ver que faltan 21 botones
2. Comprar los 10 disponibles
3. Registrar compra:
   - Cantidad: 10 piezas
   - Proveedor: "Botones SA"
4. Sistema muestra: 🟡 **48% completado** (faltan 11)
5. Cuando lleguen más botones, registrar segunda compra

### **Caso 3: Múltiples Compras**
**Situación:** Se hacen varias compras del mismo insumo

**El sistema:**
- Suma automáticamente todas las compras
- Muestra el total acumulado
- Calcula porcentaje sobre el total necesario

**Ejemplo:**
- Necesario: 20m de tela
- Compra 1: 8m (40%)
- Compra 2: 7m (75% acumulado)
- Compra 3: 5m (100% acumulado)

---

## 📈 Beneficios

### **Para la Dueña/Dirección:**
✅ **Visibilidad total** de necesidades de compra
✅ **Control de presupuesto** (costos registrados)
✅ **Seguimiento de proveedores** (quién vendió qué)
✅ **Historial completo** de adquisiciones
✅ **Decisiones informadas** basadas en datos reales

### **Para el Negocio:**
✅ **Optimización de compras** (ni más ni menos)
✅ **Mejor gestión de efectivo** (saber cuánto gastar)
✅ **Trazabilidad** (quién compró, cuándo, a quién)
✅ **Evitar faltantes** (ver lo que falta en tiempo real)
✅ **Reducir desperdicio** (comprar lo justo)

---

## 🔐 Seguridad y Permisos

### **Row Level Security (RLS):**
- ✅ Todos pueden **ver** las compras
- ✅ Usuarios autenticados pueden **crear** compras
- ✅ Usuarios autenticados pueden **editar** compras
- ✅ Usuarios autenticados pueden **eliminar** compras

### **Auditoría:**
- Cada compra registra quién la creó (`usuario_id`)
- Timestamps de creación y actualización
- Historial completo inmutable (soft delete recomendado)

---

## 🚨 Solución de Problemas

### **"No aparecen insumos necesarios"**
**Posibles causas:**
1. No hay pedidos en estado "PEDIDO"
   - **Solución**: Crear pedidos o verificar estados
2. Las prendas no tienen insumos configurados
   - **Solución**: Ir a Prendas → Editar → Configurar insumos por talla (botón 🧵)

### **"El porcentaje no se actualiza después de registrar compra"**
**Solución:**
1. Hacer clic en el botón "🔄 Actualizar" en la tarjeta
2. Si persiste, recargar la página (Ctrl + Shift + R)

### **"El costo total no se calcula"**
**Causa:** No se ingresó el costo unitario
**Solución:** El campo es opcional, pero si se deja vacío el costo total será $0

---

## 🎨 Interfaz de Usuario

### **Dashboard Principal:**
```
┌─────────────────────────────────────────────────────────┐
│ 📋 Insumos Necesarios para Producción    ⚠️ 7 insumos  │
│     Basado en pedidos pendientes                   ▼    │
└─────────────────────────────────────────────────────────┘
```

### **Vista Expandida:**
```
┌──────────────────────────────────────────────────────────┐
│ 📋 Insumos Necesarios para Producción    ⚠️ 7 insumos  │
│     Basado en pedidos pendientes                   ▲    │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ 📊 Resumen de Compra                                     │
│ Se necesitan 7 tipos de insumos diferentes               │
│                                                           │
│ ┌────────────────────────────────────────────────────┐  │
│ │ # │ Insumo  │ Necesario │ Comprado │ Falta │ Estado│  │
│ ├───┼─────────┼───────────┼──────────┼───────┼───────┤  │
│ │ 1 │ Tela... │ 14.40 m   │ 10.00 m  │ 4.40m │🟡 69% │  │
│ │   │         │           │[💰 Registrar Compra]      │  │
│ └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### **Modal de Registro:**
```
┌──────────────────────────────────────┐
│ 💰 Registrar Compra de Insumo        │
├──────────────────────────────────────┤
│ Insumo: Tela Blanca                  │
│ Cantidad Faltante: 4.40 metros       │
│                                       │
│ Cantidad Comprada: [15.00] metros    │
│ Costo Unitario: [$50.00]             │
│ Costo Total: $750.00 (calculado)     │
│ Proveedor: [Telas del Norte]         │
│ Fecha: [2026-01-21]                  │
│ Notas: [Factura #1234...]            │
│                                       │
│ [Cancelar] [💾 Registrar Compra]     │
└──────────────────────────────────────┘
```

---

## 🛠️ Arquitectura Técnica

### **Archivos Creados:**

1. **Base de Datos:**
   - `supabase/crear_tabla_compras_insumos.sql`

2. **Hooks:**
   - `lib/hooks/useComprasInsumos.ts`
   - `lib/hooks/useInsumosFaltantes.ts` (actualizado)

3. **Componentes:**
   - `components/ModalRegistrarCompra.tsx`
   - `components/TarjetaInsumosFaltantes.tsx` (actualizado)

### **Flujo de Datos:**

```
Pedidos (estado=PEDIDO)
    ↓
Detalle_Pedidos (prendas-tallas vendidas)
    ↓
Prenda_Talla_Insumos (insumos por prenda-talla)
    ↓
Cálculo: Cantidad Necesaria
    ↓
Compras_Insumos (registros de compras)
    ↓
Cálculo: Cantidad Comprada
    ↓
Resultado: Cantidad Faltante + Porcentaje
```

---

## 📞 Soporte

Para dudas o problemas:
1. Revisar esta documentación
2. Verificar que la tabla `compras_insumos` existe en Supabase
3. Verificar configuración de insumos en prendas (botón 🧵)
4. Contactar al administrador del sistema

---

**🏫 Sistema de Uniformes Winston Churchill**  
**📅 Creado:** Enero 2026  
**👥 Diseñado para:** Dirección y Gestión de Compras  
**✨ Versión:** 2.0 - Módulo de Compras Integrado
