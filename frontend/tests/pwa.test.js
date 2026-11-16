import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (ruta) => fs.readFile(join(RAIZ, ruta), 'utf8');

async function archivos(carpeta) {
  const salida = [];
  for (const entrada of await fs.readdir(join(RAIZ, carpeta), { withFileTypes: true })) {
    const ruta = join(carpeta, entrada.name);
    if (entrada.isDirectory()) salida.push(...await archivos(ruta));
    else salida.push(ruta.split('\\').join('/'));
  }
  return salida;
}

/** Ancho y alto de un PNG leídos de su cabecera IHDR. */
async function tamanoPng(ruta) {
  const datos = await fs.readFile(join(RAIZ, ruta));
  assert.equal(datos.toString('ascii', 1, 4), 'PNG', `${ruta} no es PNG`);
  return [datos.readUInt32BE(16), datos.readUInt32BE(20)];
}

async function precache() {
  const sw = await leer('sw.js');
  const bloque = sw.match(/const PRECACHE = \[([\s\S]*?)\];/);
  assert.ok(bloque, 'sw.js debe declarar PRECACHE');
  return [...bloque[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

test('el manifiesto permite instalar Fintrax como app', async () => {
  const manifiesto = JSON.parse(await leer('manifest.webmanifest'));
  assert.equal(manifiesto.short_name, 'Fintrax');
  assert.equal(manifiesto.display, 'standalone');
  assert.equal(manifiesto.start_url, './');
  assert.equal(manifiesto.lang, 'en');
  assert.ok(manifiesto.background_color && manifiesto.theme_color);
  for (const tamano of [192, 512]) {
    const icono = manifiesto.icons.find((item) => item.sizes === `${tamano}x${tamano}`);
    assert.ok(icono, `Falta el icono de ${tamano}`);
    assert.deepEqual(await tamanoPng(icono.src), [tamano, tamano]);
  }
});

test('index.html enlaza el manifiesto y el icono para iOS', async () => {
  const html = await leer('index.html');
  assert.ok(html.includes('<link rel="manifest" href="manifest.webmanifest">'));
  assert.ok(html.includes('rel="apple-touch-icon"'));
});

test('el service worker guarda todos los archivos de la app para usarla sin conexión', async () => {
  const lista = await precache();
  const necesarios = ['./', 'index.html', 'manifest.webmanifest', ...await archivos('src'), ...await archivos('assets')];
  for (const ruta of necesarios) assert.ok(lista.includes(ruta), `PRECACHE no incluye ${ruta}`);
  for (const ruta of lista.filter((item) => item !== './')) {
    await fs.access(join(RAIZ, ruta)).catch(() => assert.fail(`PRECACHE apunta a un archivo inexistente: ${ruta}`));
  }
  assert.equal(lista.includes('config.json'), false, 'La configuración del equipo no se precarga');
});

test('la app registra el service worker y el servidor sirve el manifiesto', async () => {
  assert.match(await leer('src/js/main.js'), /navigator\.serviceWorker\.register\('sw\.js'/);
  assert.ok((await leer('scripts/serve.mjs')).includes("'.webmanifest': 'application/manifest+json"));
});

test('con conexión se sirve siempre la versión publicada; la caché es solo para trabajar sin red', async () => {
  const sw = await leer('sw.js');
  assert.match(sw, /event\.respondWith\(primeroRed\(request\)\)/, 'Todas las peticiones deben ir primero a la red');
  assert.equal(sw.includes('cacheYActualiza'), false, 'La estrategia «caché primero» muestra versiones antiguas tras actualizar');
});
