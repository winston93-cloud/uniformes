# InsForge: migración y entorno (no es el runtime de la app)

## Runtime de la app (producción)

La UI y los hooks usan **solo** el cliente en `lib/supabase.ts` → **Supabase** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

No hace falta `NEXT_PUBLIC_DATABASE_PROVIDER` ni `NEXT_PUBLIC_INSFORGE_*` para que pedidos, prendas, etc. funcionen contra tu proyecto Supabase.

## Producción semanal y gastos fijos semanales (sigue en InsForge)

Esas rutas **no** usan `lib/supabase.ts` para guardar el plan: importan **`insforge`** desde **`lib/insforge.ts`** y escriben en InsForge (`produccion_plan_semanal`, `produccion_plan_semanal_items`, `semanas`, tablas de gastos fijos, etc.). El rollback del cliente “general” a Supabase **no cambió** ese diseño.

En Vercel, para que producción semanal siga funcionando hace falta **`NEXT_PUBLIC_INSFORGE_URL`** y **`NEXT_PUBLIC_INSFORGE_ANON_KEY`** (las mismas que usa `lib/insforge.ts`). Opcionalmente `assertInsforgeConfigured()` en servidor.

La ruta **`POST /api/produccion-semanal/plan`** además lee **`detalle_cotizacion`** con **`supabase`** (`lib/supabase.ts`) solo para **validar cantidades** contra cotizaciones que siguen en Supabase; el guardado del plan sigue siendo por **`insforge.database`**.

## InsForge en este repo

- **`lib/insforge.ts`** y rutas **`/api/migracion/*`**: cliente InsForge para copiar datos, DDL, wipe, sync, etc.
- Variables típicas solo si usas esa herramienta: `NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY`, `INSFORGE_ADMIN_TOKEN`.
- **`SUPABASE_SERVICE_ROLE_KEY`** + **`NEXT_PUBLIC_SUPABASE_URL`**: servidor para leer Supabase como **origen** durante migraciones.

## Histórico

Antes existía un conmutador (`NEXT_PUBLIC_DATABASE_PROVIDER=insforge`) que enviaba el cliente “público” de la app a InsForge; se **retiró**: la app quedó explícitamente en Supabase para evitar cortar dualidad en producción.
