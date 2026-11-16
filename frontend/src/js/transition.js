/**
 * Transición del registro actual a la revisión final (paso `transition`).
 *
 * Secuencia pensada para ~3,2 s:
 *   0 ms      contorno del cuerpo y HUD
 *   120 ms    relleno luminoso que sube (barrido de 900 ms)
 *   900 ms    órganos en orden, uno cada 180 ms (1.260 ms en total)
 *   2.400 ms  «Análisis completo» y barra al 100 %
 *   3.200 ms  entra la Etapa 2
 *
 * El cuerpo es la misma silueta raster de la Etapa 1, tratada como holograma
 * (`mix-blend-mode: screen`): así el contorno coincide exactamente con el
 * avatar de la Etapa 2 y las coordenadas de los órganos no se desalinean.
 *
 * La persona puede saltar la animación en cualquier momento y, si el sistema
 * pide movimiento reducido, la secuencia se resuelve de inmediato.
 */

import { $, el, limpiar, movimientoReducido, enfocar, svg } from './dom.js';
import { ORGANOS, ORGAN_ORDER } from '../data/organs.js';
import { ORGAN_SHAPES } from '../data/organ-shapes.js';
import { beep } from './audio.js';
import { imagenAvatar } from './avatar.js';

const DURACION = 3200;
const RELLENO = 120;
const INICIO_ORGANOS = 900;
const PASO_ORGANO = 180;

function crearFigura(clase) {
  const contenedor = el('div', { class: `fintrax-transition__figure ${clase}` });
  for (const [sufijo, sexo] of [
    ['f', 'Female'],
    ['m', 'Male']
  ]) {
    contenedor.append(imagenAvatar(sexo, `fintrax-transition__img fintrax-transition__img--${sufijo}`));
  }
  return contenedor;
}

function construirOrgano(key) {
  const meta = ORGANOS[key];
  const forma = ORGAN_SHAPES[key];
  const grupo = svg('g', {
    class: 'fintrax-transition__organ',
    transform: `translate(${meta.anchor.x} ${meta.anchor.y})`,
    style: `--organ:${meta.color}`
  });

  for (const d of forma.paths) {
    grupo.append(
      svg('path', {
        class: 'fintrax-transition__organ-shape',
        d,
        fill: forma.stroke ? 'none' : null,
        'stroke-width': forma.stroke || null,
        'stroke-linecap': forma.stroke ? 'round' : null
      })
    );
  }

  grupo.append(svg('circle', { class: 'fintrax-transition__organ-halo', r: forma.hit + 14 }));
  return grupo;
}

/**
 * @param {{onDone: () => void}} opciones
 */
export function createTransition({ onDone }) {
  const root = $('[data-transition]');
  const stage = $('[data-transition-stage]');
  const barra = $('[data-transition-bar]');
  const porcentaje = $('[data-transition-pct]');
  const sub = $('[data-transition-sub]');
  const log = $('[data-transition-log]');
  const saltar = $('[data-skip-transition]');

  let timers = [];
  let frame = 0;
  let iniciado = 0;
  let terminado = true;

  if (stage && !stage.childElementCount) {
    const marco = el('div', { class: 'fintrax-transition__figure-wrap' });
    marco.append(crearFigura('fintrax-transition__ghost'));
    marco.append(crearFigura('fintrax-transition__fill'));

    const capa = svg('svg', {
      class: 'fintrax-transition__canvas',
      viewBox: '0 0 941 1672',
      'aria-hidden': 'true',
      focusable: 'false'
    });

    const organos = svg('g', { class: 'fintrax-transition__organs' });
    for (const key of ORGAN_ORDER) organos.append(construirOrgano(key));
    capa.append(organos);

    const barrido = svg('rect', {
      class: 'fintrax-transition__sweep',
      x: 240,
      y: 1386,
      width: 470,
      height: 10,
      rx: 5
    });
    capa.append(barrido);

    marco.append(capa);
    stage.append(marco);
  }

  const relleno = root?.querySelector('.fintrax-transition__fill');
  const organosNodos = [...(root?.querySelectorAll('.fintrax-transition__organ') || [])];

  function limpiarTimers() {
    for (const id of timers) clearTimeout(id);
    timers = [];
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function programar(fn, ms) {
    timers.push(setTimeout(fn, ms));
  }

  function reset() {
    limpiarTimers();
    terminado = true;
    relleno?.classList.remove('is-filled');
    stage?.classList.remove('is-scanning');
    for (const nodo of organosNodos) nodo.classList.remove('is-on');
    if (barra) barra.style.setProperty('--p', '0%');
    if (porcentaje) porcentaje.textContent = '0%';
    if (log) limpiar(log);
    if (sub) sub.textContent = 'Correlating profile, measurements and symptoms.';
  }

  function progreso() {
    if (terminado) return;
    const transcurrido = performance.now() - iniciado;
    const pct = Math.min(100, Math.round((transcurrido / DURACION) * 100));
    if (barra) barra.style.setProperty('--p', `${pct}%`);
    if (porcentaje) porcentaje.textContent = `${pct}%`;
    if (pct < 100) frame = requestAnimationFrame(progreso);
  }

  function finalizar() {
    if (terminado) return;
    terminado = true;
    limpiarTimers();
    relleno?.classList.add('is-filled');
    for (const nodo of organosNodos) nodo.classList.add('is-on');
    if (barra) barra.style.setProperty('--p', '100%');
    if (porcentaje) porcentaje.textContent = '100%';
    onDone?.();
    root?.setAttribute('aria-hidden', 'true');
  }

  function saltarAnimacion() {
    if (terminado) return;
    beep('click');
    finalizar();
  }

  /**
   * @param {{sexo?: string}} opciones
   */
  function play({ sexo = '' } = {}) {
    if (!root) {
      onDone?.();
      return;
    }

    reset();
    terminado = false;
    iniciado = performance.now();
    if (stage) stage.dataset.sex = sexo;

    if (movimientoReducido()) {
      finalizar();
      return;
    }

    root.setAttribute('aria-hidden', 'false');
    programar(() => relleno?.classList.add('is-filled'), RELLENO);
    programar(() => stage?.classList.add('is-scanning'), RELLENO);

    ORGAN_ORDER.forEach((key, indice) => {
      programar(() => {
        const nodo = organosNodos[indice];
        if (!nodo) return;
        nodo.classList.add('is-on');
        if (log) {
          const linea = document.createElement('li');
          linea.textContent = `${ORGANOS[key].label} · integrado`;
          log.append(linea);
          if (log.childElementCount > 4) log.firstElementChild?.remove();
        }
      }, INICIO_ORGANOS + indice * PASO_ORGANO);
    });

    programar(() => {
      if (sub) sub.textContent = 'Analysis complete. Preparing functional map…';
    }, 2400);

    programar(() => beep('success'), 2450);
    programar(finalizar, DURACION);
    frame = requestAnimationFrame(progreso);
  }

  saltar?.addEventListener('click', saltarAnimacion);

  // Escape también salta: la animación nunca debe atrapar a nadie.
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !terminado) saltarAnimacion();
  });

  return {
    play,
    skip: saltarAnimacion,
    reset,
    focusSkip() {
      enfocar(saltar);
    }
  };
}
