// Utilidades para manejo de Ciclo Escolar
// Base: 2003 = 0, entonces 2025 = 22, 2026 = 23, etc.

const BASE_YEAR = 2003;

/**
 * Calcula el ciclo escolar actual basándose en la fecha
 * El ciclo escolar cambia en agosto de cada año
 * Ejemplo: 
 * - Agosto 2025 - Julio 2026 = Ciclo 2025-2026 (valor 22)
 * - Agosto 2026 - Julio 2027 = Ciclo 2026-2027 (valor 23)
 */
export function getCicloEscolarActual(): number {
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = hoy.getMonth() + 1; // 1-12
  
  // Si estamos en agosto (8) o después, el ciclo inicia este año
  // Si estamos antes de agosto, el ciclo inició el año pasado
  const añoInicio = mes >= 8 ? año : año - 1;
  
  return añoInicio - BASE_YEAR;
}

/**
 * Convierte el valor numérico a texto del ciclo escolar
 * Ejemplo: 22 -> "2025-2026"
 */
export function cicloEscolarToString(valor: number): string {
  const añoInicio = BASE_YEAR + valor;
  const añoFin = añoInicio + 1;
  return `${añoInicio}-${añoFin}`;
}

/**
 * Convierte el texto del ciclo escolar a valor numérico
 * Ejemplo: "2025-2026" -> 22
 */
export function stringToCicloEscolar(texto: string): number {
  const añoInicio = parseInt(texto.split('-')[0]);
  return añoInicio - BASE_YEAR;
}

/**
 * Genera un array de ciclos escolares para usar en selects
 * @param cantidadAnterior - Cuántos ciclos anteriores incluir (default: 3)
 * @param cantidadFutura - Cuántos ciclos futuros incluir (default: 1)
 */
export function getCiclosEscolaresDisponibles(
  cantidadAnterior: number = 3,
  cantidadFutura: number = 1
): Array<{ valor: number; texto: string }> {
  const cicloActual = getCicloEscolarActual();
  const ciclos: Array<{ valor: number; texto: string }> = [];
  
  for (let i = cicloActual - cantidadAnterior; i <= cicloActual + cantidadFutura; i++) {
    ciclos.push({
      valor: i,
      texto: cicloEscolarToString(i)
    });
  }
  
  return ciclos;
}
