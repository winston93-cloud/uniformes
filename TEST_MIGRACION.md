# PoC — Three Man Team (migración conceptual a InsForge)

Documento de demostración: no sustituye el esquema real del proyecto; describe cómo **prendas** e **insumos** podrían modelarse en InsForge y qué riesgos de seguridad implica.

---

## [Architect] — Relación lógica entre prendas e insumos en InsForge

En InsForge (base Postgres + API estilo PostgREST) el vínculo entre **catálogo de prendas** y **catálogo de insumos** no debe ser directo muchos-a-muchos en la tabla `prendas`, porque la receta real suele depender de **talla** (o de otra variante). El modelo recomendado es:

1. **`prendas`** — Identidad del producto terminado (nombre, código, metadatos). Sin lista embebida de insumos.
2. **`tallas`** (o equivalente) — Variantes de talla reutilizables o por prenda, según el dominio.
3. **`insumos`** — Materiales con unidades de medida, costos de referencia y metadatos; inventario puede vivir aquí o en tablas hijas (p. ej. stock por ubicación).
4. **`prenda_talla_insumos`** (tabla de unión con payload) — Filas que dicen: *para esta `prenda_id` y esta `talla_id`, el insumo `insumo_id` consume `cantidad` (en la unidad del insumo)*. Es la **receta por talla**; evita duplicar la misma relación en documentos JSON opacos y permite consultas y restricciones SQL.

**Reglas de integridad lógica:**

- Clave única compuesta o única lógica `(prenda_id, talla_id, insumo_id)` para no duplicar la misma línea de receta.
- `insumo_id` y `prenda_id` / `talla_id` con **FK** a sus tablas; borrado en cascada o `RESTRICT` según política de negocio (PoC: `ON DELETE CASCADE` en la unión solo si se acepta borrar recetas al borrar prenda/talla).
- Opcional: **vistas** o columnas generadas en InsForge para “insumos por prenda” agregando todas las tallas, sin duplicar datos.

**Separación de concerns:** el inventario físico de insumos (`stock`, ubicaciones) conviene mantenerlo en **insumos** / tablas de stock; la tabla de unión solo guarda **coeficientes de consumo**, no cantidades en almacén.

---

## [Builder] — Ejemplo SQL para crear las tablas (Postgres)

```sql
-- Catálogo de insumos
CREATE TABLE public.insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  nombre text NOT NULL,
  unidad_medida text NOT NULL DEFAULT 'unidades',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT insumos_codigo_unique UNIQUE (codigo)
);

-- Catálogo de prendas
CREATE TABLE public.prendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prendas_codigo_unique UNIQUE (codigo)
);

-- Tallas (ejemplo mínimo; en producción podría ligarse a un catálogo global)
CREATE TABLE public.tallas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  CONSTRAINT tallas_nombre_unique UNIQUE (nombre)
);

-- Receta: insumos necesarios por prenda y talla
CREATE TABLE public.prenda_talla_insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prenda_id uuid NOT NULL REFERENCES public.prendas (id) ON DELETE CASCADE,
  talla_id uuid NOT NULL REFERENCES public.tallas (id) ON DELETE CASCADE,
  insumo_id uuid NOT NULL REFERENCES public.insumos (id) ON DELETE RESTRICT,
  cantidad numeric(14, 4) NOT NULL CHECK (cantidad > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prenda_talla_insumos_receta_unique UNIQUE (prenda_id, talla_id, insumo_id)
);

CREATE INDEX idx_prenda_talla_insumos_prenda ON public.prenda_talla_insumos (prenda_id);
CREATE INDEX idx_prenda_talla_insumos_talla ON public.prenda_talla_insumos (talla_id);
CREATE INDEX idx_prenda_talla_insumos_insumo ON public.prenda_talla_insumos (insumo_id);
```

---

## [Reviewer] — Crítica de seguridad

**Sobre el modelo (Architect):** Separar receta (`prenda_talla_insumos`) del stock es sólido para evitar mezclar “cuánto se gasta en una unidad de prenda” con “cuánto hay en bodega”. El riesgo no es de seguridad sino de **ambigüedad operativa**: si en InsForge se exponen ambas cosas por API anónima, un cliente malicioso podría **leer** recetas e inventario sin control; eso se mitiga con **RLS** y roles, no con el diagrama lógico en sí.

**Sobre el SQL (Builder):** El script crea tablas con `UNIQUE` y `CHECK`, lo cual reduce datos corruptos, pero **no habilita RLS ni revoca permisos por defecto**. En Supabase/InsForge, tablas en `public` con políticas permisivas (o sin RLS) equivalen a **lectura/escritura masiva** para cualquier clave que cumpla el contrato de la API. Falta explícitamente:

- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` y políticas por rol (p. ej. solo staff inserta en `prenda_talla_insumos`).
- Revisión de **GRANT** (quién puede `INSERT`/`UPDATE`/`DELETE` en `insumos` frente a usuarios finales).
- Considerar **service role** solo en backend para operaciones sensibles (ajuste de stock), nunca en el navegador.

**Cascadas:** `ON DELETE CASCADE` desde `prendas` hacia la receta borra datos de forma silenciosa; no es vulnerabilidad clásica, pero sí **riesgo de pérdida de datos** si un usuario con permiso de borrado elimina una prenda por error. Valorar `RESTRICT` o borrado lógico (`activo = false`).

**Resumen:** La PoC es válida como esquema relacional; **no está lista para producción** sin capa de autorización (RLS + políticas) alineada al modelo de amenazas de InsForge y sin auditar qué operaciones quedan expuestas en el cliente.
