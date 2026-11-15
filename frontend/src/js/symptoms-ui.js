/**
 * Chips de síntomas y tarjetas de orientación.
 *
 * Los mismos datos alimentan el formulario y la vista de resultados. No se
 * mueven nodos del DOM: cada contenedor se reconstruye solo cuando cambia el
 * sexo (que cambia el catálogo disponible) y se sincroniza en cada cambio.
 */

import { el, limpiar, delegar, $ } from './dom.js';
import { zonasPara, claveSintoma } from '../data/symptoms.js';
import { ZONAS_NOMBRES } from '../data/symptoms.js';
import { CAUSAS, ACC, ALERTA, CTX } from '../data/content.js';
import { ESTADOS } from '../data/severity.js';
import { getState, actions, subscribe } from './state.js';
import { beep } from './audio.js';

const contenedores = () => ({
  form: $('[data-symptoms="form"]'),
  results: $('[data-symptoms="results"]')
});

const sinAcentos = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

function construir(contenedor, variante, sexo) {
  if (!contenedor) return;
  limpiar(contenedor);

  for (const [zona, [nombre, lista]] of Object.entries(zonasPara(sexo))) {
    const bloque = el('div', { class: 'fintrax-zone', dataset: { zone: zona } });
    bloque.append(el('h3', { text: nombre }));

    const chips = el('div', { class: 'fintrax-chips' });
    for (const sintoma of lista.split('|')) {
      const id = `fintrax-sym-${variante}-${zona}-${sinAcentos(sintoma)}`;
      const chip = el('label', { class: 'fintrax-chip', for: id });
      chip.append(
        el('input', {
          type: 'checkbox',
          id,
          value: sintoma,
          dataset: { symptom: '', zone: zona }
        }),
        el('span', { text: sintoma })
      );
      chips.append(chip);
    }

    bloque.append(chips);
    contenedor.append(bloque);
  }

  {
    const bloque = el('div', { class: 'fintrax-zone' });
    bloque.append(el('h3', { text: 'Estado general' }));
    const chips = el('div', { class: 'fintrax-chips' });
    const id = `fintrax-wellbeing-${variante}`;
    const chip = el('label', { class: 'fintrax-chip fintrax-chip--none', for: id });
    chip.append(
      el('input', { type: 'checkbox', id, dataset: { wellbeing: '' } }),
      el('span', { text: '✓ Me siento en óptimas condiciones' })
    );
    chips.append(chip);
    bloque.append(chips);
    contenedor.append(bloque);
  }
}

function sincronizar(state) {
  for (const contenedor of Object.values(contenedores())) {
    if (!contenedor) continue;

    for (const input of contenedor.querySelectorAll('input[data-symptom]')) {
      input.checked = state.symptoms.has(claveSintoma(input.dataset.zone, input.value));
    }

    const bien = contenedor.querySelector('input[data-wellbeing]');
    if (bien) bien.checked = state.wellBeing;

    const zonasActivas = new Set([...state.symptoms].map((clave) => clave.slice(0, clave.indexOf('|'))));
    for (const bloque of contenedor.querySelectorAll('.fintrax-zone[data-zone]')) {
      bloque.classList.toggle('hl', zonasActivas.has(bloque.dataset.zone));
    }
  }
}

function nombreZona(zona, sexo) {
  return zonasPara(sexo)[zona]?.[0] || ZONAS_NOMBRES[zona] || zona;
}

function renderTarjetas(state) {
  const caja = $('[data-sym-results]');
  if (!caja) return;
  limpiar(caja);

  if (state.symptoms.size === 0) {
    caja.append(
      el('div', {
        class: 'fintrax-sym-empty',
        text: state.wellBeing
          ? 'Marcaste que te sientes en óptimas condiciones. Mantén el monitoreo rutinario.'
          : 'Aún no has marcado ningún síntoma. Si no sientes nada, marca «Me siento en óptimas condiciones» en la lista.'
      })
    );
    return;
  }

  const porZona = new Map();
  for (const clave of state.symptoms) {
    const corte = clave.indexOf('|');
    if (corte < 0) continue;
    const zona = clave.slice(0, corte);
    const valor = clave.slice(corte + 1);
    if (!porZona.has(zona)) porZona.set(zona, []);
    porZona.get(zona).push(valor);
  }

  for (const [zona, lista] of porZona) {
    const resumen = state.result?.zones?.[zona];
    const estado = resumen?.st || 'na';
    const tarjeta = el('div', { class: 'fintrax-sym-card', dataset: { st: estado } });

    const cabecera = el('header');
    cabecera.append(
      el('b', { text: nombreZona(zona, state.profile.sexo).toUpperCase() }),
      el('span', { class: 'fintrax-pill', dataset: { st: estado }, text: (ESTADOS[estado] || ESTADOS.na).t })
    );
    tarjeta.append(cabecera);

    tarjeta.append(el('p', { class: 'fintrax-sym-s' }, [el('b', { text: 'Sientes: ' }), lista.join(' · ')]));

    const causas = [...new Set(lista.flatMap((valor) => (CAUSAS[valor] || 'Causa por determinar').split('|')))].slice(0, 4);
    tarjeta.append(el('h4', { text: 'POSIBLEMENTE SEA…' }));
    const ulCausas = el('ul');
    for (const causa of causas) ulCausas.append(el('li', { text: causa }));
    tarjeta.append(ulCausas);

    const contexto = (CTX[zona] || []).flatMap((sistema) => state.result?.systems?.[sistema]?.notes || []);
    if (contexto.length) {
      tarjeta.append(el('p', { class: 'fintrax-sym-ctx', text: `Tus datos registrados también muestran: ${contexto.join(' · ')}.` }));
    }

    tarjeta.append(el('h4', { text: 'QUÉ HACER' }));
    const ulAcciones = el('ul');
    for (const accion of ACC[zona] || []) ulAcciones.append(el('li', { text: accion }));
    tarjeta.append(ulAcciones);

    if (estado === 'bad') {
      tarjeta.append(
        el('p', {
          class: 'fintrax-sym-urgent',
          text: '⚠ Nivel GRAVE: contacta ahora al médico de vuelo o a Control de Misión.'
        })
      );
    }

    if (ALERTA[zona]) {
      tarjeta.append(el('p', { class: 'fintrax-sym-alert', text: `Busca atención inmediata si aparece: ${ALERTA[zona]}.` }));
    }

    caja.append(tarjeta);
  }

  caja.append(
    el('small', {
      class: 'fintrax-sym-disc',
      text: 'Orientación general basada en lo que marcaste; no es un diagnóstico ni sustituye al médico.'
    })
  );
}

/** Inicializa chips y tarjetas. */
export function initSymptoms() {
  const { form, results } = contenedores();

  for (const contenedor of [form, results]) {
    if (!contenedor) continue;
    delegar(contenedor, 'change', 'input[data-symptom]', (event, input) => {
      beep('click');
      actions.setSymptom(input.dataset.zone, input.value, input.checked);
    });
    delegar(contenedor, 'change', 'input[data-wellbeing]', (event, input) => {
      beep('click');
      actions.setWellBeing(input.checked);
    });
  }

  let sexoAnterior = getState().profile.sexo;
  construir(form, 'form', sexoAnterior);
  construir(results, 'results', sexoAnterior);

  const render = (state) => {
    if (state.profile.sexo !== sexoAnterior) {
      sexoAnterior = state.profile.sexo;
      construir(form, 'form', sexoAnterior);
      construir(results, 'results', sexoAnterior);
    }
    sincronizar(state);
    renderTarjetas(state);
  };

  subscribe(render);
  render(getState());
}
