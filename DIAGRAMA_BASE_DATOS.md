# 📊 Diagrama de Base de Datos - Sistema de Uniformes Winston Churchill

## 🗂️ Estructura Completa de Tablas

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SISTEMA DE UNIFORMES - DATABASE SCHEMA                    │
│                         Normalización: 3FN (Tercera Forma Normal)            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 CATÁLOGOS BASE (Tablas Maestras)

### 1️⃣ **usuarios** (Gestión de Usuarios)
```
┌─────────────────────────────────┐
│          usuarios               │
├─────────────────────────────────┤
│ 🔑 id: UUID (PK)                │
│ ✏️  nombre: VARCHAR(255)         │
│ ✏️  apellido_p: VARCHAR(255)     │
│ ✏️  apellido_m: VARCHAR(255)     │
│ 🔐 usuario: VARCHAR(100) UNIQUE  │
│ 🔐 password: TEXT                │
│ 📊 tipo: INTEGER (1,3,5)         │
│ 📧 email: VARCHAR(255)           │
│ ✅ activo: BOOLEAN               │
│ 📅 created_at: TIMESTAMP         │
│ 📅 updated_at: TIMESTAMP         │
└─────────────────────────────────┘

ROLES:
• 1: Administrador
• 3: Operador
• 5: Supervisor
```

### 2️⃣ **tallas** (Catálogo de Tallas)
```
┌─────────────────────────────────┐
│           tallas                │
├─────────────────────────────────┤
│ 🔑 id: UUID (PK)                │
│ 📏 nombre: VARCHAR(50) UNIQUE    │
│ 🔢 orden: INTEGER                │
│ ✅ activo: BOOLEAN               │
│ 📅 created_at: TIMESTAMP         │
│ 📅 updated_at: TIMESTAMP         │
└─────────────────────────────────┘

EJEMPLOS: 6, 8, 10, 12, CH, M, L, XL
```

### 3️⃣ **categorias_prendas** (Categorías de Prendas)
```
┌─────────────────────────────────┐
│      categorias_prendas         │
├─────────────────────────────────┤
│ 🔑 id: UUID (PK)                │
│ 📝 nombre: VARCHAR(100) UNIQUE   │
│ ✅ activo: BOOLEAN               │
│ 📅 created_at: TIMESTAMP         │
│ 📅 updated_at: TIMESTAMP         │
└─────────────────────────────────┘

EJEMPLOS: Camisas, Pantalones, Faldas, Deportivo
```

### 4️⃣ **presentaciones** (Unidades de Medida para Insumos)
```
┌─────────────────────────────────┐
│        presentaciones           │
├─────────────────────────────────┤
│ 🔑 id: UUID (PK)                │
│ 📦 nombre: VARCHAR(100) UNIQUE   │
│ 📝 descripcion: TEXT             │
│ ✅ activo: BOOLEAN               │
│ 📅 created_at: TIMESTAMP         │
│ 📅 updated_at: TIMESTAMP         │
└─────────────────────────────────┘

EJEMPLOS: Kilo, Metro, Bolsa, Rollo, Pieza, Litro
```

---

## 👕 PRODUCTOS Y MATERIALES

### 5️⃣ **prendas** (Catálogo de Prendas)
```
┌─────────────────────────────────┐
│           prendas               │
├─────────────────────────────────┤
│ 🔑 id: UUID (PK)                │
│ 📝 nombre: VARCHAR(255)          │
│ 🔖 codigo: VARCHAR(100) UNIQUE   │
│ 📄 descripcion: TEXT             │
│ 🔗 categoria_id: UUID (FK) ─────┼──→ categorias_prendas.id
│ ✅ activo: BOOLEAN               │
│ 📅 created_at: TIMESTAMP         │
│ 📅 updated_at: TIMESTAMP         │
└─────────────────────────────────┘

RELACIÓN: N:1 con categorias_prendas (SET NULL)
```

### 6️⃣ **insumos** (Catálogo de Materiales e Insumos)
```
┌─────────────────────────────────────────┐
│              insumos                    │
├─────────────────────────────────────────┤
│ 🔑 id: UUID (PK)                        │
│ 🔖 codigo: VARCHAR(50) UNIQUE            │
│ 📝 nombre: VARCHAR(255)                  │
│ 📄 descripcion: TEXT                     │
│ 🔗 presentacion_id: UUID (FK) ──────────┼──→ presentaciones.id
│ 🔢 cantidad_por_presentacion: DECIMAL    │
│ ✅ activo: BOOLEAN                       │
│ 📅 created_at: TIMESTAMP                 │
│ 📅 updated_at: TIMESTAMP                 │
└─────────────────────────────────────────┘

RELACIÓN: N:1 con presentaciones (RESTRICT)
EJEMPLOS: Botones, Tela, Hilo, Cierres, Elástico
```

