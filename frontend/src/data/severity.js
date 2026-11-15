/**
 * Gravedad de síntomas, catálogo de sistemas y umbrales clínicos.
 *
 * Los umbrales son los mismos que usa el prototipo v2 (evaluar/cfgCharts).
 * Están aquí, separados del motor, para poder revisarlos y testearlos sin
 * tocar la interfaz.
 */

/** Puntos por síntoma. Los no listados valen 1. */
export const SEVERIDAD_SINTOMAS = {
  Confusión: 3,
  Migraña: 2,
  'Visión borrosa': 2,
  'Dolor opresivo': 3,
  'Dificultad al respirar': 3,
  'Dolor en pecho': 3,
  'Falta de aire': 3,
  Palpitaciones: 2,
  'Dolor abdominal': 2,
  Vómito: 2,
  'Dolor al orinar': 2,
  'Pesadez testicular': 2,
  'Dolor pélvico bajo': 2
};

export const SISTEMAS = {
  cardio: 'Cardiovascular',
  osteo: 'Óseo y muscular',
  inmune: 'Inmunológico',
  psico: 'Psicológico',
  neuro: 'Neurológico'
};

/** Estados posibles y su etiqueta visible. */
export const ESTADOS = {
  ok: { t: 'BIEN', h: '#00f5b4' },
  warn: { t: 'MEDIO', h: '#ffaa33' },
  bad: { t: 'GRAVE', h: '#ff3860' },
  na: { t: 'SIN DATOS', h: '#8ebad9' }
};

/** Orden de severidad. `na` no eleva el resultado global. */
export const RANGO = { ok: 0, warn: 1, bad: 2, na: 0 };

/** Dificultad declarada en equilibrio/coordinación. */
export const DIFICULTAD = {
  'Dificultad leve': 1,
  'Dificultad moderada': 2,
  'Dificultad intensa': 3
};

/** Valores que significan "todavía no hay medición". */
export const PENDIENTES = new Set([
  '',
  'Pendiente de realizar',
  'Pendiente de prueba',
  'Seleccionar',
  'Seleccionar resultado',
  'Seleccionar método'
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
