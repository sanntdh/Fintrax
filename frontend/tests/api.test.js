import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ApiError,
  CABECERA_CLAVE,
  CLAVE_API,
  CLAVE_BASE,
  normalizarBase,
  resolverBase,
  leerApiKey,
  guardarApiKey,
  borrarApiKey,
  crearApi,
  numeroSigno,
  construirSignos,
  lecturaPreflight,
  lecturaMision,
  normalizarComplementarios,
  mapearComplementarios
} from '../src/js/api.js';

/** Almacén falso en memoria; registra qué claves recibió. */
function almacenFalso(inicial = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => datos.set(clave, String(valor)),
    removeItem: (clave) => datos.delete(clave),
    claves: () => [...datos.keys()]
  };
}

/** Respuesta mínima compatible con lo que consume el cliente. */
function respuesta(status, cuerpo) {
  const texto = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo ?? {});
  return { ok: status >= 200 && status < 300, status, text: async () => texto };
}

test('normalizarBase acepta http/https sin credenciales y rechaza el resto', () => {
  assert.equal(normalizarBase('https://api.ejemplo.test/'), 'https://api.ejemplo.test');
  assert.equal(normalizarBase('http://localhost:8000'), 'http://localhost:8000');
  assert.equal(normalizarBase('https://api.ejemplo.test/base/'), 'https://api.ejemplo.test/base');
  assert.equal(normalizarBase('ftp://api.ejemplo.test'), null);
  assert.equal(normalizarBase('https://usuario:clave@api.ejemplo.test'), null);
  assert.equal(normalizarBase('api.ejemplo.test'), null);
  assert.equal(normalizarBase('   '), null);
  assert.equal(normalizarBase(null), null);
});

test('resolverBase prioriza ?api= y cae a localStorage sin leer la clave', () => {
  const almacen = almacenFalso({ [CLAVE_BASE]: 'https://guardada.test', [CLAVE_API]: 'secreta' });
  assert.equal(resolverBase({ search: '?api=https://query.test', almacen }), 'https://query.test');
  assert.equal(resolverBase({ search: '', almacen }), 'https://guardada.test');
  assert.equal(resolverBase({ search: '?api=ftp://malo', almacen }), 'https://guardada.test');
  assert.equal(resolverBase({ search: '', almacen: almacenFalso() }), null);
});

test('la clave vive solo en sessionStorage y nunca en localStorage', () => {
  const sesion = almacenFalso();
  const local = almacenFalso();

  guardarApiKey(sesion, 'clave-demo');
  assert.equal(leerApiKey(sesion), 'clave-demo');
  assert.equal(local.getItem(CLAVE_API), null);
  assert.deepEqual(local.claves(), []);

  borrarApiKey(sesion);
  assert.equal(leerApiKey(sesion), '');
});

test('crearApi exige clave y no abre el backend de forma anónima', async () => {
  const llamadas = [];
  const api = crearApi({
    baseUrl: 'https://api.test',
    fetch: async (url, opciones) => {
      llamadas.push({ url, opciones });
      return respuesta(200, { id: 1 });
    },
    getKey: () => ''
  });

  await assert.rejects(() => api.getAstronauta(1), (error) => error instanceof ApiError && error.status === 0);
  assert.equal(llamadas.length, 0, 'No debe abrir una conexión sin clave');
});

test('crearApi rechaza una base con credenciales o esquema no http', async () => {
  const api = crearApi({ baseUrl: 'ftp://malo.test', fetch: async () => respuesta(200, {}), getKey: () => 'k' });
  await assert.rejects(() => api.getAlertas(), (error) => error instanceof ApiError && error.status === 0);
});

test('crearApi envía X-API-Key y omite credenciales de navegador', async () => {
  const llamadas = [];
  const api = crearApi({
    baseUrl: 'https://api.test/',
    fetch: async (url, opciones) => {
      llamadas.push({ url, opciones });
      return respuesta(200, { id: 7 });
    },
    getKey: () => 'clave-demo'
  });

  const datos = await api.getAstronauta(7);
  assert.deepEqual(datos, { id: 7 });
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].url, 'https://api.test/astronautas/7');
  assert.equal(llamadas[0].opciones.headers[CABECERA_CLAVE], 'clave-demo');
  assert.equal(llamadas[0].opciones.credentials, 'omit');
  assert.equal('Authorization' in llamadas[0].opciones.headers, false);
});

test('los errores 401/403/409/422 dan mensajes claros en español', async () => {
  const casos = [
    [401, {}, 'Clave de API'],
    [403, {}, 'permiso'],
    [409, { detail: 'Hay 3 muestras válidas; faltan 2 para la línea base' }, 'faltan 2'],
    [422, { detail: 'ts no puede ser futuro' }, 'ts no puede ser futuro']
  ];

  for (const [status, cuerpo, esperado] of casos) {
    const api = crearApi({
      baseUrl: 'https://api.test',
      fetch: async () => respuesta(status, cuerpo),
      getKey: () => 'k'
    });
    await assert.rejects(
      () => api.calcularLineaBase(1),
      (error) => {
        assert.equal(error.status, status);
        assert.ok(error.mensaje.includes(esperado), `${status}: ${error.mensaje}`);
        return true;
      }
    );
  }
});

