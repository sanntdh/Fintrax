/**
 * Motor de evaluación. Función pura: no lee el DOM, no escribe nada.
 *
 * Porta el motor v2 del prototipo (la segunda definición de `evaluar`) y aplica
 * tres correcciones acordadas:
 *
 * 1. El sistema psicológico NO se suma a la zona «cabeza». Solo afecta a
 *    `systems.psico`; una cefalea no empeora porque haya estrés.
 * 2. Un valor «Pendiente de prueba/realizar» no cuenta como medición. Un
 *    sistema sin datos queda en `na`, no en `ok`.
 * 3. Las zonas sin síntomas ni sistemas asociados con datos quedan en `na`
 *    («SIN DATOS») y el resultado global pasa a `unknown` si no hay nada.
 */

import { zonasPara, ZONAS_NOMBRES } from '../data/symptoms.js';
import {
  SEVERIDAD_SINTOMAS,
  SISTEMAS,
  DIFICULTAD,
  PENDIENTES,
  RANGO,
  UMBRALES
} from '../data/severity.js';
import { COUNTED_IDS, RATING_IDS } from '../data/metrics.js';
import { num, imcDe, categoriaImc, escala } from './format.js';

/** Ids de escala 0–10: solo cuentan si la persona movió el control. */
export const RATINGS = new Set(RATING_IDS);

/** Zona anatómica que resume cada sistema médico. */
export const SISTEMA_A_ZONA = { cardio: 'pecho', osteo: 'extremidades', neuro: 'cabeza' };

/** Indicadores que alimentan cada sistema (mismo orden que el prototipo). */
export const SISTEMA_CAMPOS = {
  cardio: ['fc_reposo', 'pa_sistolica', 'pa_diastolica', 'ecg_estado', 'spo2', 'fr', 'temp'],
  osteo: ['densidad_osea', 'masa_muscular', 'fuerza_muscular'],
  inmune: ['leucocitos', 'cortisol', 'marcadores_inmunes', 'hormonas_estres'],
  psico: [
    'estres',
    'estado_animo',
    'ansiedad',
    'sueno_horas',
    'sueno_calidad',
    'memoria',
    'atencion',
    'concentracion'
  ],
  neuro: ['equilibrio', 'coordinacion', 'reaccion_ms']
};

/** Perfil mínimo requerido por el formulario. */
export const PERFIL_REQUERIDO = ['nombre', 'edad', 'peso', 'estatura', 'sangre'];

/**
 * ¿El campo aporta un dato real?
 * @param {string} id
 * @param {Record<string,string>} values
 * @param {Set<string>} ratingsTouched
 */
export function isFilled(id, values, ratingsTouched) {
  if (RATINGS.has(id)) return ratingsTouched.has(id);
  const raw = values[id];
  if (raw === null || raw === undefined) return false;
  const text = String(raw).trim();
  if (!text) return false;
  return !PENDIENTES.has(text);
}

/** ¿El campo tiene un valor pendiente declarado? */
export function isPending(id, values) {
  const raw = values[id];
  if (raw === null || raw === undefined) return false;
  const text = String(raw).trim();
  return text !== '' && PENDIENTES.has(text);
}

/** Normaliza síntomas a una lista de `{zone, value}`. */
export function normalizarSintomas(symptoms) {
  if (!symptoms) return [];
  const list = typeof symptoms === 'string' ? [symptoms] : [...symptoms];
  return list
    .map((item) => {
      if (typeof item !== 'string') {
        return item && item.zone && item.value ? { zone: item.zone, value: item.value } : null;
      }
      const cut = item.indexOf('|');
      if (cut < 0) return null;
      return { zone: item.slice(0, cut), value: item.slice(cut + 1) };
    })
    .filter(Boolean);
}

/** Estado a partir de la puntuación. */
const estadoDePuntos = (score) => (score >= 3 ? 'bad' : score >= 1 ? 'warn' : 'ok');

/**
 * @param {{
 *   profile?: Record<string,string>,
 *   values?: Record<string,string>,
 *   symptoms?: Iterable<string|{zone:string,value:string}>,
 *   ratingsTouched?: Iterable<string>,
 *   wellBeing?: boolean
 * }} input
 */
