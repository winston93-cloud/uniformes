/**
 * InsForge puede tener tablas sin columna sucursal_id (migración incompleta).
 * No usar `.eq('sucursal_id', …)` en PostgREST en ese caso → filtrar en cliente.
 *
 * Si ningún registro tiene sucursal_id definido (columna ausente o todos null),
 * devolvemos todas las filas (compatible matriz única).
 */
export function filtrarFilasPorSucursalSiHayColumna<T extends Record<string, unknown>>(
  rows: T[],
  sucursalSesion?: string | null
): T[] {
  if (!sucursalSesion?.trim() || rows.length === 0) return rows;

  const algunoDefinido = rows.some((r) => r.sucursal_id != null || r.sucursalId != null);
  if (!algunoDefinido) return rows;

  const sid = sucursalSesion.trim().toLowerCase();
  return rows.filter((r) => {
    const raw = r.sucursal_id ?? r.sucursalId;
    if (raw == null || raw === '') return false;
    return String(raw).trim().toLowerCase() === sid;
  });
}
