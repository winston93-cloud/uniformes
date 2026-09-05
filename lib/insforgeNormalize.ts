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

  const empresaId =
    row.empresa_id ??
    row.empresaId ??
    row.EmpresaId ??
    row.company_id ??
    row.companyId;

  return {
    ...row,
    categoria_id: categoriaId ?? row.categoria_id,
    empresa_id: empresaId ?? row.empresa_id ?? null,
    id: row.id ?? row.Id ?? row.ID,
  };
}
