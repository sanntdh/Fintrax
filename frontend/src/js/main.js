/**
 * Punto de entrada: intro → baseline → current → transition → body.
 * El primer envío guarda los datos habituales; el segundo ejecuta el análisis.
 */

import { $, desplazarA, enfocar, movimientoReducido } from './dom.js';
import { getState, subscribe, actions } from './state.js';
import { evaluate } from './evaluation.js';
import { initStarfield } from './starfield.js';
import { createAvatar } from './avatar.js';
import { initIntro } from './intro.js';
import { initForm, irAPaso } from './form.js';
import { initCentro, enviarAlCentro } from './centro.js';
import { initProgress } from './progress.js';
import { initSymptoms } from './symptoms-ui.js';
import { initResults } from './results.js';
import { createTransition } from './transition.js';
import { construirRegistro, descargarRegistro } from './export.js';
import { showToast, hideToast } from './toast.js';
import { beep } from './audio.js';

const app = $('#fintrax-app');

const firma = (state) =>
  JSON.stringify([
    state.profile,
    state.values,
    [...state.symptoms].sort(),
    [...state.ratingsTouched].sort(),
    state.wellBeing,
    state.otherText
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
  if (getState().step !== 'current') return;
  const bloque = $('[data-symptoms="form"]')?.querySelector(`.fintrax-zone[data-zone="${zone}"]`);
  if (!bloque) return;
  beep('alert');
  irAPaso('molestias');
  desplazarA(bloque, { block: 'center' });
  bloque.classList.add('hl');
  const control = bloque.querySelector('input');
  if (control) enfocar(control);
}

/* ------------------------------------------------------------------------- */
/* Arranque                                                                  */
/* ------------------------------------------------------------------------- */

const hostFormulario = $('[data-avatar-host="form"]');
const avatarFormulario = createAvatar({ variant: 'form', onZoneSelect: enfocarZona });
hostFormulario?.append(avatarFormulario.root);

initProgress();
initSymptoms();

let ultimaFirma = '';

const results = initResults({
  onEdit: () => {
    beep('click');
    actions.volverAEditar();
    alArriba();
    enfocar($('#fintrax-form-title'));
  },
  onExport: () => {
    const state = getState();
    if (!state.result) {
      showToast('Complete the analysis before downloading.', 'warn');
      return;
    }
    const datos = descargarRegistro(state);
    actions.setExportData(datos);
    beep('success');
    showToast('Record downloaded as JSON.');
  }
});

const transition = createTransition({
  onDone: () => {
    actions.terminarAnalisis();
    alArriba();
    enfocar($('#fintrax-body-title'));
    beep('success');
  }
});

initForm({ onSubmit: iniciarAnalisis });
initCentro();

/* ------------------------------------------------------------------------- */
/* Análisis y transición                                                     */
/* ------------------------------------------------------------------------- */

function iniciarAnalisis() {
  const state = getState();
  if (state.step === 'baseline') {
    if (actions.completarHabituales()) {
      beep('success');
      alArriba();
      enfocar($('#fintrax-form-title'));
      showToast('Usual data saved. Now complete your current data.');
    }
    return;
  }
  if (state.step !== 'current') return;
  const result = evaluate(instantanea(state));
  ultimaFirma = firma(state);
  if (!actions.comenzarAnalisis(result)) return;
  actions.setExportData(construirRegistro(state));
  enviarAlCentro(getState());
  beep('click');
  alArriba();
  requestAnimationFrame(() => {
    transition.play({ sexo: state.profile.sexo });
    if (getState().step === 'transition') transition.focusSkip();
  });
}

/* ------------------------------------------------------------------------- */
/* Sincronización                                                            */
/* ------------------------------------------------------------------------- */

subscribe((state) => {
  if (app && app.dataset.step !== state.step) {
    hideToast();
    app.dataset.step = state.step;
  }

  avatarFormulario.setSex(state.profile.sexo);
  avatarFormulario.setActive(
    new Set([...state.symptoms].map((clave) => clave.slice(0, clave.indexOf('|'))))
  );

  if (state.step !== 'body') return;

  const actual = firma(state);
  if (!state.result || actual !== ultimaFirma) {
    ultimaFirma = actual;
    actions.setResult(evaluate(instantanea(state)));
    return;
  }

  results.render(state.result, state);
});

initIntro({
  onDone: () => {
    actions.terminarIntro();
    initStarfield($('[data-stars]'));
    alArriba();
    enfocar($('#fintrax-form-title'));
  }
});

// PWA: guarda la app para abrirla sin conexión. Solo en contexto seguro
// (https o localhost); un fallo de registro no afecta al uso en línea.
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
