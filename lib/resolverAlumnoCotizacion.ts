import { supabase } from '@/lib/supabase';

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

/** Si `alumno_id` no es UUID, resolvemos por referencia en la tabla `alumno`. */
export async function resolverAlumnoUuidParaCotizacion(
  legacyId: string,
  referencia: string | undefined,
  nombre: string
): Promise<string> {
  if (isUuid(legacyId)) return legacyId;

  const ref = referencia?.trim();
  if (!ref) {
    throw new Error(
      'El alumno no tiene referencia escolar; no se puede vincular a cotizaciones. Usa un alumno con referencia o da de alta el alumno en la tabla alumno.'
    );
  }

  const { data: row, error } = await supabase
    .from('alumno')
    .upsert(
      { nombre: nombre?.trim() || 'Alumno', referencia: ref, activo: true },
      { onConflict: 'referencia' }
    )
    .select('id')
    .single();

  if (error) throw error;
  return row!.id as string;
}
