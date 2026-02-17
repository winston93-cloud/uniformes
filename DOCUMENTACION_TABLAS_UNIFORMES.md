# Descripción Detallada de Tablas - Sistema de Uniformes Winston Churchill

## Resumen general

El proyecto utiliza **PostgreSQL (Supabase)** con un esquema normalizado hasta la **3FN (Tercera Forma Normal)**. Existen **17 tablas principales** agrupadas en: catálogos base, productos/materiales, clientes, ventas, inventario, sucursales, cotizaciones, compras de insumos y devoluciones.

---

## 1. Tablas de catálogo base

### `usuarios`
Gestión de usuarios del sistema.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| nombre | VARCHAR(255) | Nombre |
| apellido_p, apellido_m | VARCHAR(255) | Apellidos |
| usuario | VARCHAR(100) UNIQUE | Usuario de login |
| password | TEXT | Contraseña |
| tipo | INTEGER | 1=Admin, 3=Operador, 5=Supervisor |
| email | VARCHAR(255) | Correo electrónico |
| activo | BOOLEAN | Activo/Inactivo |
| created_at, updated_at | TIMESTAMP | Auditoría |

**Relaciones:** Referenciada por pedidos, movimientos, cortes, cotizaciones, compras_insumos.

---

### `tallas`
Catálogo de tallas disponibles.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| nombre | VARCHAR(50) UNIQUE | Ej: XS, S, M, L, XL, 6, 8, 10 |
| orden | INTEGER | Orden de visualización |
| activo | BOOLEAN | Activo |
| created_at, updated_at | TIMESTAMP | Auditoría |

**Relaciones:** → costos, prenda_talla_insumos, detalle_transferencias, detalle_devoluciones.

---

### `categorias_prendas`
Categorías de prendas (Camisas, Pantalones, etc.).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| nombre | VARCHAR(100) UNIQUE | Nombre de categoría |
| activo | BOOLEAN | Activo |
| created_at, updated_at | TIMESTAMP | Auditoría |

**Relaciones:** ← prendas (N:1)

---

### `presentaciones`
Unidades de medida para insumos (Kilo, Metro, Bolsa, etc.).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| nombre | VARCHAR(100) UNIQUE | Nombre de presentación |
| descripcion | TEXT | Descripción |
| activo | BOOLEAN | Activo |
| created_at, updated_at | TIMESTAMP | Auditoría |

**Relaciones:** ← insumos (N:1)

---

## 2. Tablas de productos y materiales

### `prendas`
Catálogo de prendas (playeras, pantalones, etc.).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| nombre | VARCHAR(255) | Nombre de la prenda |
| codigo | VARCHAR(100) UNIQUE | Código de producto |
| descripcion | TEXT | Descripción |
| categoria_id | UUID (FK) | → categorias_prendas.id |
| activo | BOOLEAN | Activo |
| created_at, updated_at | TIMESTAMP | Auditoría |

**Relaciones:**
- ← categorias_prendas (N:1, ON DELETE SET NULL)
- → costos (1:N)
- → prenda_talla_insumos (1:N)
- → detalle_transferencias, detalle_devoluciones

---

### `insumos`
Catálogo de materiales/insumos para fabricación.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| codigo | VARCHAR(50) UNIQUE | Código del insumo |
| nombre | VARCHAR(255) | Nombre |
| descripcion | TEXT | Descripción |
| presentacion_id | UUID (FK) | → presentaciones.id |
| cantidad_por_presentacion | DECIMAL | Ej: 500 botones por bolsa |
| stock_minimo | DECIMAL | Umbral para alertas |
| activo | BOOLEAN | Activo |
| created_at, updated_at | TIMESTAMP | Auditoría |

**Relaciones:**
- ← presentaciones (N:1, RESTRICT)
- → prenda_talla_insumos (1:N)
- → compras_insumos (1:N)

---

### `costos`
Tabla intermedia: precio y stock por combinación prenda-talla-sucursal.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| talla_id | UUID (FK) | → tallas.id |
| prenda_id | UUID (FK) | → prendas.id |
| sucursal_id | UUID (FK) | → sucursales.id |
| precio_venta | DECIMAL(10,2) | Precio de venta principal |
| precio_compra | DECIMAL(10,2) | Costo de adquisición |
| precio_mayoreo | DECIMAL(10,2) | Precio mayoreo |
| precio_menudeo | DECIMAL(10,2) | Precio menudeo |
| stock_inicial | INTEGER | Stock inicial |
| stock | INTEGER (≥0) | Stock actual |
| cantidad_venta | INTEGER | Unidades vendidas |
| stock_minimo | INTEGER | Umbral para alertas |
| activo | BOOLEAN | Activo |
| created_at, updated_at | TIMESTAMP | Auditoría |

