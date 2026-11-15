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
import { initForm } from './form.js';
import { initProgress } from './progress.js';
import { initSymptoms } from './symptoms-ui.js';
import { initResults } from './results.js';
import { createTransition } from './transition.js';
import { construirRegistro, descargarRegistro } from './export.js';
import { showToast, hideToast } from './toast.js';
import { beep } from './audio.js';

const app = $('#astra-app');

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
  const bloque = $('[data-symptoms="form"]')?.querySelector(`.astra-zone[data-zone="${zone}"]`);
  if (!bloque) return;
  beep('alert');
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
    enfocar($('#astra-form-title'));
  },
  onExport: () => {
    const state = getState();
    if (!state.result) {
      showToast('Completa el análisis antes de descargar.', 'warn');
      return;
    }
    const datos = descargarRegistro(state);
    actions.setExportData(datos);
    beep('success');
    showToast('Registro descargado en JSON.');
  }
});

const transition = createTransition({
  onDone: () => {
    actions.terminarAnalisis();
    alArriba();
    enfocar($('#astra-body-title'));
    beep('success');
  }
});

initForm({ onSubmit: iniciarAnalisis });

/* ------------------------------------------------------------------------- */
/* Análisis y transición                                                     */
/* ------------------------------------------------------------------------- */

function iniciarAnalisis() {
  const state = getState();
  if (state.step === 'baseline') {
    if (actions.completarHabituales()) {
      beep('success');
      alArriba();
      enfocar($('#astra-form-title'));
      showToast('Datos habituales guardados. Completa ahora tus datos actuales.');
    }
    return;
  }
  if (state.step !== 'current') return;
  const result = evaluate(instantanea(state));
  ultimaFirma = firma(state);
  if (!actions.comenzarAnalisis(result)) return;
  actions.setExportData(construirRegistro(state));
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
    enfocar($('#astra-form-title'));
  }
});
