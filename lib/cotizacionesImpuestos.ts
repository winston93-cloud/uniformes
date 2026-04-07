/**
 * Impuestos opcionales en cotizaciones (México).
 * Ajusta tasas según contabilidad; valores orientativos para la UI/PDF.
 */
export const TASA_IVA_TRASLADADO = 0.16; // IVA 16 %
/**
 * Retención ISR RESICO: 1.25 % sobre el importe que cobra el emisor **sin IVA**
 * (mismo importe base que el subtotal de partidas; no se calcula sobre el total con IVA).
 * La practica el cliente al emisor; se resta del total a pagar.
 */
export const TASA_ISR_RETENCION = 0.0125;

export function calcularMontosImpuestosCotizacion(
  subtotalPartidas: number,
  incluirIva: boolean,
  incluirIsr: boolean
) {
  /** Total que cobra el emisor sin IVA (antes de traslado de IVA). Base para IVA y para ISR RESICO. */
  const importeSinIva = Math.round(subtotalPartidas * 100) / 100;
  const montoIva = incluirIva
    ? Math.round(importeSinIva * TASA_IVA_TRASLADADO * 100) / 100
    : 0;
  const montoIsrRet = incluirIsr
    ? Math.round(importeSinIva * TASA_ISR_RETENCION * 100) / 100
    : 0;
  const total = Math.round((importeSinIva + montoIva - montoIsrRet) * 100) / 100;
  return { subtotal: importeSinIva, montoIva, montoIsrRet, total };
}
