import test from 'node:test';
import assert from 'node:assert/strict';

import { ORGANOS, ORGAN_ORDER } from '../src/data/organs.js';
import { ORGAN_SHAPES } from '../src/data/organ-shapes.js';
import { evaluateOrgans, peorOrgano, zonasConMolestias } from '../src/js/organs.js';
import { evaluate } from '../src/js/evaluation.js';

const PERFIL = {
  sexo: 'Masculino',
  nombre: 'Prueba',
  edad: '34',
  peso: '74',
  estatura: '1.78',
  sangre: 'O+'
};

const evaluar = (values = {}, symptoms = [], ratingsTouched = new Set()) =>
  evaluate({ profile: PERFIL, values, symptoms, ratingsTouched });

const fichasDe = (values = {}, symptoms = [], ratingsTouched = new Set()) => {
  const result = evaluar(values, symptoms, ratingsTouched);
  return { result, organos: evaluateOrgans(result, { values, symptoms: new Set(symptoms) }) };
};

test('el catálogo define los siete órganos en orden', () => {
  assert.equal(ORGAN_ORDER.length, 7);
  assert.deepEqual(ORGAN_ORDER, [
    'cerebro',
    'corazon',
    'pulmones',
    'higado',
    'estomago',
    'rinones',
    'intestinos'
  ]);
  assert.deepEqual(Object.keys(ORGANOS).sort(), [...ORGAN_ORDER].sort());
});

test('cada órgano tiene color, ancla, guía y forma dibujable', () => {
  for (const key of ORGAN_ORDER) {
    const organo = ORGANOS[key];
    const forma = ORGAN_SHAPES[key];

    assert.match(organo.color, /^#[0-9a-f]{6}$/i, `${key} sin color válido`);
    assert.ok(organo.label && organo.description && organo.guidance, `${key} sin textos`);

    for (const [x, y] of [
      [organo.anchor.x, organo.anchor.y],
      [organo.labelAt.x, organo.labelAt.y]
    ]) {
      assert.ok(x > 0 && x < 941, `${key}: x fuera del viewBox`);
      assert.ok(y > 0 && y < 1672, `${key}: y fuera del viewBox`);
    }

    const [inicio, ...resto] = organo.line;
    assert.deepEqual(inicio, [organo.anchor.x, organo.anchor.y], `${key}: la guía no nace en el ancla`);
    assert.deepEqual(resto[resto.length - 1], [organo.labelAt.x, organo.labelAt.y], `${key}: la guía no termina en la etiqueta`);

    assert.ok(forma && Array.isArray(forma.paths) && forma.paths.length > 0, `${key} sin forma`);
    assert.ok(forma.hit >= 18, `${key}: objetivo táctil pequeño`);
  }
});

test('una frecuencia alta marca el corazón en atención', () => {
  const { organos } = fichasDe({ fc_reposo: '130', pa_sistolica: '120', pa_diastolica: '78', spo2: '98' });
  assert.equal(organos.corazon.state, 'bad');
  assert.ok(organos.corazon.sources.some((fuente) => fuente.includes('FC 130')));
  assert.equal(peorOrgano(organos), 'corazon');
});

test('la saturación baja pesa en pulmones y no en corazón', () => {
  const { organos } = fichasDe({ fc_reposo: '70', spo2: '93' });
  assert.equal(organos.pulmones.state, 'warn');
  assert.equal(organos.corazon.state, 'ok');
});

test('el hígado queda sin datos cuando no hay marcadores hepáticos', () => {
  const { organos } = fichasDe({ fc_reposo: '70', spo2: '98', leucocitos: '9000' });
  assert.equal(organos.higado.state, 'na');
  assert.match(organos.higado.summary, /marcadores hepáticos/i);
});

test('los síntomas urinarios activan los riñones', () => {
  const { organos } = fichasDe({}, ['pelvis|Dolor al orinar']);
  assert.notEqual(organos.rinones.state, 'na');
  assert.ok(organos.rinones.sources.some((fuente) => fuente.includes('Dolor al orinar')));
});

test('el estrés no se asigna al cerebro', () => {
  const values = { estres: '10' };
  const { organos } = fichasDe(values, [], new Set(['estres']));
  assert.equal(organos.cerebro.state, 'na');
});

test('sin datos todos los órganos quedan en `na`', () => {
  const { organos } = fichasDe({});
  for (const key of ORGAN_ORDER) {
    assert.equal(organos[key].state, 'na', `${key} inventó un estado`);
    assert.equal(organos[key].urgent, false);
  }
});

test('las molestias se resumen por zona', () => {
  const result = evaluar({}, ['cabeza|Dolor de cabeza', 'pecho|Palpitaciones']);
  const zonas = zonasConMolestias(result);
  assert.ok(zonas.length >= 2);
  assert.ok(zonas.every((zona) => zona.items.length > 0));
});
