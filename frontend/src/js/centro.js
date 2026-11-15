/**
 * Conexión con el centro médico Fintrax (backend de monitoreo).
 *
 * La conexión es opcional: sin ella la evaluación local funciona igual. Con
 * ella, al analizar se envían la lectura habitual (preflight, una vez por
 * astronauta y sesión) y la actual (vuelo), y la respuesta del backend se
 * resume en una franja de los resultados.
 *
 * En un equipo de a bordo, `config.json` (no versionado) fija backend, clave y
 * astronauta: la página conecta sola y la tripulación no teclea nada. El
 * diálogo de URL y clave queda para mantenimiento (`?mantenimiento`) o para
 * equipos sin configurar.
 */

import { $, el, limpiar } from './dom.js';
import { showToast } from './toast.js';
import {
  ApiError,
  crearApi,
  resolverBase,
  guardarBase,
  leerApiKey,
  guardarApiKey,
  borrarApiKey,
  normalizarConfig,
  perfilParaBackend,
  fuenteDeRegistro,
  lecturaPreflight,
  lecturaMision,
  mapearComplementarios,
  inmuneDeRegistro,
  resumirEvaluacion
} from './api.js';

const CLAVE_ASTRONAUTA = 'fintrax.astronautaId';
const PREFIJO_PREFLIGHT = 'fintrax.preflight.';

/** Acceso tolerante a almacenes bloqueados (modo privado, previsualizaciones). */
function almacen(tipo) {
  try {
    return window[tipo];
  } catch {
    return null;
  }
}

const sesion = () => almacen('sessionStorage');
const local = () => almacen('localStorage');

function leer(store, clave) {
  try {
    return store?.getItem(clave) || '';
  } catch {
    return '';
  }
}

function escribir(store, clave, valor) {
  try {
    if (valor) store?.setItem(clave, valor);
    else store?.removeItem(clave);
  } catch {
    /* Sin almacén la conexión dura solo lo que la pestaña. */
  }
}

/** Configuración de la misión cargada al arrancar; `null` si no hay. */
let config = null;
/** Resultado de la última comprobación del enlace: 'on' | 'off' | 'probando'. */
let enlace = 'off';

/** Último estado analizado, para reintentar el envío sin repetir el análisis. */
let ultimoEstado = null;

const claveActual = () => leerApiKey(sesion()) || config?.clave || '';
const modoMantenimiento = () => new URLSearchParams(location.search).has('mantenimiento');
/** Con una configuración completa la tripulación no ve el diálogo; sin clave, sí. */
const conexionAutomatica = () => Boolean(config?.clave) && !modoMantenimiento();

function apiActual() {
  // Prioridad: ?api= (pruebas) > config.json (misión) > URL guardada a mano.
  const desdeQuery = resolverBase({ search: location.search });
  return crearApi({
    baseUrl: desdeQuery || config?.backend || resolverBase({ almacen: local() }) || '',
    getKey: claveActual
  });
}

const conectado = () => Boolean(apiActual().baseUrl && claveActual());

/* ------------------------------------------------------------------------- */
/* Indicador y diálogo de conexión                                           */
/* ------------------------------------------------------------------------- */

function pintarIndicador() {
  const boton = $('[data-centro-toggle]');
  if (!boton) return;
  const textos = {
    on: 'CENTRO MÉDICO · EN LÍNEA',
    probando: 'CENTRO MÉDICO · CONECTANDO…',
    off: conectado() ? 'CENTRO MÉDICO · SIN ENLACE' : 'CENTRO MÉDICO · SIN CONEXIÓN'
  };
  boton.dataset.estado = enlace === 'on' ? 'on' : 'off';
  $('[data-centro-label]', boton).textContent = textos[enlace];
  boton.title = conexionAutomatica() ? 'Pulsa para reintentar la conexión' : 'Configurar la conexión';
}

/**
 * Comprueba el enlace con el backend y fija el astronauta de este equipo:
 * el de `config.json`, o el único que la clave puede ver.
 * @returns {Promise<boolean>}
 */
async function comprobarEnlace() {
  if (!conectado()) {
    enlace = 'off';
    pintarIndicador();
    return false;
  }
  enlace = 'probando';
  pintarIndicador();
  try {
    const astronautas = await apiActual().listarAstronautas();
    if (config?.astronautaId) escribir(sesion(), CLAVE_ASTRONAUTA, config.astronautaId);
    else if (astronautas.length === 1) escribir(sesion(), CLAVE_ASTRONAUTA, String(astronautas[0].id));
    enlace = 'on';
  } catch {
    enlace = 'off';
  }
  pintarIndicador();
  return enlace === 'on';
}

/**
 * `config.json` es la configuración privada de un equipo de a bordo (no se
 * versiona); `config.demo.json`, la pública de la demo desplegada, con una
 * cuenta de rol «astronauta». Se usa la primera que exista y sea válida.
 */
