/**
 * InsForge a veces expone columnas FK en camelCase en el esquema real,
 * y el cliente devuelve JSON acorde; unificamos a snake_case esperado por la app.
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
