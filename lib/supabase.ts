import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  // Durante el build, usamos valores dummy para evitar errores
  // En runtime del cliente, esto causará errores apropiados
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

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

