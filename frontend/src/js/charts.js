/**
 * Gráficas del historial oficial.
 *
 * Sustituyen a la telemetría simulada del prototipo: ya no hay temporizadores
 * ni valores aleatorios. Cada serie se construye a partir de `GET /historial`
 * (evaluaciones reales, ordenadas por tiempo) y de la línea base activa
 * (`GET /linea-base`) como referencia. Un dato ausente queda en `null`: la
 * gráfica no lo inventa.
 */

import { el, limpiar } from './dom.js';
import { escala, num } from './format.js';

const COLORES = { ok: '#00f5b4', warn: '#ffaa33', bad: '#ff3860', na: '#8ebad9' };

/** Series mostradas: NEWS2 y los cinco signos frente a la línea base. */
const DEFINICIONES = [
  { id: 'news2', name: 'NEWS2', unit: '', decimals: 0, lo: 0, hi: 12, ok: [0, 4], wn: [0, 6], campo: null },
  { id: 'fc', name: 'FRECUENCIA CARDÍACA', unit: 'bpm', decimals: 0, lo: 40, hi: 160, ok: [50, 100], wn: [40, 130], campo: 'fc' },
  { id: 'spo2', name: 'SATURACIÓN DE OXÍGENO', unit: '%', decimals: 0, lo: 85, hi: 100, ok: [96, 100], wn: [92, 100], campo: 'spo2' },
  { id: 'pas', name: 'PRESIÓN SISTÓLICA', unit: 'mmHg', decimals: 0, lo: 70, hi: 180, ok: [90, 129], wn: [85, 159], campo: 'pas' },
  { id: 'fr', name: 'FRECUENCIA RESPIRATORIA', unit: 'rpm', decimals: 0, lo: 6, hi: 40, ok: [12, 20], wn: [9, 24], campo: 'fr' },
  { id: 'temp', name: 'TEMPERATURA CORPORAL', unit: '°C', decimals: 1, lo: 35, hi: 40, ok: [36.1, 37.5], wn: [35.5, 38.5], campo: 'temp' }
];

/** Base general activa (fase_ciclo nulo) o, si no existe, la última activa. */
export function baseActiva(bases) {
  if (!Array.isArray(bases) || bases.length === 0) return null;
  const activas = bases.filter((base) => base && base.activa !== false);
  const candidatas = activas.length ? activas : bases;
  return candidatas.find((base) => base.fase_ciclo === null || base.fase_ciclo === undefined) || candidatas[candidatas.length - 1];
}

/**
 * Ordena el historial por tiempo real y extrae los valores por evaluación.
 * Los signos ausentes quedan como `null`, nunca como cero.
 * @param {object[]} historial
 */
export function extraerPuntos(historial) {
  const lista = Array.isArray(historial) ? historial.filter(Boolean) : [];
  return [...lista]
    .sort((a, b) => String(a.ts ?? '').localeCompare(String(b.ts ?? '')))
    .map((evaluacion) => ({
      t: evaluacion.ts ?? null,
      news2: num(evaluacion.news2_total),
      signos: evaluacion.entrada && evaluacion.entrada.signos ? evaluacion.entrada.signos : null
    }));
}

/**
 * Construye las series del historial frente a la línea base.
 * @param {object[]} historial
 * @param {object[]} bases
 */
export function construirSeriesHistorial(historial, bases) {
  const puntos = extraerPuntos(historial);
  const base = baseActiva(bases);

  return DEFINICIONES.map((definicion) => {
    const points = puntos.map((punto) => ({
      t: punto.t,
      v: definicion.campo === null ? punto.news2 : num(punto.signos ? punto.signos[definicion.campo] : null)
    }));
    const baseValor = definicion.campo === null ? null : num(base ? base[definicion.campo] : null);
    return {
      ...definicion,
      baseValor,
      points,
      hasData: points.some((punto) => punto.v !== null)
    };
  });
}

function crearTarjeta(serie) {
  const card = el('article', { class: 'astra-chart', dataset: { hasData: 'false', st: 'na' } });

  const cabecera = el('header');
  cabecera.append(el('span', { text: serie.name }));
  const lectura = el('span');
  const valor = el('b', { text: '—' });
  lectura.append(valor, el('small', { text: serie.unit }));
  cabecera.append(lectura);
  card.append(cabecera);

  const canvas = el('canvas', { 'aria-hidden': 'true' });
  const vacio = el('div', { class: 'astra-chart__empty', text: 'Sin datos del historial' });
  const fuente = el('span', { class: 'astra-chart__source', text: '' });
  card.append(canvas, vacio, fuente);

  return { card, canvas, valor, vacio, fuente, serie, points: [] };
}

function ultimoValor(points) {
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].v !== null) return points[i].v;
  }
  return null;
}

