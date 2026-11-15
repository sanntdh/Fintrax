/**
 * Utilidades puras de formato y clasificación. Sin DOM.
 */

/** Convierte a número finito o devuelve null. */
export function num(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (raw === '') return null;
  const parsed = Number.parseFloat(raw.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Índice de masa corporal sin redondear, o null si faltan datos. */
export function imcDe(peso, estatura) {
  const p = num(peso);
  const e = num(estatura);
  if (p === null || e === null || p <= 0 || e <= 0) return null;
  return p / (e * e);
}

/** Texto con un decimal para mostrar el IMC. */
export function formatearImc(imc) {
  return imc === null ? '--' : imc.toFixed(1);
}

/** Clasificación descriptiva del IMC (no diagnóstica). */
export function categoriaImc(imc) {
  if (imc === null) return { key: 'sin-datos', label: 'CALIBRANDO...' };
  if (imc < 18.5) return { key: 'bajo', label: 'BAJO PESO' };
  if (imc < 25) return { key: 'normal', label: 'PESO NORMAL' };
  if (imc < 30) return { key: 'sobrepeso', label: 'SOBREPESO' };
  return { key: 'obesidad', label: 'OBESIDAD' };
}

/**
 * Estado de una serie respecto a una banda normal.
 * @param {number} value
 * @param {{ok:[number,number], wn:[number,number]}} band
 * @returns {'ok'|'warn'|'bad'}
 */
export function escala(value, band) {
  if (value >= band.ok[0] && value <= band.ok[1]) return 'ok';
  if (value >= band.wn[0] && value <= band.wn[1]) return 'warn';
  return 'bad';
}

/** Valor visible o raya larga. */
export function textoOSinDato(value, unidad = '') {
  const raw = value === null || value === undefined ? '' : String(value).trim();
  if (!raw) return '—';
  return unidad ? `${raw} ${unidad}` : raw;
}

/** Plural sencillo para contadores. */
export function plural(n, singular, pluralForma) {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

/** Minúsculas con la primera letra en mayúscula, tolerante a vacíos. */
export function capitalizar(texto) {
  const raw = String(texto || '');
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '';
}
