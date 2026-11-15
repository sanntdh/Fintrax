import test from 'node:test';
import assert from 'node:assert/strict';

import { perfilParaBackend, fuenteDeRegistro, resumirEvaluacion, lecturaMision, inmuneDeRegistro, mapearComplementarios, normalizarConfig } from '../src/js/api.js';
import { FORM_FIELDS, COUNTED_IDS } from '../src/data/metrics.js';
import { PROFILE_FIELDS } from '../src/js/validation.js';

/** Respuesta real de POST /astronautas/{id}/mediciones, recortada. */
const RESPUESTA_VUELO = {
  medicion: { id: 6, contexto: 'vuelo' },
  evaluacion: {
    id: 1,
    nivel: 2,
    news2_total: 7,
    resultado: {
      nivel: 2,
      news2_total: 7,
      alertas: ['NEWS2 total 7', 'fc: desviacion 49.0 >= 30.0 (ALTO)'],
      condiciones: [
        { codigo: 'radiacion', nombre: 'Exposicion a radiacion', estado: 'no_evaluable', recomendacion: 'Revisar dosimetria' },
        { codigo: 'sans', nombre: 'Riesgo neuro-ocular (SANS)', estado: 'hallazgo_compatible_requiere_evaluacion', recomendacion: 'Solicitar evaluacion oftalmologica' },
        { codigo: 'dosis', nombre: 'Dosis', estado: 'limite_de_protocolo_alcanzado_o_superado', recomendacion: 'Aplicar protocolo' }
      ]
    }
  }
};

test('el perfil viaja con los nombres y tipos del backend', () => {
  const perfil = perfilParaBackend({ nombre: '  Alex Vance ', sexo: 'Femenino', edad: '28', peso: '68.5', estatura: '1.75', sangre: 'A+' });
  assert.deepEqual(perfil, { nombre: 'Alex Vance', sexo: 'F', edad: 28, masa_kg: 68.5, estatura_m: 1.75 });
  assert.equal(perfilParaBackend({ nombre: 'B', sexo: 'Masculino', edad: '40', peso: '80', estatura: '1.8' }).sexo, 'M');
});

test('los signos del registro forman una lectura de vuelo válida', () => {
  const fuente = fuenteDeRegistro({ fc_reposo: '70', pa_sistolica: '120', fr: '14', temp: '36.6', spo2: '98' }, { peso: '68.5' });
  const { ok, lectura } = lecturaMision(fuente);
  assert.ok(ok);
  assert.deepEqual(lectura.signos, { fc: 70, pas: 120, fr: 14, temp: 36.6, spo2: 98 });
  assert.equal(lectura.masa_kg, 68.5);
});

test('sin frecuencia respiratoria la lectura no se envía', () => {
  const { ok, faltantes } = lecturaMision(fuenteDeRegistro({ fc_reposo: '70', pa_sistolica: '120', temp: '36.6', spo2: '98' }, {}));
  assert.equal(ok, false);
  assert.deepEqual(faltantes, ['fr']);
});

test('el resumen muestra nivel, NEWS2 y solo los hallazgos que requieren atención', () => {
  const resumen = resumirEvaluacion(RESPUESTA_VUELO);
  assert.equal(resumen.nivel, 2);
  assert.equal(resumen.etiqueta, 'ALTO');
  assert.equal(resumen.news2, 7);
  assert.deepEqual(resumen.hallazgos.map((h) => h.nombre), ['Riesgo neuro-ocular (SANS)', 'Dosis']);
  assert.equal(resumen.hallazgos[0].recomendacion, 'Solicitar evaluacion oftalmologica');
  assert.equal(resumen.alertas.length, 2);
});

test('una lectura sin evaluación o con datos restringidos no rompe el resumen', () => {
  assert.equal(resumirEvaluacion({ medicion: { id: 1 }, evaluacion: null }), null);
  const sinCondiciones = resumirEvaluacion({ evaluacion: { nivel: 0, news2_total: 0, resultado: {} } });
  assert.equal(sinCondiciones.etiqueta, 'BAJO');
  assert.deepEqual(sinCondiciones.hallazgos, []);
  assert.deepEqual(sinCondiciones.alertas, []);
});

