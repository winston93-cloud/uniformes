import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient as createInsforgeClient } from '@insforge/sdk';

/** PostgrestError no es instancia de Error; usar esto en catch de llamadas a Supabase / InsForge DB. */
export function getSupabaseErrorMessage(err: unknown): string {
  if (err === null || err === undefined) return 'Error desconocido';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const o = err as Record<string, unknown>;
    const parts = [o.message, o.details, o.hint].filter((x) => typeof x === 'string' && (x as string).length) as string[];
    if (parts.length) return parts.join(' — ');
  }
  if (err instanceof Error) return err.message;
  return 'Error desconocido';
}

function looksLikeJwt(token: string) {
  return token.split('.').length === 3;
}

function useInsforgeAsPrimaryDb(): boolean {
  const p = process.env.NEXT_PUBLIC_DATABASE_PROVIDER?.trim().toLowerCase();
  return p === 'insforge' || process.env.NEXT_PUBLIC_USE_INSFORGE === 'true';
}

/**
 * Cliente compatible con `import { supabase } from '@/lib/supabase'`:
 * - `.from()` / `.rpc()` → InsForge Database (PostgREST)
 * - `.storage` → adaptador sobre InsForge Storage (upload/remove/createSignedUrl vía URL pública)
 */
function createInsforgeBrowserClient() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL ?? process.env.INSFORGE_URL ?? '';
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ?? process.env.INSFORGE_ANON_KEY ?? '';

  if (typeof window !== 'undefined' && useInsforgeAsPrimaryDb()) {
    if (!baseUrl || !anonKey) {
      console.error('[DB] DATABASE_PROVIDER=insforge pero faltan NEXT_PUBLIC_INSFORGE_URL / NEXT_PUBLIC_INSFORGE_ANON_KEY');
    }
  }

  const client = createInsforgeClient({
    baseUrl: baseUrl || 'https://placeholder.supabase.co',
    anonKey: anonKey && looksLikeJwt(anonKey) ? anonKey : undefined,
  });

  const storageWrapper = {
    from(bucketName: string) {
      const bucket = client.storage.from(bucketName);
      return {
        async upload(path: string, file: File | Blob, options?: { contentType?: string; upsert?: boolean }) {
          void options?.upsert;
          const fileArg =
            file instanceof File
              ? file
              : new File([file], path.split('/').pop() || 'blob', {
                  type: options?.contentType || 'application/octet-stream',
                });
          const r = await bucket.upload(path, fileArg);
          return {
            data: r.data ? { path } : null,
            error: r.error ? ({ message: getSupabaseErrorMessage(r.error), name: 'StorageApiError' } as const) : null,
          };
        },
        async remove(paths: string[]) {
          let lastErr: { message: string } | null = null;
          for (const p of paths) {
            const r = await bucket.remove(p);
            if (r.error) lastErr = { message: getSupabaseErrorMessage(r.error) };
          }
          return { data: null, error: lastErr };
        },
        async createSignedUrl(pathRelativo: string, _expiresIn: number) {
          try {
            const url = bucket.getPublicUrl(pathRelativo);
            return { data: { signedUrl: url, path: pathRelativo }, error: null };
          } catch (e: unknown) {
            return { data: null, error: { message: getSupabaseErrorMessage(e) } as { message: string } };
          }
        },
      };
    },
  };

  return {
    from: (table: string) => client.database.from(table),
    rpc: (fn: string, args?: Record<string, unknown>, opts?: Parameters<typeof client.database.rpc>[2]) =>
      client.database.rpc(fn, args, opts),
    storage: storageWrapper,
  };
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!useInsforgeAsPrimaryDb() && (!supabaseUrl || !supabaseAnonKey)) {
  console.error('Missing Supabase environment variables');
}

/** Cliente de datos para la app (hooks, componentes cliente y rutas que importan `@/lib/supabase`). */
export const supabase = (
  useInsforgeAsPrimaryDb()
    ? (createInsforgeBrowserClient() as unknown as SupabaseClient)
    : createSupabaseClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-key')
) as SupabaseClient;
