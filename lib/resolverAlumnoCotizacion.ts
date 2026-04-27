import { supabase } from '@/lib/supabase';

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function soloDigitos(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

/**
 * Resuelve el id a guardar en `cotizaciones.alumno_id`.
 * - UUID: se devuelve tal cual (si tu FK sigue siendo UUID).
 * - Numérico (id legado): se devuelve como string.
 * - Otro: busca o crea fila en `alumno` por `alumno_ref`.
 */
export async function resolverAlumnoUuidParaCotizacion(
  legacyId: string,
  referencia: string | undefined,
  nombre: string
): Promise<string> {
  if (isUuid(legacyId)) return legacyId;

  if (soloDigitos(legacyId)) {
    return legacyId.trim();
  }

  const ref = referencia?.trim();
  if (!ref) {
    throw new Error(
      'El alumno no tiene referencia escolar; no se puede vincular a cotizaciones. Usa un alumno con referencia o da de alta el alumno en la tabla alumno.'
    );
  }

  const { data: row, error } = await supabase
    .from('alumno')
    .upsert(
      {
        alumno_ref: ref,
        alumno_nombre_completo: nombre?.trim() || 'Alumno',
        alumno_status: 1,
      },
      { onConflict: 'alumno_ref' }
    )
    .select('alumno_id')
    .single();

  if (error) throw error;
  return String((row as { alumno_id: number | string }).alumno_id);
}
