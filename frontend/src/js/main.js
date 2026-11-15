/**
 * Punto de entrada. Cablea los módulos y controla la conmutación de vistas.
 *
 * No hay variables globales: todo vive en el estado y en las suscripciones.
 */

import { $, desplazarA, enfocar, movimientoReducido } from './dom.js';
import { getState, subscribe, actions } from './state.js';
import { evaluate } from './evaluation.js';
import { initStarfield } from './starfield.js';
import { createAvatar } from './avatar.js';
import { initForm } from './form.js';
import { initProgress } from './progress.js';
import { initSymptoms } from './symptoms-ui.js';
import { initResults } from './results.js';
import { construirRegistro, descargarRegistro } from './export.js';
import { showToast } from './toast.js';
import { beep } from './audio.js';

const firma = (state) =>
  JSON.stringify([
    state.profile,
    state.values,
    [...state.symptoms].sort(),
    [...state.ratingsTouched].sort(),
    state.wellBeing
  ]);

const instantanea = (state) => ({
  profile: state.profile,
  values: state.values,
  symptoms: state.symptoms,
  ratingsTouched: state.ratingsTouched,
  wellBeing: state.wellBeing
});

function alArriba() {
  window.scrollTo({ top: 0, behavior: movimientoReducido() ? 'auto' : 'smooth' });
}

function enfocarZona(zone) {
  const bloque = $('[data-symptoms="form"]')?.querySelector(`.astra-zone[data-zone="${zone}"]`);
  if (!bloque) return;
  beep('alert');
  desplazarA(bloque, { block: 'center' });
  bloque.classList.add('hl');
  const control = bloque.querySelector('input');
  if (control) enfocar(control);
}

function animarAnalisis() {
  return new Promise((resolve) => {
    const overlay = $('[data-analyzing]');
    const barra = $('[data-analyzing-bar]');
    const porcentaje = $('[data-analyzing-pct]');
    if (!overlay) return resolve();

    if (movimientoReducido()) return resolve();

    let progreso = 0;
    overlay.classList.add('on');
    overlay.setAttribute('aria-hidden', 'false');

    const paso = () => {
      progreso = Math.min(100, progreso + 7);
      barra?.style.setProperty('--p', `${progreso}%`);
      if (porcentaje) porcentaje.textContent = `${progreso}%`;
      if (progreso < 100) return;
      clearInterval(temporizador);
      setTimeout(() => {
        overlay.classList.remove('on');
        overlay.setAttribute('aria-hidden', 'true');
        resolve();
      }, 250);
    };

    const temporizador = setInterval(paso, 90);
    paso();
  });
}

async function iniciarAnalisis() {
  if (document.body.dataset.astraBusy === '1') return;
  document.body.dataset.astraBusy = '1';
  beep('click');

  await animarAnalisis();

  const state = getState();
  const result = evaluate(instantanea(state));
  ultimaFirma = firma(state);

  actions.setExportData(construirRegistro(state));
  actions.setResult(result);
  actions.setView('results');
  beep(result.overall === 'ok' ? 'success' : 'alert');
  alArriba();

  document.body.dataset.astraBusy = '0';
}

const app = $('#astra-app');
initStarfield($('[data-stars]'));

const hostFormulario = $('[data-avatar-host="form"]');
const hostResultados = $('[data-avatar-host="results"]');

let results = null;
let ultimaFirma = '';

const avatarFormulario = createAvatar({ variant: 'form', onZoneSelect: enfocarZona });
const avatarResultados = createAvatar({
  variant: 'results',
  onZoneSelect: (zone) => results?.selectZone(zone)
});

hostFormulario?.append(avatarFormulario.root);
hostResultados?.append(avatarResultados.root);

initProgress();
initSymptoms();
results = initResults({ avatar: avatarResultados });
initForm({ onSubmit: iniciarAnalisis });

$('[data-back]')?.addEventListener('click', () => {
  beep('click');
  actions.volverAlFormulario();
  alArriba();
});

$('[data-export]')?.addEventListener('click', () => {
  const state = getState();
  if (!state.result) {
    showToast('Completa el análisis antes de descargar.', 'warn');
    return;
  }
  const datos = descargarRegistro(state);
  actions.setExportData(datos);
  beep('success');
  showToast('Registro descargado en JSON.');
});

subscribe((state) => {
  if (app) app.dataset.view = state.view;

  avatarFormulario.setSex(state.profile.sexo);
  avatarResultados.setSex(state.profile.sexo);
  avatarFormulario.setActive(new Set([...state.symptoms].map((clave) => clave.slice(0, clave.indexOf('|')))));

  if (state.view !== 'results') return;

  const actual = firma(state);
  if (!state.result || actual !== ultimaFirma) {
    ultimaFirma = actual;
    actions.setResult(evaluate(instantanea(state)));
    return;
  }

  results.render(state.result, state);
});
