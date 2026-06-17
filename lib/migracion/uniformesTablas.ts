import { TABLAS_MIGRACION_ORDER } from '@/lib/migracion/tablasOrder';

/** Tablas del sistema Uniformes (sin auditoría). */
export const TABLAS_UNIFORMES = TABLAS_MIGRACION_ORDER.filter((t) => t !== 'auditoria');

export const TABLAS_UNIFORMES_CON_AUDITORIA = [...TABLAS_MIGRACION_ORDER] as const;
