/**
 * Telemetría de las cuatro series (frecuencia cardíaca, saturación, presión y
 * temperatura).
 *
 * Diferencia deliberada con el prototipo: si no hay una medición real, la
 * tarjeta muestra «sin datos» y no dibuja ninguna curva inventada. El título de
 * la columna ya advierte que la telemetría es simulada.
 */

import { el, limpiar, movimientoReducido } from './dom.js';
import { escala } from './format.js';

const COLORES = { ok: '#00f5b4', warn: '#ffaa33', bad: '#ff3860', na: '#8ebad9' };
const PUNTOS = 60;

function crearTarjeta(serie) {
  const card = el('article', { class: 'astra-chart', dataset: { hasData: 'false', st: 'na' } });

  const cabecera = el('header');
  cabecera.append(el('span', { text: serie.name }));
  const lectura = el('span');
  const valor = el('b', { text: '—' });
  const unidad = el('small', { text: serie.unit });
  lectura.append(valor, unidad);
  cabecera.append(lectura);
  card.append(cabecera);

  const canvas = el('canvas', { 'aria-hidden': 'true' });
  const vacio = el('div', { class: 'astra-chart__empty', text: serie.source });
  const fuente = el('span', { class: 'astra-chart__source', text: serie.source });
  card.append(canvas, vacio, fuente);

  return { card, canvas, valor, vacio, fuente, serie, data: [] };
}

function generar(serie) {
  let valor = serie.base;
  const data = [];
  for (let i = 0; i < PUNTOS; i++) {
    valor = serie.base + (valor - serie.base) * 0.7 + (Math.random() - 0.5) * serie.ripple * 2;
    data.push(valor);
  }
  return data;
}

function dibujar(tarjeta) {
  const { canvas, serie, data } = tarjeta;
  if (!serie.hasData || data.length === 0) return;

  const ancho = canvas.clientWidth;
  const alto = canvas.clientHeight;
  if (!ancho || !alto) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

  const py = (v) => alto - margenInf - ((v - serie.lo) / (serie.hi - serie.lo)) * (alto - 22);
  const px = (i) => margenIzq + (i / (PUNTOS - 1)) * util;
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
  for (let i = 0; i <= 6; i++) {
    const x = margenIzq + (i * util) / 6;
    ctx.beginPath();
    ctx.moveTo(x, margenSup);
    ctx.lineTo(x, alto - margenInf);
    ctx.stroke();
  }

  // Límites de la banda.
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(0,245,180,.4)';
  for (const limite of [serie.ok[0], serie.ok[1]]) {
    if (limite > serie.lo && limite < serie.hi) {
      ctx.beginPath();
      ctx.moveTo(margenIzq, py(limite));
      ctx.lineTo(ancho - margenDer, py(limite));
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // Área y línea.
  const gradiente = ctx.createLinearGradient(0, 0, 0, alto);
  gradiente.addColorStop(0, `${color}55`);
  gradiente.addColorStop(1, `${color}00`);

  ctx.beginPath();
  data.forEach((v, i) => (i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v))));
  ctx.lineTo(px(PUNTOS - 1), alto - margenInf);
  ctx.lineTo(px(0), alto - margenInf);
  ctx.fillStyle = gradiente;
  ctx.fill();

  ctx.beginPath();
  data.forEach((v, i) => (i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v))));
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 9;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.shadowBlur = 0;

  const ultimo = data[data.length - 1];
  ctx.beginPath();
  ctx.arc(px(PUNTOS - 1), py(ultimo), 4, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();

  // Etiquetas.
  ctx.fillStyle = '#8ebad9';
  ctx.font = '10px Rajdhani, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(String(serie.hi), margenIzq - 4, margenSup + 8);
  ctx.fillText(String(serie.lo), margenIzq - 4, alto - margenInf + 2);
  ctx.textAlign = 'left';
  ctx.fillText('−60 s', margenIzq, alto - 2);
  ctx.textAlign = 'right';
  ctx.fillText('AHORA', ancho - margenDer, alto - 2);
  ctx.textAlign = 'left';
}

function actualizarLectura(tarjeta) {
  const { serie, data, card, valor, vacio, fuente } = tarjeta;

  card.dataset.hasData = String(serie.hasData);
  fuente.textContent = serie.source;
  vacio.textContent = 'Sin datos disponibles';
  vacio.hidden = serie.hasData;

  if (!serie.hasData || data.length === 0) {
    valor.textContent = '—';
    card.dataset.st = 'na';
    return;
  }

  const ultimo = data[data.length - 1];
  const estado = escala(ultimo, serie);
  card.dataset.st = estado;
  valor.textContent = ultimo.toFixed(serie.decimals);
  dibujar(tarjeta);
}

/**
 * @param {HTMLElement|null} host
 */
export function createCharts(host) {
  if (!host) return { update() {}, destroy() {} };

  let tarjetas = [];
  let timer = null;
  let observer = null;
  const reducido = movimientoReducido();

  function destruirTarjetas() {
    clearInterval(timer);
    timer = null;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    limpiar(host);
    tarjetas = [];
  }

  function tick() {
    for (const tarjeta of tarjetas) {
      if (!tarjeta.serie.hasData) continue;
      const previo = tarjeta.data[tarjeta.data.length - 1];
      const siguiente =
        tarjeta.serie.base +
        (previo - tarjeta.serie.base) * 0.7 +
        (Math.random() - 0.5) * tarjeta.serie.ripple * 2;
      tarjeta.data.push(siguiente);
      tarjeta.data.shift();
      actualizarLectura(tarjeta);
    }
  }

  function construir(series) {
    destruirTarjetas();
    for (const serie of series) {
      const tarjeta = crearTarjeta(serie);
      tarjeta.data = serie.hasData ? generar(serie) : [];
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

    if (!reducido) timer = setInterval(tick, 1000);
  }

  function update(series) {
    const mismas =
      tarjetas.length === series.length &&
      tarjetas.every((tarjeta, i) => tarjeta.serie.id === series[i].id);

    if (!mismas) {
      construir(series);
      return;
    }

    tarjetas.forEach((tarjeta, i) => {
      const nueva = series[i];
      const teniaDatos = tarjeta.serie.hasData;
      tarjeta.serie = nueva;
      if (nueva.hasData && !teniaDatos) tarjeta.data = generar(nueva);
      if (!nueva.hasData) tarjeta.data = [];
      actualizarLectura(tarjeta);
    });
  }

  return { update, destroy: destruirTarjetas };
}
