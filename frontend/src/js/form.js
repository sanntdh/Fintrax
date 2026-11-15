/**
 * Formulario: perfil, secciones de indicadores y validación propia.
 *
 * Las secciones se generan desde `METRIC_SECTIONS`, la misma fuente que usa el
 * motor de evaluación. Los controles escriben en el estado; el DOM nunca es la
 * fuente de verdad.
 */

import { $, el, delegar, desplazarA, enfocar, limpiar } from './dom.js';
import { METRIC_SECTIONS } from '../data/metrics.js';
import { actions, subscribe, getState } from './state.js';
import { beep } from './audio.js';
import { showToast } from './toast.js';
import { erroresRegistro, progresoRegistro } from './validation.js';

const idControl = (id) => `fintrax-${id}`;

function campoNumero(field) {
  const wrapper = el('div', {
    class: `fintrax-metric-field${field.wide ? ' fintrax-metric-field--wide' : ''}`
  });

  const label = el('label', { class: 'fintrax-metric-label', for: idControl(field.id) });
  label.append(document.createTextNode(field.label));
  if (field.note) label.append(el('small', { text: ` ${field.note}` }));
  wrapper.append(label);

  const unidad = el('div', { class: `fintrax-unit${field.wideUnit ? ' fintrax-unit--wide' : ''}` });
  unidad.append(
    el('input', {
      type: 'number',
      id: idControl(field.id),
      dataset: { field: field.id },
      placeholder: field.placeholder,
      min: field.min,
      max: field.max,
      step: field.step,
      inputmode: field.step >= 1 ? 'numeric' : 'decimal'
    }),
    el('span', { text: field.unit })
  );
  wrapper.append(unidad);

  if (field.helper) wrapper.append(el('p', { class: 'fintrax-helper', text: field.helper }));
  return wrapper;
}

function campoPresion(field) {
  const wrapper = el('div', { class: 'fintrax-metric-field' });
  wrapper.append(el('span', { class: 'fintrax-metric-label', text: field.label }));

  const dual = el('div', { class: 'fintrax-metric-dual' });
  for (const item of field.ids) {
    const bloque = el('div');
    bloque.append(el('label', { for: idControl(item.id), text: item.label }));
    const unidad = el('div', { class: 'fintrax-unit' });
    unidad.append(
      el('input', {
        type: 'number',
        id: idControl(item.id),
        dataset: { field: item.id },
        placeholder: item.placeholder,
        min: item.min,
        max: item.max,
        step: item.step,
        inputmode: 'numeric'
      }),
      el('span', { text: 'mmHg' })
    );
    bloque.append(unidad);
    dual.append(bloque);
  }
  wrapper.append(dual);
  return wrapper;
}

function campoSelect(field) {
  const wrapper = el('div', {
    class: `fintrax-metric-field${field.wide ? ' fintrax-metric-field--wide' : ''}`
  });
  wrapper.append(el('label', { class: 'fintrax-metric-label', for: idControl(field.id), text: field.label }));

  const select = el('select', { id: idControl(field.id), dataset: { field: field.id } });
  select.append(el('option', { value: '', text: field.placeholder || 'Seleccionar' }));
  for (const opcion of field.options || []) {
    select.append(el('option', { value: opcion, text: opcion }));
  }
  wrapper.append(select);

  if (field.helper) wrapper.append(el('p', { class: 'fintrax-helper', text: field.helper }));
  return wrapper;
}

function campoTextarea(field) {
  const wrapper = el('div', {
    class: `fintrax-metric-field${field.wide ? ' fintrax-metric-field--wide' : ''}`
  });
  wrapper.append(el('label', { class: 'fintrax-metric-label', for: idControl(field.id), text: field.label }));
  wrapper.append(
    el('textarea', {
      id: idControl(field.id),
      dataset: { field: field.id },
      placeholder: field.placeholder,
      rows: 3
    })
  );
  return wrapper;
}