test('un 200 con HTML, JSON roto o vacío se rechaza, no cuenta como éxito', async () => {
  const casos = ['<!DOCTYPE html><html></html>', '{"a": ', ''];
  for (const cuerpo of casos) {
    const api = crearApi({
      baseUrl: 'https://api.test',
      fetch: async () => respuesta(200, cuerpo),
      getKey: () => 'k'
    });
    await assert.rejects(
      () => api.getAstronauta(1),
      (error) => error instanceof ApiError && /JSON/.test(error.mensaje),
      `Debe rechazar el cuerpo: ${JSON.stringify(cuerpo)}`
    );
  }
});

test('una petición no persiste la clave fuera de sessionStorage', async () => {
  const sesion = almacenFalso({ [CLAVE_API]: 'clave-demo' });
  const local = almacenFalso();
  const api = crearApi({
    baseUrl: 'https://api.test',
    fetch: async () => respuesta(200, []),
    getKey: () => leerApiKey(sesion)
  });

  await api.getAlertas();
  assert.equal(local.getItem(CLAVE_API), null);
  assert.equal(sesion.getItem(CLAVE_API), 'clave-demo');
});

test('lecturaPreflight construye una lectura de reposo sin complementarios', () => {
  const { ok, lectura } = lecturaPreflight({ fc: '64', pas: '115', fr: '14', temp: '36.6', spo2: '98' });
  assert.equal(ok, true);
  assert.deepEqual(lectura, {
    contexto: 'preflight',
    signos: { fc: 64, pas: 115, fr: 14, temp: 36.6, spo2: 98 }
  });
  assert.equal('complementarios' in lectura, false);
  assert.equal('ejercicio' in lectura, false);
});

test('los campos vacíos no se convierten en 0', () => {
  assert.equal(numeroSigno(''), null);
  assert.equal(numeroSigno('   '), null);
  assert.equal(numeroSigno('0'), 0);
  assert.equal(numeroSigno('36,6'), 36.6);

  const { ok, faltantes } = construirSignos({ fc: '', pas: '115', fr: '14', temp: '36.6', spo2: '98' });
  assert.equal(ok, false);
  assert.deepEqual(faltantes, ['fc']);
});

test('lecturaMision incluye los complementarios mapeados y omite los desconocidos', () => {
  const complementarios = mapearComplementarios({ sintomas: ['ojos|Visión borrosa'] });
  const { ok, lectura } = lecturaMision({
    fc: '64', pas: '115', fr: '14', temp: '36.6', spo2: '98', complementarios
  });

  assert.equal(ok, true);
  assert.equal(lectura.contexto, 'vuelo');
  assert.deepEqual(lectura.complementarios, { cambio_visual: true });
});

test('un síntoma no seleccionado queda desconocido, nunca en falso', () => {
  const mapa = mapearComplementarios({ sintomas: [] });
  assert.equal(mapa.cambio_visual, null);
  assert.equal(mapa.evaluacion_inmune_anormal, null);
  assert.deepEqual(normalizarComplementarios(mapa), null);
});

test('evaluacion_inmune_anormal solo viaja si se marca explícitamente', () => {
  const mapa = mapearComplementarios({
    sintomas: ['cabeza|Confusión'],
    explicitos: { evaluacion_inmune_anormal: true }
  });

  assert.equal(mapa.dificultad_cognitiva, true);
  assert.equal(mapa.evaluacion_inmune_anormal, true);
  assert.equal(mapa.alteracion_sueno, null);
});

test('un mareo genérico activa desorientación pero no síntomas al incorporarse', () => {
  const mapa = mapearComplementarios({ sintomas: ['cabeza|Mareo o vértigo'] });
  assert.equal(mapa.mareo_desorientacion, true);
  assert.equal(mapa.sintomas_al_incorporarse, null, 'Solo un checkbox posicional explícito lo activa');
});

test('una escala baja sin confirmación no activa complementarios', () => {
  const mapa = mapearComplementarios({
    sintomas: [],
    values: { sueno_calidad: '3', estado_animo: '2', memoria: '1' },
    ratingsTouched: new Set(['sueno_calidad', 'estado_animo', 'memoria'])
  });

  assert.equal(mapa.alteracion_sueno, null, 'No se infiere una alteración de sueño desde una escala');
  assert.equal(mapa.alteracion_animo, null);
  assert.equal(mapa.dificultad_cognitiva, null);
});
