import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluate, configurarSeries, isFilled, isPending } from '../src/js/evaluation.js';

const perfil = (extra = {}) => ({ sexo: 'Masculino', edad: '35', peso: '78', estatura: '1.80', ...extra });

test('sin datos el resultado global es desconocido y ningún sistema está en verde', () => {
  const r = evaluate({});
  assert.equal(r.overall, 'unknown');
  for (const sistema of Object.values(r.systems)) assert.equal(sistema.st, 'na');
  for (const zona of Object.values(r.zones)) assert.equal(zona.st, 'na');
});

test('el sistema psicológico no eleva la gravedad de la cabeza', () => {
  const r = evaluate({
    profile: perfil(),
    values: { estres: '10' },
    ratingsTouched: new Set(['estres'])
  });
  assert.equal(r.systems.psico.st, 'bad');
  assert.equal(r.zones.cabeza.st, 'na', 'La cefalea no debe heredar el estado psicológico');
  assert.equal(r.overall, 'bad');
});

test('una escala no tocada no cuenta aunque tenga un valor', () => {
  const r = evaluate({ profile: perfil(), values: { estres: '9' } });
  assert.equal(r.systems.psico.st, 'na');
  assert.equal(r.overall, 'unknown');
});

test('los valores pendientes no cuentan como medición', () => {
  assert.equal(isFilled('equilibrio', { equilibrio: 'Pendiente de prueba' }, new Set()), false);
  assert.equal(isPending('equilibrio', { equilibrio: 'Pendiente de prueba' }), true);

  const r = evaluate({
    profile: perfil(),
    values: { equilibrio: 'Pendiente de prueba', ecg_estado: 'Pendiente de realizar' }
  });
  assert.equal(r.systems.neuro.st, 'na');
  assert.equal(r.systems.cardio.st, 'na');
  assert.equal(r.overall, 'unknown');
});

test('una presión alta marca el sistema cardiovascular y el pecho', () => {
  const r = evaluate({
    profile: perfil(),
    values: { pa_sistolica: '165', pa_diastolica: '102' }
  });
  assert.equal(r.systems.cardio.st, 'bad');
  assert.equal(r.zones.pecho.st, 'bad');
  assert.equal(r.overall, 'bad');
});

test('un IMC alto añade una advertencia sin inventar patología', () => {
  const r = evaluate({ profile: { ...perfil(), peso: '100', estatura: '1.70' } });
  assert.ok(r.imc > 30);
  assert.equal(r.zones.pecho.st, 'warn');
  assert.equal(r.zones.extremidades.st, 'warn');
  assert.ok(r.zones.pecho.notes.includes('IMC elevado'));
  assert.equal(r.overall, 'warn');
});

test('los síntomas suman por zona y respetan su severidad', () => {
  const r = evaluate({
    profile: perfil(),
    symptoms: ['cabeza|Confusión', 'cabeza|Mareo o vértigo']
  });
  assert.equal(r.zones.cabeza.items.length, 2);
  assert.equal(r.zones.cabeza.score, 4);
  assert.equal(r.zones.cabeza.st, 'bad');
});

test('una zona sin mediciones ni síntomas queda sin datos', () => {
  const r = evaluate({ profile: perfil(), values: { fc_reposo: '70' } });
  assert.equal(r.systems.cardio.st, 'ok');
  assert.equal(r.zones.pecho.st, 'ok');
  assert.equal(r.zones.ojos.st, 'na');
  assert.equal(r.zones.estomago.st, 'na');
});

test('las series nunca inventan datos cuando falta la medición', () => {
  const r = evaluate({ profile: perfil() });
  const series = configurarSeries(r);
  assert.equal(series.length, 4);
  assert.equal(series.find((s) => s.id === 'fc').hasData, false);
  assert.equal(series.find((s) => s.id === 'temp').hasData, false, 'La temperatura no se registra');
  for (const serie of series) {
    assert.ok(serie.base >= serie.lo && serie.base <= serie.hi, `Base fuera de rango en ${serie.id}`);
  }
});

test('las series usan la medición real y la marcan como tal', () => {
  const r = evaluate({
    profile: perfil(),
    values: { fc_reposo: '70', pa_sistolica: '120', pa_diastolica: '80', spo2: '98' }
  });
  const series = configurarSeries(r);
  assert.equal(series.find((s) => s.id === 'fc').hasData, true);
  assert.equal(series.find((s) => s.id === 'fc').base, 70);
  assert.equal(series.find((s) => s.id === 'spo2').base, 98);
  assert.equal(series.find((s) => s.id === 'pa').base, 120);
});