### 7️⃣ **costos** (Precio y Stock por Prenda-Talla)
```
┌──────────────────────────────────────────┐
│              costos                      │
│         (Tabla Intermedia)               │
├──────────────────────────────────────────┤
│ 🔑 id: UUID (PK)                         │
│ 🔗 talla_id: UUID (FK) ──────────────────┼──→ tallas.id
│ 🔗 prenda_id: UUID (FK) ─────────────────┼──→ prendas.id
│ 💰 precio_venta: DECIMAL(10,2)           │
│ 📊 stock_inicial: INTEGER                │
│ 📦 stock: INTEGER (CHECK >= 0)           │
│ ✅ activo: BOOLEAN                       │
│ 📅 created_at: TIMESTAMP                 │
│ 📅 updated_at: TIMESTAMP                 │
│ 🔒 UNIQUE(talla_id, prenda_id)           │
└──────────────────────────────────────────┘

RELACIONES:
• N:1 con tallas (CASCADE)
• N:1 con prendas (CASCADE)
• Tabla de relación N:M entre prendas y tallas
• Almacena precio y stock específico por combinación
```

### 8️⃣ **prenda_talla_insumos** (Insumos por Talla de Prenda) ⭐ NUEVO
```
┌──────────────────────────────────────────┐
│       prenda_talla_insumos               │
│         (Tabla Intermedia)               │
├──────────────────────────────────────────┤
│ 🔑 id: UUID (PK)                         │
│ 🔗 prenda_id: UUID (FK) ─────────────────┼──→ prendas.id
│ 🔗 talla_id: UUID (FK) ──────────────────┼──→ tallas.id
│ 🔗 insumo_id: UUID (FK) ─────────────────┼──→ insumos.id
│ 🔢 cantidad: DECIMAL(10,2)               │
│ 📅 created_at: TIMESTAMP                 │
│ 📅 updated_at: TIMESTAMP                 │
│ 🔒 UNIQUE(prenda_id, talla_id, insumo_id)│
└──────────────────────────────────────────┘

RELACIONES:
• N:1 con prendas (CASCADE)
• N:1 con tallas (CASCADE)
• N:1 con insumos (CASCADE)
• Define qué insumos y cantidad se necesitan para cada talla de cada prenda
• Ejemplo: Camisa Polo Talla 10 necesita: 3 botones, 2 mts tela, 1 cuello
```

---

## 👥 CLIENTES

### 9️⃣ **alumnos** (Alumnos de la Institución)
```
┌─────────────────────────────────┐
│           alumnos               │
├─────────────────────────────────┤
│ 🔑 id: UUID (PK)                │
│ 📝 nombre: VARCHAR(255)          │
│ 🎫 referencia: VARCHAR(50) UNIQUE│
│ 📚 grado: VARCHAR(50)            │
│ 🏫 grupo: VARCHAR(10)            │
│ 📞 telefono: VARCHAR(20)         │
│ 📧 email: VARCHAR(255)           │
│ ✅ activo: BOOLEAN               │
│ 📅 created_at: TIMESTAMP         │
│ 📅 updated_at: TIMESTAMP         │
└─────────────────────────────────┘

TIPO CLIENTE: 'alumno'
```

### 🔟 **externos** (Clientes Externos)
```
┌─────────────────────────────────┐
│           externos              │
├─────────────────────────────────┤
│ 🔑 id: UUID (PK)                │
│ 📝 nombre: VARCHAR(255)          │
│ 📞 telefono: VARCHAR(20)         │
│ 📧 email: VARCHAR(255)           │
│ 🏠 direccion: TEXT               │
│ ✅ activo: BOOLEAN               │
│ 📅 created_at: TIMESTAMP         │
│ 📅 updated_at: TIMESTAMP         │
└─────────────────────────────────┘

TIPO CLIENTE: 'externo'
```

---

## 🛒 VENTAS Y PEDIDOS

