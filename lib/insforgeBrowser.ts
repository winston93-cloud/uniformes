import { createClient, type InsForgeClient } from '@insforge/sdk';

/**
 * Cliente InsForge en el navegador (NEXT_PUBLIC_*).
 * Usar en hooks de bloques ya cortados a InsForge (p. ej. Bloque 1: usuarios, ciclos).
 */
const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL ?? '';
const anonKey =
  process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ??
  process.env.NEXT_PUBLIC_INSFORGE_ADMIN_TOKEN ??
  '';

if (!baseUrl || !anonKey) {
  console.error('Missing InsForge browser environment variables');
}

export const insforgeBrowser: InsForgeClient = createClient({
  baseUrl: baseUrl || 'https://placeholder.supabase.co',
  anonKey: anonKey || 'placeholder-key',
});

/** Acceso tablas PostgREST (misma forma que `insforge.database` en server). */
export function insforgeDb() {
  return insforgeBrowser.database;
}

/** Cliente con `.from` / `.rpc` para Bloque 3 (inventario maestro). */
export type Block3Database = ReturnType<typeof insforgeDb>;
