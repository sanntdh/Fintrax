import test from 'node:test';
import assert from 'node:assert/strict';
import { actions, getState, copiarRegistro } from '../src/js/state.js';
import { erroresRegistro, progresoRegistro, PROFILE_FIELDS } from '../src/js/validation.js';
import { FIELD_IDS, RATING_IDS } from '../src/data/metrics.js';
import { evaluate } from '../src/js/evaluation.js';
import { construirRegistro } from '../src/js/export.js';

function registroCompleto() {
  return {
    profile: { sexo: 'Female', nombre: 'Ana Ríos', edad: '28', peso: '68.5', estatura: '1.75', sangre: 'O+' },
    values: {
      fc_reposo: '68', pa_sistolica: '120', pa_diastolica: '80',
      ecg_estado: 'No findings reported', spo2: '98', fr: '14', temp: '36.6',
      densidad_osea: '1.120', region_dxa: 'Lumbar spine', masa_muscular: '31.5',
      fuerza_muscular: '42', metodo_fuerza: 'Hand grip (dynamometer)',
      leucocitos: '6500', cortisol: '12', hora_cortisol: 'Morning',
      marcadores_inmunes: 'Within range', hormonas_estres: 'Within range',
      estres: '2', estado_animo: '8', ansiedad: '2', sueno_horas: '7.5', sueno_calidad: '8',
      memoria: '8', atencion: '8', concentracion: '8', equilibrio: 'No perceived difficulty',
      coordinacion: 'No perceived difficulty', reaccion_ms: '245'
    },
    ratingsTouched: new Set(RATING_IDS), symptoms: new Set(),
    wellBeing: true, otherText: 'Sin observaciones'
  };
}

function rellenar(record) {
  for (const [key, value] of Object.entries(record.profile)) actions.setProfile(key, value);
  for (const [key, value] of Object.entries(record.values)) {
    if (record.ratingsTouched.has(key)) actions.setRating(key, value);
    else actions.setValue(key, value);
  }
  actions.setWellBeing(record.wellBeing);
  actions.setOtherText(record.otherText);
}

test('cada campo que no es de laboratorio, incluidos los auxiliares, es obligatorio', () => {
  assert.deepEqual(erroresRegistro(registroCompleto()), {});
  for (const field of PROFILE_FIELDS) {
    const record = registroCompleto();
    record.profile[field.id] = '   ';
    assert.ok(erroresRegistro(record)[field.id], `${field.id} no se exige`);
    assert.ok(progresoRegistro(record).porcentaje < 100);
  }
  for (const id of FIELD_IDS.filter((campo) => !LABORATORIO.includes(campo))) {
    const record = registroCompleto();
    record.values[id] = '';
    assert.ok(erroresRegistro(record)[id], `${id} no se exige`);
  }
});

test('rechaza números fuera de rango, decimales inválidos y opciones ajenas', () => {
  for (const [id, value] of [['fc_reposo', '241'], ['spo2', '101'], ['pa_sistolica', '49'], ['pa_diastolica', '201'], ['reaccion_ms', '1.5'], ['sueno_horas', '7.1'], ['cortisol', 'abc'], ['ecg_estado', 'otra opción']]) {
    const record = registroCompleto();
    record.values[id] = value;
    assert.ok(erroresRegistro(record)[id], `${id} aceptó ${value}`);
  }
  const record = registroCompleto();
  record.profile.edad = '28.5';
  record.profile.sangre = 'Z+';
  assert.ok(erroresRegistro(record).edad);
  assert.ok(erroresRegistro(record).sangre);
});

test('una escala exige confirmación explícita, incluso si se elige cero o cinco', () => {
  const record = registroCompleto();
  record.values.estres = '5';
  record.ratingsTouched.delete('estres');
  assert.ok(erroresRegistro(record).estres);
  record.ratingsTouched.add('estres');
  assert.equal(erroresRegistro(record).estres, undefined);
  record.values.estres = '0';
  assert.equal(erroresRegistro(record).estres, undefined);
  assert.equal(progresoRegistro(record).porcentaje, 100);
});