export function evaluate(input = {}) {
  const profile = input.profile || {};
  const values = input.values || {};
  const ratingsTouched =
    input.ratingsTouched instanceof Set ? input.ratingsTouched : new Set(input.ratingsTouched || []);
  const sintomas = normalizarSintomas(input.symptoms);
  const sexo = profile.sexo || '';
  const edad = num(profile.edad) ?? 0;
  const imc = imcDe(profile.peso, profile.estatura);

  // --- Zonas anatómicas ----------------------------------------------------
  const zones = {};
  for (const key of Object.keys(zonasPara(sexo))) {
    zones[key] = { score: 0, items: [], notes: [], st: 'na' };
  }

  for (const sintoma of sintomas) {
    const zone = zones[sintoma.zone];
    if (!zone) continue;
    zone.score += SEVERIDAD_SINTOMAS[sintoma.value] ?? 1;
    zone.items.push(sintoma.value);
  }

  const addZone = (key, note) => {
    if (!zones[key]) return;
    zones[key].score += 1;
    zones[key].notes.push(note);
  };
  if (imc !== null && imc >= 30) {
    addZone('pecho', 'IMC elevado');
    addZone('extremidades', 'IMC elevado');
  }
  if (imc !== null && imc > 0 && imc < 18.5) addZone('estomago', 'IMC bajo');
  if (edad >= UMBRALES.edadRiesgo) addZone('pecho', `Edad ≥ ${UMBRALES.edadRiesgo}`);

  // --- Sistemas médicos ----------------------------------------------------
  const systems = {};
  for (const [key, ids] of Object.entries(SISTEMA_CAMPOS)) {
    systems[key] = {
      score: 0,
      notes: [],
      n: ids.filter((id) => isFilled(id, values, ratingsTouched)).length,
      st: 'na',
      label: SISTEMAS[key]
    };
  }

  const addSystem = (key, points, note) => {
    if (!points) return;
    systems[key].score += points;
    if (note) systems[key].notes.push(note);
  };

  // Cardiovascular
  const fc = num(values.fc_reposo);
  const ps = num(values.pa_sistolica);
  const pd = num(values.pa_diastolica);
  const ox = num(values.spo2);
  const temp = num(values.temp);
  const u = UMBRALES;
  if (fc !== null) {
    const points =
      fc < u.fc.badLow || fc > u.fc.badHigh ? 3 : fc < u.fc.warnLow || fc > u.fc.warnHigh ? 1 : 0;
    addSystem('cardio', points, `FC ${fc} bpm`);
  }
  if (ps !== null && pd !== null) {
    const points =
      ps >= u.pa.badSis || pd >= u.pa.badDia || ps < u.pa.badSisLow
        ? 3
        : ps >= u.pa.warnSis || pd >= u.pa.warnDia || ps < u.pa.warnSisLow || pd < u.pa.warnDiaLow
          ? 1
          : 0;
    addSystem('cardio', points, `PA ${ps}/${pd}`);
  }
  if (ox !== null) {
    const points = ox < u.spo2.bad ? 3 : ox < u.spo2.warn ? 1 : 0;
    addSystem('cardio', points, `SpO₂ ${ox}%`);
  }
  if (values.ecg_estado === 'Con hallazgos por revisar') addSystem('cardio', 2, 'ECG con hallazgos');

  // Óseo y muscular
  const dx = num(values.densidad_osea);
  const fz = num(values.fuerza_muscular);
  const umbralFuerza = sexo === 'Masculino' ? u.fuerza.hombre : u.fuerza.mujer;
  if (dx !== null) {
    const points = dx < u.densidadOsea.bad ? 3 : dx < u.densidadOsea.warn ? 1 : 0;
    addSystem('osteo', points, 'Densidad ósea baja');
  }
  if (fz !== null) {
    const points = fz < umbralFuerza * u.fuerza.ratioBad ? 3 : fz < umbralFuerza ? 1 : 0;
    addSystem('osteo', points, `Fuerza baja (${fz} kgf)`);
  }

  // Inmunológico
  const lc = num(values.leucocitos);
  const co = num(values.cortisol);
  if (lc !== null) {
    const points =
      lc < u.leucocitos.badLow || lc > u.leucocitos.badHigh
        ? 3
        : lc < u.leucocitos.warnLow || lc > u.leucocitos.warnHigh
          ? 1
          : 0;
    addSystem('inmune', points, `Leucocitos ${lc}/µL`);
  }
  if (co !== null) addSystem('inmune', co > u.cortisol.warnAlto ? 1 : 0, 'Cortisol alto');

  // Psicológico (solo si la escala se tocó)
  const alto = (id, label) => {
    if (!ratingsTouched.has(id)) return;
    const value = num(values[id]);
    if (value === null) return;
    const points = value >= u.psicoAlto.bad ? 3 : value >= u.psicoAlto.warn ? 1 : 0;
    addSystem('psico', points, `${label} ${value}/10`);
  };
  const bajo = (id, label) => {
    if (!ratingsTouched.has(id)) return;
    const value = num(values[id]);
    if (value === null) return;
    const points = value <= u.psicoBajo.bad ? 3 : value <= u.psicoBajo.warn ? 1 : 0;
    addSystem('psico', points, `${label} ${value}/10`);
  };
  alto('estres', 'Estrés');
  alto('ansiedad', 'Ansiedad');
  bajo('estado_animo', 'Ánimo bajo');
  bajo('sueno_calidad', 'Sueño pobre');
  bajo('memoria', 'Memoria');
  bajo('atencion', 'Atención');
  bajo('concentracion', 'Concentración');
  const horasSueno = num(values.sueno_horas);
  if (horasSueno !== null) {
    const points =
      horasSueno < u.suenoHoras.bad
        ? 3
        : horasSueno < u.suenoHoras.warnBajo || horasSueno > u.suenoHoras.warnAlto
          ? 1
          : 0;
    addSystem('psico', points, `Sueño ${horasSueno} h`);
  }

  // Neurológico
  for (const id of ['equilibrio', 'coordinacion']) {
    const texto = (values[id] || '').trim();
    const points = DIFICULTAD[texto] || 0;
    if (points) addSystem('neuro', points, `${id[0].toUpperCase()}${id.slice(1)}: ${texto.toLowerCase()}`);
  }
  const rt = num(values.reaccion_ms);
  if (rt !== null) {
    const points = rt > u.reaccion.bad ? 3 : rt > u.reaccion.warn ? 1 : 0;
    addSystem('neuro', points, `Reacción ${rt} ms`);
  }

  // Estado de cada sistema: sin datos reales ⇒ `na`
  for (const system of Object.values(systems)) {
    system.st = system.n === 0 ? 'na' : estadoDePuntos(system.score);
  }

  // --- Resumen por zona ----------------------------------------------------
  for (const [systemKey, zoneKey] of Object.entries(SISTEMA_A_ZONA)) {
    const zone = zones[zoneKey];
    const system = systems[systemKey];
    if (!zone || !system) continue;
    zone.score += system.score;
    zone.notes.push(...system.notes);
  }

  for (const [zoneKey, zone] of Object.entries(zones)) {
    const linked = Object.entries(SISTEMA_A_ZONA).find(([, z]) => z === zoneKey)?.[0];
    const systemHasData = linked ? systems[linked].st !== 'na' : false;
    const hasData = zone.items.length > 0 || zone.notes.length > 0 || systemHasData;
    zone.st = hasData ? estadoDePuntos(zone.score) : 'na';
    zone.label = ZONAS_NOMBRES[zoneKey] || zoneKey;
  }

  // --- Resultado global ----------------------------------------------------
  const estados = [...Object.values(zones).map((z) => z.st), ...Object.values(systems).map((s) => s.st)];
  const conDatos = estados.filter((st) => st !== 'na');
  const worst = conDatos.reduce((max, st) => Math.max(max, RANGO[st] ?? 0), 0);
  const overall = conDatos.length === 0 ? 'unknown' : ['ok', 'warn', 'bad'][worst];

  // --- Diagnóstico de completitud -----------------------------------------
  const filledMetrics = COUNTED_IDS.filter((id) => isFilled(id, values, ratingsTouched));
  const missingProfile = PERFIL_REQUERIDO.filter((key) => !String(profile[key] || '').trim());
  const pending = COUNTED_IDS.filter((id) => isPending(id, values));
  const flags = [];
  if (missingProfile.length) flags.push('perfil-incompleto');
  if (!profile.sexo) flags.push('sin-sexo');
  if (filledMetrics.length === 0) flags.push('sin-mediciones');
  if (sintomas.length === 0 && !input.wellBeing) flags.push('sin-sintomas');
  if (pending.length) flags.push('pendientes');
  if (imc !== null && imc >= 30) flags.push('imc-alto');
  if (imc !== null && imc < 18.5) flags.push('imc-bajo');
  if (edad >= UMBRALES.edadRiesgo) flags.push('edad-riesgo');
  if (systems.psico.st === 'bad') flags.push('psico-grave');

  return {
    zones,
    systems,
    overall,
    imc,
    imcCategoria: categoriaImc(imc).label,
    edad,
    base: { fc, ps, pd, ox, temp },
    counts: {
      symptoms: sintomas.length,
      filledMetrics: filledMetrics.length,
      totalMetrics: COUNTED_IDS.length
    },
    missing: { profile: missingProfile, metrics: COUNTED_IDS.filter((id) => !isFilled(id, values, ratingsTouched)) },
    pending,
    flags,
    imcEstado: categoriaImc(imc)
  };
}

