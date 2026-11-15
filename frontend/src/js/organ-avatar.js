/**
 * Avatar de la Etapa 2: silueta existente + capa SVG de órganos.
 *
 * Se conserva la imagen raster del avatar (la misma de la Etapa 1) y encima se
 * dibujan siete órganos interactivos con su línea guía. Cada órgano lleva su
 * color propio, pero el estado nunca se comunica solo por color: siempre hay
 * una etiqueta de texto y un `aria-label`.
 *
 * Las etiquetas son HTML, no `<text>` del SVG. El avatar mide ~294 px de ancho
 * para un viewBox de 941: un texto de 26 unidades se vería a 8 px. Con etiquetas
 * HTML el tamaño no depende del escalado del dibujo y se leen a 10–11 px con
 * el fondo propio de una píldora.
 *
 * El tamaño táctil mínimo (44 px) se resuelve con un círculo transparente de
 * `hit` unidades; las formas visibles son más pequeñas.
 */

import { el, svg } from './dom.js';
import { ORGANOS, ORGAN_ORDER } from '../data/organs.js';
import { ORGAN_SHAPES } from '../data/organ-shapes.js';
import { ESTADOS } from '../data/severity.js';

const VIEWBOX = { w: 941, h: 1672 };

/**
 * Orden de pintado: los órganos profundos primero para que el corazón y el
 * cerebro queden por encima. No afecta al orden de lectura ni al de la
 * transición, que siguen `ORGAN_ORDER`.
 */
const ORGAN_PAINT = ['rinones', 'higado', 'intestinos', 'estomago', 'pulmones', 'corazon', 'cerebro'];

const pct = (parte, total) => `${((parte / total) * 100).toFixed(2)}%`;

function crearImagen(clase, sexo) {
  const base = sexo === 'Femenino' ? 'assets/avatar-female' : 'assets/avatar-male';
  const picture = el('picture', { class: `astra-avatar__img ${clase}` });
  picture.append(
    el('source', { srcset: `${base}.webp`, type: 'image/webp' }),
    el('img', {
      src: `${base}.png`,
      alt: '',
      width: 941,
      height: 1672,
      decoding: 'async'
    })
  );
  return picture;
}

function crearNodo(key, onSelect) {
  const meta = ORGANOS[key];
  const forma = ORGAN_SHAPES[key];

  const grupo = svg('g', {
    class: 'astra-organ-node',
    'data-organ': key,
    'data-stroke': forma.stroke ? 'true' : null,
    transform: `translate(${meta.anchor.x} ${meta.anchor.y})`,
    tabindex: '0',
    role: 'button',
    'aria-label': `${meta.label}: sin datos`,
    style: `--organ:${meta.color}`
  });

  grupo.append(svg('circle', { class: 'astra-organ-node__halo', r: forma.hit + 12 }));

  for (const d of forma.paths) {
    grupo.append(
      svg('path', {
        class: 'astra-organ-node__shape',
        d,
        'stroke-width': forma.stroke || null,
        'stroke-linecap': forma.stroke ? 'round' : null,
        'stroke-linejoin': forma.stroke ? 'round' : null
      })
    );
  }

  for (const d of forma.details) {
    grupo.append(svg('path', { class: 'astra-organ-node__detail', d }));
  }

  grupo.append(svg('circle', { class: 'astra-organ-node__ring', r: forma.hit + 5 }));
  grupo.append(svg('circle', { class: 'astra-organ-node__target', r: forma.hit }));

  const activar = () => onSelect?.(key);
  grupo.addEventListener('click', activar);
  grupo.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activar();
    }
  });

  return grupo;
}

/** Guía + punto de anclaje. El texto va aparte, en HTML. */
function crearGuia(key) {
  const meta = ORGANOS[key];
  const puntos = meta.line.map(([x, y]) => `${x},${y}`).join(' ');
  const grupo = svg('g', { class: 'astra-organ-leader', 'data-organ': key, style: `--organ:${meta.color}` });
  grupo.append(svg('polyline', { class: 'astra-organ-leader__line', points: puntos }));
  grupo.append(
    svg('circle', {
      class: 'astra-organ-leader__dot',
      cx: meta.labelAt.x,
      cy: meta.labelAt.y,
      r: 5
    })
  );
  return grupo;
}

