/**
 * Gravedad de síntomas, catálogo de sistemas y umbrales clínicos.
 *
 * Los umbrales son los mismos que usa el prototipo v2 (evaluar/cfgCharts).
 * Están aquí, separados del motor, para poder revisarlos y testearlos sin
 * tocar la interfaz.
 */

/** Puntos por síntoma. Los no listados valen 1. */
export const SEVERIDAD_SINTOMAS = {
  'Confusion': 3,
  'Migraine': 2,
  'Blurred vision': 2,
  'Crushing pain': 3,
  'Difficulty breathing': 3,
  'Chest pain': 3,
  'Shortness of breath': 3,
  'Palpitations': 2,
  'Abdominal pain': 2,
  'Vomiting': 2,
  'Painful urination': 2,
  'Testicular heaviness': 2,
  'Lower pelvic pain': 2
};

export const SISTEMAS = {
  cardio: 'Cardiovascular',
  osteo: 'Bone and muscle',
  inmune: 'Immune',
  psico: 'Psychological',
  neuro: 'Neurological'
};

/** Estados posibles y su etiqueta visible. */
export const ESTADOS = {
  ok: { t: 'GOOD', h: '#00f5b4' },
  warn: { t: 'MEDIUM', h: '#ffaa33' },
  bad: { t: 'SEVERE', h: '#ff3860' },
  na: { t: 'NO DATA', h: '#8ebad9' }
};

/** Orden de severidad. `na` no eleva el resultado global. */
export const RANGO = { ok: 0, warn: 1, bad: 2, na: 0 };

/** Dificultad declarada en equilibrio/coordinación. */
export const DIFICULTAD = {
  'Mild difficulty': 1,
  'Moderate difficulty': 2,
  'Severe difficulty': 3
};

/** Valores que significan "todavía no hay medición". */
export const PENDIENTES = new Set([
  '',
  'Not done yet',
  'Test pending',
  'Select',
  'Select result',
  'Select method'
]);

/**
 * Umbrales usados por evaluate().
 * Se documentan aquí para que las pruebas y la revisión clínica sean explícitas.
 */
export const UMBRALES = {
  fc: { badLow: 50, badHigh: 120, warnLow: 60, warnHigh: 100 },
  pa: { badSis: 160, badDia: 100, badSisLow: 80, warnSis: 130, warnDia: 85, warnSisLow: 90, warnDiaLow: 60 },
  spo2: { bad: 91, warn: 95 },
  densidadOsea: { bad: 0.75, warn: 0.9 },
  fuerza: { ratioBad: 0.7, hombre: 27, mujer: 16 },
  leucocitos: { badLow: 3500, badHigh: 15000, warnLow: 4000, warnHigh: 11000 },
  cortisol: { warnAlto: 25 },
  psicoAlto: { bad: 8, warn: 6 },
  psicoBajo: { bad: 2, warn: 4 },
  suenoHoras: { bad: 5, warnBajo: 6, warnAlto: 10 },
  reaccion: { bad: 500, warn: 350 },
  imc: { alto: 30, bajo: 18.5 },
  edadRiesgo: 60
};
