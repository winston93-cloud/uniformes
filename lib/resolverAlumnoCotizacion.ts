import { insforgeDb } from '@/lib/insforgeBrowser';

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function soloDigitos(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

/**
 * Resuelve el id a guardar en `cotizaciones.alumno_id` / `datos_fiscales_cliente.alumno_id`.
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

  const { data: row, error } = await insforgeDb()
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