### 1️⃣1️⃣ **pedidos** (Órdenes de Venta)
```
┌──────────────────────────────────────────┐
│              pedidos                     │
├──────────────────────────────────────────┤
│ 🔑 id: UUID (PK)                         │
│ 🔗 alumno_id: UUID (FK) ─────────────────┼──→ alumnos.id
│ 🔗 externo_id: UUID (FK) ────────────────┼──→ externos.id
│ 👤 tipo_cliente: VARCHAR(20)             │
│    CHECK IN ('alumno', 'externo')        │
│ 📊 estado: VARCHAR(20)                   │
│    CHECK IN ('PEDIDO', 'ENTREGADO',      │
│              'LIQUIDADO', 'CANCELADO')   │
│ 💵 subtotal: DECIMAL(10,2)               │
│ 💰 total: DECIMAL(10,2)                  │
│ 📅 fecha_entrega: TIMESTAMP              │
│ 📅 fecha_liquidacion: TIMESTAMP          │
│ 📝 notas: TEXT                           │
│ 🔗 usuario_id: UUID (FK) ────────────────┼──→ usuarios.id
│ 📅 created_at: TIMESTAMP                 │
│ 📅 updated_at: TIMESTAMP                 │
└──────────────────────────────────────────┘

RELACIONES:
• N:1 con alumnos (SET NULL) - Cliente interno
• N:1 con externos (SET NULL) - Cliente externo
• N:1 con usuarios (SET NULL) - Quien registró
• Polimórfico: puede ser de alumno O externo
```

### 1️⃣2️⃣ **detalle_pedidos** (Líneas de Pedido)
```
┌──────────────────────────────────────────┐
│          detalle_pedidos                 │
├──────────────────────────────────────────┤
│ 🔑 id: UUID (PK)                         │
│ 🔗 pedido_id: UUID (FK) ─────────────────┼──→ pedidos.id
│ 🔗 costo_id: UUID (FK) ──────────────────┼──→ costos.id
│ 🔢 cantidad: INTEGER (CHECK > 0)         │
│ 💰 precio_unitario: DECIMAL(10,2)        │
│ 💵 subtotal: DECIMAL(10,2)               │
│ 📅 created_at: TIMESTAMP                 │
└──────────────────────────────────────────┘

RELACIONES:
• N:1 con pedidos (CASCADE)
• N:1 con costos (RESTRICT) - Vincula a prenda-talla específica
```

---

## 📦 INVENTARIO

### 1️⃣3️⃣ **movimientos** (Movimientos de Inventario)
```
┌──────────────────────────────────────────┐
│           movimientos                    │
├──────────────────────────────────────────┤
│ 🔑 id: UUID (PK)                         │
│ 📊 tipo: VARCHAR(20)                     │
│    CHECK IN ('ENTRADA', 'SALIDA',        │
│              'AJUSTE')                   │
│ 🔗 costo_id: UUID (FK) ──────────────────┼──→ costos.id
│ 🔢 cantidad: INTEGER                     │
│    (+) entrada/ajuste+                   │
│    (-) salida/ajuste-                    │
│ 📝 observaciones: TEXT                   │
│ 🔗 usuario_id: UUID (FK) ────────────────┼──→ usuarios.id
│ 📅 created_at: TIMESTAMP                 │
└──────────────────────────────────────────┘

RELACIONES:
• N:1 con costos (RESTRICT)
• N:1 con usuarios (SET NULL)
```

---

## 💰 CAJA Y CORTES

### 1️⃣4️⃣ **cortes** (Cortes de Caja)
```
┌──────────────────────────────────────────┐
│              cortes                      │
├──────────────────────────────────────────┤
│ 🔑 id: UUID (PK)                         │
│ 📅 fecha: TIMESTAMP                      │
│ 📅 fecha_inicio: DATE                    │
│ 📅 fecha_fin: DATE                       │
│ 💰 total_ventas: DECIMAL(10,2)           │
│ 🔢 total_pedidos: INTEGER                │
│ 🔗 usuario_id: UUID (FK) ────────────────┼──→ usuarios.id
│ ✅ activo: BOOLEAN                       │
│ 📅 created_at: TIMESTAMP                 │
│ 📅 updated_at: TIMESTAMP                 │
└──────────────────────────────────────────┘

RELACIÓN: N:1 con usuarios (SET NULL)
```

### 1️⃣5️⃣ **detalle_cortes** (Pedidos Incluidos en Corte)
```
┌──────────────────────────────────────────┐
│         detalle_cortes                   │
├──────────────────────────────────────────┤
│ 🔑 id: UUID (PK)                         │
│ 🔗 corte_id: UUID (FK) ──────────────────┼──→ cortes.id
│ 🔗 pedido_id: UUID (FK) ─────────────────┼──→ pedidos.id
│ 📅 created_at: TIMESTAMP                 │
└──────────────────────────────────────────┘

RELACIONES:
• N:1 con cortes (CASCADE)
• N:1 con pedidos (RESTRICT)
• Tabla de relación N:M entre cortes y pedidos
```

