/**
 * Comparativa estática entre el registro habitual y el actual.
 *
 * Sustituye a la antigua «telemetría»: Fintrax no monitoriza de forma
 * continua, solo compara dos mediciones puntuales. Cada indicador se dibuja
 * sobre su escala con la franja normal; primero los que tienen anomalías.
 */

import { el, svg, limpiar } from './dom.js';
import { escala } from './format.js';
import { UMBRALES as U } from '../data/severity.js';

/**
 * `ok`/`wn`: franjas normal y de vigilancia (fuera de `wn` es atención).
 * `cambio`: diferencia con lo habitual que se considera notable; son los
 * umbrales de aviso de desviación del backend (`_DESV_DEFAULT`).
 * FR y temperatura usan las franjas de puntuación 0 y 1 de NEWS2 (RCP).
 */
export const COMPARABLES = [
  { id: 'fc_reposo', label: 'Heart rate', unit: 'bpm', ok: [U.fc.warnLow, U.fc.warnHigh], wn: [U.fc.badLow, U.fc.badHigh], eje: [30, 160], cambio: 15 },
  { id: 'pa_sistolica', label: 'Systolic pressure', unit: 'mmHg', ok: [U.pa.warnSisLow, U.pa.warnSis - 1], wn: [U.pa.badSisLow, U.pa.badSis - 1], eje: [60, 200], cambio: 15 },
  { id: 'spo2', label: 'Oxygen saturation', unit: '%', ok: [U.spo2.warn, 100], wn: [U.spo2.bad, 100], eje: [80, 100], cambio: 3 },
  { id: 'fr', label: 'Respiratory rate', unit: 'rpm', ok: [12, 20], wn: [9, 24], eje: [4, 40], cambio: 4 },
  { id: 'temp', label: 'Temperature', unit: '°C', ok: [36.1, 38], wn: [35.1, 39], eje: [34, 41], cambio: 0.8 },
  {
    id: 'leucocitos', label: 'White blood cells', unit: '/µL',
    ok: [U.leucocitos.warnLow, U.leucocitos.warnHigh], wn: [U.leucocitos.badLow, U.leucocitos.badHigh], eje: [0, 20000], cambio: null
  }
];

const GRAVEDAD = { bad: 0, warn: 1, ok: 2, na: 3 };

function numero(valor) {
  const texto = String(valor ?? '').trim().replace(',', '.');
  if (!texto) return null;
  const n = Number(texto);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {Record<string, string>} habitual valores del registro habitual
 * @param {Record<string, string>} actual valores del registro actual
 */
export function compararRegistros(habitual = {}, actual = {}) {
  const filas = COMPARABLES.map((def) => {
    const base = numero(habitual[def.id]);
    const ahora = numero(actual[def.id]);
    const delta = base !== null && ahora !== null ? Math.round((ahora - base) * 10) / 10 : null;
    const estado = ahora === null ? 'na' : escala(ahora, def);
    const cambioNotable = delta !== null && def.cambio !== null && Math.abs(delta) >= def.cambio;
    return {
      ...def,
      base,
      actual: ahora,
      delta,
      estado,
      cambioNotable,
      anomalia: estado === 'warn' || estado === 'bad' || cambioNotable
    };
  });
  const anomalas = filas.filter((fila) => fila.anomalia).sort((a, b) => GRAVEDAD[a.estado] - GRAVEDAD[b.estado]);
  return { anomalas, normales: filas.filter((fila) => !fila.anomalia) };
}

/** Posición en % del ancho: sin `viewBox`, los círculos no se deforman. */
function posicion(valor, [min, max]) {
  const t = (Math.min(max, Math.max(min, valor)) - min) / (max - min);
  return Math.round(t * 1000) / 10;
}

const pct = (valor) => `${valor}%`;

function grafica(fila) {
  const lienzo = svg('svg', { class: 'fintrax-comp__svg', 'aria-hidden': 'true' });
  const desde = posicion(fila.ok[0], fila.eje);
  lienzo.append(
    svg('rect', { x: 0, y: 10, width: '100%', height: 4, rx: 2, class: 'fintrax-comp__pista' }),
    svg('rect', {
      x: pct(desde),
      y: 8,
      width: pct(posicion(fila.ok[1], fila.eje) - desde),
      height: 8,
      rx: 4,
      class: 'fintrax-comp__normal'
    })
  );
  if (fila.base !== null && fila.actual !== null) {
    lienzo.append(svg('line', {
      x1: pct(posicion(fila.base, fila.eje)), x2: pct(posicion(fila.actual, fila.eje)), y1: 12, y2: 12, class: 'fintrax-comp__linea'
    }));
  }
  if (fila.base !== null) {
    lienzo.append(svg('circle', { cx: pct(posicion(fila.base, fila.eje)), cy: 12, r: 5, class: 'fintrax-comp__base' }));
  }
  if (fila.actual !== null) {
    lienzo.append(svg('circle', { cx: pct(posicion(fila.actual, fila.eje)), cy: 12, r: 6, class: 'fintrax-comp__actual' }));
  }
  return lienzo;
}

const formato = (valor) => (valor === null ? '—' : String(valor));

function filaComparativa(fila) {
  const item = el('li', { class: 'fintrax-comp', dataset: { st: fila.estado, cambio: String(fila.cambioNotable) } });
  const cabecera = el('div', { class: 'fintrax-comp__head' });
  cabecera.append(el('strong', { text: fila.label }));
  const cifras = `Usual ${formato(fila.base)} → Current ${formato(fila.actual)} ${fila.unit}`;
  const delta = fila.delta === null || fila.delta === 0 ? '' : ` (${fila.delta > 0 ? '+' : ''}${formato(fila.delta)})`;
  cabecera.append(el('span', { text: cifras + delta }));
  item.append(cabecera, grafica(fila));
  const motivo = fila.estado === 'bad' ? 'Out of range: needs attention'
    : fila.estado === 'warn' ? 'Outside the normal range'
      : fila.cambioNotable ? 'Notable change from your usual value' : '';
  if (motivo) item.append(el('small', { class: 'fintrax-comp__motivo', text: motivo }));
  return item;
}

/** Pinta la comparativa en `host`. */
export function createComparativa(host) {
  return {
    update(habitual, actual) {
      if (!host) return;
      limpiar(host);
      const { anomalas, normales } = compararRegistros(habitual, actual);
      if (anomalas.length) {
        const lista = el('ul', { class: 'fintrax-comp-lista' });
        for (const fila of anomalas) lista.append(filaComparativa(fila));
        host.append(lista);
      } else {
        host.append(el('p', { class: 'fintrax-accion-vacio', text: 'No anomalies compared with your usual record.' }));
      }
      if (normales.length) {
        const detalle = el('details', { class: 'fintrax-comp-normales' });
        detalle.append(el('summary', { text: `No relevant changes (${normales.length})` }));
        const lista = el('ul', { class: 'fintrax-comp-lista' });
        for (const fila of normales) lista.append(filaComparativa(fila));
        detalle.append(lista);
        host.append(detalle);
      }
    }
  };
}
