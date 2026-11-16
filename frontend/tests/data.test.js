import test from 'node:test';
import assert from 'node:assert/strict';

import { CAUSAS } from '../src/data/content.js';
import { listaSintomas } from '../src/data/symptoms.js';
import {
  COUNTED_IDS,
  COUNTED_BY_SECTION,
  FIELD_IDS,
  RATING_IDS,
  METRIC_SECTIONS
} from '../src/data/metrics.js';
import { SEVERIDAD_SINTOMAS } from '../src/data/severity.js';
import { PROFILE_FIELDS } from '../src/js/validation.js';

const sintomasDeAmbosSexos = () =>
  new Set(
    [...listaSintomas('Male'), ...listaSintomas('Female')].map((sintoma) => sintoma.value)
  );

test('CAUSAS cubre todos los síntomas disponibles en ambos sexos', () => {
  const sintomas = sintomasDeAmbosSexos();
  const claves = Object.keys(CAUSAS);
  const faltantes = [...sintomas].filter((sintoma) => !claves.includes(sintoma));
  assert.deepEqual(faltantes, [], `Síntomas sin causa orientativa: ${faltantes.join(', ')}`);
  // «Molestia pélvica» queda en el catálogo base pero ambos sexos lo reemplazan
  // por listas específicas; se conserva por paridad con el prototipo.
  assert.ok(claves.length >= sintomas.size, 'Faltan causas en el catálogo');
});

test('la severidad solo referencia síntomas existentes', () => {
  const sintomas = sintomasDeAmbosSexos();
  for (const clave of Object.keys(SEVERIDAD_SINTOMAS)) {
    assert.ok(sintomas.has(clave), `Severidad definida para un síntoma inexistente: ${clave}`);
  }
});

test('los 25 indicadores contados suman exactamente el total', () => {
  assert.equal(COUNTED_IDS.length, 25);
  const porSeccion = COUNTED_BY_SECTION.reduce((total, seccion) => total + seccion.ids.length, 0);
  assert.equal(porSeccion, COUNTED_IDS.length);
});

test('el formulario exige 34 campos habituales y 35 actuales', () => {
  assert.equal(PROFILE_FIELDS.length, 6);
  assert.equal(PROFILE_FIELDS.length + FIELD_IDS.length, 34);
  assert.equal(PROFILE_FIELDS.length + FIELD_IDS.length + 1, 35);
});

test('los ids de campo son únicos y las escalas están entre los contados', () => {
  assert.equal(new Set(FIELD_IDS).size, FIELD_IDS.length);
  for (const id of RATING_IDS) {
    assert.ok(FIELD_IDS.includes(id), `La escala ${id} no existe en el formulario`);
    assert.ok(COUNTED_IDS.includes(id), `La escala ${id} no cuenta para el progreso`);
  }
});

test('todas las secciones declaran índice y campos', () => {
  assert.equal(METRIC_SECTIONS.length, 5);
  for (const seccion of METRIC_SECTIONS) {
    assert.ok(seccion.index.includes('/ 05'), `Índice inválido en ${seccion.id}`);
    assert.ok(seccion.fields.length > 0, `Sección vacía: ${seccion.id}`);
  }
});
