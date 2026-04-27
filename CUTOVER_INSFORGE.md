# Cutover: app → InsForge

## Qué ya hace el código

`lib/supabase.ts` exporta el mismo `supabase` que usan hooks y páginas. Si en Vercel define:

- `NEXT_PUBLIC_DATABASE_PROVIDER=insforge` (o `NEXT_PUBLIC_USE_INSFORGE=true`)

entonces **`.from()` y `.rpc()`** van al **PostgREST de InsForge**.  
**Storage** usa el SDK de InsForge con un adaptador compatible (upload / remove / URL pública).

## Tu checklist en Vercel (producción)

1. **InsForge (públicas, van al bundle del cliente)**  
   - `NEXT_PUBLIC_INSFORGE_URL` — host API del proyecto (ej. `https://xxx.us-east.insforge.app`).  
   - `NEXT_PUBLIC_INSFORGE_ANON_KEY` — anon key del proyecto InsForge.

2. **Activar el conmutador**  
   - `NEXT_PUBLIC_DATABASE_PROVIDER=insforge`

3. **Supabase solo donde sigue haciendo falta**  
   - **Migración / sync:** la app sigue leyendo **Supabase como origen** con `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` (servidor). No quites eso hasta que dejes de usar `/migracion` contra ese proyecto.  
   - Si **ya no** necesitas la UI de migración contra Supabase, puedes retirar las vars públicas de Supabase del cliente y dejar solo las del servidor (evaluar por entorno).

4. **Admin InsForge** (ya lo usas para migraciones):  
   - `INSFORGE_ADMIN_TOKEN` — sin cambiar.

5. **Redeploy** del proyecto en Vercel tras guardar variables.

## Verificación rápida

- Abre la app (pedidos, insumos, etc.): deben cargar datos desde **InsForge**.  
- RPC (`crear_pedido_atomico`, etc.) deben existir en la **misma base InsForge** donde migraste (funciones Postgres).  
- Storage: si el bucket es **privado**, las URLs públicas pueden fallar; ajusta políticas o bucket en InsForge.

## Rollback

Quita `NEXT_PUBLIC_DATABASE_PROVIDER` o pon `supabase` y redeploy; la app vuelve al cliente Supabase.
