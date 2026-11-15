/**
 * Panel de enlace con el backend de monitoreo: línea base y misión.
 *
 * La interfaz nunca decide el nivel clínico: solo envía lecturas y muestra el
 * resultado oficial del backend. El cálculo local (`evaluation.js`) se conserva
 * como orientación por zonas y queda etiquetado como tal.
 *
 * Las funciones puras (`puedeCalcularBase`, `enviarLecturasPreflight`,
 * `calcularBase`) se pueden probar sin navegador.
 */

import { $, el, limpiar, delegar } from './dom.js';
import { getState, actions, subscribe } from './state.js';
import { beep } from './audio.js';
import { showToast } from './toast.js';
import {
  ApiError,
  crearApi,
  resolverBase,
  guardarBase,
  leerApiKey,
  guardarApiKey,
  lecturaPreflight,
  lecturaMision,
  mapearComplementarios
} from './api.js';

/** Roles que la interfaz ofrece para calcular la línea base (el servidor decide). */
export const ROLES_CALCULO_BASE = new Set(['medico', 'admin']);

/** ¿El rol declarado puede intentar calcular la línea base? */
export const puedeCalcularBase = (rol) => ROLES_CALCULO_BASE.has(String(rol || '').toLowerCase());

const SIGNOS = [
  { id: 'fc', label: 'Frecuencia cardíaca', unit: 'bpm' },
  { id: 'pas', label: 'Presión sistólica', unit: 'mmHg' },
  { id: 'fr', label: 'Frecuencia respiratoria', unit: 'rpm' },
  { id: 'temp', label: 'Temperatura', unit: '°C' },
  { id: 'spo2', label: 'Saturación O₂', unit: '%' }
];

const COMPLEMENTARIOS = [
  { id: 'cambio_visual', label: 'Cambio visual' },
  { id: 'sintomas_al_incorporarse', label: 'Síntomas al incorporarse' },
  { id: 'alteracion_sueno', label: 'Alteración del sueño' },
  { id: 'alteracion_animo', label: 'Alteración del ánimo' },
  { id: 'dificultad_cognitiva', label: 'Dificultad cognitiva' },
  { id: 'mareo_desorientacion', label: 'Mareo o desorientación' },
  { id: 'evaluacion_inmune_anormal', label: 'Evaluación inmune anormal (solo informe de laboratorio)' }
];

const NIVELES = { 0: 'BAJO', 1: 'MEDIO', 2: 'ALTO' };
const nombreNivel = (nivel) => NIVELES[Number(nivel)] || `Nivel ${nivel}`;

/**
 * Envía las lecturas de reposo una por una. Nunca borra el borrador: informa
 * qué índice falló para que la persona pueda corregir y reintentar.
 * @param {{api: object, astronautaId: number|string, lecturas?: object[], desde?: number, onProgreso?: Function}} opciones
 */
export async function enviarLecturasPreflight({ api, astronautaId, lecturas = [], desde = 0, onProgreso } = {}) {
  const indices = [];
  const fallos = [];
  const inicio = Math.max(0, desde);

  for (let i = inicio; i < lecturas.length; i++) {
    const { ok, lectura, faltantes } = lecturaPreflight(lecturas[i]);
    if (!ok) {
      fallos.push({ indice: i, mensaje: `Faltan signos: ${faltantes.join(', ')}` });
      break;
    }
    try {
      await api.registrarMedicion(astronautaId, lectura);
      indices.push(i);
      if (typeof onProgreso === 'function') onProgreso(inicio + indices.length, lecturas.length);
    } catch (error) {
      fallos.push({ indice: i, mensaje: error instanceof ApiError ? error.mensaje : String(error?.message || error) });
      break;
    }
  }

  return {
    enviadas: inicio + indices.length,
    indices,
    fallos,
    completado: fallos.length === 0 && inicio + indices.length >= lecturas.length
  };
}

/**
 * Controlador del envío de línea base. Conserva la cantidad real enviada para
 * que un reintento continúe desde la primera lectura fallida, y bloquea un
 * segundo envío concurrente para no duplicar.
 * @param {{onCambio?: (enviadas: number, total: number) => void}} opciones
 */
