/**
 * Códigos de acceso de la capa FINTRAX.
 *
 * Es una validación local de prototipo: no sustituye autenticación real.
 * El código demo se muestra en la interfaz solo después del primer error,
 * para poder probar el estado de fallo sin adivinar la clave.
 */

export const CODIGOS_VALIDOS = ['ASTRATA-2045', 'ASTRATA2045'];

export const CODIGO_DEMO = 'ASTRATA-2045';

/** Quita espacios y normaliza a mayúsculas. */
export function normalizarCodigo(valor) {
  return String(valor ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

/** @param {string} valor */
export function codigoValido(valor) {
  return CODIGOS_VALIDOS.includes(normalizarCodigo(valor));
}
