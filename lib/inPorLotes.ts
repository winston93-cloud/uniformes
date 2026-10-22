type Respuesta<T, E> = PromiseLike<{ data: T[] | null; error: E | null }>;

/**
 * El gateway de InsForge responde 502 sin CORS (el navegador lo ve como "Failed to fetch") cuando la URL pasa de
 * ~3 KB, unos 80 UUID en un filtro `.in()`. Lanza la consulta por lotes y junta las filas; se detiene en el primer error.
 */
export async function inPorLotes<T, E>(
  ids: readonly string[],
  consulta: (lote: string[]) => Respuesta<T, E>,
  tamano = 40
): Promise<{ data: T[]; error: E | null }> {
  const filas: T[] = [];
  for (let i = 0; i < ids.length; i += tamano) {
    const { data, error } = await consulta(ids.slice(i, i + tamano));
    if (error) return { data: filas, error };
    filas.push(...(data ?? []));
  }
  return { data: filas, error: null };
}