export function crearControladorPreflight({ onCambio } = {}) {
  let enviadas = 0;
  let enviando = false;

  return {
    get enviadas() {
      return enviadas;
    },
    get enviando() {
      return enviando;
    },
    reiniciar() {
      enviadas = 0;
    },
    async enviar({ api, astronautaId, lecturas = [] } = {}) {
      if (enviando) return { omitido: true, enviadas, completado: false, fallos: [] };
      enviando = true;
      try {
        const resultado = await enviarLecturasPreflight({
          api,
          astronautaId,
          lecturas,
          desde: enviadas,
          onProgreso: (hechas) => {
            if (typeof onCambio === 'function') onCambio(hechas, lecturas.length);
          }
        });
        enviadas = resultado.enviadas;
        if (typeof onCambio === 'function') onCambio(enviadas, lecturas.length);
        return { ...resultado, omitido: false };
      } finally {
        enviando = false;
      }
    }
  };
}

/**
 * Estado específico de paciente, sin datos del anterior: borradores, historial,
 * línea base y resultado oficial quedan vacíos al cambiar de astronauta.
 */
export function estadoPacienteLimpio() {
  return {
    astronauta: null,
    preflight: { lecturas: lecturasIniciales(), enviadas: 0, error: '', aviso: '' },
    mision: { borrador: { fc: '', pas: '', fr: '', temp: '', spo2: '' }, explicitos: {}, error: '' },
    oficial: null,
    historial: [],
    base: []
  };
}

/**
 * ¿La respuesta tardía corresponde al paciente vigente? Evita que una respuesta
 * lenta del paciente anterior sustituya el estado actual.
 */
export function respuestaVigente(estado, { generacion, astronautaId } = {}) {
  const backend = estado?.backend; // Los handlers pasan getState(), no su subestado.
  if (!backend) return false;
  return backend.generacion === generacion && Boolean(backend.astronauta) && backend.astronauta.id === Number(astronautaId);
}

/** Pide al backend el cálculo de la línea base respetando el rol declarado. */
export async function calcularBase({ api, astronautaId, rol } = {}) {
  if (!puedeCalcularBase(rol)) {
    return { ok: false, status: 403, mensaje: 'Solo médico o administrador pueden calcular la línea base.', bases: null };
  }
  try {
    const bases = await api.calcularLineaBase(astronautaId);
    return { ok: true, bases: Array.isArray(bases) ? bases : [] };
  } catch (error) {
    return {
      ok: false,
      status: error instanceof ApiError ? error.status : 0,
      mensaje: error instanceof ApiError ? error.mensaje : String(error?.message || error),
      bases: null
    };
  }
}

// --- Interfaz -----------------------------------------------------------------

const almacenLocal = () => (typeof localStorage !== 'undefined' ? localStorage : null);
const almacenSesion = () => (typeof sessionStorage !== 'undefined' ? sessionStorage : null);

const textoError = (error) => (error instanceof ApiError ? error.mensaje : String(error?.message || error || 'Error inesperado'));

/** Cinco lecturas de reposo vacías (una por muestra de línea base). */
const lecturasIniciales = () => Array.from({ length: 5 }, () => ({ fc: '', pas: '', fr: '', temp: '', spo2: '' }));

/** Fecha legible del resultado oficial; nunca la inventa. */
function formatearFecha(ts) {
  if (!ts) return 'sin fecha';
  const fecha = new Date(ts);
  return Number.isNaN(fecha.getTime()) ? String(ts) : fecha.toLocaleString('es-CO');
}

function campoNumero({ label, unit, dataset, value = '', step = 'any' }) {
  const campo = el('label', { class: 'astra-api-campo' });
  campo.append(el('span', { text: unit ? `${label} (${unit})` : label }));
  campo.append(
    el('input', {
      type: 'number',
      inputmode: 'decimal',
      step,
      value,
      dataset
    })
  );
  return campo;
}

