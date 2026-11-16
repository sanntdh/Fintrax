import test from 'node:test';
import assert from 'node:assert/strict';

import { accionesPara } from '../src/js/acciones.js';
import { AREAS, FUENTES } from '../src/data/acciones.js';

const sistemas = (extra = {}) => ({
  cardio: { st: 'ok' }, muscular: { st: 'ok' }, inmune: { st: 'ok' }, psico: { st: 'ok' }, neuro: { st: 'ok' }, ...extra
});

test('sin molestias ni sistemas alterados no se propone nada', () => {
  assert.deepEqual(accionesPara({ symptoms: [], systems: sistemas() }), { urgente: false, areas: [] });
});

test('el mareo lleva a acciones vestibulares respaldadas por FISIO p. 5', () => {
  const { areas } = accionesPara({ symptoms: ['cabeza|Dizziness or vertigo'], systems: sistemas() });
  const vestibular = areas.find((area) => area.id === 'alteracion_vestibular');
  assert.ok(vestibular);
  assert.deepEqual(vestibular.motivos, ['Dizziness or vertigo']);
  assert.ok(vestibular.acciones.some((accion) => accion.fuente === 'FISIO' && accion.pagina === 5));
});

test('la visión borrosa lleva a las gafas de ajuste según NASA (SANS-MTB p. 12)', () => {
  const { areas } = accionesPara({ symptoms: ['ojos|Blurred vision'], systems: sistemas() });
  const sans = areas.find((area) => area.id === 'sans');
  assert.equal(sans.respaldada, true);
  assert.ok(sans.acciones.some((accion) => accion.fuente === 'SANS-MTB' && accion.pagina === 12));
});

test('sueño y ánimo alterados remiten a higiene del sueño y a la conferencia psicológica de NASA', () => {
  const area = accionesPara({ symptoms: [], systems: sistemas({ psico: { st: 'warn' } }) })
    .areas.find((item) => item.id === 'salud_mental_sueno');
  assert.deepEqual(area.acciones.map((accion) => accion.fuente).sort(), ['BHP-OPS', 'SLEEP-ER']);
});

test('cada área con molestias tiene ya alguna acción respaldada', () => {
  for (const [id, area] of Object.entries(AREAS)) assert.ok(area.acciones.length, `${id} sin acciones`);
});

test('dolor en el pecho o falta de aire piden avisar de inmediato', () => {
  assert.equal(accionesPara({ symptoms: ['pecho|Crushing pain'], systems: sistemas() }).urgente, true);
  assert.equal(accionesPara({ symptoms: ['pecho|Shortness of breath'], systems: sistemas() }).urgente, true);
  assert.equal(accionesPara({ symptoms: [], systems: sistemas({ cardio: { st: 'bad' } }) }).urgente, true);
});

test('los sistemas alterados también activan sus áreas', () => {
  const ids = accionesPara({ symptoms: [], systems: sistemas({ inmune: { st: 'warn' }, muscular: { st: 'bad' } }) })
    .areas.map((area) => area.id);
  assert.ok(ids.includes('alteracion_inmunitaria'));
  assert.ok(ids.includes('deterioro_muscular'));
  assert.ok(ids.includes('perdida_osea'));
});

test('las fuentes de NASA llevan su enlace público', () => {
  for (const [id, fuente] of Object.entries(FUENTES)) {
    if (fuente.nasa) assert.match(fuente.url, /^https:\/\/(www\.nasa\.gov|humanresearchroadmap\.nasa\.gov|ntrs\.nasa\.gov)\//, id);
  }
});

test('toda acción cita fuente conocida, página y texto literal', () => {
  for (const area of Object.values(AREAS)) {
    for (const accion of area.acciones) {
      assert.ok(FUENTES[accion.fuente], `${area.titulo}: fuente desconocida`);
      assert.ok(Number.isInteger(accion.pagina) && accion.pagina > 0, `${area.titulo}: página inválida`);
      assert.ok(accion.cita.length > 20, `${area.titulo}: falta la cita`);
      assert.ok(accion.texto.split(/\s+/).length <= 18, `${area.titulo}: acción demasiado larga`);
    }
  }
});
