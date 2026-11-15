import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

async function leer(relativa) {
  return fs.readFile(join(RAIZ, relativa), 'utf8');
}

test('index.html declara todos los puntos de montaje', async () => {
  const html = await leer('index.html');
  const ganchos = [
    'id="astra-app"',
    'data-view="form"',
    'data-avatar-host="form"',
    'data-avatar-host="results"',
    'data-symptoms="form"',
    'data-symptoms="results"',
    'data-sym-results',
    'data-metric-sections',
    'data-quicknav',
    'data-progress-bar',
    'data-progress-text',
    'data-progress-sections',
    'data-imc-value',
    'data-imc-category',
    'data-zone-count',
    'data-zone-status',
    'data-banner',
    'data-banner-title',
    'data-banner-text',
    'data-banner-chips',
    'data-organs',
    'data-charts',
    'data-analyzing',
    'data-toast',
    'data-back',
    'data-export'
  ];
  for (const gancho of ganchos) assert.ok(html.includes(gancho), `Falta ${gancho}`);
  assert.ok(html.includes('type="module" src="src/js/main.js"'), 'Falta el módulo de entrada');
});

test('el HTML no contiene manejadores inline', async () => {
  const html = await leer('index.html');
  for (const patron of ['onclick=', 'onchange=', 'oninput=', 'onsubmit=']) {
    assert.equal(html.includes(patron), false, `El HTML usa ${patron}`);
  }
});

test('el código no usa innerHTML ni document.write', async () => {
  const carpeta = join(RAIZ, 'src/js');
  const archivos = await fs.readdir(carpeta);
  for (const archivo of archivos.filter((nombre) => nombre.endsWith('.js'))) {
    const contenido = await fs.readFile(join(carpeta, archivo), 'utf8');
    assert.equal(contenido.includes('.innerHTML'), false, `${archivo} usa innerHTML`);
    assert.equal(contenido.includes('document.write'), false, `${archivo} usa document.write`);
    assert.equal(contenido.includes('eval('), false, `${archivo} usa eval`);
  }
});

test('el HTML referencia las hojas de estilo existentes', async () => {
  const html = await leer('index.html');
  const estilos = [...html.matchAll(/href="(src\/css\/[^"]+\.css)"/g)].map((m) => m[1]);
  assert.ok(estilos.length >= 8);
  for (const estilo of estilos) {
    await fs.access(join(RAIZ, estilo));
  }
});