function pintarLecturasPreflight(host, lecturas) {
  if (!host) return;
  limpiar(host);
  lecturas.forEach((lectura, indice) => {
    const bloque = el('div', { class: 'astra-api-lectura' });
    bloque.append(el('h4', { text: `Lectura ${indice + 1}` }));
    const grid = el('div', { class: 'astra-api-signos' });
    for (const signo of SIGNOS) {
      grid.append(
        campoNumero({
          label: signo.label,
          unit: signo.unit,
          value: lectura[signo.id] ?? '',
          dataset: { preflightSigno: signo.id, preflightIndice: String(indice) }
        })
      );
    }
    bloque.append(grid);
    host.append(bloque);
  });
}

function pintarSignosMision(host, borrador) {
  if (!host) return;
  limpiar(host);
  const grid = el('div', { class: 'astra-api-signos' });
  for (const signo of SIGNOS) {
    grid.append(
      campoNumero({
        label: signo.label,
        unit: signo.unit,
        value: borrador[signo.id] ?? '',
        dataset: { misionSigno: signo.id }
      })
    );
  }
  host.append(grid);

  const extras = el('div', { class: 'astra-api-extras' });
  extras.append(
    campoNumero({ label: 'CO₂ de cabina', unit: 'mmHg', value: borrador.co2_mmhg ?? '', dataset: { misionExtra: 'co2_mmhg' } }),
    campoNumero({ label: 'Masa corporal', unit: 'kg', value: borrador.masa_kg ?? '', dataset: { misionExtra: 'masa_kg' } })
  );

  const conciencia = el('label', { class: 'astra-api-campo' });
  conciencia.append(el('span', { text: 'Conciencia' }));
  const select = el('select', { dataset: { misionExtra: 'conciencia' } });
  for (const opcion of ['alerta', 'confuso', 'voz', 'dolor', 'inconsciente']) {
    select.append(el('option', { value: opcion, text: opcion, selected: opcion === 'alerta' }));
  }
  conciencia.append(select);
  extras.append(conciencia);

  const ejercicio = el('label', { class: 'astra-api-check' });
  ejercicio.append(
    el('input', { type: 'checkbox', dataset: { misionExtra: 'ejercicio' } }),
    el('span', { text: 'Lectura durante o después de ejercicio' })
  );
  extras.append(ejercicio);

  host.append(extras);
}

function pintarComplementarios(host, explicitos) {
  if (!host) return;
  limpiar(host);
  for (const campo of COMPLEMENTARIOS) {
    const etiqueta = el('label', { class: 'astra-api-check' });
    etiqueta.append(
      el('input', {
        type: 'checkbox',
        checked: explicitos[campo.id] === true,
        dataset: { complementario: campo.id }
      }),
      el('span', { text: campo.label })
    );
    host.append(etiqueta);
  }
}

function pintarListaBase(host, bases) {
  if (!host) return;
  limpiar(host);
  if (!Array.isArray(bases) || bases.length === 0) {
    host.append(el('p', { class: 'astra-api-hint', text: 'El backend todavía no devuelve una línea base activa.' }));
    return;
  }
  const lista = el('ul', { class: 'astra-api-lista' });
  for (const base of bases) {
    const partes = [
      base.fase_ciclo ? `fase ${base.fase_ciclo}` : 'general',
      `FC ${base.fc}`,
      `PAS ${base.pas}`,
      `FR ${base.fr}`,
      `T ${base.temp}`,
      `SpO₂ ${base.spo2}`,
      base.activa ? 'activa' : 'inactiva'
    ];
    if (base.desactualizada) partes.push('desactualizada');
    lista.append(el('li', { text: partes.join(' · ') }));
  }
  host.append(lista);
}

