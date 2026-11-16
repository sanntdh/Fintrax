/**
 * Avatar holográfico con zonas interactivas.
 *
 * Se construye dos veces (formulario y resultados) en lugar de mover un nodo
 * entre paneles, como hacía el prototipo. Cada instancia mantiene su propio SVG
 * y comparte las mismas coordenadas y el mismo catálogo de zonas.
 */

import { el, svg, limpiar } from './dom.js';
import { zonasPara } from '../data/symptoms.js';
import { ESTADOS } from '../data/severity.js';

/** Coordenadas tomadas del SVG original (viewBox 941×1672). */
const HOTSPOTS = [
  { zone: 'cabeza', cx: 470, cy: 180, wave: 22, dot: 13, label: 'Head area' },
  { zone: 'ojos', cx: 470, cy: 213, wave: 20, dot: 11, label: 'Eyes area' },
  { zone: 'pecho', cx: 470, cy: 438, wave: 23, dot: 13, label: 'Chest area' },
  { zone: 'estomago', cx: 470, cy: 575, wave: 23, dot: 13, label: 'Stomach area' },
  { zone: 'pelvis', cx: 470, cy: 715, wave: 23, dot: 13, label: 'Pelvis area' },
  { zone: 'extremidades', cx: 390, cy: 950, wave: 22, dot: 13, label: 'Legs area' },
  { zone: 'extremidades', cx: 270, cy: 655, wave: 22, dot: 13, label: 'Arms area' }
];

/**
 * Imagen del holograma para un sexo. Solo WebP: lo soportan todos los
 * navegadores actuales y pesa ~40 KB frente a ~1,2 MB del PNG original.
 * @param {string} sexo 'Female' | 'Male'
 * @param {string} clases clases del contenedor
 */
export function imagenAvatar(sexo, clases) {
  const picture = el('picture', { class: clases });
  picture.append(el('img', {
    src: sexo === 'Female' ? 'assets/avatar-female.webp' : 'assets/avatar-male.webp',
    alt: '',
    width: 941,
    height: 1672,
    decoding: 'async'
  }));
  return picture;
}

const crearImagen = (clase, sexo) => imagenAvatar(sexo, `fintrax-avatar__img ${clase}`);

function crearHotspots(onZoneSelect) {
  const groups = HOTSPOTS.map((hot) => {
    const group = svg('g', {
      class: 'fintrax-hot',
      'data-zone': hot.zone,
      tabindex: '0',
      role: 'button',
      'aria-label': hot.label
    });
    group.append(
      svg('circle', { class: 'wave', cx: hot.cx, cy: hot.cy, r: hot.wave }),
      svg('circle', { class: 'dot', cx: hot.cx, cy: hot.cy, r: hot.dot })
    );
    if (onZoneSelect) {
      const activar = () => onZoneSelect(hot.zone);
      group.addEventListener('click', activar);
      group.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activar();
        }
      });
    }
    return group;
  });

  const labels = svg('g', { 'data-avatar-labels': '' });
  return { root: svg('svg', { class: 'fintrax-avatar__hotspots', viewBox: '0 0 941 1672' }, groups), labels };
}

/**
 * @param {{variant?: 'form'|'results', onZoneSelect?: (zone: string) => void}} options
 */
export function createAvatar({ variant = 'form', onZoneSelect } = {}) {
  const root = el('div', { class: 'fintrax-avatar', dataset: { sex: '', glow: 'na' } });
  root.append(crearImagen('fintrax-avatar__img--female', 'Female'));
  root.append(crearImagen('fintrax-avatar__img--male', 'Male'));

  const { root: hotspots, labels } = crearHotspots(onZoneSelect);
  hotspots.append(labels);
  root.append(hotspots);

  if (variant === 'form') {
    root.append(el('span', { class: 'fintrax-avatar__sweep', 'aria-hidden': 'true' }));
  }

  const groups = [...hotspots.querySelectorAll('.fintrax-hot')];

  function setSex(sexo) {
    const valor = sexo === 'Female' || sexo === 'Male' ? sexo : '';
    root.dataset.sex = valor;
    const disponibles = zonasPara(valor);
    for (const group of groups) {
      group.hidden = !(group.dataset.zone in disponibles);
    }
  }

  function setActive(activas) {
    const set = activas instanceof Set ? activas : new Set(activas || []);
    for (const group of groups) group.classList.toggle('on', set.has(group.dataset.zone));
  }

  function setSelection(zone) {
    for (const group of groups) group.classList.toggle('sel', group.dataset.zone === zone);
  }

  function setGlow(estado) {
    root.dataset.glow = estado || 'na';
  }

  function setStatuses(zonas) {
    limpiar(labels);
    for (const group of groups) {
      const clave = group.dataset.zone;
      const zona = zonas ? zonas[clave] : null;
      group.classList.remove('st-ok', 'st-warn', 'st-bad');
      if (!zona || group.hidden) continue;
      const estado = zona.st || 'na';
      group.classList.add(`st-${estado}`);
      if (estado === 'na') continue;

      const hot = HOTSPOTS.find((item) => item.label === group.getAttribute('aria-label'));
      if (!hot) continue;
      const izquierda = hot.cx < 400 || clave === 'ojos';
      const texto = svg('text', {
        class: 'fintrax-hl',
        x: izquierda ? hot.cx - 34 : hot.cx + 36,
        y: hot.cy + 10,
        'text-anchor': izquierda ? 'end' : 'start',
        fill: (ESTADOS[estado] || ESTADOS.na).h
      });
      texto.textContent = `${hot.label.replace('Area ', '').toUpperCase()} · ${(ESTADOS[estado] || ESTADOS.na).t}`;
      labels.append(texto);
    }
  }

  setSex('');
  return { root, setSex, setActive, setSelection, setGlow, setStatuses };
}
