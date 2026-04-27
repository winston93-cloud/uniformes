# InsForge: migración y entorno (no es el runtime de la app)

## Runtime de la app (producción)

La UI y los hooks usan **solo** el cliente en `lib/supabase.ts` → **Supabase** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

No hace falta `NEXT_PUBLIC_DATABASE_PROVIDER` ni `NEXT_PUBLIC_INSFORGE_*` para que pedidos, prendas, etc. funcionen contra tu proyecto Supabase.

## InsForge en este repo

- **`lib/insforge.ts`** y rutas **`/api/migracion/*`**: cliente InsForge para copiar datos, DDL, wipe, sync, etc.
- Variables típicas solo si usas esa herramienta: `NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY`, `INSFORGE_ADMIN_TOKEN`.
- **`SUPABASE_SERVICE_ROLE_KEY`** + **`NEXT_PUBLIC_SUPABASE_URL`**: servidor para leer Supabase como **origen** durante migraciones.

## Histórico

Antes existía un conmutador (`NEXT_PUBLIC_DATABASE_PROVIDER=insforge`) que enviaba el cliente “público” de la app a InsForge; se **retiró**: la app quedó explícitamente en Supabase para evitar cortar dualidad en producción.