function pintarOficial(host, evaluacion) {
  if (!host) return;
  limpiar(host);
  if (!evaluacion) return;

  const resultado = evaluacion.resultado || {};
  const caja = el('div', { class: 'astra-api-oficial' });
  const cabecera = el('header');
  cabecera.append(
    el('b', { text: 'Resultado oficial del backend' }),
    el('span', {
      class: 'astra-pill',
      dataset: { st: Number(evaluacion.nivel) >= 2 ? 'bad' : Number(evaluacion.nivel) >= 1 ? 'warn' : 'ok' },
      text: nombreNivel(evaluacion.nivel)
    })
  );
  caja.append(cabecera);
  caja.append(el('p', { text: `NEWS2 total: ${evaluacion.news2_total ?? '—'}` }));
  caja.append(el('p', { class: 'astra-api-hint', text: `Fecha del resultado: ${formatearFecha(evaluacion.ts)}` }));

  if (resultado.news2_desglose && typeof resultado.news2_desglose === 'object') {
    const ul = el('ul', { class: 'astra-api-lista' });
    for (const [clave, valor] of Object.entries(resultado.news2_desglose)) {
      ul.append(el('li', { text: `${clave}: ${valor}` }));
    }
    if (ul.childNodes.length) {
      caja.append(el('h4', { text: 'Desglose NEWS2' }), ul);
    }
  }

  if (resultado.niveles_capas && typeof resultado.niveles_capas === 'object') {
    const ul = el('ul', { class: 'astra-api-lista' });
    for (const [capa, nivel] of Object.entries(resultado.niveles_capas)) {
      ul.append(el('li', { text: `${capa}: ${nombreNivel(nivel)}` }));
    }
    caja.append(el('h4', { text: 'Capas de riesgo' }), ul);
  }

  if (Array.isArray(resultado.alertas) && resultado.alertas.length) {
    const ul = el('ul', { class: 'astra-api-lista astra-api-lista--alerta' });
    for (const alerta of resultado.alertas) ul.append(el('li', { text: String(alerta) }));
    caja.append(el('h4', { text: 'Alertas' }), ul);
  }

  if (Array.isArray(resultado.notas) && resultado.notas.length) {
    const ul = el('ul', { class: 'astra-api-lista' });
    for (const nota of resultado.notas) ul.append(el('li', { text: String(nota) }));
    caja.append(el('h4', { text: 'Notas' }), ul);
  }

  if (Array.isArray(resultado.condiciones) && resultado.condiciones.length) {
    const ul = el('ul', { class: 'astra-api-lista' });
    for (const condicion of resultado.condiciones) {
      const etiqueta = condicion?.nombre || condicion?.codigo || 'Condición';
      ul.append(el('li', { text: `${etiqueta}: ${condicion?.estado ?? 'sin estado'}` }));
    }
    caja.append(el('h4', { text: 'Cribado complementario' }), ul);
  }

  caja.append(el('small', { class: 'astra-api-hint', text: 'Resultado autoritativo del backend; no proviene del cálculo local.' }));
  host.append(caja);
}

