import { createClient } from '@insforge/sdk';

// Cliente InsForge para uso SOLO en backend (API routes).
// Las variables deben existir en runtime (local y/o Vercel):
// - NEXT_PUBLIC_INSFORGE_URL
// - NEXT_PUBLIC_INSFORGE_ANON_KEY

// Soportamos nombres alternativos por si Vercel/entornos los configuran distinto.
const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL ?? process.env.INSFORGE_URL;
const insforgeAnonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ?? process.env.INSFORGE_ANON_KEY;

export function assertInsforgeConfigured() {
  if (!insforgeUrl || !insforgeAnonKey) {
    throw new Error(
      'Faltan variables de entorno de InsForge. Configura NEXT_PUBLIC_INSFORGE_URL y NEXT_PUBLIC_INSFORGE_ANON_KEY (o INSFORGE_URL/INSFORGE_ANON_KEY).'
    );
  }
}

export const insforge = createClient({
  baseUrl: insforgeUrl || 'https://placeholder.supabase.co',
  anonKey: insforgeAnonKey || 'placeholder-key',
});

