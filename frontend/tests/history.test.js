import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { construirSeriesHistorial, extraerPuntos } from '../src/js/charts.js';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

const HISTORIAL = [
  {
    ts: '2026-11-14T12:00:00',
    news2_total: 2,
    entrada: { signos: { fc: 70, pas: 120, fr: 14, temp: 36.6, spo2: 98 } }
  },
  {
    ts: '2026-11-14T10:00:00',
    news2_total: 0,
    entrada: { signos: { fc: 64, pas: 115, fr: 13, temp: 36.5, spo2: 99 } }
  },
  { ts: '2026-11-14T11:00:00', news2_total: 1, entrada: null }
];

test('extraerPuntos ordena por tiempo real', () => {
  const puntos = extraerPuntos(HISTORIAL);
  assert.deepEqual(
    puntos.map((p) => p.t),
    ['2026-11-14T10:00:00', '2026-11-14T11:00:00', '2026-11-14T12:00:00']
  );
  assert.deepEqual(puntos.map((p) => p.news2), [0, 1, 2]);
});

test('las series del historial no inventan los signos faltantes', () => {
  const series = construirSeriesHistorial(HISTORIAL, []);
  const news2 = series.find((s) => s.id === 'news2');
  assert.deepEqual(news2.points.map((p) => p.v), [0, 1, 2]);

  const fc = series.find((s) => s.id === 'fc');
  assert.deepEqual(fc.points.map((p) => p.v), [64, null, 70]);
  assert.equal(fc.hasData, true);
});

test('sin historial las series quedan sin datos', () => {
  const series = construirSeriesHistorial([], []);
  assert.ok(series.length >= 5);
  for (const serie of series) assert.equal(serie.hasData, false);
});

test('la línea base activa alimenta la referencia de cada signo', () => {
  const bases = [{ id: 2, fase_ciclo: null, activa: true, fc: 64, pas: 115, fr: 14, temp: 36.6, spo2: 98 }];
  const historial = [
    {
      ts: '2026-11-14T10:00:00',
      news2_total: 0,
      entrada: { signos: { fc: 80, pas: 130, fr: 20, temp: 37.2, spo2: 95 } }
    }
  ];

  const series = construirSeriesHistorial(historial, bases);
  assert.equal(series.find((s) => s.id === 'fc').baseValor, 64);
  assert.equal(series.find((s) => s.id === 'spo2').baseValor, 98);
  assert.equal(series.find((s) => s.id === 'fr').baseValor, 14);
  assert.equal(series.find((s) => s.id === 'temp').baseValor, 36.6);
});

test('las gráficas ya no usan temporizadores ni valores aleatorios', async () => {
  const contenido = await fs.readFile(join(RAIZ, 'src/js/charts.js'), 'utf8');
  assert.equal(contenido.includes('Math.random'), false, 'charts.js no debe generar valores aleatorios');
  assert.equal(contenido.includes('setInterval'), false, 'charts.js no debe animar con temporizadores');
});