/** Inicializa el panel de backend. */
export function initBackendPanel() {
  const baseInput = $('[data-api-base]');
  const keyInput = $('[data-api-key]');
  const rolInput = $('[data-api-rol]');
  const conectar = $('[data-api-conectar]');
  const estado = $('[data-api-estado]');
  const astroBlock = $('[data-api-astro-block]');
  const astroSelect = $('[data-api-astro]');
  const astroIdInput = $('[data-api-astro-id]');
  const usarAstro = $('[data-api-usar-astro]');
  const astroEstado = $('[data-api-astro-estado]');
  const preflightBlock = $('[data-api-preflight]');
  const preflightProgreso = $('[data-api-preflight-progreso]');
  const preflightHost = $('[data-api-preflight-lecturas]');
  const preflightEnviar = $('[data-api-preflight-enviar]');
  const calcularBtn = $('[data-api-calcular-base]');
  const preflightError = $('[data-api-preflight-error]');
  const baseHost = $('[data-api-base-lista]');
  const misionBlock = $('[data-api-mision]');
  const misionHost = $('[data-api-mision-signos]');
  const complementariosHost = $('[data-api-complementarios]');
  const misionEnviar = $('[data-api-mision-enviar]');
  const misionError = $('[data-api-mision-error]');
  const oficialHost = $('[data-api-oficial]');

  if (!conectar || !preflightHost) return { destroy() {} };

  const backend = getState().backend;

  // Estado inicial de la interfaz desde el estado y los almacenes.
  const baseInicial = resolverBase({ search: typeof location !== 'undefined' ? location.search : '', almacen: almacenLocal() });
  if (baseInput) baseInput.value = backend.baseUrl || baseInicial || '';
  if (keyInput) keyInput.value = leerApiKey(almacenSesion());
  if (rolInput) rolInput.value = backend.rol || 'astronauta';

  if (!backend.preflight.lecturas.length) {
    actions.setPreflight({ lecturas: lecturasIniciales() });
  }
  pintarLecturasPreflight(preflightHost, getState().backend.preflight.lecturas);
  pintarSignosMision(misionHost, getState().backend.mision.borrador);
  pintarComplementarios(complementariosHost, getState().backend.mision.explicitos);

  const controlPreflight = crearControladorPreflight({
    onCambio: (enviadas) => {
      actions.setPreflight({ enviadas });
    }
  });

  function apiActual() {
    return crearApi({
      baseUrl: getState().backend.baseUrl,
      getKey: () => leerApiKey(almacenSesion())
    });
  }

  /**
   * Descarta todo el estado del paciente anterior y vuelve a pintar el panel.
   * El borrador es por astronauta; no se conserva ni se persiste PHI.
   */
  function limpiarPaciente() {
    const limpio = estadoPacienteLimpio();
    const generacion = (getState().backend.generacion || 0) + 1;
    actions.setBackend({ ...limpio, generacion });
    controlPreflight.reiniciar();
    pintarLecturasPreflight(preflightHost, limpio.preflight.lecturas);
    pintarSignosMision(misionHost, limpio.mision.borrador);
    pintarComplementarios(complementariosHost, limpio.mision.explicitos);
    pintarListaBase(baseHost, []);
    pintarOficial(oficialHost, null);
    if (preflightError) preflightError.textContent = '';
    if (misionError) misionError.textContent = '';
  }

  function exigirAstronauta() {
    const astronauta = getState().backend.astronauta;
    if (!astronauta || !astronauta.id) {
      showToast('Selecciona un astronauta antes de continuar.', 'warn');
      return null;
    }
    return astronauta;
  }

  // --- Conexión -------------------------------------------------------------
  conectar.addEventListener('click', async () => {
    beep('click');
    const baseNormalizada = resolverBase({ search: `?api=${encodeURIComponent(baseInput?.value || '')}`, almacen: null });
    if (!baseNormalizada) {
      if (estado) estado.textContent = 'Escribe una URL de backend http o https, sin credenciales.';
      return;
    }
    const clave = keyInput?.value?.trim() || '';
    if (!clave) {
      if (estado) estado.textContent = 'Escribe la clave de API (X-API-Key).';
      return;
    }
    guardarBase(almacenLocal(), baseNormalizada);
    guardarApiKey(almacenSesion(), clave);

    // Conexión nueva: descarta al paciente anterior para no mostrar su resultado.
    limpiarPaciente();
    const generacion = getState().backend.generacion;
    actions.setBackend({ baseUrl: baseNormalizada, rol: rolInput?.value || 'astronauta', conectado: false, astronautas: [], error: '' });
    if (estado) estado.textContent = 'Conectando…';

    try {
      const lista = await apiActual().listarAstronautas({ limite: 50 });
      if (getState().backend.generacion !== generacion) return;
      const astronautas = Array.isArray(lista) ? lista : [];
      actions.setBackend({ conectado: true, astronautas, error: '' });
      if (astroSelect) {
        limpiar(astroSelect);
        astroSelect.append(el('option', { value: '', text: 'Selecciona un astronauta' }));
        for (const a of astronautas) {
          astroSelect.append(el('option', { value: String(a.id), text: `${a.id} · ${a.nombre || 'sin nombre'}` }));
        }
      }
      if (estado) estado.textContent = `Conectado. ${astronautas.length} astronauta(s) disponibles.`;
      showToast('Conexión establecida con el backend.');
      beep('success');
    } catch (error) {
      if (getState().backend.generacion !== generacion) return;
      actions.setBackend({ conectado: false, error: textoError(error) });
      if (estado) estado.textContent = textoError(error);
      beep('alert');
    }
  });

  // --- Selección de astronauta ---------------------------------------------
  function usarAstronauta(id, nombre = '') {
    const numero = Number(id);
    if (!Number.isInteger(numero) || numero <= 0) {
      if (astroEstado) astroEstado.textContent = 'Indica un id de astronauta válido.';
      return;
    }
    const actual = getState().backend.astronauta;
    if (actual && actual.id === numero) {
      if (astroEstado) astroEstado.textContent = `Astronauta ${numero} ya está seleccionado.`;
      return;
    }
    // Cambio de paciente: el borrador es por astronauta y no se reutiliza.
    limpiarPaciente();
    actions.setBackend({ astronauta: { id: numero, nombre } });
    if (astroEstado) {
      astroEstado.textContent = `Astronauta ${numero}${nombre ? ` · ${nombre}` : ''} seleccionado. Borrador nuevo.`;
    }
    if (astroIdInput) astroIdInput.value = String(numero);
    void cargarHistorial(numero);
    beep('click');
  }

  astroSelect?.addEventListener('change', () => {
    const valor = astroSelect.value;
    if (!valor) return;
    const opcion = astroSelect.options[astroSelect.selectedIndex];
    usarAstronauta(valor, opcion ? opcion.text.split(' · ').slice(1).join(' · ') : '');
  });

  usarAstro?.addEventListener('click', () => {
    usarAstronauta(astroIdInput?.value, '');
  });

  async function cargarHistorial(id) {
    const generacion = getState().backend.generacion;
    try {
      const api = apiActual();
      const [historial, base] = await Promise.all([
        api.getHistorial(id, { limite: 50 }),
        api.getLineaBase(id).catch(() => [])
      ]);
      if (!respuestaVigente(getState(), { generacion, astronautaId: id })) return;
      actions.setBackend({
        historial: Array.isArray(historial) ? historial : [],
        base: Array.isArray(base) ? base : []
      });
    } catch (error) {
      if (!respuestaVigente(getState(), { generacion, astronautaId: id })) return;
      actions.setBackend({ historial: [], base: [], error: textoError(error) });
    }
  }

  // --- Preflight ------------------------------------------------------------
  delegar(preflightHost, 'input', '[data-preflight-signo]', (event, control) => {
    const indice = Number(control.dataset.preflightIndice);
    const lecturas = getState().backend.preflight.lecturas.map((lectura, i) =>
      i === indice ? { ...lectura, [control.dataset.preflightSigno]: control.value } : lectura
    );
    actions.setPreflight({ lecturas });
  });

  preflightEnviar?.addEventListener('click', async () => {
    const astronauta = exigirAstronauta();
    if (!astronauta) return;
    if (controlPreflight.enviando) return;
    const generacion = getState().backend.generacion;
    const api = apiActual();
    const lecturas = getState().backend.preflight.lecturas;
    if (preflightError) preflightError.textContent = 'Enviando…';

    const resultado = await controlPreflight.enviar({ api, astronautaId: astronauta.id, lecturas });
    if (resultado.omitido) return;
    if (!respuestaVigente(getState(), { generacion, astronautaId: astronauta.id })) return;

    // Conserva la cantidad real enviada aunque haya fallo: el reintento no duplica.
    actions.setPreflight({ enviadas: resultado.enviadas });
    if (preflightProgreso) preflightProgreso.textContent = `${resultado.enviadas} de ${lecturas.length} lecturas enviadas`;

    if (resultado.fallos.length) {
      actions.setPreflight({ error: resultado.fallos[0].mensaje });
      if (preflightError) preflightError.textContent = `Lectura ${resultado.fallos[0].indice + 1}: ${resultado.fallos[0].mensaje}`;
      beep('alert');
      return;
    }

    actions.setPreflight({ error: '' });
    if (preflightError) preflightError.textContent = '';
    showToast('Lecturas de línea base enviadas.');
    beep('success');
  });

  calcularBtn?.addEventListener('click', async () => {
    const astronauta = exigirAstronauta();
    if (!astronauta) return;
    beep('click');
    const generacion = getState().backend.generacion;
    const resultado = await calcularBase({
      api: apiActual(),
      astronautaId: astronauta.id,
      rol: getState().backend.rol
    });
    if (!respuestaVigente(getState(), { generacion, astronautaId: astronauta.id })) return;

    if (!resultado.ok) {
      if (preflightError) preflightError.textContent = resultado.mensaje;
      beep('alert');
      return;
    }
    if (preflightError) preflightError.textContent = '';
    pintarListaBase(baseHost, resultado.bases);
    void cargarHistorial(astronauta.id);
    showToast('Línea base calculada por el backend.');
    beep('success');
  });

  // --- Misión ---------------------------------------------------------------
  delegar(misionHost, 'input', '[data-mision-signo]', (event, control) => {
    const borrador = { ...getState().backend.mision.borrador, [control.dataset.misionSigno]: control.value };
    actions.setMision({ borrador });
  });

  delegar(misionHost, 'input', '[data-mision-extra]', (event, control) => {
    const campo = control.dataset.misionExtra;
    const valor = control.type === 'checkbox' ? control.checked : control.value;
    const borrador = { ...getState().backend.mision.borrador, [campo]: valor };
    actions.setMision({ borrador });
  });

  delegar(misionHost, 'change', '[data-mision-extra]', (event, control) => {
    const campo = control.dataset.misionExtra;
    const valor = control.type === 'checkbox' ? control.checked : control.value;
    const borrador = { ...getState().backend.mision.borrador, [campo]: valor };
    actions.setMision({ borrador });
  });

  delegar(complementariosHost, 'change', '[data-complementario]', (event, control) => {
    const explicitos = { ...getState().backend.mision.explicitos, [control.dataset.complementario]: control.checked };
    actions.setMision({ explicitos });
  });

  misionEnviar?.addEventListener('click', async () => {
    const astronauta = exigirAstronauta();
    if (!astronauta) return;
    beep('click');

    const state = getState();
    const complementarios = mapearComplementarios({
      sintomas: state.symptoms,
      explicitos: state.backend.mision.explicitos
    });

    const { ok, lectura, faltantes } = lecturaMision({ ...state.backend.mision.borrador, complementarios });
    if (!ok) {
      if (misionError) misionError.textContent = `Faltan signos: ${faltantes.join(', ')}`;
      beep('alert');
      return;
    }

    // Un registro nuevo invalida el resultado anterior: no debe quedar como oficial.
    const generacion = state.backend.generacion;
    actions.setBackend({ oficial: null });
    pintarOficial(oficialHost, null);

    if (misionError) misionError.textContent = 'Registrando…';
    try {
      const respuesta = await apiActual().registrarMedicion(astronauta.id, lectura);
      if (!respuestaVigente(getState(), { generacion, astronautaId: astronauta.id })) return;
      const evaluacion = respuesta?.evaluacion || null;
      actions.setMision({ error: '' });
      actions.setBackend({ oficial: evaluacion, error: '' });
      if (misionError) misionError.textContent = evaluacion ? '' : 'Lectura guardada; sin evaluación asociada.';
      pintarOficial(oficialHost, evaluacion);
      void cargarHistorial(astronauta.id);
      showToast(evaluacion ? 'Lectura registrada y evaluada.' : 'Lectura registrada.');
      beep(evaluacion && Number(evaluacion.nivel) >= 2 ? 'alert' : 'success');
    } catch (error) {
      if (!respuestaVigente(getState(), { generacion, astronautaId: astronauta.id })) return;
      const mensaje = textoError(error);
      actions.setMision({ error: mensaje });
      if (misionError) misionError.textContent = mensaje;
      beep('alert');
    }
  });

  // --- Visibilidad según el estado -----------------------------------------
  function sincronizar(state) {
    const { conectado, astronauta, oficial } = state.backend;
    if (astroBlock) astroBlock.hidden = !conectado;
    if (preflightBlock) preflightBlock.hidden = !astronauta;
    if (misionBlock) misionBlock.hidden = !astronauta;
    if (calcularBtn) calcularBtn.disabled = !puedeCalcularBase(state.backend.rol);
    const { enviadas, lecturas } = state.backend.preflight;
    if (preflightProgreso) preflightProgreso.textContent = `${enviadas} de ${lecturas.length} lecturas enviadas`;
    if (oficial && !oficialHost?.childNodes.length) pintarOficial(oficialHost, oficial);
  }

  const desuscribir = subscribe(sincronizar);
  sincronizar(getState());

  return {
    destroy() {
      desuscribir();
    }
  };
}