test('el formulario pide frecuencia respiratoria y temperatura dentro de los rangos del backend', () => {
  const porId = Object.fromEntries(FORM_FIELDS.map((campo) => [campo.id, campo]));
  // RANGOS_SIGNOS del backend: fr 0–70, temp 25–45, spo2 50–100.
  for (const [id, min, max] of [['fr', 0, 70], ['temp', 25, 45], ['spo2', 50, 100]]) {
    assert.ok(porId[id], `Falta ${id}`);
    assert.ok(porId[id].min >= min && porId[id].max <= max, `${id} fuera del rango del backend`);
    assert.ok(COUNTED_IDS.includes(id), `${id} debe contar como indicador`);
  }
});

test('el perfil admite solo lo que el backend acepta', () => {
  const porId = Object.fromEntries(PROFILE_FIELDS.map((campo) => [campo.id, campo]));
  assert.deepEqual([porId.edad.min, porId.edad.max], [18, 80]);
  assert.deepEqual([porId.estatura.min, porId.estatura.max], [1.2, 2.2]);
  assert.deepEqual([porId.peso.min, porId.peso.max], [30, 200]);
});

test('ningún campo obligatorio pide texto libre', () => {
  assert.deepEqual(FORM_FIELDS.filter((campo) => campo.kind === 'textarea').map((campo) => campo.id), []);
});

test('marcadores y hormonas se responden con tres opciones', () => {
  const porId = Object.fromEntries(FORM_FIELDS.map((campo) => [campo.id, campo]));
  for (const id of ['marcadores_inmunes', 'hormonas_estres']) {
    assert.equal(porId[id].kind, 'select');
    assert.deepEqual(porId[id].options, ['Dentro de rango', 'Fuera de rango', 'No disponible']);
  }
});

test('un resultado inmunitario fuera de rango llega al backend como evaluación anormal', () => {
  assert.equal(inmuneDeRegistro({ marcadores_inmunes: 'Fuera de rango', hormonas_estres: 'Dentro de rango' }), true);
  assert.equal(inmuneDeRegistro({ marcadores_inmunes: 'Dentro de rango', hormonas_estres: 'Dentro de rango' }), false);
  // Sin análisis disponible no se afirma nada: el backend lo trata como desconocido.
  assert.equal(inmuneDeRegistro({ marcadores_inmunes: 'No disponible', hormonas_estres: 'Dentro de rango' }), null);
  const complementarios = mapearComplementarios({ explicitos: { evaluacion_inmune_anormal: true } });
  assert.equal(complementarios.evaluacion_inmune_anormal, true);
});

test('la configuración de la misión fija backend, clave y astronauta sin que lo teclee nadie', () => {
  assert.deepEqual(
    normalizarConfig({ backend: 'http://localhost:8000/', clave: ' clave-equipo ', astronautaId: 3 }),
    { backend: 'http://localhost:8000', clave: 'clave-equipo', astronautaId: '3' }
  );
  assert.deepEqual(normalizarConfig({ backend: 'https://nave.local' }), { backend: 'https://nave.local', clave: '', astronautaId: '' });
});

test('una configuración inválida se ignora y la página sigue en modo local', () => {
  for (const malo of [null, 'texto', {}, { backend: 'ftp://nave' }, { backend: 'http://usuario:pass@nave' }]) {
    assert.equal(normalizarConfig(malo), null);
  }
});

test('el ejemplo de configuración no lleva una clave real y la del equipo no se versiona', async () => {
  const { readFile } = await import('node:fs/promises');
  const ejemplo = JSON.parse(await readFile(new URL('../config.example.json', import.meta.url), 'utf8'));
  assert.ok(normalizarConfig(ejemplo), 'El ejemplo debe ser una configuración válida');
  assert.match(ejemplo.clave, /^<.*>$/, 'El ejemplo solo puede llevar un marcador, no una clave');
  const ignorados = await readFile(new URL('../.gitignore', import.meta.url), 'utf8');
  assert.match(ignorados, /^config\.json$/m);
});
