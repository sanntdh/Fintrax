/**
 * Cliente HTTP del backend de monitoreo y contrato de las lecturas.
 *
 * Reglas de seguridad (S5):
 * - La clave de API (`X-API-Key`) vive SOLO en `sessionStorage`. Nunca se
 *   escribe en `localStorage`, en la URL ni en el repositorio.
 * - La URL base sale de `?api=` o de `localStorage` (solo la URL, sin
 *   credenciales embebidas). No hay backend por defecto ni datos reales
 *   precargados.
 * - Sin clave configurada el cliente no abre ninguna conexión: no existe el
 *   modo «backend anónimo».
 * - Las peticiones omiten credenciales de navegador, de modo que un CORS con
 *   comodín nunca viaja con cookies.
 *
 * `fetch` y los almacenes se inyectan para poder probar sin navegador.
 */

export const CLAVE_BASE = 'fintrax.apiBase';
export const CLAVE_API = 'fintrax.apiKey';
export const CABECERA_CLAVE = 'X-API-Key';

/** Error con el estado HTTP y un mensaje ya listo para mostrar. */
export class ApiError extends Error {
  /**
   * @param {number} status 0 si el fallo es de configuración o de red
   * @param {string} mensaje mensaje en español listo para la interfaz
   * @param {string} [detalle] detalle técnico o del backend
   */
  constructor(status, mensaje, detalle = '') {
    super(mensaje);
    this.name = 'ApiError';
    this.status = status;
    this.mensaje = mensaje;
    this.detalle = detalle;
  }
}

const ESQUEMAS = new Set(['http:', 'https:']);

/**
 * Valida y normaliza una URL base. Solo admite http/https, sin usuario ni
 * contraseña embebidos, y descarta query y fragmento.
 * @param {unknown} raw
 * @returns {string|null}
 */
export function normalizarBase(raw) {
  if (typeof raw !== 'string') return null;
  const texto = raw.trim();
  if (!texto) return null;
  let url;
  try {
    url = new URL(texto);
  } catch {
    return null;
  }
  if (!ESQUEMAS.has(url.protocol)) return null;
  if (url.username || url.password) return null;
  url.hash = '';
  url.search = '';
  const base = url.href.replace(/\/+$/, '');
  return base || null;
}

/**
 * Resuelve la URL base: primero `?api=`, después `localStorage`. Nunca lee la
 * clave.
 * @param {{search?: string, almacen?: Storage}} opciones
 * @returns {string|null}
 */
export function resolverBase({ search = '', almacen } = {}) {
  const params = new URLSearchParams(search || '');
  const desdeQuery = normalizarBase(params.get('api') || '');
  if (desdeQuery) return desdeQuery;
  const guardada = almacen && typeof almacen.getItem === 'function' ? almacen.getItem(CLAVE_BASE) : null;
  return normalizarBase(guardada || '');
}

/** Guarda solo la URL base en el almacén recibido (localStorage). */
export function guardarBase(almacen, base) {
  const normalizada = normalizarBase(base);
  if (!almacen || typeof almacen.setItem !== 'function') return false;
  if (!normalizada) {
    if (typeof almacen.removeItem === 'function') almacen.removeItem(CLAVE_BASE);
    return false;
  }
  almacen.setItem(CLAVE_BASE, normalizada);
  return true;
}

/** Lee la clave desde `sessionStorage`; devuelve '' si no hay. */
export function leerApiKey(almacen) {
  const valor = almacen && typeof almacen.getItem === 'function' ? almacen.getItem(CLAVE_API) : null;
  return typeof valor === 'string' && valor ? valor : '';
}

/** Escribe la clave en `sessionStorage`; una clave vacía la borra. */
export function guardarApiKey(almacen, clave) {
  const texto = typeof clave === 'string' ? clave.trim() : '';
  if (!almacen || typeof almacen.setItem !== 'function') return false;
  if (!texto) {
    if (typeof almacen.removeItem === 'function') almacen.removeItem(CLAVE_API);
    return false;
  }
  almacen.setItem(CLAVE_API, texto);
  return true;
}

/** Borra la clave de `sessionStorage`. */
export function borrarApiKey(almacen) {
  if (!almacen || typeof almacen.removeItem !== 'function') return;
  almacen.removeItem(CLAVE_API);
}