**Restricción:** UNIQUE(talla_id, prenda_id) por sucursal.

**Relaciones:**
- ← tallas (N:1, ON DELETE CASCADE)
- ← prendas (N:1, ON DELETE CASCADE)
- ← sucursales (N:1)
- → detalle_pedidos (1:N, RESTRICT)
- → movimientos (1:N, RESTRICT)
- → detalle_transferencias, detalle_cotizacion

---

### `prenda_talla_insumos`
Tabla intermedia: insumos necesarios por cada talla de cada prenda.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| prenda_id | UUID (FK) | → prendas.id |
| talla_id | UUID (FK) | → tallas.id |
| insumo_id | UUID (FK) | → insumos.id |
| cantidad | DECIMAL(10,2) | Cantidad requerida |
| created_at, updated_at | TIMESTAMP | Auditoría |

**Restricción:** UNIQUE(prenda_id, talla_id, insumo_id)

**Relaciones:**
- ← prendas (N:1, CASCADE)
- ← tallas (N:1, CASCADE)
- ← insumos (N:1, CASCADE)

---

## 3. Tablas de clientes

### `alumnos`
Alumnos de la institución (clientes internos).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| nombre | VARCHAR(255) | Nombre |
| referencia | VARCHAR(50) UNIQUE | Código único (auto-generado) |
| grado | VARCHAR(50) | Grado escolar |
| grupo | VARCHAR(10) | Grupo |
| telefono, email | VARCHAR | Contacto |
| activo | BOOLEAN | Activo |
| created_at, updated_at | TIMESTAMP | Auditoría |

**Relaciones:** → pedidos, cotizaciones

---

### `externos`
Clientes externos (no alumnos).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| nombre | VARCHAR(255) | Nombre |
| telefono, email | VARCHAR | Contacto |
| direccion | TEXT | Dirección |
| activo | BOOLEAN | Activo |
| created_at, updated_at | TIMESTAMP | Auditoría |

**Relaciones:** → pedidos, cotizaciones

---

## 4. Tablas de ventas y pedidos

### `pedidos`
Órdenes de venta.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| alumno_id | UUID (FK) | → alumnos.id (si tipo=alumno) |
| externo_id | UUID (FK) | → externos.id (si tipo=externo) |
| sucursal_id | UUID (FK) | → sucursales.id |
| tipo_cliente | VARCHAR(20) | 'alumno' \| 'externo' |
| estado | VARCHAR(20) | PEDIDO, ENTREGADO, LIQUIDADO, CANCELADO |
| subtotal, total | DECIMAL(10,2) | Montos |
| fecha_entrega, fecha_liquidacion | TIMESTAMP | Fechas |
| notas | TEXT | Notas |
| modalidad_pago | VARCHAR(20) | TOTAL \| ANTICIPO |
| efectivo_recibido | DECIMAL(10,2) | Efectivo recibido |
| cliente_nombre | VARCHAR(255) | Nombre del cliente |
| usuario_id | UUID (FK) | → usuarios.id |
| created_at, updated_at | TIMESTAMP | Auditoría |

**Relaciones:**
- ← alumnos (N:1, SET NULL)
- ← externos (N:1, SET NULL)
- ← sucursales (N:1)
- ← usuarios (N:1, SET NULL)
- → detalle_pedidos (1:N, CASCADE)
- → detalle_cortes (1:N, RESTRICT)
- → devoluciones (1:N)

---

### `detalle_pedidos`
Líneas/ítems de cada pedido.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| pedido_id | UUID (FK) | → pedidos.id |
| costo_id | UUID (FK) | → costos.id |
| prenda_id, talla_id | UUID (FK) | Referencias directas opcionales |
| cantidad | INTEGER (>0) | Cantidad |
| precio_unitario | DECIMAL(10,2) | Precio unitario |
| subtotal | DECIMAL(10,2) | Subtotal |
| especificaciones | TEXT | Detalles adicionales |
| pendiente | INTEGER (≥0) | Cantidad pendiente de entregar |
| created_at | TIMESTAMP | Auditoría |

**Relaciones:**
- ← pedidos (N:1, CASCADE)
- ← costos (N:1, RESTRICT)

---

## 5. Tabla de inventario

### `movimientos`
Movimientos de inventario (entradas, salidas, ajustes).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| tipo | VARCHAR(20) | ENTRADA \| SALIDA \| AJUSTE |
| costo_id | UUID (FK) | → costos.id |
| cantidad | INTEGER | + para entrada, - para salida |
| observaciones | TEXT | Observaciones |
| usuario_id | UUID (FK) | → usuarios.id |
| created_at | TIMESTAMP | Auditoría |

**Relaciones:**
- ← costos (N:1, RESTRICT)
- ← usuarios (N:1, SET NULL)

