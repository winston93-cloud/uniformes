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

function looksLikeJwt(token: string) {
  // JWT suele venir como: header.payload.signature (3 partes separadas por '.')
  return token.split('.').length === 3;
}

export const insforge = createClient({
  baseUrl: insforgeUrl || 'https://placeholder.supabase.co',
  // Si el token NO parece JWT (por ejemplo empieza con `ik_`), el SDK podría
  // intentar decodificarlo como JWT y fallar. Como en nuestro caso las policies
  // son `public`, intentamos operar sin Authorization.
  anonKey: insforgeAnonKey && looksLikeJwt(insforgeAnonKey) ? insforgeAnonKey : undefined,
});