/** Mensaje en español para cada estado relevante. */
export function mensajeDeError(status, detalle = '') {
  const extra = typeof detalle === 'string' ? detalle.trim() : '';
  switch (status) {
    case 401:
      return 'Clave de API ausente o inválida. Revisa la conexión con el backend.';
    case 403:
      return 'Tu rol no tiene permiso para esta operación.';
    case 404:
      return extra || 'El recurso solicitado no existe en el backend.';
    case 409:
      return extra || 'La operación choca con el estado actual del backend.';
    case 422:
      return `Los datos enviados no son válidos${extra ? `: ${extra}` : '.'}`;
    default:
      return extra || `El backend respondió con un error (${status}).`;
  }
}

/** Extrae el detalle legible de un cuerpo de error del backend. */
export function extraerDetalle(cuerpo) {
  if (cuerpo === null || cuerpo === undefined) return '';
  if (typeof cuerpo === 'string') return cuerpo.trim();
  if (typeof cuerpo === 'object') {
    const detalle = cuerpo.detail;
    if (typeof detalle === 'string') return detalle.trim();
    if (Array.isArray(detalle)) {
      return detalle
        .map((item) => (item && typeof item.msg === 'string' ? item.msg : ''))
        .filter(Boolean)
        .join('; ');
    }
  }
  return '';
}

/**
 * Crea el cliente. `fetch` y `getKey` son inyectables.
 * @param {{baseUrl?: string, fetch?: typeof fetch, getKey?: () => string}} opciones
 */
export function crearApi({ baseUrl = '', fetch: fetchImpl, getKey } = {}) {
  const raiz = normalizarBase(baseUrl);
  const traer = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);

  async function peticion(ruta, opciones = {}) {
    const clave = typeof getKey === 'function' ? getKey() : '';
    if (!clave) throw new ApiError(0, 'Configura la clave de API antes de contactar al backend.');
    if (!raiz) throw new ApiError(0, 'Configura una URL de backend válida (http o https).');
    if (typeof traer !== 'function') throw new ApiError(0, 'Este entorno no dispone de fetch.');

    const { method = 'GET', body, query } = opciones;
    const url = new URL(raiz + ruta);
    if (query) {
      for (const [llave, valor] of Object.entries(query)) {
        if (valor === undefined || valor === null || valor === '') continue;
        url.searchParams.set(llave, String(valor));
      }
    }

    const cabeceras = { Accept: 'application/json', [CABECERA_CLAVE]: clave };
    let carga;
    if (body !== undefined) {
      cabeceras['Content-Type'] = 'application/json';
      carga = JSON.stringify(body);
    }

    let respuesta;
    try {
      respuesta = await traer(url.toString(), {
        method,
        headers: cabeceras,
        body: carga,
        credentials: 'omit'
      });
    } catch (error) {
      throw new ApiError(0, 'No se pudo contactar al backend. Revisa la URL y tu conexión.', String(error?.message || error));
    }

    const texto = typeof respuesta.text === 'function' ? await respuesta.text() : '';
    let datos = null;
    let jsonValido = false;
    if (texto && texto.trim()) {
      try {
        datos = JSON.parse(texto);
        jsonValido = true;
      } catch {
        datos = null;
      }
    }

    if (!respuesta.ok) {
      const detalle = extraerDetalle(datos) || (jsonValido ? '' : texto.slice(0, 200));
      throw new ApiError(respuesta.status, mensajeDeError(respuesta.status, detalle), detalle);
    }
    if (!jsonValido || datos === null) {
      throw new ApiError(
        respuesta.status,
        'El backend respondió sin JSON válido. Revisa la URL y la versión del servidor.',
        texto.slice(0, 200)
      );
    }
    return datos;
  }

  const rutaAstro = (id, sufijo = '') => `/astronautas/${encodeURIComponent(id)}${sufijo}`;

  return {
    baseUrl: raiz,
    getAstronauta: (id) => peticion(rutaAstro(id)),
    crearAstronauta: (cuerpo) => peticion('/astronautas', { method: 'POST', body: cuerpo }),
    getResumen: (id) => peticion(rutaAstro(id, '/resumen')),
    listarAstronautas: (query) => peticion('/astronautas', { query }),
    registrarMedicion: (id, cuerpo) => peticion(rutaAstro(id, '/mediciones'), { method: 'POST', body: cuerpo }),
    calcularLineaBase: (id) => peticion(rutaAstro(id, '/linea-base'), { method: 'POST' }),
    getLineaBase: (id) => peticion(rutaAstro(id, '/linea-base')),
    getHistorial: (id, query) => peticion(rutaAstro(id, '/historial'), { query }),
    getAlertas: (query) => peticion('/alertas', { query })
  };
}

