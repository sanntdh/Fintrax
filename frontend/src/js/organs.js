/**
 * Evaluación por órgano para la Etapa 2.
 *
 * Es una función pura: recibe el resultado de `evaluate()` y el estado, y
 * devuelve una ficha por órgano. No reutiliza el estado global del sistema
 * para evitar dobles conteos (por ejemplo, SpO₂ pesa en pulmones y no en
 * corazón). El psicológico no se asigna al cerebro.
 */

import { ORGANOS, ORGAN_ORDER } from '../data/organs.js';
import { DIFICULTAD, SEVERIDAD_SINTOMAS, UMBRALES } from '../data/severity.js';
import { num } from './format.js';

const puntosSintoma = (valor) => SEVERIDAD_SINTOMAS[valor] ?? 1;

function estadoDe(score, fuentes) {
  if (!fuentes.length) return 'na';
  if (score >= 3) return 'bad';
  if (score >= 1) return 'warn';
  return 'ok';
}

function resumen(estado, fuentes, etiqueta) {
  if (estado === 'na') {
    return etiqueta === 'Liver'
      ? 'No liver markers in this record.'
      : 'Not enough measurements or symptoms to assess this organ.';
  }
  if (estado === 'bad') return `Findings that need attention: ${fuentes.join(' · ')}.`;
  if (estado === 'warn') return `Data to review: ${fuentes.join(' · ')}.`;
  return `Recorded values within expected range: ${fuentes.join(' · ')}.`;
}

/**
 * @param {ReturnType<import('./evaluation.js').evaluate>} result
 * @param {{values?: Record<string,string>, symptoms?: Iterable<string>}} state
 */
