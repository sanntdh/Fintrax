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
    'id="fintrax-app"',
    'data-step="intro"',
    'data-intro',
    'id="fintrax-logo"',
    'id="fintrax-fondo"',
    'data-form-stage',
    'data-edit-baseline',
    'data-current-only',
    'data-avatar-host="form"',
    'data-symptoms="form"',
    'data-symptoms="results"',
    'data-sym-results',
    'data-metric-sections',
    'data-quicknav',
    'data-progress-bar',
    'data-progress-text',
    'data-step-panel="perfil"',
    'data-step-panel="molestias"',
    'data-step-only="current"',
    'data-step-prev',
    'data-step-next',
    'data-step-count',
    'data-centro-toggle',
    'data-centro-dialog',
    'data-centro-form',
    'data-centro data-estado="off"',
    'data-imc-value',
    'data-imc-category',
    'data-zone-count',
    'data-zone-status',
    'data-submit',
    'data-form-note',
    'data-transition',
    'data-transition-stage',
    'data-transition-bar',
    'data-skip-transition',
    'data-banner',
    'data-banner-title',
    'data-banner-text',
    'data-banner-chips',
    'data-body-summary',
    'data-organ-avatar',
    'data-organ-rail="left"',
    'data-organ-rail="right"',
    'data-organ-card',
    'data-body-tab="telemetry"',
    'data-tab-panel="telemetry"',
    'data-record',
    'data-charts',
    'data-toast',
    'data-back',
    'data-export'
  ];
  for (const gancho of ganchos) assert.ok(html.includes(gancho), `Falta ${gancho}`);
  assert.ok(html.includes('type="module" src="src/js/main.js"'), 'Falta el módulo de entrada');
  assert.ok(html.includes('data-form-status role="status"'), 'El formulario debe anunciar los errores');
});

test('el flujo declara introducción, dos registros, análisis y revisión', async () => {
  const html = await leer('index.html');
  const css = await leer('src/css/layout.css');
  const estado = await leer('src/js/state.js');
  assert.ok(html.includes('data-step="intro"'), 'La aplicación no arranca en la animación');
  for (const paso of ['intro', 'baseline', 'current', 'transition', 'body']) {
    assert.ok(css.includes(`[data-step='${paso}'`), `layout.css no conmuta el paso ${paso}`);
  }
  assert.ok(/STEPS = \['intro', 'baseline', 'current', 'transition', 'body'\]/.test(estado), 'STEPS incompleto');
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

test('el formulario se recorre por pasos, un bloque cada vez', async () => {
  const html = await leer('index.html');
  const form = await leer('src/js/form.js');
  assert.equal(html.includes('data-progress-sections'), false, 'El progreso por secciones vuelve a duplicarse');
  assert.equal(html.includes('fintrax-metric-intro'), false, 'Sobra el recuadro de instrucciones generales');
  assert.ok(form.includes('dataset.stepPanel = section.id'), 'Cada sección de indicadores debe ser un paso');
  assert.ok(/export function irAPaso\(/.test(form), 'Falta la navegación pública entre pasos');
});
