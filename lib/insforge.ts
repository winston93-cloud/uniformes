import { createClient } from '@insforge/sdk';

// Cliente InsForge para uso SOLO en backend (API routes).
// Las variables deben existir en runtime (local y/o Vercel):
// - NEXT_PUBLIC_INSFORGE_URL
// - NEXT_PUBLIC_INSFORGE_ANON_KEY

// Soportamos nombres alternativos por si Vercel/entornos los configuran distinto.
const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL ?? process.env.INSFORGE_URL;
const insforgeAnonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ?? process.env.INSFORGE_ANON_KEY;
const insforgeAdminKey =
  process.env.INSFORGE_ADMIN_TOKEN ??
  process.env.INSFORGE_API_KEY ??
  process.env.NEXT_PUBLIC_INSFORGE_ADMIN_TOKEN;

/** Token para API routes: admin (ik_) o anon JWT. InsForge exige Authorization en todas las peticiones. */
function resolveInsforgeAuthToken(): string | undefined {
  return insforgeAdminKey || insforgeAnonKey || undefined;
}

export function assertInsforgeConfigured() {
  if (!insforgeUrl || !resolveInsforgeAuthToken()) {
    throw new Error(
      'Faltan variables de entorno de InsForge. Configura NEXT_PUBLIC_INSFORGE_URL y NEXT_PUBLIC_INSFORGE_ANON_KEY (o INSFORGE_ADMIN_TOKEN / INSFORGE_API_KEY).'
    );
  }
}

export const insforge = createClient({
  baseUrl: insforgeUrl || 'https://placeholder.supabase.co',
  // ik_ (API key) o JWT anon: el SDK lo envía como Bearer en cada request.
  anonKey: resolveInsforgeAuthToken(),
});

