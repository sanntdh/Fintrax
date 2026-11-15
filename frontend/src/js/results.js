/**
 * Revisión final tras completar el registro actual: mapa funcional por órganos.
 *
 * Recibe el resultado de `evaluate()` y lo traduce a siete fichas de órgano con
 * `evaluateOrgans()`. La vista tiene tres piezas sincronizadas:
 *
 *   1. el avatar SVG (órganos, líneas guía y etiquetas),
 *   2. los dos rieles laterales con el estado de cada órgano,
 *   3. la ficha del órgano seleccionado (nombre, estado, indicación y datos).
 *
 * La telemetría, las molestias y el registro viven en pestañas para que el
 * avatar siga siendo el protagonista sin perder ninguna función anterior.
 */

import { $, el, limpiar, delegar, enfocar } from './dom.js';
import { ESTADOS } from '../data/severity.js';
import { ORGANOS, ORGAN_ORDER } from '../data/organs.js';
import { evaluateOrgans, peorOrgano, zonasConMolestias } from './organs.js';
import { createOrganAvatar } from './organ-avatar.js';
import { createCharts } from './charts.js';
import { configurarSeries } from './evaluation.js';
import { actions } from './state.js';
import { beep } from './audio.js';
import { construirRegistro } from './export.js';

const TITULOS = {
  bad: '◇ HALLAZGOS QUE REQUIEREN ATENCIÓN',
  warn: '◇ DATOS A REVISAR',
  ok: '◇ SISTEMAS DENTRO DE LO ESPERADO',
  unknown: '◇ SIN DATOS SUFICIENTES'
};

const TEXTOS = {
  bad: 'Hay órganos con hallazgos que conviene valorar antes de la misión.',
  warn: 'Algunos datos están fuera de rango o hay molestias que revisar.',
  ok: 'No aparecen hallazgos relevantes con los datos registrados.',
  unknown: 'Faltan mediciones y molestias para valorar los órganos.'
};

/**
 * Lado del riel según el ancla de la etiqueta en el SVG: las etiquetas que
 * crecen hacia la izquierda (`anchor: end`) van al riel izquierdo.
 */
function lado(clave) {
  return ORGANOS[clave]?.labelAt?.anchor === 'end' ? 'left' : 'right';
}

function estadoGlobal(organos) {
  const estados = ORGAN_ORDER.map((key) => organos[key].state);
  if (estados.every((estado) => estado === 'na')) return 'unknown';
  if (estados.includes('bad')) return 'bad';
  if (estados.includes('warn')) return 'warn';
  return 'ok';
}

function contarEstados(organos) {
  return ORGAN_ORDER.reduce(
    (total, key) => {
      total[organos[key].state] += 1;
      return total;
    },
    { ok: 0, warn: 0, bad: 0, na: 0 }
  );
}

/**
 * @param {{onEdit: () => void, onExport: () => void}} opciones
 */
