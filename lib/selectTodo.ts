type Pagina<T, E> = PromiseLike<{ data: T[] | null; error: E | null }>;

/**
 * InsForge (PostgREST) corta cada respuesta en 1000 filas sin avisar: pide por páginas hasta traer todo.
 * La consulta debe llevar un orden estable que termine en una columna única (p. ej. `.order('id')`).
 */
export async function selectTodo<T, E>(
  pagina: (desde: number, hasta: number) => Pagina<T, E>,
  tamano = 1000
): Promise<{ data: T[]; error: E | null }> {
  const filas: T[] = [];
  for (let desde = 0; desde < tamano * 200; desde += tamano) {
    const { data, error } = await pagina(desde, desde + tamano - 1);
    if (error) return { data: filas, error };
    const lote = data ?? [];
    filas.push(...lote);
    if (lote.length < tamano) return { data: filas, error: null };
  }
  return { data: filas, error: null };
}
