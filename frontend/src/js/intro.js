/** Línea de tiempo de «Fintrax Código Error.html», reproducida una sola vez. */
import { $, svg, movimientoReducido } from './dom.js';
import { crearFondoFintrax } from './fintrax-background.js';

const DURACION = 10000;

function octagono(cx, cy, radio) {
  return Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI / 8 + i * Math.PI / 4;
    return `${(cx + radio * Math.cos(a)).toFixed(1)},${(cy + radio * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

function crearIconos(root) {
  const trazo = { stroke: '#c9e6ec', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  const iconos = [
    [170, 230, [
      svg('rect', { ...trazo, x: -22, y: -24, width: 44, height: 56, rx: 5 }),
      svg('rect', { ...trazo, x: -10, y: -33, width: 20, height: 12, rx: 3, fill: '#0a2a33' }),
      svg('path', { ...trazo, d: 'M-12 -4H12M-12 6H12M-12 16H12M-12 26H6', 'stroke-width': 3 })
    ]],
    [854, 230, [
      svg('use', { href: '#fintrax-heart', transform: 'scale(.27) translate(0 -8)', fill: 'none', stroke: '#c9e6ec', 'stroke-width': 14, 'stroke-linejoin': 'round' }),
      svg('path', { ...trazo, d: 'M-22 2H-9L-3 -9L5 14L11 2H22', 'stroke-width': 3.5 })
    ]],
    [170, 736, [svg('g', { transform: 'rotate(-42)' }, [
      svg('rect', { x: -33, y: -15, width: 66, height: 30, rx: 15, fill: '#a9c1ca', stroke: '#cfe3ea', 'stroke-width': 3 }),
      svg('path', { d: 'M0 -15V15', stroke: '#4d7b8c', 'stroke-width': 3 }),
      svg('rect', { x: -33, y: -15, width: 33, height: 30, rx: 15, fill: '#c0d4db' })
    ])]],
    [854, 726, [svg('path', { d: 'M-9 -34H9V-9H34V9H9V34H-9V9H-34V-9H-9Z', fill: '#b2dee4', stroke: '#d4eef2', 'stroke-width': 3, 'stroke-linejoin': 'round' })]]
  ];
  iconos.forEach(([x, y, contenido], i) => {
    const host = $(`#fintrax-ic${i + 1}`, root);
    host.replaceChildren(
      svg('polygon', { points: octagono(x, y, 76), fill: 'rgba(5,62,80,.6)', stroke: '#86d3bf', 'stroke-width': 3, 'stroke-linejoin': 'round', style: 'filter:drop-shadow(0 0 8px rgba(120,230,200,.5))' }),
      svg('polygon', { points: octagono(x, y, 66), fill: 'none', stroke: '#86d3bf', 'stroke-opacity': 0.3, 'stroke-width': 1.5 }),
      svg('polygon', { points: octagono(x, y, 86), fill: 'none', stroke: '#86d3bf', 'stroke-opacity': 0.14, 'stroke-width': 1.5 }),
      svg('g', { transform: `translate(${x} ${y})` }, contenido)
    );
  });
}

export function initIntro({ onDone }) {
  const root = $('[data-intro]');
  const reduce = movimientoReducido() || typeof root.animate !== 'function';
  const animaciones = [];
  let terminado = false;
  let timer;
  crearIconos(root);
  const detenerFondo = crearFondoFintrax($('#fintrax-fondo'), reduce);

  function finalizar() {
    if (terminado) return;
    terminado = true;
    clearTimeout(timer);
    detenerFondo();
    for (const animacion of animaciones) animacion.cancel();
    onDone();
  }

  function tl(id, inicio, fin, desde, hasta, opciones = {}) {
    const nodo = $(`#fintrax-${id}`, root);
    if (reduce) {
      Object.assign(nodo.style, hasta);
      return;
    }
    const frames = [
      { offset: 0, ...desde },
      { offset: inicio / DURACION, ...desde },
      { offset: fin / DURACION, easing: 'ease-out', ...hasta },
      { offset: opciones.hold ?? 0.93, ...hasta },
      { offset: 1, ...(opciones.out || { opacity: 0 }) }
    ];
    animaciones.push(nodo.animate(frames, { duration: DURACION, iterations: 1, fill: 'both' }));
  }

  function pulso(id, inicio, fin) {
    $(`#fintrax-${id}`, root).style.strokeDasharray = '1';
    tl(id, inicio, fin, { opacity: 1, strokeDashoffset: 1 }, { opacity: 1, strokeDashoffset: 0 }, { out: { opacity: 0, strokeDashoffset: 0 } });
  }

  const visible = { opacity: 1 }, oculto = { opacity: 0 };
  tl('flare', 150, 700, { opacity: 0, transform: 'scale(.1)', transformOrigin: '505px 490px' }, { opacity: 1, transform: 'scale(1)', transformOrigin: '505px 490px' }, { hold: 0.14, out: { opacity: 0, transform: 'scale(1.8)', transformOrigin: '505px 490px' } });
  tl('ringSeg', 600, 1500, oculto, { opacity: 0.9 }, { hold: 0.18 });
  tl('disc', 900, 1700, oculto, visible);
  tl('ringThin', 900, 1700, oculto, visible);
  tl('ringIn', 1000, 1800, oculto, visible);
  tl('ringArc', 1200, 2000, oculto, visible);
  tl('heartG', 1300, 2100, oculto, visible);
  pulso('ecg1', 2000, 2700);
  tl('cross', 1700, 2300, { opacity: 0, transform: 'translate(596px,303px) scale(.4)' }, { opacity: 1, transform: 'translate(596px,303px) scale(1)' });
  tl('swoosh', 1700, 2500, oculto, { opacity: 0.95 });
  tl('txtSpace', 2300, 3000, { opacity: 0, letterSpacing: '20px' }, { opacity: 1, letterSpacing: '0px' });
  tl('sub', 2800, 3500, oculto, visible);
  tl('gline', 3000, 3700, oculto, visible);
  pulso('ecgL', 3400, 4200);
  pulso('ecgR', 3400, 4200);
  ['ic1', 'ic2', 'ic3', 'ic4'].forEach((id, i) => tl(id, 4000 + i * 220, 4600 + i * 220, oculto, visible));

  // El modo de movimiento reducido presenta el emblema estático brevemente.
  if (animaciones.length) Promise.all(animaciones.map((a) => a.finished)).then(finalizar).catch(() => {});
  timer = setTimeout(finalizar, reduce ? 1200 : DURACION + 150);
}