// --- Contrato de las lecturas ------------------------------------------------

/** Signos que exige el backend en toda lectura. */
export const CAMPOS_SIGNOS = ['fc', 'pas', 'fr', 'temp', 'spo2'];

/** Los siete complementarios derivados de síntomas y pruebas. */
export const CAMPOS_COMPLEMENTARIOS = [
  'cambio_visual',
  'sintomas_al_incorporarse',
  'alteracion_sueno',
  'alteracion_animo',
  'dificultad_cognitiva',
  'mareo_desorientacion',
  'evaluacion_inmune_anormal'
];

/** Síntomas que activan cada bandera. `evaluacion_inmune_anormal` no se deduce. */
export const MAPEO_SINTOMAS = {
  cambio_visual: ['Visión borrosa', 'Sensibilidad a luz'],
  // Un mareo genérico NO implica síntomas al incorporarse: solo lo activa el
  // checkbox posicional explícito (no hay síntoma textual que lo mencione).
  sintomas_al_incorporarse: [],
  mareo_desorientacion: ['Mareo o vértigo', 'Confusión'],
  dificultad_cognitiva: ['Confusión'],
  alteracion_sueno: [],
  alteracion_animo: [],
  evaluacion_inmune_anormal: []
};

/**
 * Convierte a número estricto. Un vacío es `null`, nunca 0.
 * @param {unknown} valor
 * @returns {number|null}
 */
