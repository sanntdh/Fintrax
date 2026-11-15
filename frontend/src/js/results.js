/**
 * Vista de resultados: banner, órganos, sistemas, avatar y telemetría.
 *
 * El resultado llega ya calculado por `evaluate()`. Este módulo solo pinta y
 * sincroniza la selección entre la lista de órganos y el avatar.
 */

import { $, el, limpiar, desplazarA } from './dom.js';
import { MENSAJES, SIN_ALTERACIONES, CONSEJO_ESTADO } from '../data/content.js';
import { ESTADOS } from '../data/severity.js';
import { configurarSeries } from './evaluation.js';
import { createCharts } from './charts.js';
import { beep } from './audio.js';

function nombresEn(result, estado) {
  return [...Object.values(result.zones), ...Object.values(result.systems)]
    .filter((item) => item.st === estado)
    .map((item) => item.label)
    .join(', ');
}

function crearOrgano(clave, zona, onSelect) {
  const estado = zona.st || 'na';
  const tarjeta = el('div', {
    class: 'astra-organ',
    dataset: { st: estado, z: clave },
    tabindex: '0',
    role: 'button',
    'aria-label': `${zona.label}: ${(ESTADOS[estado] || ESTADOS.na).t}`
  });

  tarjeta.append(
    el('span', { class: 'astra-dot' }),
    el('b', { text: zona.label.toUpperCase() }),
    el('span', { class: 'astra-pill', dataset: { st: estado }, text: (ESTADOS[estado] || ESTADOS.na).t })
  );

  const items = zona.items?.length ? zona.items.join(' · ') : '';
  const notas = zona.notes?.length ? zona.notes.join(', ') : '';
  const detalle = [items, notas].filter(Boolean).join(' · ');
  const descripcion =
    estado === 'na'
      ? 'Sin mediciones ni molestias registradas en esta zona.'
      : `${detalle || SIN_ALTERACIONES}. ${CONSEJO_ESTADO[estado] || CONSEJO_ESTADO.na}`;
  tarjeta.append(el('p', { text: descripcion }));

  const activar = () => onSelect(clave, tarjeta);
  tarjeta.addEventListener('click', activar);
  tarjeta.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activar();
    }
  });
  return tarjeta;
}

function crearSistema(clave, sistema) {
  const estado = sistema.st || 'na';
  const tarjeta = el('div', { class: 'astra-system', dataset: { st: estado } });
  tarjeta.append(
    el('span', { class: 'astra-dot' }),
    el('b', { text: sistema.label.toUpperCase() }),
    el('span', { class: 'astra-pill', dataset: { st: estado }, text: (ESTADOS[estado] || ESTADOS.na).t })
  );

  let detalle = 'Valores dentro de lo esperado.';
  if (estado === 'na') detalle = 'Sin mediciones registradas.';
  else if (sistema.notes?.length) detalle = sistema.notes.join(' · ');

  tarjeta.append(el('p', { text: detalle }));
  return tarjeta;
}

/**
 * @param {{avatar: {setStatuses: Function, setGlow: Function, setSelection: Function}}} opciones
 */
export function initResults({ avatar }) {
  const banner = $('[data-banner]');
  const titulo = $('[data-banner-title]');
  const texto = $('[data-banner-text]');
  const chips = $('[data-banner-chips]');
  const organsHost = $('[data-organs]');
  const chartsHost = $('[data-charts]');

  const charts = createCharts(chartsHost);
  let seleccion = '';

  function seleccionar(clave, nodo) {
    seleccion = clave;
    avatar.setSelection(clave);
    for (const organo of organsHost?.querySelectorAll('.astra-organ') || []) {
      organo.classList.toggle('sel', organo.dataset.z === clave);
    }
    if (nodo) desplazarA(nodo, { block: 'nearest' });
    beep('click');
  }

  function pintarBanner(result, state) {
    if (!banner || !titulo || !texto) return;
    const overall = result.overall || 'unknown';
    const mensaje = MENSAJES[overall] || MENSAJES.unknown;
    const graves = nombresEn(result, 'bad');
    const moderados = nombresEn(result, 'warn');

    titulo.textContent = mensaje[0];

    let cuerpo = mensaje[1].replace('{nombres}', overall === 'bad' ? graves : moderados);
    if (overall === 'bad' && moderados) {
      cuerpo = cuerpo.replace('. Se recomienda', ` (y moderadas en ${moderados}). Se recomienda`);
    }
    texto.textContent = cuerpo;

    banner.dataset.state = overall;
    if (!chips) return;
    limpiar(chips);
    const perfil = state.profile;
    const datos = [
      (perfil.nombre || '—').toUpperCase(),
      `${(perfil.sexo || '—').toUpperCase()} · ${perfil.edad || '—'} AÑOS`,
      `IMC ${result.imc === null ? '—' : result.imc.toFixed(1)}`,
      `SANGRE ${(perfil.sangre || '—').toUpperCase()}`
    ];
    for (const dato of datos) chips.append(el('span', { text: dato }));
  }

  function pintarOrganos(result) {
    if (!organsHost) return;
    limpiar(organsHost);

    for (const [clave, zona] of Object.entries(result.zones)) {
      const organo = crearOrgano(clave, zona, seleccionar);
      if (clave === seleccion) organo.classList.add('sel');
      organsHost.append(organo);
    }

    organsHost.append(el('div', { class: 'astra-col-title astra-col-title--spaced', text: '◆ SISTEMAS MÉDICOS' }));
    for (const [clave, sistema] of Object.entries(result.systems)) {
      organsHost.append(crearSistema(clave, sistema));
    }
  }

  function render(result, state) {
    if (!result) return;

    if (seleccion && !result.zones[seleccion]) seleccion = '';

    pintarBanner(result, state);
    pintarOrganos(result);

    avatar.setStatuses(result.zones);
    avatar.setGlow(result.overall === 'unknown' ? 'na' : result.overall);
    avatar.setSelection(seleccion);

    charts.update(configurarSeries(result));
  }

  return {
    render,
    selectZone(clave) {
      if (!clave) return;
      const nodo = organsHost?.querySelector(`.astra-organ[data-z="${clave}"]`);
      seleccionar(clave, nodo);
    },
    destroy() {
      charts.destroy();
    }
  };
}
