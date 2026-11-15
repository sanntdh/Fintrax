import test from 'node:test';
import assert from 'node:assert/strict';

import { compararRegistros } from '../src/js/comparativa.js';

const BASE = { fc_reposo: '68', pa_sistolica: '118', spo2: '98', fr: '14', temp: '36.6', leucocitos: '6500' };

test('una frecuencia cardíaca alta y muy distinta de la habitual es una anomalía', () => {
  const { anomalas } = compararRegistros(BASE, { ...BASE, fc_reposo: '118' });
  const fc = anomalas.find((fila) => fila.id === 'fc_reposo');
  assert.ok(fc, 'La FC alterada debe aparecer entre las anomalías');
  assert.deepEqual([fc.base, fc.actual, fc.delta], [68, 118, 50]);
  assert.equal(fc.estado, 'warn');
  assert.equal(fc.cambioNotable, true);
});

test('un valor dentro de rango y casi igual al habitual no es anomalía', () => {
  const { anomalas, normales } = compararRegistros(BASE, { ...BASE, spo2: '97' });
  assert.equal(anomalas.some((fila) => fila.id === 'spo2'), false);
  assert.equal(normales.find((fila) => fila.id === 'spo2').estado, 'ok');
});

test('un cambio notable respecto a lo habitual cuenta aunque siga en rango', () => {
  // NEWS2 considera normal hasta 38,0 °C; subir 1 °C sobre lo habitual sí es un cambio notable.
  const temp = compararRegistros(BASE, { ...BASE, temp: '37.6' }).anomalas.find((fila) => fila.id === 'temp');
  assert.equal(temp.estado, 'ok');
  assert.equal(temp.cambioNotable, true);
});

test('las anomalías más graves van primero', () => {
  const { anomalas } = compararRegistros(BASE, { ...BASE, fc_reposo: '110', spo2: '88' });
  assert.deepEqual(anomalas.map((fila) => [fila.id, fila.estado]), [['spo2', 'bad'], ['fc_reposo', 'warn']]);
});

test('no inventa datos: sin medición actual no hay estado ni anomalía', () => {
  const { anomalas, normales } = compararRegistros({ fc_reposo: '68' }, {});
  assert.equal(anomalas.length, 0);
  const fc = normales.find((fila) => fila.id === 'fc_reposo');
  assert.deepEqual([fc.actual, fc.delta, fc.estado], [null, null, 'na']);
});

test('compara los cinco signos vitales que también evalúa el backend', () => {
  const ids = compararRegistros(BASE, BASE).normales.map((fila) => fila.id);
  for (const id of ['fc_reposo', 'pa_sistolica', 'spo2', 'fr', 'temp']) assert.ok(ids.includes(id), `Falta ${id}`);
});
