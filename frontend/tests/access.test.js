import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CODIGOS_VALIDOS,
  CODIGO_DEMO,
  codigoValido,
  normalizarCodigo
} from '../src/data/access.js';

test('el código demo es válido', () => {
  assert.ok(CODIGOS_VALIDOS.includes(CODIGO_DEMO));
  assert.ok(codigoValido(CODIGO_DEMO));
});

test('normaliza espacios, mayúsculas y guiones', () => {
  assert.equal(normalizarCodigo('  astrata-2045 '), 'ASTRATA-2045');
  assert.ok(codigoValido(' astrata-2045 '));
  assert.ok(codigoValido('ASTRATA2045'));
  assert.ok(codigoValido('Astrata 2045'));
});

test('rechaza códigos vacíos o ajenos', () => {
  for (const valor of ['', '   ', null, undefined, 'ASTRATA-0000', 'FINTRAX', 'ASTRATA-2045X']) {
    assert.equal(codigoValido(valor), false, `Aceptó un código inválido: ${String(valor)}`);
  }
});

test('el catálogo de códigos no queda vacío ni duplicado', () => {
  assert.ok(CODIGOS_VALIDOS.length >= 1);
  assert.equal(new Set(CODIGOS_VALIDOS).size, CODIGOS_VALIDOS.length);
});