async function cargarConfig() {
  config = null;
  for (const archivo of ['config.json', 'config.demo.json']) {
    try {
      const respuesta = await fetch(archivo, { cache: 'no-store' });
      config = respuesta.ok ? normalizarConfig(await respuesta.json()) : null;
    } catch {
      config = null;
    }
    if (config) return;
  }
}

async function alPulsarIndicador() {
  if (!conexionAutomatica()) {
    abrirDialogo();
    return;
  }
  const ok = await comprobarEnlace();
  showToast(ok ? 'Centro médico Fintrax en línea.' : 'Sin enlace con el centro médico. El análisis sigue siendo local.', ok ? '' : 'warn');
}

function mensajeDialogo(texto, tono = '') {
  const nodo = $('[data-centro-msg]');
  if (!nodo) return;
  nodo.textContent = texto;
  nodo.dataset.tono = tono;
}

function pintarSelector(astronautas) {
  const campo = $('[data-centro-elegir]');
  const select = $('[data-centro-astronauta]');
  if (!campo || !select) return;
  limpiar(select);
  for (const astro of astronautas) {
    select.append(el('option', { value: String(astro.id), text: `${astro.nombre} · #${astro.id}` }));
  }
  const guardado = leer(sesion(), CLAVE_ASTRONAUTA);
  if (astronautas.some((astro) => String(astro.id) === guardado)) select.value = guardado;
  campo.hidden = astronautas.length < 2;
}

async function conectar(event) {
  event.preventDefault();
  const url = $('[data-centro-url]').value;
  const clave = $('[data-centro-clave]').value;
  if (!guardarBase(local(), url)) {
    mensajeDialogo('Escribe una URL http o https válida, por ejemplo http://localhost:8000.', 'error');
    return;
  }
  if (clave.trim()) guardarApiKey(sesion(), clave);
  if (!leerApiKey(sesion())) {
    mensajeDialogo('Escribe la clave de API que te asignó el equipo médico.', 'error');
    return;
  }

  mensajeDialogo('Conectando…');
  const selector = $('[data-centro-elegir]');
  const yaElegia = selector && !selector.hidden;
  try {
    const astronautas = await apiActual().listarAstronautas();
    const elegido = yaElegia ? $('[data-centro-astronauta]').value : '';
    pintarSelector(astronautas);
    if (astronautas.length === 1) escribir(sesion(), CLAVE_ASTRONAUTA, String(astronautas[0].id));
    else if (elegido) escribir(sesion(), CLAVE_ASTRONAUTA, elegido);
    else if (!astronautas.length) escribir(sesion(), CLAVE_ASTRONAUTA, '');

    $('[data-centro-clave]').value = '';
    enlace = 'on';
    pintarIndicador();
    $('[data-centro-desconectar]').hidden = false;
    if (astronautas.length > 1 && !elegido) {
      mensajeDialogo('Conectado. Elige el astronauta y pulsa Conectar de nuevo.', 'ok');
      return;
    }
    mensajeDialogo(astronautas.length
      ? 'Conectado. Tus análisis se validarán con el centro médico.'
      : 'Conectado. Se creará tu ficha con tu perfil al analizar.', 'ok');
    showToast('Centro médico Fintrax en línea.');
  } catch (error) {
    borrarApiKey(sesion());
    enlace = 'off';
    pintarIndicador();
    mensajeDialogo(error instanceof ApiError ? error.mensaje : 'No se pudo conectar.', 'error');
  }
}

function desconectar() {
  borrarApiKey(sesion());
  escribir(sesion(), CLAVE_ASTRONAUTA, '');
  enlace = 'off';
  pintarSelector([]);
  pintarIndicador();
  $('[data-centro-desconectar]').hidden = true;
  mensajeDialogo('Sin conexión. El análisis seguirá siendo local.');
}

/* ------------------------------------------------------------------------- */
/* Franja de resultados                                                      */
/* ------------------------------------------------------------------------- */

function pintarFranja({ estado, titulo, texto = '', resumen = null }) {
  const host = $('[data-centro]');
  if (!host) return;
  limpiar(host);
  host.dataset.estado = estado;

  const cabecera = el('div', { class: 'fintrax-centro__head' });
  cabecera.append(el('span', { class: 'fintrax-centro__kicker', text: 'CENTRO MÉDICO FINTRAX' }), el('strong', { text: titulo }));
  if (texto) cabecera.append(el('span', { class: 'fintrax-centro__texto', text: texto }));
  host.append(cabecera);

  if (estado === 'off') {
    const reintentar = conexionAutomatica();
    const boton = el('button', { type: 'button', class: 'fintrax-btn fintrax-btn--secondary', text: reintentar ? 'Reintentar' : 'Conectar' });
    boton.addEventListener('click', () => (reintentar ? enviarAlCentro(ultimoEstado) : abrirDialogo()));
    host.append(boton);
  }

  if (!resumen || (!resumen.hallazgos.length && !resumen.alertas.length)) return;
  const detalle = el('details', { class: 'fintrax-centro__detalle' });
  detalle.append(el('summary', { text: 'Ver recomendaciones' }));
  const lista = el('ul');
  for (const hallazgo of resumen.hallazgos) {
    const item = el('li');
    item.append(el('strong', { text: hallazgo.nombre }), el('span', { text: hallazgo.recomendacion }));
    lista.append(item);
  }
  if (!resumen.hallazgos.length) {
    for (const alerta of resumen.alertas) lista.append(el('li', { text: alerta }));
  }
  detalle.append(lista);
  host.append(detalle);
}

