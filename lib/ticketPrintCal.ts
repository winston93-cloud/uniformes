import { esCuentaWinston, type SesionLineaVenta } from '@/lib/winstonLineaVenta';

export type TicketPrintCal = {
  leftMm: number;
  topMm: number;
  widthPct: number;
  scale: number;
  paddingTopMm: number;
};

/** Matriz / Uniformes — no cambiar estos defaults. */
const MATRIZ_DEFAULT: TicketPrintCal = {
  leftMm: 40,
  topMm: 0,
  widthPct: 82,
  scale: 0.98,
  paddingTopMm: 2.5,
};

/** Sucursal Winston — calibración HP LaserJet en tienda. */
const WINSTON_DEFAULT: TicketPrintCal = {
  leftMm: 20,
  topMm: 0,
  widthPct: 79,
  scale: 0.98,
  paddingTopMm: 2.5,
};

export function defaultTicketPrintCal(sesion?: SesionLineaVenta | null): TicketPrintCal {
  return esCuentaWinston(sesion) ? { ...WINSTON_DEFAULT } : { ...MATRIZ_DEFAULT };
}

/** Matriz sigue usando la clave histórica para no perder calibraciones guardadas. */
export function ticketPrintCalStorageKey(sesion?: SesionLineaVenta | null): string {
  return esCuentaWinston(sesion) ? 'ticketPrintCal_v1_winston' : 'ticketPrintCal_v1';
}

export function loadTicketPrintCal(sesion?: SesionLineaVenta | null): TicketPrintCal {
  const defaults = defaultTicketPrintCal(sesion);
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(ticketPrintCalStorageKey(sesion));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<TicketPrintCal>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function saveTicketPrintCal(sesion: SesionLineaVenta | null | undefined, cal: TicketPrintCal): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ticketPrintCalStorageKey(sesion), JSON.stringify(cal));
  } catch {
    // ignore
  }
}