---

## 🔗 DIAGRAMA DE RELACIONES

```
                                    ┌─────────────┐
                                    │  usuarios   │
                                    └──────┬──────┘
                                           │
                           ┌───────────────┼───────────────┐
                           │               │               │
                           ▼               ▼               ▼
                    ┌──────────┐    ┌──────────┐    ┌──────────┐
                    │ pedidos  │    │movimien..│    │  cortes  │
                    └────┬─────┘    └──────────┘    └────┬─────┘
                         │                                │
                    ┌────┴────┐                          │
                    │         │                          ▼
                    ▼         ▼                   ┌──────────────┐
            ┌──────────┐  ┌──────────┐           │detalle_cortes│
            │ alumnos  │  │externos  │           └──────────────┘
            └──────────┘  └──────────┘


    ┌───────────────┐         ┌──────────────┐         ┌─────────┐
    │presentaciones │◄────────┤   insumos    │         │ tallas  │
    └───────────────┘         └──────┬───────┘         └────┬────┘
                                     │                      │
                                     │                      │
                                     │    ┌─────────────────┤
                                     │    │                 │
                                     ▼    ▼                 ▼
    ┌───────────────┐         ┌──────────────────┐    ┌────────┐
    │categorias_    │         │prenda_talla_     │    │ costos │
    │  prendas      │         │  insumos         │    └───┬────┘
    └───────┬───────┘         └──────────────────┘        │
            │                          │                   │
            │                          │                   ├──────┐
            ▼                          ▼                   │      │
      ┌─────────┐              ┌─────────┐                │      │
      │prendas  │──────────────┤         │                │      │
      └─────────┘              └─────────┘                ▼      ▼
                                                    ┌──────────────────┐
                                                    │detalle_pedidos   │
                                                    └──────────────────┘
```

---

## 📊 ANÁLISIS DE NORMALIZACIÓN

### ✅ Primera Forma Normal (1FN)
- ✅ Todas las columnas contienen valores atómicos
- ✅ No hay grupos repetitivos
- ✅ Cada columna tiene un nombre único
- ✅ El orden de las filas y columnas es irrelevante

### ✅ Segunda Forma Normal (2FN)
- ✅ Cumple 1FN
- ✅ No hay dependencias parciales de la clave primaria
- ✅ Todas las columnas no clave dependen completamente de la PK
- ✅ Tablas intermedias con claves compuestas correctamente diseñadas

**Ejemplo:**
- `costos`: `(talla_id, prenda_id)` → `precio_venta, stock`
- `prenda_talla_insumos`: `(prenda_id, talla_id, insumo_id)` → `cantidad`

### ✅ Tercera Forma Normal (3FN)
- ✅ Cumple 2FN
- ✅ No hay dependencias transitivas
- ✅ Todos los atributos no clave dependen directamente de la PK

**Separación de Conceptos:**
- ✅ `categorias_prendas` separada de `prendas`
- ✅ `presentaciones` separada de `insumos`
- ✅ `tallas` como catálogo independiente
- ✅ Clientes separados: `alumnos` vs `externos`

---

## 🎯 TIPOS DE RELACIONES

### 1️⃣ **Uno a Muchos (1:N)**
```
categorias_prendas ──1──< N──prendas
presentaciones ──1──< N──insumos
usuarios ──1──< N──pedidos
usuarios ──1──< N──movimientos
usuarios ──1──< N──cortes
alumnos ──1──< N──pedidos
externos ──1──< N──pedidos
pedidos ──1──< N──detalle_pedidos
cortes ──1──< N──detalle_cortes
```

### 2️⃣ **Muchos a Muchos (N:M) - Con Tabla Intermedia**

#### **prendas ↔ tallas** (a través de `costos`)
```
prendas ──N──< costos >──N──tallas
Tabla intermedia: costos
Datos adicionales: precio_venta, stock, stock_inicial
```

#### **prendas + tallas ↔ insumos** (a través de `prenda_talla_insumos`) ⭐
```
(prendas + tallas) ──N──< prenda_talla_insumos >──N──insumos
Tabla intermedia: prenda_talla_insumos
Datos adicionales: cantidad
Permite: Definir diferentes insumos y cantidades para cada talla de cada prenda
```

#### **cortes ↔ pedidos** (a través de `detalle_cortes`)
```
cortes ──N──< detalle_cortes >──N──pedidos
Tabla intermedia: detalle_cortes
```

