/**
 * Estado único de la aplicación.
 *
 * El DOM ya no es la fuente de verdad: acceso, formulario, avatar, progreso y
 * resultados leen de aquí. Sustituye a los globales `window.ASTRA_res`,
 * `ASTRA_select`, `ASTRA_run` y `ASTRA_d` del prototipo.
 *
 * intro → baseline → current → transition → body.
 * El formulario compartido edita un registro por vez. Las instantáneas de las
 * dos etapas conservan sus propios valores, escalas y perfil al navegar.
 */

import { RATING_IDS } from '../data/metrics.js';
import { sintomaValido } from '../data/symptoms.js';
import { erroresRegistro } from './validation.js';

const listeners = new Set();

/** Pasos válidos del flujo. */
export const STEPS = ['intro', 'baseline', 'current', 'transition', 'body'];

export function copiarRegistro(record) {
  return {
    profile: { ...record.profile },
    values: { ...record.values },
    ratingsTouched: new Set(record.ratingsTouched),
    symptoms: new Set(record.symptoms),
    wellBeing: Boolean(record.wellBeing),
    otherText: record.otherText || ''
  };
}

const state = {
  profile: { sexo: '', nombre: '', edad: '', peso: '', estatura: '', sangre: '' },
  values: {},
  ratingsTouched: new Set(),
  symptoms: new Set(),
  wellBeing: false,
  otherText: '',

  step: 'intro',
  activeRecord: 'baseline',
  records: { baseline: null, current: null },

  // Etapa 2
  selectedOrgan: '',

  result: null,
  exportData: null
};

/** Estado actual (objeto vivo, de solo lectura por convención). */
export const getState = () => state;

/**
 * Suscribe una función a cualquier cambio. Devuelve el desuscriptor.
 * @param {(state: typeof state) => void} fn
 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Notifica a todos los suscriptores. */
export function emit() {
  for (const fn of [...listeners]) fn(state);
}

/** Ejecuta varias mutaciones y notifica una sola vez. */
export function batch(mutator) {
  mutator(state);
  emit();
}

export const actions = {
  setProfile(field, value) {
    state.profile[field] = String(value ?? '');

    // Al cambiar de sexo, las molestias que ya no existen en el catálogo se
    // retiran para que no queden selecciones invisibles en el estado.
    if (field === 'sexo') {
      for (const clave of [...state.symptoms]) {
        const corte = clave.indexOf('|');
        if (corte < 0 || !sintomaValido(clave.slice(0, corte), clave.slice(corte + 1), state.profile.sexo)) {
          state.symptoms.delete(clave);
        }
      }
    }

    emit();
  },

  setValue(id, value) {
    state.values[id] = String(value ?? '');
    emit();
  },

  touchRating(id) {
    if (!RATING_IDS.includes(id)) return;
    state.ratingsTouched.add(id);
    emit();
  },

  /** Actualiza el valor de una escala y la marca como respondida en un solo paso. */
  setRating(id, value) {
    state.values[id] = String(value ?? '');
    if (RATING_IDS.includes(id)) state.ratingsTouched.add(id);
    emit();
  },

  setSymptom(zone, value, seleccionado) {
    const key = `${zone}|${value}`;
    if (seleccionado) {
      state.symptoms.add(key);
      state.wellBeing = false;
    } else {
      state.symptoms.delete(key);
    }
    emit();
  },

  clearSymptoms() {
    state.symptoms.clear();
    emit();
  },

  setWellBeing(activo) {
    state.wellBeing = Boolean(activo);
    if (state.wellBeing) state.symptoms.clear();
    emit();
  },

  setOtherText(text) {
    state.otherText = String(text ?? '');
    emit();
  },

  /* --- Flujo ------------------------------------------------------------ */

  terminarIntro() {
    if (state.step !== 'intro') return;
    state.step = 'baseline';
    emit();
  },

  completarHabituales() {
    if (state.step !== 'baseline' || Object.keys(erroresRegistro(state)).length) return false;
    state.records.baseline = copiarRegistro(state);
    const actual = state.records.current || {
      profile: { ...state.profile, peso: '', estatura: '' },
      values: {}, ratingsTouched: new Set(), symptoms: new Set(), wellBeing: false, otherText: ''
    };
    Object.assign(state, copiarRegistro(actual));
    state.activeRecord = 'current';
    state.step = 'current';
    state.result = null;
    state.exportData = null;
    emit();
    return true;
  },

  editarHabituales() {
    if (!['current', 'body'].includes(state.step) || !state.records.baseline) return;
    state.records.current = copiarRegistro(state);
    Object.assign(state, copiarRegistro(state.records.baseline));
    state.activeRecord = 'baseline';
    state.step = 'baseline';
    state.result = null;
    state.exportData = null;
    emit();
  },

  /** Desde resultados se vuelve a las mediciones actuales. */
  volverAEditar() {
    if (state.step !== 'body') return;
    state.step = 'current';
    state.result = null;
    state.exportData = null;
    emit();
  },

  comenzarAnalisis(result) {
    if (state.step !== 'current' || !state.records.baseline || !result) return false;
    if (Object.keys(erroresRegistro(state.records.baseline)).length ||
        Object.keys(erroresRegistro(state, 'current')).length) return false;
    state.records.current = copiarRegistro(state);
    state.result = result;
    state.step = 'transition';
    emit();
    return true;
  },

  terminarAnalisis() {
    if (state.step !== 'transition' || !state.result) return;
    state.step = 'body';
    emit();
  },

  setSelectedOrgan(key) {
    state.selectedOrgan = String(key || '');
    emit();
  },

  setResult(result) {
    state.result = result;
    emit();
  },

  setExportData(data) {
    state.exportData = data;
    emit();
  }
};

/** Perfil listo para el motor de evaluación. */
export const perfilActual = () => ({ ...state.profile });

/** Valores en el formato que espera `evaluate()`. */
export const valoresActuales = () => ({ ...state.values });

/** Indica si una escala 0–10 fue movida por la persona. */
export const ratingTocado = (id) => state.ratingsTouched.has(id);

/** Reemplaza todas las selecciones (usado al cambiar de sexo). */
export function conservarSintomasValidos(esValido) {
  for (const key of [...state.symptoms]) {
    const cut = key.indexOf('|');
    if (!esValido(key.slice(0, cut), key.slice(cut + 1))) state.symptoms.delete(key);
  }
  emit();
}
