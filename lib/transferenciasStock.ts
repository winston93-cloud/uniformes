// Cliente InsForge server-side (PostgREST + rpc)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

/**
 * Toda operación de transferencia que mueve stock corre en una función de Postgres
 * (migración 20260926120000_transferencias-atomicas): una sola transacción con la
 * transferencia bloqueada, para que dos clics o reintentos no dupliquen stock.
 */
export async function rpcTransferencia<T = Record<string, unknown>>(
  db: DbClient,
  fn:
    | 'transferencia_crear'
    | 'transferencia_modificar'
    | 'transferencia_recibir'
    | 'transferencia_recibir_partida'
    | 'transferencia_cancelar'
    | 'transferencia_reenviar_complementario',
  params: Record<string, unknown>
): Promise<T> {
  const { data, error } = await db.rpc(fn, params);
  if (error) {
    const msg = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error);
    throw new Error(msg);
  }
  return data as T;
}
