import { supabase } from '@/lib/supabase';
import type { DatosFiscalesCliente } from '@/lib/types';
import { isUuid, resolverAlumnoUuidParaCotizacion } from '@/lib/resolverAlumnoCotizacion';

/**
 * Registro fiscal del receptor (tabla `datos_fiscales_cliente`) para armar el PDF de cotización.
 * RFC y código postal vienen de ahí cuando existen; teléfono no está en esa tabla (sigue en alumno/externo).
 */
export async function obtenerDatosFiscalesClienteParaPdf(
  tipoCliente: 'alumno' | 'externo',
  cliente: Record<string, unknown> | null | undefined
): Promise<DatosFiscalesCliente | null> {
  if (!cliente) return null;
  try {
    let alumnoUuid: string | null = null;
    let externoUuid: string | null = null;
    if (tipoCliente === 'externo') {
      const id = String((cliente as { id?: string }).id || '');
      if (!isUuid(id)) return null;
      externoUuid = id;
    } else {
      const legacyId = String((cliente as { id?: string }).id || '');
      const ref = String(
        (cliente as { referencia?: string }).referencia || (cliente as { alumno_ref?: string }).alumno_ref || ''
      );
      const nombre = String((cliente as { nombre?: string }).nombre || '');
      alumnoUuid = await resolverAlumnoUuidParaCotizacion(legacyId, ref, nombre);
    }
    const col = alumnoUuid ? 'alumno_id' : 'externo_id';
    const fk = alumnoUuid || externoUuid;
    const { data, error } = await supabase
      .from('datos_fiscales_cliente')
      .select('*')
      .eq(col, fk!)
      .maybeSingle();
    if (error) return null;
    return (data as DatosFiscalesCliente) ?? null;
  } catch {
    return null;
  }
}

/** Domicilio / RFC / teléfono para el bloque izquierdo del PDF. */
export function datosClientePdfDesdeFiscalesYContacto(
  cliente: Record<string, unknown> | null | undefined,
  fiscales: DatosFiscalesCliente | null
): { domicilio: string; rfc: string; telefono: string } {
  const tel = String((cliente?.telefono as string) || (cliente?.tel as string) || '').trim();
  if (!fiscales) {
    return {
      domicilio: String(cliente?.domicilio || cliente?.direccion || cliente?.domicilio_fiscal || '').trim(),
      rfc: String(cliente?.rfc || '').trim(),
      telefono: tel,
    };
  }
  const dir = String(cliente?.domicilio || cliente?.direccion || cliente?.domicilio_fiscal || '').trim();
  const cpLine = `C.P. ${String(fiscales.codigo_postal).trim()}`;
  const domicilio = dir ? `${dir}\n${cpLine}` : cpLine;
  return {
    domicilio,
    rfc: String(fiscales.rfc || '').trim(),
    telefono: tel,
  };
}