function crearEtiqueta(key, onSelect) {
  const meta = ORGANOS[key];
  const lado = meta.labelAt.anchor === 'start' ? 'start' : 'end';

  const boton = el('button', {
    type: 'button',
    class: 'astra-organ-tag',
    dataset: { organ: key, anchor: lado },
    style: [
      `--organ:${meta.color}`,
      `left:${pct(meta.labelAt.x, VIEWBOX.w)}`,
      `top:${pct(meta.labelAt.y, VIEWBOX.h)}`
    ].join(';'),
    'aria-label': `${meta.label}: sin datos`
  });
  boton.append(el('span', { class: 'astra-organ-tag__name', text: meta.label }));

  const activar = () => onSelect?.(key);
  boton.addEventListener('click', activar);
  return boton;
}

/**
 * @param {{onSelect?: (key: string) => void}} opciones
 */
export function createOrganAvatar({ onSelect } = {}) {
  const root = el('div', {
    class: 'astra-avatar astra-organ-avatar',
    dataset: { sex: '', glow: 'na' }
  });

  root.append(crearImagen('astra-avatar__img--female', 'Femenino'));
  root.append(crearImagen('astra-avatar__img--male', 'Masculino'));

  const capa = svg('svg', {
    class: 'astra-organ-avatar__layer',
    viewBox: `0 0 ${VIEWBOX.w} ${VIEWBOX.h}`,
    role: 'group',
    'aria-label': 'Órganos interactivos del cuerpo'
  });

  const guias = svg('g', { class: 'astra-organ-leaders' });
  const nodos = svg('g', { class: 'astra-organ-nodes' });

  for (const key of ORGAN_ORDER) guias.append(crearGuia(key));
  for (const key of ORGAN_PAINT) nodos.append(crearNodo(key, onSelect));

  capa.append(guias, nodos);
  root.append(capa);

  const etiquetas = el('div', { class: 'astra-organ-tags' });
  for (const key of ORGAN_ORDER) etiquetas.append(crearEtiqueta(key, onSelect));
  root.append(etiquetas);

  const nodosPorClave = new Map(
    [...root.querySelectorAll('.astra-organ-node')].map((nodo) => [nodo.dataset.organ, nodo])
  );
  const guiasPorClave = new Map(
    [...root.querySelectorAll('.astra-organ-leader')].map((nodo) => [nodo.dataset.organ, nodo])
  );
  const etiquetasPorClave = new Map(
    [...root.querySelectorAll('.astra-organ-tag')].map((nodo) => [nodo.dataset.organ, nodo])
  );

  function setSex(sexo) {
    root.dataset.sex = sexo || '';
  }

  function setGlow(estado) {
    root.dataset.glow = estado || 'na';
  }

  /**
   * @param {Record<string, {state: string, label: string}>} organos
   * @param {string} seleccionado
   */
  function setOrgans(organos, seleccionado = '') {
    for (const key of ORGAN_ORDER) {
      const organo = organos?.[key];
      const estado = organo?.state || 'na';
      const etiqueta = (ESTADOS[estado] || ESTADOS.na).t;
      const activo = key === seleccionado;

      for (const mapa of [nodosPorClave, guiasPorClave, etiquetasPorClave]) {
        const nodo = mapa.get(key);
        if (!nodo) continue;
        nodo.dataset.st = estado;
        nodo.dataset.selected = String(activo);
      }

      for (const mapa of [nodosPorClave, etiquetasPorClave]) {
        const nodo = mapa.get(key);
        if (!nodo) continue;
        nodo.setAttribute('aria-label', `${organo?.label || key}: ${etiqueta}`);
        nodo.setAttribute('aria-pressed', activo ? 'true' : 'false');
      }
    }
  }

  function setSelection(key) {
    for (const nodo of root.querySelectorAll('.astra-organ-node, .astra-organ-tag')) {
      nodo.dataset.selected = String(nodo.dataset.organ === key);
    }
  }

  return { root, setSex, setGlow, setOrgans, setSelection };
}
