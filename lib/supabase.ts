import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** PostgrestError no es instancia de Error; usar esto en catch de llamadas a Supabase. */
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

/**
 * Cliente Supabase para la app (hooks, componentes cliente, rutas que importan `@/lib/supabase`).
 * La migración a InsForge usa clientes separados en `lib/insforge.ts` y APIs `/api/migracion/*`.
 */
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
) as SupabaseClient;