function dibujar(tarjeta) {
  const { canvas, serie, points } = tarjeta;
  if (!serie.hasData || points.length === 0) return;

  const ancho = canvas.clientWidth;
  const alto = canvas.clientHeight;
  if (!ancho || !alto) return;

  const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
  canvas.width = Math.round(ancho * dpr);
  canvas.height = Math.round(alto * dpr);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, ancho, alto);

  const margenIzq = 34;
  const margenDer = 8;
  const margenSup = 8;
  const margenInf = 14;
  const util = ancho - margenIzq - margenDer;
  const altoUtil = alto - margenSup - margenInf;
  const n = points.length;

  const py = (v) => alto - margenInf - ((v - serie.lo) / (serie.hi - serie.lo)) * (alto - 22);
  const px = (i) => (n === 1 ? margenIzq + util / 2 : margenIzq + (i / (n - 1)) * util);
  const color = COLORES[tarjeta.card.dataset.st] || COLORES.na;

  // Banda de normalidad.
  ctx.fillStyle = 'rgba(0,245,180,.07)';
  ctx.fillRect(margenIzq, py(serie.ok[1]), util, py(serie.ok[0]) - py(serie.ok[1]));

  // Rejilla.
  ctx.strokeStyle = 'rgba(0,240,255,.1)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = margenSup + (i * altoUtil) / 3;
    ctx.beginPath();
    ctx.moveTo(margenIzq, y);
    ctx.lineTo(ancho - margenDer, y);
    ctx.stroke();
  }

  // Referencia de la línea base.
  if (serie.baseValor !== null) {
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = 'rgba(56,225,255,.75)';
    ctx.beginPath();
    ctx.moveTo(margenIzq, py(serie.baseValor));
    ctx.lineTo(ancho - margenDer, py(serie.baseValor));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Área y línea, rompiendo en los huecos.
  const gradiente = ctx.createLinearGradient(0, 0, 0, alto);
  gradiente.addColorStop(0, `${color}55`);
  gradiente.addColorStop(1, `${color}00`);

  ctx.beginPath();
  let trazando = false;
  points.forEach((punto, i) => {
    if (punto.v === null) {
      trazando = false;
      return;
    }
    if (!trazando) {
      ctx.moveTo(px(i), py(punto.v));
      trazando = true;
    } else {
      ctx.lineTo(px(i), py(punto.v));
    }
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 9;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Último punto válido.
  const ultimo = ultimoValor(points);
  if (ultimo !== null) {
    const indice = points.map((punto) => punto.v).lastIndexOf(ultimo);
    ctx.beginPath();
    ctx.arc(px(indice), py(ultimo), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  // Etiquetas.
  ctx.fillStyle = '#8ebad9';
  ctx.font = '10px Rajdhani, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(String(serie.hi), margenIzq - 4, margenSup + 8);
  ctx.fillText(String(serie.lo), margenIzq - 4, alto - margenInf + 2);
  ctx.textAlign = 'left';
  ctx.fillText('INICIO', margenIzq, alto - 2);
  ctx.textAlign = 'right';
  ctx.fillText('AHORA', ancho - margenDer, alto - 2);
  ctx.textAlign = 'left';
}

function actualizarLectura(tarjeta) {
  const { serie, points, card, valor, vacio, fuente } = tarjeta;

  card.dataset.hasData = String(serie.hasData);
  vacio.textContent = 'Sin datos del historial';
  vacio.hidden = serie.hasData;
  fuente.textContent = serie.baseValor === null ? '' : `Referencia base: ${serie.baseValor}`;

  const ultimo = ultimoValor(points);
  if (!serie.hasData || ultimo === null) {
    valor.textContent = '—';
    card.dataset.st = 'na';
    return;
  }

  card.dataset.st = escala(ultimo, serie);
  valor.textContent = ultimo.toFixed(serie.decimals);
  dibujar(tarjeta);
}

/**
 * @param {HTMLElement|null} host
 */
export function createCharts(host) {
  if (!host) return { update() {}, destroy() {} };

  let tarjetas = [];
  let observer = null;

  function destruirTarjetas() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    limpiar(host);
    tarjetas = [];
  }

  function construir(series) {
    destruirTarjetas();
    for (const serie of series) {
      const tarjeta = crearTarjeta(serie);
      tarjeta.points = serie.points || [];
      host.append(tarjeta.card);
      tarjetas.push(tarjeta);
      actualizarLectura(tarjeta);
    }

    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(() => {
        for (const tarjeta of tarjetas) dibujar(tarjeta);
      });
      for (const tarjeta of tarjetas) observer.observe(tarjeta.canvas);
    }
  }

  function update(series) {
    const lista = Array.isArray(series) ? series : [];
    const mismas =
      tarjetas.length === lista.length &&
      tarjetas.every((tarjeta, i) => tarjeta.serie.id === lista[i].id);

    if (!mismas) {
      construir(lista);
      return;
    }

    tarjetas.forEach((tarjeta, i) => {
      tarjeta.serie = lista[i];
      tarjeta.points = lista[i].points || [];
      actualizarLectura(tarjeta);
    });
  }

  return { update, destroy: destruirTarjetas };
}
