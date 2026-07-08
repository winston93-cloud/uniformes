import { createClient, type InsForgeClient } from '@insforge/sdk';

/**
 * Cliente InsForge del proyecto **Winston Servicios** (tabla `alumno`).
 * Solo server-side (API routes). No mezclar con el proyecto Uniformes.
 *
 * Env:
 * - NEXT_PUBLIC_INSFORGE_ALUMNOS_URL / INSFORGE_ALUMNOS_URL
 * - INSFORGE_ALUMNOS_API_KEY / INSFORGE_ALUMNOS_ADMIN_TOKEN / NEXT_PUBLIC_INSFORGE_ALUMNOS_ANON_KEY
 */
function resolveAlumnosBaseUrl(): string | undefined {
  return (
    process.env.INSFORGE_ALUMNOS_URL ??
    process.env.NEXT_PUBLIC_INSFORGE_ALUMNOS_URL ??
    undefined
  );
}

function resolveAlumnosAuthToken(): string | undefined {
  return (
    process.env.INSFORGE_ALUMNOS_API_KEY ??
    process.env.INSFORGE_ALUMNOS_ADMIN_TOKEN ??
    process.env.NEXT_PUBLIC_INSFORGE_ALUMNOS_ANON_KEY ??
    undefined
  );
}

export function alumnosInsforgeConfigured(): boolean {
  return Boolean(resolveAlumnosBaseUrl() && resolveAlumnosAuthToken());
}

export function assertAlumnosInsforgeConfigured() {
  if (!alumnosInsforgeConfigured()) {
    throw new Error(
      'Faltan variables de InsForge Alumnos (Winston Servicios). Configura NEXT_PUBLIC_INSFORGE_ALUMNOS_URL e INSFORGE_ALUMNOS_API_KEY.'
    );
  }
}

/** Cliente fresco por invocación (lee env en runtime). */
export function getInsforgeAlumnos(): InsForgeClient {
  assertAlumnosInsforgeConfigured();
  return createClient({
    baseUrl: resolveAlumnosBaseUrl()!,
    anonKey: resolveAlumnosAuthToken()!,
  });
}