---

## 6. Tablas de caja

### `cortes`
Cortes de caja.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| fecha | TIMESTAMP | Fecha del corte |
| fecha_inicio, fecha_fin | DATE | Período |
| total_ventas | DECIMAL(10,2) | Total vendido |
| total_pedidos | INTEGER | Número de pedidos |
| usuario_id | UUID (FK) | → usuarios.id |
| activo | BOOLEAN | Activo |
| created_at, updated_at | TIMESTAMP | Auditoría |

**Relaciones:**
- ← usuarios (N:1, SET NULL)
- → detalle_cortes (1:N, CASCADE)

---

### `detalle_cortes`
Pedidos incluidos en cada corte.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| corte_id | UUID (FK) | → cortes.id |
| pedido_id | UUID (FK) | → pedidos.id |
| created_at | TIMESTAMP | Auditoría |

**Relaciones:**
- ← cortes (N:1, CASCADE)
- ← pedidos (N:1, RESTRICT)

---

## 7. Tablas de sucursales

### `sucursales`
Catálogo de sucursales.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| codigo | VARCHAR(20) UNIQUE | Código (ej: MAT-MAD) |
| nombre | VARCHAR(100) | Nombre |
| direccion | TEXT | Dirección |
| telefono | VARCHAR(20) | Teléfono |
| es_matriz | BOOLEAN | Si es sucursal matriz |
| activo | BOOLEAN | Activo |
| created_at, updated_at | TIMESTAMP | Auditoría |

**Relaciones:** ← costos, pedidos, transferencias, devoluciones

---

### `transferencias`
Transferencias entre sucursales.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| folio | VARCHAR(20) UNIQUE | Folio (ej: TRANS-2026-001) |
| sucursal_origen_id | UUID (FK) | → sucursales.id |
| sucursal_destino_id | UUID (FK) | → sucursales.id |
| usuario_id | SMALLINT (FK) | → usuario.usuario_id |
| fecha_transferencia | TIMESTAMP | Fecha |
| estado | VARCHAR(20) | PENDIENTE, EN_TRANSITO, RECIBIDA, CANCELADA |
| observaciones | TEXT | Observaciones |
| created_at, updated_at | TIMESTAMP | Auditoría |

**Restricción:** sucursal_origen_id ≠ sucursal_destino_id

**Relaciones:**
- ← sucursales (N:1)
- → detalle_transferencias (1:N, CASCADE)

---

### `detalle_transferencias`
Detalle de prendas transferidas.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| transferencia_id | UUID (FK) | → transferencias.id |
| prenda_id | UUID (FK) | → prendas.id |
| talla_id | UUID (FK) | → tallas.id |
| cantidad | INTEGER (>0) | Cantidad |
| costo_id | UUID (FK) | → costos.id |
| created_at | TIMESTAMP | Auditoría |

**Relaciones:**
- ← transferencias (N:1, CASCADE)
- ← prendas (N:1)
- ← tallas (N:1)
- ← costos (N:1)

---

## 8. Tablas de cotizaciones

### `cotizaciones`
Cotizaciones (sin afectar inventario).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| folio | VARCHAR(50) UNIQUE | Folio (ej: COT-YYYYMM-0001) |
| alumno_id | UUID (FK) | → alumnos.id |
| externo_id | UUID (FK) | → externos.id |
| tipo_cliente | VARCHAR(20) | 'alumno' \| 'externo' |
| fecha_cotizacion | DATE | Fecha |
| fecha_vigencia | DATE | Vigencia |
| subtotal, total | DECIMAL(10,2) | Montos |
| observaciones | TEXT | Observaciones |
| condiciones_pago | TEXT | Condiciones de pago |
| tiempo_entrega | VARCHAR(100) | Tiempo de entrega |
| pdf_url | TEXT | URL del PDF generado |
| estado | VARCHAR(20) | vigente, aceptada, rechazada, vencida |
| usuario_id | UUID (FK) | → usuarios.id |
| created_at, updated_at | TIMESTAMP | Auditoría |

**Restricción:** Debe tener alumno_id O externo_id (no ambos, no ninguno)

**Relaciones:**
- ← alumnos, externos (N:1, SET NULL)
- ← usuarios (N:1, SET NULL)
- → detalle_cotizacion (1:N, CASCADE)

---

