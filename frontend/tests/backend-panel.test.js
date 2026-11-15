import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ApiError } from '../src/js/api.js';
import {
  puedeCalcularBase,
  enviarLecturasPreflight,
  calcularBase,
  crearControladorPreflight,
  estadoPacienteLimpio,
  respuestaVigente,
  ROLES_CALCULO_BASE
} from '../src/js/backend-panel.js';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

const LECTURAS = [
  { fc: '64', pas: '115', fr: '14', temp: '36.6', spo2: '98' },
  { fc: '65', pas: '116', fr: '15', temp: '36.5', spo2: '97' },
  { fc: '66', pas: '117', fr: '16', temp: '36.4', spo2: '96' }
];

test('solo médico y administrador pueden calcular la línea base', () => {
  assert.deepEqual([...ROLES_CALCULO_BASE].sort(), ['admin', 'medico']);
  assert.equal(puedeCalcularBase('medico'), true);
  assert.equal(puedeCalcularBase('admin'), true);
  assert.equal(puedeCalcularBase('astronauta'), false);
  assert.equal(puedeCalcularBase('tierra'), false);
  assert.equal(puedeCalcularBase(''), false);
});

test('las lecturas de preflight se envían de una en una y en orden', async () => {
  const enviadas = [];
  const api = {
    registrarMedicion: async (id, cuerpo) => {
      enviadas.push({ id, cuerpo });
      return { medicion: { id: enviadas.length }, evaluacion: null };
    }
  };

  const resultado = await enviarLecturasPreflight({ api, astronautaId: 5, lecturas: LECTURAS });
  assert.equal(resultado.completado, true);
  assert.equal(resultado.enviadas, 3);
  assert.equal(enviadas.length, 3);
  assert.equal(enviadas[0].cuerpo.contexto, 'preflight');
  assert.equal('complementarios' in enviadas[0].cuerpo, false);
  assert.deepEqual(enviadas[2].cuerpo.signos, { fc: 66, pas: 117, fr: 16, temp: 36.4, spo2: 96 });
});

test('el borrador de preflight no se pierde cuando falla un envío', async () => {
  const lecturas = LECTURAS.map((lectura) => ({ ...lectura }));
  let n = 0;
  const api = {
    registrarMedicion: async () => {
      n += 1;
      if (n === 3) throw new ApiError(409, 'Registro duplicado o referencia inválida');
      return {};
    }
  };

  const resultado = await enviarLecturasPreflight({ api, astronautaId: 5, lecturas });
  assert.equal(resultado.enviadas, 2);
  assert.equal(resultado.completado, false);
  assert.equal(resultado.fallos.length, 1);
  assert.equal(resultado.fallos[0].indice, 2);
  assert.ok(resultado.fallos[0].mensaje.includes('duplicado'));
  assert.equal(lecturas.length, 3, 'El borrador se conserva intacto');
});

test('una lectura incompleta no se envía y no inventa ceros', async () => {
  let llamadas = 0;
  const api = { registrarMedicion: async () => { llamadas += 1; return {}; } };
  const lecturas = [{ fc: '64', pas: '', fr: '14', temp: '36.6', spo2: '98' }];

  const resultado = await enviarLecturasPreflight({ api, astronautaId: 5, lecturas });
  assert.equal(llamadas, 0);
  assert.equal(resultado.enviadas, 0);
  assert.equal(resultado.fallos[0].indice, 0);
  assert.ok(resultado.fallos[0].mensaje.includes('pas'));
});

test('calcular base respeta el rol sin llamar al backend si no autoriza', async () => {
  let llamadas = 0;
  const api = { calcularLineaBase: async () => { llamadas += 1; return []; } };

  const negado = await calcularBase({ api, astronautaId: 5, rol: 'astronauta' });
  assert.equal(negado.ok, false);
  assert.equal(llamadas, 0);
  assert.ok(negado.mensaje.length > 0);

  const permitido = await calcularBase({ api, astronautaId: 5, rol: 'medico' });
  assert.equal(permitido.ok, true);
  assert.equal(llamadas, 1);
});

test('un 409 por muestras insuficientes conserva el conteo aunque sean 0', async () => {
  const api = {
    calcularLineaBase: async () => {
      throw new ApiError(409, 'Hay 0 muestras válidas; faltan 5 para la línea base');
    }
  };

  const resultado = await calcularBase({ api, astronautaId: 1, rol: 'admin' });
  assert.equal(resultado.ok, false);
  assert.equal(resultado.status, 409);
  assert.ok(resultado.mensaje.includes('0 muestras'));
  assert.ok(resultado.mensaje.includes('faltan 5'));
});

