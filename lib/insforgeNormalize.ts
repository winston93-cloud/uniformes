/**
 * Unifica variantes de nombre de FK (camelCase/PascalCase) sobre la fila API;
 * válido para Supabase y otros PostgREST.
 */
export function normalizarCamposPrendaApi(row: Record<string, unknown>): Record<string, unknown> {
  const categoriaId =
    row.categoria_id ??
    row.categoriaId ??
    row.CategoriaId ??
    row.category_id ??
    row.categoryId;

  return {
    ...row,
    categoria_id: categoriaId ?? row.categoria_id,
    id: row.id ?? row.Id ?? row.ID,
  };
}
