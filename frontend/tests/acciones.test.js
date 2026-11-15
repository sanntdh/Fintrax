import test from 'node:test';
import assert from 'node:assert/strict';

import { accionesPara } from '../src/js/acciones.js';
import { AREAS } from '../src/data/acciones.js';

const sistemas = (extra = {}) => ({
  cardio: { st: 'ok' }, muscular: { st: 'ok' }, inmune: { st: 'ok' }, psico: { st: 'ok' }, neuro: { st: 'ok' }, ...extra
});

test('sin molestias ni sistemas alterados no se propone nada', () => {
  assert.deepEqual(accionesPara({ symptoms: [], systems: sistemas() }), { urgente: false, areas: [] });
});

test('el mareo lleva a acciones vestibulares respaldadas por FISIO p. 5', () => {
  const { areas } = accionesPara({ symptoms: ['cabeza|Mareo o vértigo'], systems: sistemas() });
  const vestibular = areas.find((area) => area.id === 'alteracion_vestibular');
  assert.ok(vestibular);
  assert.deepEqual(vestibular.motivos, ['Mareo o vértigo']);
  assert.ok(vestibular.acciones.some((accion) => accion.fuente === 'FISIO' && accion.pagina === 5));
});

test('si las fuentes no respaldan acciones se dice, sin inventarlas', () => {
  const { areas } = accionesPara({ symptoms: ['ojos|Visión borrosa'], systems: sistemas() });
  const sans = areas.find((area) => area.id === 'sans');
  assert.equal(sans.respaldada, false);
  assert.deepEqual(sans.acciones, []);
});

test('dolor en el pecho o falta de aire piden avisar de inmediato', () => {
  assert.equal(accionesPara({ symptoms: ['pecho|Dolor opresivo'], systems: sistemas() }).urgente, true);
  assert.equal(accionesPara({ symptoms: ['pecho|Falta de aire'], systems: sistemas() }).urgente, true);
  assert.equal(accionesPara({ symptoms: [], systems: sistemas({ cardio: { st: 'bad' } }) }).urgente, true);
});

test('los sistemas alterados también activan sus áreas', () => {
  const ids = accionesPara({ symptoms: [], systems: sistemas({ inmune: { st: 'warn' }, muscular: { st: 'bad' } }) })
    .areas.map((area) => area.id);
  assert.ok(ids.includes('alteracion_inmunitaria'));
  assert.ok(ids.includes('deterioro_muscular'));
  assert.ok(ids.includes('perdida_osea'));
});

test('toda acción cita fuente local, página y texto literal', () => {
  for (const area of Object.values(AREAS)) {
    for (const accion of area.acciones) {
      assert.ok(['EXON', 'FISIO', 'LIMEN'].includes(accion.fuente), `${area.titulo}: fuente desconocida`);
      assert.ok(Number.isInteger(accion.pagina) && accion.pagina > 0, `${area.titulo}: página inválida`);
      assert.ok(accion.cita.length > 20, `${area.titulo}: falta la cita`);
      assert.ok(accion.texto.split(/\s+/).length <= 18, `${area.titulo}: acción demasiado larga`);
    }
  }
});