function campoEscala(field) {
  const wrapper = el('div', {
    class: `fintrax-metric-field${field.wide ? ' fintrax-metric-field--wide' : ''}`
  });
  wrapper.append(el('label', { class: 'fintrax-metric-label', for: idControl(field.id), text: field.label }));

  const fila = el('div', { class: 'fintrax-range-row' });
  const input = el('input', {
    type: 'range',
    id: idControl(field.id),
    min: 0,
    max: 10,
    step: 1,
    value: 5,
    dataset: { rating: field.id }
  });
  const salida = el('output', { class: 'fintrax-range-value', for: idControl(field.id), text: '—' });
  fila.append(input, salida);
  wrapper.append(fila);

  const extremos = el('div', { class: 'fintrax-range-ends' });
  for (const texto of field.ends || []) extremos.append(el('span', { text: texto }));
  wrapper.append(extremos);
  wrapper.append(el('button', {
    type: 'button',
    class: 'fintrax-rating-confirm',
    dataset: { confirmRating: field.id },
    'aria-pressed': 'false',
    text: 'Confirmar 5/10'
  }));
  return wrapper;
}

function campoPreview(field) {
  const wrapper = el('div', { class: 'fintrax-metric-field fintrax-metric-field--wide' });
  wrapper.append(el('span', { class: 'fintrax-metric-label', text: field.label }));

  const medidas = el('div', { class: 'fintrax-mini-measures' });
  const peso = el('span', { class: 'fintrax-mini-measure' });
  peso.append(document.createTextNode('Peso '), el('strong', { dataset: { previewPeso: '' }, text: '— kg' }));
  const estatura = el('span', { class: 'fintrax-mini-measure' });
  estatura.append(document.createTextNode('Estatura '), el('strong', { dataset: { previewEstatura: '' }, text: '— m' }));
  medidas.append(peso, estatura);
  wrapper.append(medidas);

  if (field.helper) wrapper.append(el('p', { class: 'fintrax-helper', text: field.helper }));
  return wrapper;
}

const CONSTRUCTORES = {
  number: campoNumero,
  pressure: campoPresion,
  select: campoSelect,
  textarea: campoTextarea,
  range: campoEscala,
  preview: campoPreview
};

function crearCampo(field) {
  if (field.kind === 'divider') {
    return el('div', { class: 'fintrax-divider-label', text: field.label });
  }
  const constructor = CONSTRUCTORES[field.kind];
  const nodo = constructor ? constructor(field) : null;
  if (nodo && field.optional) {
    nodo.dataset.optional = 'true';
    $('.fintrax-metric-label', nodo)?.append(el('small', { class: 'fintrax-opcional', text: ' (opcional)' }));
  }
  return nodo;
}

function crearSeccion(section) {
  const bloque = el('section', {
    class: 'fintrax-metric-section fintrax-step-panel',
    id: `fintrax-sec-${section.id}`,
    'aria-labelledby': `fintrax-sec-${section.id}-title`
  });
  bloque.dataset.stepPanel = section.id;
  bloque.dataset.stepLabel = section.title;

  const cabecera = el('div', { class: 'fintrax-metric-header' });
  cabecera.append(el('span', { class: 'fintrax-metric-header__icon', 'aria-hidden': 'true', text: section.icon }));

  const titulos = el('div');
  titulos.append(
    el('h2', { id: `fintrax-sec-${section.id}-title`, tabindex: '-1', text: section.title }),
    el('p', { text: section.subtitle })
  );
  cabecera.append(titulos);
  bloque.append(cabecera);

  if (section.note) bloque.append(el('p', { class: 'fintrax-metric-note', text: section.note }));

  const grid = el('div', { class: 'fintrax-metric-grid' });
  for (const field of section.fields) {
    const nodo = crearCampo(field);
    if (nodo) grid.append(nodo);
  }
  bloque.append(grid);
  return bloque;
}

function pintarSecciones() {
  const host = $('[data-metric-sections]');
  if (!host) return;
  limpiar(host);
  for (const section of METRIC_SECTIONS) host.append(crearSeccion(section));
}

/** Nombre del campo de validación que escribe un control. */
function campoDe(control) {
  if (control.matches('[data-symptoms] input')) return 'symptoms';
  return control.dataset.profile || control.dataset.field || control.dataset.rating || '';
}

/** Campos obligatorios dentro de un paso, sin repetir los radios de un mismo grupo. */
function camposDelPaso(panel) {
  const campos = new Set();
  for (const control of panel.querySelectorAll('[data-profile], [data-field], [data-rating], [data-symptoms] input')) {
    if (control.closest('[data-optional]')) continue;
    const campo = campoDe(control);
    if (campo) campos.add(campo);
  }
  return [...campos];
}

let irAPasoActual = () => {};

