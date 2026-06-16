import { createClient, type InsForgeClient } from '@insforge/sdk';

// Cliente InsForge para uso SOLO en backend (API routes).
// Las variables deben existir en runtime (local y/o Vercel):
// - NEXT_PUBLIC_INSFORGE_URL
// - NEXT_PUBLIC_INSFORGE_ANON_KEY o INSFORGE_ADMIN_TOKEN

function resolveInsforgeBaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_INSFORGE_URL ?? process.env.INSFORGE_URL;
}

/** Token en runtime: admin (ik_) o anon. No leer env al importar el módulo (build de Vercel). */
function resolveInsforgeAuthToken(): string | undefined {
  return (
    process.env.INSFORGE_ADMIN_TOKEN ??
    process.env.INSFORGE_API_KEY ??
    process.env.NEXT_PUBLIC_INSFORGE_ADMIN_TOKEN ??
    process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ??
    process.env.INSFORGE_ANON_KEY
  );
}

export function assertInsforgeConfigured() {
  if (!resolveInsforgeBaseUrl() || !resolveInsforgeAuthToken()) {
    throw new Error(
      'Faltan variables de entorno de InsForge. Configura NEXT_PUBLIC_INSFORGE_URL y NEXT_PUBLIC_INSFORGE_ANON_KEY (o INSFORGE_ADMIN_TOKEN / INSFORGE_API_KEY).'
    );
  }
}

/** Cliente fresco por invocación serverless (lee env en runtime, no en build). */
export function getInsforge(): InsForgeClient {
  const baseUrl = resolveInsforgeBaseUrl();
  const anonKey = resolveInsforgeAuthToken();
  return createClient({
    baseUrl: baseUrl || 'https://placeholder.supabase.co',
    anonKey,
  });
}

/** Compatibilidad con imports existentes: delega a getInsforge() en cada acceso. */
export const insforge: InsForgeClient = new Proxy({} as InsForgeClient, {
  get(_target, prop) {
    const client = getInsforge();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});