test('el segundo registro exige estado de molestias; las observaciones son opcionales', () => {
  const record = registroCompleto();
  record.wellBeing = false;
  record.otherText = ' ';
  assert.deepEqual(Object.keys(erroresRegistro(record, 'current')), ['symptoms']);
  assert.deepEqual(erroresRegistro(record, 'baseline'), {});
  record.symptoms.add('cabeza|Confusion');
  assert.deepEqual(erroresRegistro(record, 'current'), {});
  record.wellBeing = true;
  assert.ok(erroresRegistro(record, 'current').symptoms);
});

test('recorrido completo: orden, aislamiento, edición, análisis actual y exportación de ambos registros', () => {
  const state = getState();
  assert.equal(state.step, 'intro');
  assert.equal(actions.completarHabituales(), false);
  assert.equal(actions.comenzarAnalisis(evaluate(registroCompleto())), false);
  actions.terminarAnalisis();
  assert.equal(state.step, 'intro');

  actions.terminarIntro();
  assert.equal(state.step, 'baseline');
  assert.equal(actions.completarHabituales(), false);
  rellenar(registroCompleto());
  assert.equal(actions.completarHabituales(), true);
  assert.equal(state.step, 'current');
  assert.equal(state.result, null);
  assert.equal(state.profile.nombre, 'Ana Ríos');
  assert.equal(state.profile.peso, '');
  assert.deepEqual(state.values, {});
  assert.equal(state.ratingsTouched.size, 0);
  assert.equal(state.wellBeing, false);
  assert.equal(actions.comenzarAnalisis(evaluate(state)), false);

  const actual = registroCompleto();
  actual.values.fc_reposo = '145';
  actual.profile.peso = '70.5';
  rellenar(actual);
  assert.equal(state.records.baseline.values.fc_reposo, '68');
  actions.editarHabituales();
  assert.equal(state.step, 'baseline');
  assert.equal(state.values.fc_reposo, '68');
  assert.equal(state.profile.peso, '68.5');
  actions.setValue('fc_reposo', '72');
  actions.completarHabituales();
  assert.equal(state.values.fc_reposo, '145');
  assert.equal(state.profile.peso, '70.5');
  assert.equal(state.ratingsTouched.size, RATING_IDS.length);

  const snapshot = copiarRegistro(state);
  snapshot.values.fc_reposo = '99';
  snapshot.ratingsTouched.clear();
  assert.equal(state.values.fc_reposo, '145');
  assert.equal(state.ratingsTouched.size, RATING_IDS.length);
  const result = evaluate(state);
  assert.equal(result.systems.cardio.st, 'bad');
  assert.equal(evaluate(state.records.baseline).systems.cardio.st, 'ok');
  assert.equal(actions.comenzarAnalisis(result), true);
  assert.equal(state.step, 'transition');
  assert.equal(actions.comenzarAnalisis(result), false);
  actions.terminarAnalisis();
  assert.equal(state.step, 'body');

  actions.setOtherText('Observación revisada');
  const exported = construirRegistro(state);
  assert.equal(exported.registros.habituales.perfil.peso_kg, '68.5');
  assert.equal(exported.registros.actuales.perfil.peso_kg, '70.5');
  assert.equal(exported.registros.actuales.observaciones, 'Observación revisada');
  assert.equal(exported.registros.habituales.variables[0].registros[0].value, '72 bpm');
  assert.equal(exported.registros.actuales.variables[0].registros[0].value, '145 bpm');
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(exported)));

  actions.volverAEditar();
  assert.equal(state.step, 'current');
  assert.equal(state.values.fc_reposo, '145');
  assert.equal(state.result, null);
  actions.setValue('spo2', '');
  assert.equal(actions.comenzarAnalisis(result), false);
  actions.terminarIntro();
  actions.terminarAnalisis();
  assert.equal(state.step, 'current');
});

const LABORATORIO = ['densidad_osea', 'region_dxa', 'leucocitos', 'cortisol', 'hora_cortisol', 'marcadores_inmunes', 'hormonas_estres'];

test('los datos de laboratorio son opcionales y no frenan el progreso', () => {
  const record = registroCompleto();
  for (const id of LABORATORIO) delete record.values[id];
  assert.deepEqual(erroresRegistro(record), {});
  assert.equal(progresoRegistro(record).porcentaje, 100);
});

test('un dato de laboratorio escrito mal sigue siendo un error', () => {
  const record = registroCompleto();
  record.values.leucocitos = 'abc';
  assert.ok(erroresRegistro(record).leucocitos);
  assert.ok(progresoRegistro(record).porcentaje < 100);
});
