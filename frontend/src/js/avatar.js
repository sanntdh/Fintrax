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
  { zone: 'cabeza', cx: 470, cy: 180, wave: 22, dot: 13, label: 'Zona Cabeza' },
  { zone: 'ojos', cx: 470, cy: 213, wave: 20, dot: 11, label: 'Zona Ojos' },
  { zone: 'pecho', cx: 470, cy: 438, wave: 23, dot: 13, label: 'Zona Pecho' },
  { zone: 'estomago', cx: 470, cy: 575, wave: 23, dot: 13, label: 'Zona Estómago' },
  { zone: 'pelvis', cx: 470, cy: 715, wave: 23, dot: 13, label: 'Zona Pelvis' },
  { zone: 'extremidades', cx: 390, cy: 950, wave: 22, dot: 13, label: 'Zona Piernas' },
  { zone: 'extremidades', cx: 270, cy: 655, wave: 22, dot: 13, label: 'Zona Brazos' }
];

function crearImagen(clase, sexo) {
  const src = sexo === 'Femenino' ? 'assets/avatar-female' : 'assets/avatar-male';
  const picture = el('picture', { class: `astra-avatar__img ${clase}` });
  picture.append(
    el('source', { srcset: `${src}.webp`, type: 'image/webp' }),
    el('img', {
      src: `${src}.png`,
      alt: '',
      width: 941,
      height: 1672,
      decoding: 'async'
    })
  );
  return picture;
}

function crearHotspots(onZoneSelect) {
  const groups = HOTSPOTS.map((hot) => {
    const group = svg('g', {
      class: 'astra-hot',
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
  return { root: svg('svg', { class: 'astra-avatar__hotspots', viewBox: '0 0 941 1672' }, groups), labels };
}

/**
 * @param {{variant?: 'form'|'results', onZoneSelect?: (zone: string) => void}} options
 */
export function createAvatar({ variant = 'form', onZoneSelect } = {}) {
  const root = el('div', { class: 'astra-avatar', dataset: { sex: '', glow: 'na' } });
  root.append(crearImagen('astra-avatar__img--female', 'Femenino'));
  root.append(crearImagen('astra-avatar__img--male', 'Masculino'));

  const { root: hotspots, labels } = crearHotspots(onZoneSelect);
  hotspots.append(labels);
  root.append(hotspots);

  if (variant === 'form') {
    root.append(el('span', { class: 'astra-avatar__sweep', 'aria-hidden': 'true' }));
  }

  const groups = [...hotspots.querySelectorAll('.astra-hot')];

  function setSex(sexo) {
    const valor = sexo === 'Femenino' || sexo === 'Masculino' ? sexo : '';
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
        class: 'astra-hl',
        x: izquierda ? hot.cx - 34 : hot.cx + 36,
        y: hot.cy + 10,
        'text-anchor': izquierda ? 'end' : 'start',
        fill: (ESTADOS[estado] || ESTADOS.na).h
      });
      texto.textContent = `${hot.label.replace('Zona ', '').toUpperCase()} · ${(ESTADOS[estado] || ESTADOS.na).t}`;
      labels.append(texto);
    }
  }

  setSex('');
  return { root, setSex, setActive, setSelection, setGlow, setStatuses };
}
