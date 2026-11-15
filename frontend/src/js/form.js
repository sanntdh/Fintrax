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

const ETIQUETAS_ERROR = {
  nombre: 'Escribe tu nombre.',
  edad: 'Indica una edad entre 1 y 120 años.',
  peso: 'Indica tu peso en kilogramos.',
  estatura: 'Indica tu estatura en metros (por ejemplo, 1.75).',
  sangre: 'Selecciona tu grupo sanguíneo.',
  sexo: 'Selecciona hombre o mujer para calibrar el avatar.'
};

const idControl = (id) => `astra-${id}`;

function campoNumero(field) {
  const wrapper = el('div', {
    class: `astra-metric-field${field.wide ? ' astra-metric-field--wide' : ''}`
  });

  const label = el('label', { class: 'astra-metric-label', for: idControl(field.id) });
  label.append(document.createTextNode(field.label));
  if (field.optional) label.append(el('small', { text: ' (opcional)' }));
  if (field.note) label.append(el('small', { text: ` ${field.note}` }));
  wrapper.append(label);

  const unidad = el('div', { class: `astra-unit${field.wideUnit ? ' astra-unit--wide' : ''}` });
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

  if (field.helper) wrapper.append(el('p', { class: 'astra-helper', text: field.helper }));
  return wrapper;
}

function campoPresion(field) {
  const wrapper = el('div', { class: 'astra-metric-field' });
  wrapper.append(el('span', { class: 'astra-metric-label', text: field.label }));

  const dual = el('div', { class: 'astra-metric-dual' });
  for (const item of field.ids) {
    const bloque = el('div');
    bloque.append(el('label', { for: idControl(item.id), text: item.label }));
    const unidad = el('div', { class: 'astra-unit' });
    unidad.append(
      el('input', {
        type: 'number',
        id: idControl(item.id),
        dataset: { field: item.id },
        placeholder: item.placeholder,
        min: 30,
        max: 260,
        step: 1,
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
    class: `astra-metric-field${field.wide ? ' astra-metric-field--wide' : ''}`
  });
  wrapper.append(el('label', { class: 'astra-metric-label', for: idControl(field.id), text: field.label }));

  const select = el('select', { id: idControl(field.id), dataset: { field: field.id } });
  select.append(el('option', { value: '', text: field.placeholder || 'Seleccionar' }));
  for (const opcion of field.options || []) {
    select.append(el('option', { value: opcion, text: opcion }));
  }
  wrapper.append(select);

  if (field.helper) wrapper.append(el('p', { class: 'astra-helper', text: field.helper }));
  return wrapper;
}

function campoTextarea(field) {
  const wrapper = el('div', {
    class: `astra-metric-field${field.wide ? ' astra-metric-field--wide' : ''}`
  });
  wrapper.append(el('label', { class: 'astra-metric-label', for: idControl(field.id), text: field.label }));
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
    class: `astra-metric-field${field.wide ? ' astra-metric-field--wide' : ''}`
  });
  wrapper.append(el('label', { class: 'astra-metric-label', for: idControl(field.id), text: field.label }));

  const fila = el('div', { class: 'astra-range-row' });
  const input = el('input', {
    type: 'range',
    id: idControl(field.id),
    min: 0,
    max: 10,
    step: 1,
    value: 5,
    dataset: { rating: field.id }
  });
  const salida = el('output', { class: 'astra-range-value', for: idControl(field.id), text: '5/10' });
  fila.append(input, salida);
  wrapper.append(fila);

  const extremos = el('div', { class: 'astra-range-ends' });
  for (const texto of field.ends || []) extremos.append(el('span', { text: texto }));
  wrapper.append(extremos);
  return wrapper;
}

function campoPreview(field) {
  const wrapper = el('div', { class: 'astra-metric-field astra-metric-field--wide' });
  wrapper.append(el('span', { class: 'astra-metric-label', text: field.label }));

  const medidas = el('div', { class: 'astra-mini-measures' });
  const peso = el('span', { class: 'astra-mini-measure' });
  peso.append(document.createTextNode('Peso '), el('strong', { dataset: { previewPeso: '' }, text: '— kg' }));
  const estatura = el('span', { class: 'astra-mini-measure' });
  estatura.append(document.createTextNode('Estatura '), el('strong', { dataset: { previewEstatura: '' }, text: '— m' }));
  medidas.append(peso, estatura);
  wrapper.append(medidas);

  if (field.helper) wrapper.append(el('p', { class: 'astra-helper', text: field.helper }));
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
    return el('div', { class: 'astra-divider-label', text: field.label });
  }
  const constructor = CONSTRUCTORES[field.kind];
  return constructor ? constructor(field) : null;
}

