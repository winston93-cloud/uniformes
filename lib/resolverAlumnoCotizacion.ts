/**
 * Resuelve el id a guardar en `cotizaciones.alumno_id` / `datos_fiscales_cliente.alumno_id`.
 * Fuente viva de alumnos: Winston Servicios (`alumno_id` numérico).
 */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function soloDigitos(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

export async function resolverAlumnoUuidParaCotizacion(
  legacyId: string,
  _referencia: string | undefined,
  _nombre: string
): Promise<string> {
  if (isUuid(legacyId)) return legacyId;
  if (soloDigitos(legacyId)) return legacyId.trim();
  throw new Error(
    'No se pudo vincular el alumno: falta id numérico de Winston Servicios. Vuelve a buscar y seleccionar el alumno.'
  );
}