### 3️⃣ **Relación Polimórfica**
```
pedidos puede tener:
├─ alumno_id → alumnos (clientes internos)
└─ externo_id → externos (clientes externos)

Controlado por: tipo_cliente ('alumno' | 'externo')
```

---

## 🔐 INTEGRIDAD REFERENCIAL

### 🗑️ **ON DELETE CASCADE** (Eliminar en cascada)
Cuando se elimina el padre, se eliminan los hijos automáticamente:

```
prendas → costos
tallas → costos
pedidos → detalle_pedidos
cortes → detalle_cortes
prendas → prenda_talla_insumos
tallas → prenda_talla_insumos
insumos → prenda_talla_insumos
```

### 🚫 **ON DELETE RESTRICT** (Restringir eliminación)
No permite eliminar el padre si tiene hijos:

```
costos ← detalle_pedidos
costos ← movimientos
pedidos ← detalle_cortes
presentaciones ← insumos
```

### 🔄 **ON DELETE SET NULL** (Establecer NULL)
Al eliminar el padre, establece NULL en los hijos:

```
categorias_prendas ← prendas
usuarios ← pedidos
usuarios ← movimientos
usuarios ← cortes
alumnos ← pedidos
externos ← pedidos
```

---

## 📈 ESTADÍSTICAS DEL SCHEMA

```
📊 Total de Tablas: 15
   ├─ Catálogos Base: 4 (usuarios, tallas, categorias_prendas, presentaciones)
   ├─ Productos: 3 (prendas, insumos, costos)
   ├─ Clientes: 2 (alumnos, externos)
   ├─ Ventas: 2 (pedidos, detalle_pedidos)
   ├─ Inventario: 1 (movimientos)
   ├─ Caja: 2 (cortes, detalle_cortes)
   └─ Relaciones: 1 (prenda_talla_insumos) ⭐

🔗 Total de Relaciones FK: 22
🔑 Claves Únicas: 8
✅ Constraints CHECK: 5
🔒 Políticas RLS: 15 (todas activas)
📊 Índices: 40+
```

---

## 🎓 CONCLUSIONES SOBRE NORMALIZACIÓN

### ✅ Ventajas del Diseño Actual:

1. **Sin Redundancia**: Los datos no se duplican innecesariamente
2. **Integridad**: Las relaciones FK garantizan consistencia
3. **Flexibilidad**: Fácil agregar nuevos catálogos o entidades
4. **Mantenibilidad**: Cambios en una tabla no afectan otras
5. **Escalabilidad**: Diseño permite crecimiento sin reestructuración

### 🎯 Características Destacadas:

1. **Tabla `prenda_talla_insumos`**: Permite costos precisos por talla
2. **Polimorfismo en pedidos**: Maneja alumnos y externos eficientemente  
3. **Separación de presentaciones**: Facilita gestión de unidades de medida
4. **Historial completo**: Timestamps en todas las tablas
5. **Soft Delete**: Campo `activo` permite desactivar sin eliminar

---

## 🔧 USO RECOMENDADO

### Para Consultas Complejas:

```sql
-- Obtener costo de fabricación de una prenda en una talla específica
SELECT 
    p.nombre as prenda,
    t.nombre as talla,
    i.nombre as insumo,
    pti.cantidad,
    pr.nombre as unidad_medida
FROM prenda_talla_insumos pti
JOIN prendas p ON pti.prenda_id = p.id
JOIN tallas t ON pti.talla_id = t.id
JOIN insumos i ON pti.insumo_id = i.id
JOIN presentaciones pr ON i.presentacion_id = pr.id
WHERE p.id = '{prenda_id}' AND t.id = '{talla_id}';
```

### Para Reportes:

```sql
-- Pedidos por alumno con detalle
SELECT 
    a.nombre,
    ped.created_at,
    p.nombre as prenda,
    t.nombre as talla,
    dp.cantidad,
    dp.subtotal
FROM pedidos ped
JOIN alumnos a ON ped.alumno_id = a.id
JOIN detalle_pedidos dp ON dp.pedido_id = ped.id
JOIN costos c ON dp.costo_id = c.id
JOIN prendas p ON c.prenda_id = p.id
JOIN tallas t ON c.talla_id = t.id
WHERE ped.tipo_cliente = 'alumno';
```

---

**📅 Última actualización:** 2026-01-09  
**🏫 Sistema:** Winston Churchill - Gestión de Uniformes  
**👨‍💻 Normalización:** 3FN (Tercera Forma Normal)