function textoResumen(resumen) {
  const hallazgos = resumen.hallazgos.length;
  return [
    `NEWS2 ${resumen.news2 ?? '—'}`,
    hallazgos
      ? `${hallazgos} ${hallazgos === 1 ? 'hallazgo requiere' : 'hallazgos requieren'} evaluación`
      : 'Sin hallazgos que requieran evaluación'
  ].join(' · ');
}

async function asegurarAstronauta(api, perfil) {
  const guardado = leer(sesion(), CLAVE_ASTRONAUTA);
  if (guardado) return guardado;
  const creado = await api.crearAstronauta(perfilParaBackend(perfil));
  escribir(sesion(), CLAVE_ASTRONAUTA, String(creado.id));
  return String(creado.id);
}

/**
 * Envía los registros al backend y pinta el resultado. Nunca bloquea la
 * evaluación local: cualquier fallo queda descrito en la franja.
 * @param {ReturnType<import('./state.js').getState>} state
 */
export async function enviarAlCentro(state) {
  if (!state) return;
  ultimoEstado = state;
  if (!conectado()) {
    pintarFranja({ estado: 'off', titulo: 'Evaluación local', texto: 'Conecta el centro médico para validar este análisis.' });
    return;
  }
  const { baseline, current } = state.records;
  if (!current) return;

  const mision = lecturaMision({
    ...fuenteDeRegistro(current.values, current.profile),
    complementarios: mapearComplementarios({
      sintomas: current.symptoms,
      explicitos: { evaluacion_inmune_anormal: inmuneDeRegistro(current.values) }
    })
  });
  if (!mision.ok) {
    pintarFranja({ estado: 'error', titulo: 'No enviado', texto: `Faltan signos vitales: ${mision.faltantes.join(', ')}.` });
    return;
  }

  pintarFranja({ estado: 'enviando', titulo: 'Enviando al centro médico…' });
  const api = apiActual();
  try {
    if (enlace !== 'on' && !(await comprobarEnlace())) {
      pintarFranja({ estado: 'off', titulo: 'Sin enlace', texto: 'No hay enlace con el centro médico; el análisis es local.' });
      return;
    }
    const id = await asegurarAstronauta(api, current.profile);
    const marca = PREFIJO_PREFLIGHT + id;
    if (baseline && !leer(sesion(), marca)) {
      const reposo = lecturaPreflight(fuenteDeRegistro(baseline.values, baseline.profile));
      if (reposo.ok) {
        await api.registrarMedicion(id, reposo.lectura);
        escribir(sesion(), marca, '1');
      }
    }
    const resumen = resumirEvaluacion(await api.registrarMedicion(id, mision.lectura));
    if (!resumen) {
      pintarFranja({ estado: 'ok', titulo: 'Lectura registrada', texto: 'El centro no devolvió evaluación para esta lectura.' });
      return;
    }
    pintarFranja({ estado: `nivel-${resumen.nivel}`, titulo: `Nivel ${resumen.etiqueta}`, texto: textoResumen(resumen), resumen });
  } catch (error) {
    pintarFranja({
      estado: 'error',
      titulo: 'No se pudo validar',
      texto: error instanceof ApiError ? error.mensaje : 'Error inesperado al contactar al centro médico.'
    });
  }
}

/* ------------------------------------------------------------------------- */
/* Arranque                                                                  */
/* ------------------------------------------------------------------------- */

function abrirDialogo() {
  const dialogo = $('[data-centro-dialog]');
  if (!dialogo) return;
  $('[data-centro-url]').value = apiActual().baseUrl || '';
  mensajeDialogo(conectado() ? 'Conectado.' : 'Introduce la URL del backend y tu clave de API.');
  $('[data-centro-desconectar]').hidden = !conectado();
  if (typeof dialogo.showModal === 'function') dialogo.showModal();
  else dialogo.setAttribute('open', '');
}

export async function initCentro() {
  $('[data-centro-toggle]')?.addEventListener('click', alPulsarIndicador);
  $('[data-centro-form]')?.addEventListener('submit', conectar);
  $('[data-centro-desconectar]')?.addEventListener('click', desconectar);
  $('[data-centro-cerrar]')?.addEventListener('click', () => $('[data-centro-dialog]').close());
  pintarIndicador();
  await cargarConfig();
  await comprobarEnlace();
}