export function initResults({ onEdit, onExport }) {
  const banner = $('[data-banner]');
  const titulo = $('[data-banner-title]');
  const texto = $('[data-banner-text]');
  const chips = $('[data-banner-chips]');
  const resumen = $('[data-body-summary]');
  const rielIzq = $('[data-organ-rail="left"]');
  const rielDer = $('[data-organ-rail="right"]');
  const ficha = $('[data-organ-card]');
  const hostAvatar = $('[data-organ-avatar]');
  const chartsHost = $('[data-charts]');
  const registro = $('[data-record]');

  const organAvatar = createOrganAvatar({
    onSelect: (key) => seleccionarOrgano(key)
  });
  if (hostAvatar) {
    limpiar(hostAvatar);
    hostAvatar.append(organAvatar.root);
  }

  const charts = createCharts(chartsHost);
  let seleccion = '';

  /* --- Selección -------------------------------------------------------- */

  function seleccionarOrgano(key, { mover = false } = {}) {
    if (!key || key === seleccion) return;
    seleccion = key;
    actions.setSelectedOrgan(key);
    beep('click');
    if (mover && ficha) enfocar(ficha);
  }

  /* --- Resumen ---------------------------------------------------------- */

  function pintarBanner(result, state, organos) {
    if (!banner || !titulo || !texto) return;
    const overall = estadoGlobal(organos);
    const cuentas = contarEstados(organos);

    banner.dataset.state = overall;
    titulo.textContent = TITULOS[overall];
    texto.textContent = `${TEXTOS[overall]} ${cuentas.bad} en atención · ${cuentas.warn} por revisar · ${cuentas.na} sin datos.`;

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

  function pintarResumen(result, state, organos) {
    if (!resumen) return;
    limpiar(resumen);
    const cuentas = contarEstados(organos);
    const molestias = zonasConMolestias(result).reduce((total, zona) => total + zona.items.length, 0);

    const datos = [
      ['ÓRGANOS', `${ORGAN_ORDER.length}`],
      ['MEDICIONES', `${result.counts?.filledMetrics ?? 0}/${result.counts?.totalMetrics ?? 0}`],
      ['MOLESTIAS', `${molestias}`],
      ['IMC', result.imc === null ? '—' : result.imc.toFixed(1)],
      ['EN ATENCIÓN', `${cuentas.bad}`]
    ];

    for (const [etiqueta, valor] of datos) {
      const bloque = el('div', { class: 'fintrax-body__metric' });
      bloque.append(el('span', { text: etiqueta }), el('strong', { text: valor }));
      resumen.append(bloque);
    }
  }

  /* --- Rieles ----------------------------------------------------------- */

  function crearPastilla(key, organo, activo) {
    const estado = organo.state;
    const boton = el('button', {
      type: 'button',
      class: 'fintrax-organ-pill',
      dataset: { organPill: key, st: estado },
      'aria-pressed': activo ? 'true' : 'false',
      style: `--organ:${organo.color}`
    });
    boton.append(
      el('span', { class: 'fintrax-organ-pill__dot', 'aria-hidden': 'true' }),
      el('span', { class: 'fintrax-organ-pill__body' }, [
        el('b', { text: organo.label }),
        el('span', { class: 'fintrax-organ-pill__summary', text: organo.summary })
      ]),
      el('span', { class: 'fintrax-pill', dataset: { st: estado }, text: (ESTADOS[estado] || ESTADOS.na).t })
    );
    boton.addEventListener('click', () => seleccionarOrgano(key, { mover: true }));
    return boton;
  }

  function pintarRieles(organos, seleccionado) {
    for (const [host, destino] of [
      [rielIzq, 'left'],
      [rielDer, 'right']
    ]) {
      if (!host) continue;
      limpiar(host);
      for (const key of ORGAN_ORDER) {
        if (lado(key) !== destino) continue;
        host.append(crearPastilla(key, organos[key], key === seleccionado));
      }
    }
  }

  /* --- Ficha del órgano ------------------------------------------------- */

  function pintarFicha(organos, seleccionado) {
    if (!ficha) return;
    const organo = organos[seleccionado];
    if (!organo) {
      limpiar(ficha);
      return;
    }

    const estado = organo.state;
    const indice = ORGAN_ORDER.indexOf(seleccionado) + 1;

    ficha.dataset.st = estado;
    ficha.dataset.organ = seleccionado;
    ficha.style.setProperty('--organ', organo.color);
    limpiar(ficha);

    const cabecera = el('header', { class: 'fintrax-organ-card__head' });
    cabecera.append(
      el('span', {
        class: 'fintrax-organ-card__index',
        text: `ÓRGANO ${String(indice).padStart(2, '0')} / ${String(ORGAN_ORDER.length).padStart(2, '0')}`
      }),
      el('h3', { text: organo.label }),
      el('span', {
        class: 'fintrax-pill fintrax-pill--lg',
        dataset: { st: estado },
        text: (ESTADOS[estado] || ESTADOS.na).t
      })
    );

    const cuerpo = el('div', { class: 'fintrax-organ-card__body' });
    cuerpo.append(el('p', { class: 'fintrax-organ-card__desc', text: organo.summary }));

    const indicacion = el('div', { class: 'fintrax-organ-card__block' });
    indicacion.append(
      el('h4', { text: 'INDICACIÓN' }),
      el('p', { text: organo.guidance })
    );
    cuerpo.append(indicacion);

    const fuentes = el('div', { class: 'fintrax-organ-card__block' });
    fuentes.append(el('h4', { text: 'DATOS USADOS' }));
    if (organo.sources?.length) {
      const lista = el('ul', { class: 'fintrax-organ-card__list' });
      for (const fuente of organo.sources) lista.append(el('li', { text: fuente }));
      fuentes.append(lista);
    } else {
      fuentes.append(
        el('p', {
          class: 'fintrax-organ-card__empty',
          text: 'No hay mediciones ni molestias registradas para este órgano.'
        })
      );
    }
    cuerpo.append(fuentes);

    const detalle = el('p', { class: 'fintrax-organ-card__meta', text: organo.description });
    cuerpo.append(detalle);

    ficha.append(cabecera, cuerpo);
  }

  /* --- Pestañas --------------------------------------------------------- */

  const tabs = [...document.querySelectorAll('[data-body-tab]')];
  const paneles = [...document.querySelectorAll('[data-tab-panel]')];

  function activarTab(nombre) {
    for (const tab of tabs) {
      const activo = tab.dataset.bodyTab === nombre;
      tab.dataset.active = String(activo);
      tab.setAttribute('aria-selected', activo ? 'true' : 'false');
      tab.tabIndex = activo ? 0 : -1;
    }
    for (const panel of paneles) {
      panel.hidden = panel.dataset.tabPanel !== nombre;
    }
    if (nombre === 'telemetry') charts.redraw();
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => activarTab(tab.dataset.bodyTab));
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const actual = tabs.indexOf(tab);
      const siguiente = (actual + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[siguiente].focus();
      activarTab(tabs[siguiente].dataset.bodyTab);
    });
  }

  /* --- Registro --------------------------------------------------------- */

  function pintarRegistro(result, state) {
    if (!registro) return;
    limpiar(registro);
    const datos = construirRegistro(state);
    const etapas = datos.registros || { actuales: datos };
    const sistemas = ['cardio', 'osteo', 'inmune', 'psico', 'neuro'];
    for (const [etapa, datosEtapa] of Object.entries(etapas)) {
      const actual = etapa === 'actuales';
      const bloque = el('details', { class: 'fintrax-record-stage', open: actual, dataset: { recordStage: etapa } });
      bloque.append(el('summary', { text: actual ? 'Etapa 2 · Datos actuales y evaluación' : 'Etapa 1 · Valores habituales de referencia' }));
      const perfil = datosEtapa.perfil;
      const filas = [
        ['Nombre', perfil.nombre], ['Sexo', perfil.sexo], ['Edad', `${perfil.edad} años`],
        ['Peso', `${perfil.peso_kg} kg`], ['Estatura', `${perfil.estatura_m} m`],
        ['Grupo sanguíneo', perfil.grupo_sanguineo]
      ];
      const lista = el('dl', { class: 'fintrax-record' });
      for (const [etiqueta, valor] of filas) lista.append(el('dt', { text: etiqueta }), el('dd', { text: valor }));
      bloque.append(lista);

      datosEtapa.variables.forEach((grupo, i) => {
        const seccion = el('section', { class: 'fintrax-record-group' });
        const titulo = el('h3', { text: grupo.categoria });
        const estado = actual ? result.systems?.[sistemas[i]]?.st : null;
        if (estado) titulo.append(el('span', { class: 'fintrax-pill', dataset: { st: estado }, text: ESTADOS[estado].t }));
        seccion.append(titulo);
        const valores = el('dl', { class: 'fintrax-record' });
        for (const dato of grupo.registros) valores.append(el('dt', { text: dato.label }), el('dd', { text: dato.value }));
        seccion.append(valores);
        bloque.append(seccion);
      });
      if (actual) {
        const molestias = datosEtapa.sinMolestias ? 'Sin molestias declaradas'
          : datosEtapa.molestias.map((s) => `${s.zona}: ${s.molestia}`).join(' · ') || 'No declarado';
        bloque.append(el('p', { class: 'fintrax-record__note', text: `Molestias: ${molestias}` }));
        bloque.append(el('p', { class: 'fintrax-record__note', text: `Observaciones: ${datosEtapa.observaciones}` }));
      }
      registro.append(bloque);
    }
  }

  /* --- Render ----------------------------------------------------------- */

  function render(result, state) {
    if (!result) return;

    const organos = evaluateOrgans(result, state);
    const seleccionado =
      seleccion && organos[seleccion] ? seleccion : peorOrgano(organos);
    seleccion = seleccionado;

    const overall = estadoGlobal(organos);

    pintarBanner(result, state, organos);
    pintarResumen(result, state, organos);
    pintarRieles(organos, seleccionado);
    pintarFicha(organos, seleccionado);
    pintarRegistro(result, state);

    organAvatar.setSex(state.profile.sexo);
    organAvatar.setOrgans(organos, seleccionado);
    organAvatar.setGlow(overall);

    charts.update(configurarSeries(result));
  }

  // Delegación: un solo manejador para todas las pastillas del riel.
  for (const host of [rielIzq, rielDer]) {
    if (!host) continue;
    delegar(host, 'click', '[data-organ-pill]', (event, boton) => {
      seleccionarOrgano(boton.dataset.organPill, { mover: true });
    });
  }

  $('[data-export]')?.addEventListener('click', () => onExport?.());
  $('[data-back]')?.addEventListener('click', () => onEdit?.());

  activarTab('telemetry');

  return {
    render,
    selectOrgan: (key) => seleccionarOrgano(key),
    destroy() {
      charts.destroy();
    }
  };
}