export function numeroSigno(valor) {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  if (!texto) return null;
  const numero = Number(texto.replace(',', '.'));
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Construye los cinco signos; informa de los que faltan sin inventar ceros.
 * @param {Record<string, unknown>} fuente
 */
export function construirSignos(fuente = {}) {
  const signos = {};
  const faltantes = [];
  for (const campo of CAMPOS_SIGNOS) {
    const valor = numeroSigno(fuente[campo]);
    if (valor === null) faltantes.push(campo);
    else signos[campo] = valor;
  }
  return { ok: faltantes.length === 0, signos, faltantes };
}

/** Lectura de reposo para la línea base: preflight, sin complementarios. */
export function lecturaPreflight(fuente = {}) {
  const { ok, signos, faltantes } = construirSignos(fuente);
  if (!ok) return { ok: false, faltantes };
  return { ok: true, lectura: { contexto: 'preflight', signos } };
}

/**
 * Normaliza complementarios: solo viajan los booleanos explícitos. Un valor
 * desconocido (`null`) se omite en lugar de convertirse en negativo.
 */
export function normalizarComplementarios(fuente) {
  if (!fuente || typeof fuente !== 'object') return null;
  const salida = {};
  for (const campo of CAMPOS_COMPLEMENTARIOS) {
    if (fuente[campo] === true) salida[campo] = true;
    else if (fuente[campo] === false) salida[campo] = false;
  }
  return Object.keys(salida).length ? salida : null;
}

/**
 * Deriva las banderas complementarias del estado. Solo cuentan los síntomas
 * nombrados explícitamente y los checkboxes dedicados. Devuelve `true` cuando
 * hay evidencia, `false` solo si se marca explícitamente y `null` cuando no se
 * sabe: nunca se convierte un síntoma no seleccionado en negativo, y una escala
 * subjetiva sin confirmación no activa ninguna bandera.
 * @param {{sintomas?: Iterable<string>, explicitos?: Record<string, boolean>}} opciones
 */
export function mapearComplementarios({ sintomas = [], explicitos = {} } = {}) {
  const valores = new Set(
    [...sintomas].map((item) => {
      if (typeof item !== 'string') return null;
      const corte = item.indexOf('|');
      return corte >= 0 ? item.slice(corte + 1) : item;
    })
  );

  const salida = {};
  for (const campo of CAMPOS_COMPLEMENTARIOS) {
    if (explicitos[campo] === true) {
      salida[campo] = true;
      continue;
    }
    if (explicitos[campo] === false) {
      salida[campo] = false;
      continue;
    }
    const porSintoma = (MAPEO_SINTOMAS[campo] || []).some((sintoma) => valores.has(sintoma));
    salida[campo] = porSintoma ? true : null;
  }
  return salida;
}

/** Lectura de misión: signos en vuelo con los complementarios disponibles. */
export function lecturaMision(fuente = {}) {
  const { ok, signos, faltantes } = construirSignos(fuente);
  if (!ok) return { ok: false, faltantes };

  if (fuente.conciencia) signos.conciencia = String(fuente.conciencia);
  if (fuente.oxigeno_suplementario) signos.oxigeno_suplementario = true;
  if (fuente.hipercapnico) signos.hipercapnico = true;

  const lectura = { contexto: 'vuelo', signos };

  const co2 = numeroSigno(fuente.co2_mmhg);
  if (co2 !== null) lectura.co2_mmhg = co2;
  if (fuente.ejercicio) lectura.ejercicio = true;
  const masa = numeroSigno(fuente.masa_kg);
  if (masa !== null) lectura.masa_kg = masa;
  if (fuente.fase_ciclo) lectura.fase_ciclo = String(fuente.fase_ciclo);

  const complementarios = normalizarComplementarios(fuente.complementarios);
  if (complementarios) lectura.complementarios = complementarios;

  return { ok: true, lectura };
}

// --- Traducción entre el formulario y el backend ---------------------------

const SEXO_BACKEND = { Femenino: 'F', Masculino: 'M' };

/**
 * Perfil del formulario con los nombres y tipos de `AstronautaIn`. El grupo
 * sanguíneo no existe en el backend y no se envía.
 * @param {Record<string, string>} perfil
 */
export function perfilParaBackend(perfil = {}) {
  return {
    nombre: String(perfil.nombre ?? '').trim(),
    sexo: SEXO_BACKEND[perfil.sexo] ?? perfil.sexo,
    edad: numeroSigno(perfil.edad),
    masa_kg: numeroSigno(perfil.peso),
    estatura_m: numeroSigno(perfil.estatura)
  };
}

/**
 * Fuente para `lecturaPreflight`/`lecturaMision` a partir de un registro del
 * formulario: renombra los ids locales a los signos del backend.
 * @param {Record<string, string>} values
 * @param {Record<string, string>} perfil
 */
export function fuenteDeRegistro(values = {}, perfil = {}) {
  return {
    fc: values.fc_reposo,
    pas: values.pa_sistolica,
    fr: values.fr,
    temp: values.temp,
    spo2: values.spo2,
    masa_kg: perfil.peso
  };
}

/**
 * Bandera `evaluacion_inmune_anormal` a partir de los resultados de
 * laboratorio: `true` si alguno está fuera de rango, `false` si ambos están
 * dentro y `null` si falta alguno (no se afirma lo que no se sabe).
 * @param {Record<string, string>} values
 */
export function inmuneDeRegistro(values = {}) {
  const resultados = [values.marcadores_inmunes, values.hormonas_estres];
  if (resultados.includes('Fuera de rango')) return true;
  if (resultados.every((valor) => valor === 'Dentro de rango')) return false;
  return null;
}

const ETIQUETAS_NIVEL = ['BAJO', 'MEDIO', 'ALTO'];

/** Estados de condición que piden actuar; el resto no se muestra. */
const ESTADOS_RELEVANTES = new Set([
  'hallazgo_compatible_requiere_evaluacion',
  'limite_de_protocolo_alcanzado_o_superado'
]);

/**
 * Resume la respuesta de `POST /mediciones` para la pantalla de resultados.
 * Devuelve `null` cuando la lectura no produjo evaluación (preflight). El rol
 * «tierra» recibe la respuesta sin condiciones: se tratan como lista vacía.
 */
export function resumirEvaluacion(respuesta) {
  const evaluacion = respuesta?.evaluacion;
  if (!evaluacion) return null;
  const resultado = evaluacion.resultado || {};
  const nivel = Number(evaluacion.nivel ?? resultado.nivel ?? 0);
  return {
    id: evaluacion.id,
    nivel,
    etiqueta: ETIQUETAS_NIVEL[nivel] ?? 'CRÍTICO',
    news2: evaluacion.news2_total ?? resultado.news2_total ?? null,
    hallazgos: (resultado.condiciones || [])
      .filter((condicion) => ESTADOS_RELEVANTES.has(condicion.estado))
      .map(({ nombre, recomendacion }) => ({ nombre, recomendacion })),
    alertas: Array.isArray(resultado.alertas) ? resultado.alertas : []
  };
}
