import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (ruta) => fs.readFile(join(RAIZ, ruta), 'utf8');

async function cabeceras(fuente) {
  const config = JSON.parse(await leer('vercel.json'));
  const regla = config.headers.find((item) => item.source === fuente);
  assert.ok(regla, `vercel.json no define cabeceras para ${fuente}`);
  return Object.fromEntries(regla.headers.map(({ key, value }) => [key.toLowerCase(), value]));
}

test('Vercel sirve la carpeta tal cual, sin paso de compilación', async () => {
  const config = JSON.parse(await leer('vercel.json'));
  assert.equal(config.framework, null);
  assert.equal(JSON.parse(await leer('package.json')).scripts.build, undefined, 'Un script build haría que Vercel compilara');
});

test('el service worker y la configuración no se quedan en caché del CDN', async () => {
  for (const ruta of ['/sw.js', '/config.json']) {
    assert.match((await cabeceras(ruta))['cache-control'], /max-age=0/);
  }
});

test('la CSP solo ejecuta código propio y permite conectar con un backend https o local', async () => {
  const csp = (await cabeceras('/(.*)'))['content-security-policy'];
  assert.ok(csp, 'Falta la Content-Security-Policy');
  assert.match(csp, /script-src 'self'(;|$)/, 'Los scripts deben ser solo propios');
  assert.match(csp, /connect-src [^;]*https:/);
  assert.match(csp, /connect-src [^;]*http:\/\/localhost:\*/);
  assert.match(csp, /worker-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
});

test('index.html cumple la CSP: ningún script en línea', async () => {
  const html = await leer('index.html');
  assert.equal(/<script(?![^>]*\bsrc=)[^>]*>/.test(html), false, 'Hay un <script> en línea');
});

test('no se publican la clave del equipo, las pruebas ni los HTML de referencia', async () => {
  const ignorados = (await leer('.vercelignore')).split('\n').map((linea) => linea.trim());
  for (const patron of ['config.json', 'tests', 'scripts', 'ASTRA_*.html', 'Fintrax Código Error.html', 'node_modules']) {
    assert.ok(ignorados.includes(patron), `.vercelignore debe excluir ${patron}`);
  }
});

test('la demo pública conecta sola con el backend publicado', async () => {
  const { normalizarConfig } = await import('../src/js/api.js');
  const demo = normalizarConfig(JSON.parse(await leer('config.demo.json')));
  assert.equal(demo.backend, 'https://fintrax-pxxs.onrender.com');
  assert.match(await leer('src/js/centro.js'), /'config\.json', 'config\.demo\.json'/, 'config.demo.json debe ser el respaldo de config.json');
  for (const archivo of ['.vercelignore', '.gitignore']) {
    assert.equal((await leer(archivo)).split('\n').includes('config.demo.json'), false, `${archivo} no debe excluir la demo`);
  }
});

test('la configuración de la demo se pide a la red y se guarda para usarla sin conexión', async () => {
  const sw = await leer('sw.js');
  assert.match(sw, /cache\.add\('config\.demo\.json'\)/);
  assert.match(sw, /config\.demo\.json/);
  assert.match((await cabeceras('/config.demo.json'))['cache-control'], /max-age=0/);
});

test('un marcador de clave sin rellenar no se usa como clave', async () => {
  const { normalizarConfig } = await import('../src/js/api.js');
  assert.equal(normalizarConfig({ backend: 'https://nave.local', clave: '<clave del astronauta de demo>' }).clave, '');
});