function crearSeccion(section) {
  const bloque = el('section', {
    class: 'astra-metric-section',
    id: `astra-sec-${section.id}`,
    'aria-labelledby': `astra-sec-${section.id}-title`
  });

  const cabecera = el('div', { class: 'astra-metric-header' });
  cabecera.append(el('span', { class: 'astra-metric-header__icon', 'aria-hidden': 'true', text: section.icon }));

  const titulos = el('div');
  titulos.append(
    el('h2', { id: `astra-sec-${section.id}-title`, text: section.title }),
    el('p', { text: section.subtitle })
  );
  cabecera.append(titulos, el('span', { class: 'astra-metric-index', text: section.index }));
  bloque.append(cabecera);

  if (section.note) bloque.append(el('p', { class: 'astra-metric-note', text: section.note }));

  const grid = el('div', { class: 'astra-metric-grid' });
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

  const nav = $('[data-quicknav]');
  if (nav) {
    limpiar(nav);
    for (const section of METRIC_SECTIONS) {
      nav.append(el('a', { href: `#astra-sec-${section.id}`, text: section.title }));
    }
  }
}

function marcarError(campo, mensaje) {
  const error = $(`[data-error-for="${campo}"]`);
  if (error) error.textContent = mensaje || '';

  if (campo === 'sexo') {
    for (const radio of document.querySelectorAll('input[name="sexo"]')) {
      radio.setAttribute('aria-invalid', mensaje ? 'true' : 'false');
    }
    return;
  }

  const control = document.querySelector(`[data-profile="${campo}"]`);
  if (control) control.setAttribute('aria-invalid', mensaje ? 'true' : 'false');
}

function limpiarError(campo) {
  marcarError(campo, '');
}

function valorPerfil(campo) {
  return String(getState().profile[campo] || '').trim();
}

function validarPerfil() {
  const errores = {};

  if (!valorPerfil('nombre')) errores.nombre = ETIQUETAS_ERROR.nombre;

  const edad = Number.parseFloat(valorPerfil('edad'));
  if (!Number.isFinite(edad) || edad < 1 || edad > 120) errores.edad = ETIQUETAS_ERROR.edad;

  const peso = Number.parseFloat(valorPerfil('peso'));
  if (!Number.isFinite(peso) || peso <= 0) errores.peso = ETIQUETAS_ERROR.peso;

  const estatura = Number.parseFloat(valorPerfil('estatura'));
  if (!Number.isFinite(estatura) || estatura < 0.5 || estatura > 2.5) errores.estatura = ETIQUETAS_ERROR.estatura;

  if (!valorPerfil('sangre')) errores.sangre = ETIQUETAS_ERROR.sangre;
  if (!valorPerfil('sexo')) errores.sexo = ETIQUETAS_ERROR.sexo;

  for (const campo of Object.keys(ETIQUETAS_ERROR)) marcarError(campo, errores[campo] || '');

  const orden = ['sexo', 'nombre', 'edad', 'peso', 'estatura', 'sangre'];
  const primero = orden.find((campo) => errores[campo]);
  const nodo = primero
    ? primero === 'sexo'
      ? document.querySelector('input[name="sexo"]')
      : document.querySelector(`[data-profile="${primero}"]`)
    : null;

  return { ok: Object.keys(errores).length === 0, primero: nodo };
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

  const form = $('#astra-personal-form');
  if (!form) return;

  // Perfil: texto, números, selectores y radios.
  const manejarPerfil = (event, control) => {
    const campo = control.dataset.profile;
    if (!campo) return;
    if (getState().profile[campo] === control.value) return;
    if (campo === 'sexo') beep('click');
    actions.setProfile(campo, control.value);
    limpiarError(campo);
  };

  delegar(form, 'input', '[data-profile]', manejarPerfil);
  delegar(form, 'change', '[data-profile]', manejarPerfil);

  // Observaciones libres.
  delegar(form, 'input', '[data-other]', (event, control) => {
    actions.setOtherText(control.value);
  });

  // Indicadores numéricos, selects y áreas de texto.
  const hostMetricas = $('[data-metric-sections]');
  if (hostMetricas) {
    const manejarCampo = (event, control) => {
      if (!control.dataset.field) return;
      if (getState().values[control.dataset.field] === control.value) return;
      actions.setValue(control.dataset.field, control.value);
    };
    delegar(hostMetricas, 'input', '[data-field]', manejarCampo);
    delegar(hostMetricas, 'change', '[data-field]', manejarCampo);
    delegar(hostMetricas, 'input', '[data-rating]', (event, control) => {
      const id = control.dataset.rating;
      actions.setRating(id, control.value);
      const salida = control.parentElement?.querySelector('.astra-range-value');
      if (salida) salida.textContent = `${control.value}/10`;
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const { ok, primero } = validarPerfil();
    const estado = $('[data-form-status]');

    if (!ok) {
      if (estado) estado.textContent = 'Revisa los datos marcados antes de continuar.';
      showToast('Completa los datos obligatorios para continuar.', 'warn');
      beep('alert');
      if (primero) {
        desplazarA(primero, { block: 'center' });
        enfocar(primero);
      }
      return;
    }

    if (estado) estado.textContent = '';
    onSubmit();
  });

  const sincronizar = (state) => actualizarVistaPrevia(state);
  subscribe(sincronizar);
  sincronizar(getState());
}