/** Muestra el paso que contiene el bloque indicado (p. ej. `molestias`). */
export function irAPaso(id) {
  irAPasoActual(id);
}

function marcarError(campo, mensaje) {
  const error = $(`[data-error-for="${campo}"]`);
  if (error) error.textContent = mensaje || '';
  const control = nodoDe(campo);
  if (control) control.setAttribute('aria-invalid', mensaje ? 'true' : 'false');
}

/** Control que recibe el foco cuando falta un campo. */
function nodoDe(campo) {
  if (campo === 'symptoms') return $('[data-symptoms="form"] input');
  if (campo === 'otherText') return $('[data-other]');
  return $(`[data-profile="${campo}"], [data-field="${campo}"], [data-rating="${campo}"]`);
}

function actualizarVistaPrevia(state) {
  const peso = $('[data-preview-peso]');
  const estatura = $('[data-preview-estatura]');
  if (peso) peso.textContent = state.profile.peso ? `${state.profile.peso} kg` : '— kg';
  if (estatura) estatura.textContent = state.profile.estatura ? `${state.profile.estatura} m` : '— m';
}

/**
 * @param {{onSubmit: () => void}} opciones
 */
export function initForm({ onSubmit }) {
  pintarSecciones();

  const form = $('#fintrax-personal-form');
  if (!form) return;

  const submit = $('[data-submit]');
  const nota = $('[data-form-note]');
  const tocados = new Set();
  let etapaAnterior = '';

  // Asistente por pasos: se muestra un bloque cada vez para no saturar la vista.
  const nav = $('[data-quicknav]');
  const anterior = $('[data-step-prev]');
  const siguiente = $('[data-step-next]');
  const contador = $('[data-step-count]');
  let paso = 0;

  const pasosVisibles = () => [...form.querySelectorAll('[data-step-panel]')]
    .filter((panel) => !panel.dataset.stepOnly || panel.dataset.stepOnly === getState().activeRecord);

  function pintarPasos(errores) {
    const pasos = pasosVisibles();
    paso = Math.min(paso, pasos.length - 1);
    const ultimo = paso === pasos.length - 1;
    const actual = getState().activeRecord === 'current';

    for (const panel of form.querySelectorAll('[data-step-panel]')) panel.hidden = panel !== pasos[paso];

    if (nav) {
      limpiar(nav);
      pasos.forEach((panel, i) => {
        const campos = camposDelPaso(panel);
        const hechos = campos.filter((campo) => !errores[campo]).length;
        const boton = el('button', {
          type: 'button',
          class: 'fintrax-stepper__step',
          dataset: { gotoStep: String(i), complete: String(hechos === campos.length) },
          'aria-label': campos.length
            ? `Paso ${i + 1}: ${panel.dataset.stepLabel}, ${hechos} de ${campos.length} campos`
            : `Paso ${i + 1}: ${panel.dataset.stepLabel}, opcional`
        });
        boton.append(
          el('span', { class: 'fintrax-stepper__num', 'aria-hidden': 'true', text: hechos === campos.length ? '✓' : String(i + 1) }),
          el('span', { class: 'fintrax-stepper__label', text: panel.dataset.stepLabel }),
          el('span', { class: 'fintrax-stepper__count', 'aria-hidden': 'true', text: campos.length ? `${hechos}/${campos.length}` : 'opcional' })
        );
        if (i === paso) boton.setAttribute('aria-current', 'step');
        nav.append(boton);
      });
    }

    if (anterior) anterior.hidden = paso === 0;
    $('[data-edit-baseline]').hidden = !(actual && paso === 0);
    if (siguiente) siguiente.hidden = ultimo;
    if (submit) submit.hidden = !ultimo;
    if (contador) contador.textContent = `Paso ${paso + 1} de ${pasos.length}`;
  }

  function mostrarPaso(indice, { foco = true } = {}) {
    paso = indice;
    pintarPasos(progresoRegistro(getState(), getState().activeRecord).errores);
    if (!foco) return;
    const titulo = $('h2', pasosVisibles()[paso]);
    desplazarA($('#fintrax-form'), { block: 'start' });
    if (titulo) enfocar(titulo);
  }

  irAPasoActual = (id) => {
    const indice = pasosVisibles().findIndex((panel) => panel.dataset.stepPanel === id);
    if (indice >= 0 && indice !== paso) mostrarPaso(indice, { foco: false });
  };

  /** Lleva al paso que contiene un control y lo enfoca. */
  function mostrarControl(control) {
    const indice = pasosVisibles().indexOf(control.closest('[data-step-panel]'));
    if (indice >= 0 && indice !== paso) mostrarPaso(indice, { foco: false });
    desplazarA(control, { block: 'center' });
    enfocar(control);
  }

  if (nav) {
    delegar(nav, 'click', '[data-goto-step]', (event, boton) => mostrarPaso(Number(boton.dataset.gotoStep)));
  }
  anterior?.addEventListener('click', () => mostrarPaso(paso - 1));
  siguiente?.addEventListener('click', () => {
    const { errores } = progresoRegistro(getState(), getState().activeRecord);
    const pendientes = camposDelPaso(pasosVisibles()[paso]).filter((campo) => errores[campo]);
    if (pendientes.length === 0) {
      beep('click');
      mostrarPaso(paso + 1);
      return;
    }
    for (const campo of pendientes) tocados.add(campo);
    reflejarValidacion();
    showToast('Completa este paso antes de continuar.', 'warn');
    beep('alert');
    const primero = nodoDe(pendientes[0]);
    if (primero) mostrarControl(primero);
  });

  // Etiquetas y errores enlazados para todos los controles, incluidas las escalas.
  for (const control of form.querySelectorAll('[data-profile], [data-field], [data-rating], [data-other]')) {
    const campo = control.dataset.profile || control.dataset.field || control.dataset.rating || 'otherText';
    let error = $(`[data-error-for="${campo}"]`, form);
    if (!error) {
      error = el('p', { class: 'fintrax-field__error', dataset: { errorFor: campo }, 'aria-live': 'polite' });
      control.closest('.fintrax-metric-field, .fintrax-field').append(error);
    }
    error.id = `fintrax-error-${campo}`;
    control.setAttribute('aria-describedby', error.id);
    // Observaciones y datos de laboratorio son opcionales; el resto es obligatorio.
    if (control.matches('[data-other]') || control.closest('[data-optional]')) continue;
    control.setAttribute('aria-required', 'true');
    if (control.type !== 'range') control.required = true;
  }

  function reflejarValidacion({ forzar = false } = {}) {
    const state = getState();
    const { errores, total, completos } = progresoRegistro(state, state.activeRecord);
    const faltan = Object.keys(errores).length;
    const ok = faltan === 0;

    if (forzar) for (const campo of Object.keys(errores)) tocados.add(campo);

    for (const nodo of form.querySelectorAll('[data-error-for]')) {
      const campo = nodo.dataset.errorFor;
      marcarError(campo, tocados.has(campo) ? errores[campo] || '' : '');
    }

    if (submit) {
      submit.disabled = !ok;
      submit.setAttribute('aria-disabled', String(!ok));
      submit.dataset.ready = String(ok);
    }

    if (nota) {
      nota.textContent = ok
        ? (state.activeRecord === 'baseline'
          ? 'Registro habitual completo · continúa con tus datos actuales.'
          : 'Registro actual completo · listo para analizar.')
        : `${completos}/${total} campos válidos. Faltan ${faltan} por completar o corregir. ${Object.values(errores)[0]}`;
      nota.dataset.ready = String(ok);
    }

    return { ok, errores };
  }

  function sincronizarEtapa(state) {
    const actual = state.activeRecord === 'current';
    if (etapaAnterior !== state.activeRecord) {
      etapaAnterior = state.activeRecord;
      tocados.clear();
      paso = 0;
      for (const control of form.querySelectorAll('[data-profile]')) {
        const value = state.profile[control.dataset.profile] || '';
        if (control.type === 'radio') control.checked = control.value === value;
        else control.value = value;
      }
      for (const control of form.querySelectorAll('[data-field], [data-rating]')) {
        const id = control.dataset.field || control.dataset.rating;
        control.value = state.values[id] ?? (control.type === 'range' ? '5' : '');
      }
      $('[data-other]').value = state.otherText;
      $('[data-form-status]').textContent = '';
    }

    $('[data-form-stage]').textContent = actual ? 'ETAPA 2 DE 2 · DATOS ACTUALES' : 'ETAPA 1 DE 2 · DATOS HABITUALES';
    $('#fintrax-form-title').textContent = actual ? 'Registro de datos actuales' : 'Registro Biomédico';
    $('[data-form-subtitle]').textContent = actual
      ? 'Registra cómo te encuentras ahora · FINTRAX'
      : 'Evaluación de referencia previa a la misión · FINTRAX';
    $('[data-submit]').textContent = actual ? '⚡ ANALIZAR DATOS ACTUALES ›' : '⚡ COMENZAR ANÁLISIS ›';
    for (const bloque of document.querySelectorAll('[data-current-only]')) bloque.hidden = !actual;
    $('[data-other]').disabled = !actual;

    for (const control of form.querySelectorAll('[data-rating]')) {
      const id = control.dataset.rating;
      const confirmado = state.ratingsTouched.has(id);
      control.parentElement.querySelector('output').textContent = confirmado ? `${state.values[id]}/10` : '—';
      const boton = $(`[data-confirm-rating="${id}"]`);
      boton.textContent = confirmado ? `✓ ${state.values[id]}/10 confirmado` : `Confirmar ${control.value}/10`;
      boton.setAttribute('aria-pressed', String(confirmado));
    }
  }

  // Perfil: texto, números, selectores y radios.
  const manejarPerfil = (event, control) => {
    const campo = control.dataset.profile;
    if (!campo) return;
    if (getState().profile[campo] === control.value) return;
    if (campo === 'sexo') beep('click');
    // Se marca como visitado antes de escribir: la validación se recalcula en
    // la suscripción, ya con el estado nuevo.
    tocados.add(campo);
    actions.setProfile(campo, control.value);
  };

  delegar(form, 'input', '[data-profile]', manejarPerfil);
  delegar(form, 'change', '[data-profile]', manejarPerfil);

  // Al salir de un campo se muestra su error, si lo tiene.
  delegar(form, 'focusout', '[data-profile], [data-field], [data-rating], [data-other]', (event, control) => {
    const campo = control.dataset.profile || control.dataset.field || control.dataset.rating || 'otherText';
    tocados.add(campo);
    reflejarValidacion();
  });

  // Observaciones libres.
  delegar(form, 'input', '[data-other]', (event, control) => {
    tocados.add('otherText');
    actions.setOtherText(control.value);
  });

  // Indicadores numéricos, selects y áreas de texto.
  const hostMetricas = $('[data-metric-sections]');
  if (hostMetricas) {
    const manejarCampo = (event, control) => {
      if (!control.dataset.field) return;
      tocados.add(control.dataset.field);
      if (getState().values[control.dataset.field] === control.value) return;
      actions.setValue(control.dataset.field, control.value);
    };
    delegar(hostMetricas, 'input', '[data-field]', manejarCampo);
    delegar(hostMetricas, 'change', '[data-field]', manejarCampo);
    delegar(hostMetricas, 'input', '[data-rating]', (event, control) => {
      const id = control.dataset.rating;
      tocados.add(id);
      actions.setRating(id, control.value);
    });
    delegar(hostMetricas, 'click', '[data-confirm-rating]', (event, boton) => {
      const id = boton.dataset.confirmRating;
      tocados.add(id);
      actions.setRating(id, nodoDe(id).value);
    });
  }

  delegar(form, 'change', '[data-symptom], [data-wellbeing]', () => {
    tocados.add('symptoms');
    reflejarValidacion();
  });

  $('[data-edit-baseline]').addEventListener('click', () => {
    actions.editarHabituales();
    desplazarA($('#fintrax-form-title'), { block: 'start' });
    enfocar($('#fintrax-form-title'));
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const errores = erroresRegistro(getState(), getState().activeRecord);
    const primero = nodoDe(Object.keys(errores)[0]);
    const ok = Object.keys(errores).length === 0;
    const estado = $('[data-form-status]');

    if (!ok) {
      reflejarValidacion({ forzar: true });
      if (estado) estado.textContent = 'Revisa los datos marcados antes de continuar.';
      showToast('Completa los datos obligatorios para continuar.', 'warn');
      beep('alert');
      if (primero) mostrarControl(primero);
      return;
    }

    if (estado) estado.textContent = '';
    onSubmit();
  });

  const sincronizar = (state) => {
    sincronizarEtapa(state);
    actualizarVistaPrevia(state);
    pintarPasos(reflejarValidacion().errores);
  };
  subscribe(sincronizar);
  sincronizar(getState());
}