/**
 * Configuración de las cuatro series de telemetría.
 * `hasData` indica si existe una medición real; si no, la gráfica se muestra
 * vacía en lugar de inventar una curva.
 */
export function configurarSeries(result) {
  const u = UMBRALES;
  const pecho = result.zones.pecho?.score ?? 0;
  const digestivo = (result.zones.estomago?.score ?? 0) + (result.zones.cabeza?.score ?? 0);
  const imcPuntos = result.imc !== null && result.imc >= 30 ? 12 : 0;
  const { fc, ps, pd, ox, temp } = result.base;
  return [
    {
      id: 'fc',
      name: 'FRECUENCIA CARDÍACA',
      unit: 'bpm',
      base: fc ?? 68 + (result.edad >= 50 ? 4 : 0) + pecho * 9,
      ripple: 2.2,
      lo: 40,
      hi: 140,
      decimals: 0,
      ok: [u.fc.warnLow, u.fc.warnHigh],
      wn: [u.fc.badLow, u.fc.badHigh],
      hasData: fc !== null,
      source: fc !== null ? 'Medición registrada' : 'Sin medición de frecuencia cardíaca'
    },
    {
      id: 'spo2',
      name: 'SATURACIÓN DE OXÍGENO',
      unit: '%',
      base: Math.min(99.5, ox ?? Math.max(88, 98 - pecho * 1.6)),
      ripple: 0.5,
      lo: 86,
      hi: 100,
      decimals: 0,
      ok: [u.spo2.warn, 100],
      wn: [u.spo2.bad, 100],
      hasData: ox !== null,
      source: ox !== null ? 'Medición registrada' : 'Sin medición de saturación'
    },
    {
      id: 'pa',
      name: 'PRESIÓN SISTÓLICA',
      unit: 'mmHg',
      base: ps ?? 116 + imcPuntos + pecho * 6,
      ripple: 2,
      lo: 70,
      hi: 180,
      decimals: 0,
      // Se conservan las bandas de la gráfica del prototipo v2 (85–159).
      ok: [90, 129],
      wn: [85, 159],
      hasData: ps !== null,
      source: ps !== null ? (pd !== null ? 'Medición registrada' : 'Solo sistólica registrada') : 'Sin medición de presión'
    },
    {
      id: 'temp',
      name: 'TEMPERATURA CORPORAL',
      unit: '°C',
      base: temp ?? 36.6 + digestivo * 0.2,
      ripple: 0.06,
      lo: 35,
      hi: 40,
      decimals: 1,
      ok: [36.1, 37.5],
      wn: [35.5, 38.5],
      hasData: temp !== null,
      source: temp !== null ? 'Medición registrada' : 'Sin medición de temperatura'
    }
  ];
}

/** Estado de una lectura concreta (usado por las gráficas). */
export const estadoLectura = (value, serie) => escala(value, serie);