export function evaluateOrgans(result, state = {}) {
  const values = state?.values || {};
  const zones = result?.zones || {};
  const porZona = (zona) => zones[zona]?.items || [];
  const todos = Object.values(zones).flatMap((zona) => zona.items || []);

  const sintomasDe = (lista) => [...new Set(todos.filter((s) => lista.includes(s)))];
  const fuentesDeSintomas = (lista) =>
    sintomasDe(lista).map((s) => `Symptom: ${s}`);

  const fichas = {};

  // Cerebro: neurológico + síntomas de cabeza. Sin psicológico.
  {
    const fuentes = [];
    let score = 0;
    const equilibrio = (values.equilibrio || '').trim();
    const coordinacion = (values.coordinacion || '').trim();
    for (const [id, texto] of [
      ['Balance', equilibrio],
      ['Coordination', coordinacion]
    ]) {
      const puntos = DIFICULTAD[texto] || 0;
      if (puntos) {
        score += puntos;
        fuentes.push(`${id}: ${texto.toLowerCase()}`);
      } else if (texto && texto !== 'No perceived difficulty' && texto !== 'Test pending') {
        fuentes.push(`${id}: ${texto.toLowerCase()}`);
      }
    }
    const reaccion = num(values.reaccion_ms);
    if (reaccion !== null) {
      const puntos =
        reaccion > UMBRALES.reaccion.bad ? 3 : reaccion > UMBRALES.reaccion.warn ? 1 : 0;
      score += puntos;
      fuentes.push(`Reaction ${reaccion} ms`);
    }
    for (const sintoma of sintomasDe(ORGANOS.cerebro.symptoms)) {
      score += puntosSintoma(sintoma);
      fuentes.push(`Symptom: ${sintoma}`);
    }
    fichas.cerebro = { score, fuentes };
  }

  // Corazón: FC, PA y ECG + síntomas cardíacos.
  {
    const fuentes = [];
    let score = 0;
    const fc = result?.base?.fc ?? num(values.fc_reposo);
    if (fc !== null && fc !== undefined) {
      const u = UMBRALES.fc;
      const puntos = fc < u.badLow || fc > u.badHigh ? 3 : fc < u.warnLow || fc > u.warnHigh ? 1 : 0;
      score += puntos;
      fuentes.push(`HR ${fc} bpm`);
    }
    const ps = result?.base?.ps ?? num(values.pa_sistolica);
    const pd = result?.base?.pd ?? num(values.pa_diastolica);
    if (ps !== null && ps !== undefined && pd !== null && pd !== undefined) {
      const u = UMBRALES.pa;
      const puntos =
        ps >= u.badSis || pd >= u.badDia || ps < u.badSisLow
          ? 3
          : ps >= u.warnSis || pd >= u.warnDia || ps < u.warnSisLow || pd < u.warnDiaLow
            ? 1
            : 0;
      score += puntos;
      fuentes.push(`BP ${ps}/${pd} mmHg`);
    }
    if (values.ecg_estado === 'Findings to review') {
      score += 2;
      fuentes.push('ECG with findings');
    }
    for (const sintoma of sintomasDe(ORGANOS.corazon.symptoms)) {
      score += puntosSintoma(sintoma);
      fuentes.push(`Symptom: ${sintoma}`);
    }
    fichas.corazon = { score, fuentes };
  }

  // Pulmones: saturación + síntomas respiratorios.
  {
    const fuentes = [];
    let score = 0;
    const ox = result?.base?.ox ?? num(values.spo2);
    if (ox !== null && ox !== undefined) {
      const puntos = ox < UMBRALES.spo2.bad ? 3 : ox < UMBRALES.spo2.warn ? 1 : 0;
      score += puntos;
      fuentes.push(`SpO₂ ${ox}%`);
    }
    for (const sintoma of sintomasDe(ORGANOS.pulmones.symptoms)) {
      score += puntosSintoma(sintoma);
      fuentes.push(`Symptom: ${sintoma}`);
    }
    fichas.pulmones = { score, fuentes };
  }

  // Hígado: sin marcadores específicos en el formulario actual.
  fichas.higado = { score: 0, fuentes: [] };

  // Estómago: síntomas digestivos altos.
  {
    const fuentes = fuentesDeSintomas(ORGANOS.estomago.symptoms);
    const score = sintomasDe(ORGANOS.estomago.symptoms).reduce(
      (total, s) => total + puntosSintoma(s),
      0
    );
    fichas.estomago = { score, fuentes };
  }

  // Riñones: síntomas urinarios y dolor lumbar.
  {
    const fuentes = fuentesDeSintomas(ORGANOS.rinones.symptoms);
    const score = sintomasDe(ORGANOS.rinones.symptoms).reduce(
      (total, s) => total + puntosSintoma(s),
      0
    );
    fichas.rinones = { score, fuentes };
  }

  // Intestinos: hinchazón y dolor abdominal.
  {
    const fuentes = fuentesDeSintomas(ORGANOS.intestinos.symptoms);
    const score = sintomasDe(ORGANOS.intestinos.symptoms).reduce(
      (total, s) => total + puntosSintoma(s),
      0
    );
    fichas.intestinos = { score, fuentes };
  }

  const resultado = {};
  for (const key of ORGAN_ORDER) {
    const meta = ORGANOS[key];
    const ficha = fichas[key] || { score: 0, fuentes: [] };
    const estado = estadoDe(ficha.score, ficha.fuentes);
    resultado[key] = {
      ...meta,
      state: estado,
      score: ficha.score,
      sources: ficha.fuentes,
      summary: resumen(estado, ficha.fuentes, meta.label),
      urgent: estado === 'bad'
    };
  }
  return resultado;
}

/** Órgano con peor estado, para seleccionarlo al entrar. */
export function peorOrgano(organos) {
  const orden = { bad: 3, warn: 2, ok: 1, na: 0 };
  return (
    ORGAN_ORDER.reduce((peor, key) => {
      const actual = orden[organos[key]?.state] ?? 0;
      const previo = peor ? orden[organos[peor]?.state] ?? 0 : -1;
      return actual > previo ? key : peor;
    }, '') || 'corazon'
  );
}

/** Zonas con molestias, para el resumen. */
export function zonasConMolestias(result) {
  return Object.entries(result?.zones || {})
    .filter(([, zona]) => zona.items?.length)
    .map(([key, zona]) => ({ key, label: zona.label, items: zona.items }));
}