### `detalle_cotizacion`
Partidas de cada cotización.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| cotizacion_id | UUID (FK) | → cotizaciones.id |
| prenda_nombre | VARCHAR(255) | Nombre de la prenda |
| talla | VARCHAR(50) | Talla |
| color | VARCHAR(100) | Color |
| especificaciones | TEXT | Detalles adicionales |
| cantidad | INTEGER (>0) | Cantidad |
| precio_unitario | DECIMAL(10,2) | Precio unitario |
| subtotal | DECIMAL(10,2) | Subtotal |
| orden | INTEGER | Orden de partidas |
| tipo_precio_usado | VARCHAR(10) | 'mayoreo' \| 'menudeo' |
| prenda_id | UUID (FK) | → prendas.id (opcional) |
| costo_id | UUID (FK) | → costos.id (opcional) |
| es_manual | BOOLEAN | Si es partida manual |
| created_at | TIMESTAMP | Auditoría |

**Relaciones:**
- ← cotizaciones (N:1, CASCADE)
- ← prendas, costos (opcionales)

---

## 9. Tabla de compras de insumos

### `compras_insumos`
Registro de compras de insumos.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| insumo_id | UUID (FK) | → insumos.id |
| cantidad_comprada | DECIMAL(10,2) | Cantidad |
| costo_unitario, costo_total | DECIMAL(10,2) | Costos |
| proveedor | VARCHAR(255) | Proveedor |
| fecha_compra | DATE | Fecha |
| notas | TEXT | Notas |
| usuario_id | UUID (FK) | → usuarios.id |
| created_at, updated_at | TIMESTAMP | Auditoría |

**Relaciones:**
- ← insumos (N:1, CASCADE)
- ← usuarios (N:1, SET NULL)

---

## 10. Tablas de devoluciones

### `devoluciones`
Registro de devoluciones de pedidos.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| folio | SERIAL UNIQUE | Folio |
| pedido_id | UUID (FK) | → pedidos.id |
| sucursal_id | UUID (FK) | → sucursales.id |
| usuario_id | SMALLINT (FK) | → usuario.usuario_id |
| tipo_devolucion | VARCHAR(20) | COMPLETA, PARCIAL, CAMBIO_TALLA, CAMBIO_PRENDA |
| motivo | VARCHAR(100) | Motivo |
| observaciones | TEXT | Observaciones |
| total_devolucion | DECIMAL(10,2) | Monto devuelto |
| reembolso_aplicado | BOOLEAN | Si se hizo reembolso |
| monto_reembolsado | DECIMAL(10,2) | Monto reembolsado |
| estado | VARCHAR(20) | PENDIENTE, PROCESADA, CANCELADA |
| created_at, updated_at | TIMESTAMP | Auditoría |

**Relaciones:**
- ← pedidos (N:1, CASCADE)
- ← sucursales (N:1)
- → detalle_devoluciones (1:N, CASCADE)

---

### `detalle_devoluciones`
Detalle de artículos devueltos.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | Identificador único |
| devolucion_id | UUID (FK) | → devoluciones.id |
| detalle_pedido_id | UUID | Referencia al detalle original |
| prenda_id, talla_id | UUID (FK) | Artículo devuelto |
| cantidad_devuelta | INTEGER (>0) | Cantidad |
| precio_unitario, subtotal | DECIMAL(10,2) | Montos |
| es_cambio | BOOLEAN | Si es cambio (no devolución pura) |
| prenda_cambio_id, talla_cambio_id | UUID (FK) | Nuevo artículo (si es cambio) |
| cantidad_cambio, precio_cambio | - | Datos del cambio |
| observaciones_detalle | TEXT | Detalles |
| created_at | TIMESTAMP | Auditoría |

**Relaciones:**
- ← devoluciones (N:1, CASCADE)
- ← prendas (N:1)

---

## Diagrama de relaciones (resumen)

```
usuarios ──┬── pedidos ──┬── detalle_pedidos ── costos ──┬── tallas
           │             │                               └── prendas ── categorias_prendas
           │             └── devoluciones ── detalle_devoluciones
           ├── movimientos ── costos
           ├── cortes ── detalle_cortes ── pedidos
           ├── cotizaciones ── detalle_cotizacion
           └── compras_insumos ── insumos ── presentaciones

alumnos ───┴── pedidos
externos ──┴── pedidos

sucursales ──┬── costos
             ├── pedidos
             ├── transferencias ── detalle_transferencias ── prendas, tallas, costos
             └── devoluciones

prenda_talla_insumos: prendas + tallas + insumos (N:M:M)
```

---

## Nota sobre inconsistencia de usuarios

Existen referencias a **dos tablas de usuarios diferentes**:
- **`usuarios`** (schema principal): UUID, usada en pedidos, movimientos, cortes, cotizaciones, compras_insumos.
- **`usuario`** (legacy?): SMALLINT usuario_id, referenciada en devoluciones y transferencias.

Puede existir inconsistencia en el proyecto; conviene unificar o documentar la relación entre ambas.

---

**Última actualización:** 2026-01-31  
**Sistema:** Winston Churchill - Gestión de Uniformes  
**Base de datos:** PostgreSQL (Supabase)