test('un 403 del servidor se propaga como mensaje claro', async () => {
  const api = {
    calcularLineaBase: async () => {
      throw new ApiError(403, 'Tu rol no tiene permiso para esta operación.');
    }
  };

  const resultado = await calcularBase({ api, astronautaId: 1, rol: 'medico' });
  assert.equal(resultado.ok, false);
  assert.equal(resultado.status, 403);
  assert.ok(resultado.mensaje.includes('permiso'));
});

test('la vista local queda etiquetada como orientación no oficial', async () => {
  const html = await fs.readFile(join(RAIZ, 'index.html'), 'utf8');
  assert.ok(html.includes('data-local-note'), 'Falta el gancho de la etiqueta local');
  assert.ok(
    html.includes('Orientación local, no resultado oficial'),
    'El cálculo local debe declararse explícitamente como no oficial'
  );
});

test('el reintento de preflight envía solo las lecturas pendientes', async () => {
  let n = 0;
  const llamadas = [];
  const api = {
    registrarMedicion: async (id, cuerpo) => {
      llamadas.push(cuerpo);
      n += 1;
      if (n === 3) throw new ApiError(409, 'Registro duplicado o referencia inválida');
      return {};
    }
  };
  const control = crearControladorPreflight({});

  const primero = await control.enviar({ api, astronautaId: 5, lecturas: LECTURAS });
  assert.equal(primero.enviadas, 2);
  assert.equal(primero.completado, false);
  assert.equal(primero.fallos[0].indice, 2);
  assert.equal(control.enviadas, 2, 'El control conserva la cantidad real enviada');

  const reintento = await control.enviar({ api, astronautaId: 5, lecturas: LECTURAS });
  assert.equal(reintento.enviadas, 3);
  assert.equal(reintento.completado, true);
  assert.equal(llamadas.length, 4, 'Solo se reenvía la lectura pendiente');
  assert.deepEqual(llamadas[3].signos, { fc: 66, pas: 117, fr: 16, temp: 36.4, spo2: 96 });
});

test('un segundo envío concurrente se omite y no duplica', async () => {
  let resolver;
  const pendiente = new Promise((resolve) => { resolver = resolve; });
  let llamadas = 0;
  const api = {
    registrarMedicion: async () => {
      llamadas += 1;
      await pendiente;
      return {};
    }
  };
  const control = crearControladorPreflight({});

  const primero = control.enviar({ api, astronautaId: 5, lecturas: [LECTURAS[0]] });
  const segundo = await control.enviar({ api, astronautaId: 5, lecturas: [LECTURAS[0]] });
  assert.equal(segundo.omitido, true);
  assert.equal(llamadas, 1, 'El clic concurrente no debe abrir otra petición');

  resolver();
  await primero;
  assert.equal(llamadas, 1);
});

test('cambiar de paciente limpia borrador, historial, base y oficial', () => {
  const limpio = estadoPacienteLimpio();
  assert.equal(limpio.astronauta, null);
  assert.equal(limpio.oficial, null);
  assert.deepEqual(limpio.historial, []);
  assert.deepEqual(limpio.base, []);
  assert.equal(limpio.preflight.enviadas, 0);
  assert.equal(limpio.preflight.lecturas.length, 5);
  for (const lectura of limpio.preflight.lecturas) {
    assert.deepEqual(lectura, { fc: '', pas: '', fr: '', temp: '', spo2: '' });
  }
  assert.deepEqual(limpio.mision.borrador, { fc: '', pas: '', fr: '', temp: '', spo2: '' });
  assert.deepEqual(limpio.mision.explicitos, {});
});

test('una respuesta tardía del paciente anterior no se aplica', () => {
  const estado = { backend: { generacion: 2, astronauta: { id: 9 } } };
  assert.equal(respuestaVigente(estado, { generacion: 2, astronautaId: 9 }), true);
  assert.equal(respuestaVigente(estado, { generacion: 1, astronautaId: 9 }), false, 'Generación vieja');
  assert.equal(respuestaVigente(estado, { generacion: 2, astronautaId: 8 }), false, 'Otro paciente');
  assert.equal(respuestaVigente({ backend: { generacion: 2, astronauta: null } }, { generacion: 2, astronautaId: 9 }), false);
});

test('el guard usa el estado raíz real del panel', async () => {
  const { getState, actions } = await import('../src/js/state.js');
  const anterior = { ...getState().backend };
  try {
    actions.setBackend({ generacion: 42, astronauta: { id: 9 } });
    assert.equal(respuestaVigente(getState(), { generacion: 42, astronautaId: 9 }), true);
    actions.setBackend({ astronauta: { id: 10 } });
    assert.equal(respuestaVigente(getState(), { generacion: 42, astronautaId: 9 }), false);
  } finally {
    actions.setBackend(anterior);
  }
});
