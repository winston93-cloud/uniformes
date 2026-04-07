/**
 * Impuestos opcionales en cotizaciones (México).
 * Ajusta tasas según contabilidad; valores orientativos para la UI/PDF.
 */
export const TASA_IVA_TRASLADADO = 0.16; // IVA 16 %
/**
 * Retención de ISR (RESICO): 1.25 % sobre subtotal.
 * Retención que practica el cliente al emisor; se resta del total de la cotización.
 */
export const TASA_ISR_RETENCION = 0.0125;

export function calcularMontosImpuestosCotizacion(
  subtotalPartidas: number,
  incluirIva: boolean,
  incluirIsr: boolean
) {
  const sub = Math.round(subtotalPartidas * 100) / 100;
  const montoIva = incluirIva
    ? Math.round(sub * TASA_IVA_TRASLADADO * 100) / 100
    : 0;
  const montoIsrRet = incluirIsr
    ? Math.round(sub * TASA_ISR_RETENCION * 100) / 100
    : 0;
  const total = Math.round((sub + montoIva - montoIsrRet) * 100) / 100;
  return { subtotal: sub, montoIva, montoIsrRet, total };
}
