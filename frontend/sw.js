/**
 * Service worker de Fintrax: la app funciona sin conexión.
 *
 * - Al instalarse guarda en caché todos los archivos de la app (PRECACHE).
 * - Responde desde la caché y actualiza en segundo plano
 *   (stale-while-revalidate): los cambios llegan en la siguiente apertura.
 * - `config.json` y `config.demo.json` se piden primero a la red (pueden
 *   cambiar) y se guardan como respaldo; no van en PRECACHE porque son opcionales.
 * - Las peticiones al backend (otro origen) no pasan por la caché.
 *
 * Al añadir o quitar archivos de src/ o assets/, actualiza PRECACHE: un test
 * lo comprueba. Cambia VERSION para forzar una recarga completa de la caché.
 */

const VERSION = 'fintrax-v2';

const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/avatar-female.webp',
  'assets/avatar-male.webp',
  'assets/fonts/orbitron-900.woff2',
  'assets/fonts/rajdhani-500.woff2',
  'assets/fonts/rajdhani-600.woff2',
  'assets/fonts/rajdhani-700.woff2',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon.svg',
  'src/css/a11y.css',
  'src/css/avatar.css',
  'src/css/base.css',
  'src/css/body.css',
  'src/css/centro.css',
  'src/css/fonts.css',
  'src/css/form.css',
  'src/css/gate.css',
  'src/css/intro.css',
  'src/css/layout.css',
  'src/css/results.css',
  'src/css/tokens.css',
  'src/css/transition.css',
  'src/data/access.js',
  'src/data/acciones.js',
  'src/data/content.js',
  'src/data/groups.js',
  'src/data/metrics.js',
  'src/data/organ-shapes.js',
  'src/data/organs.js',
  'src/data/schema.js',
  'src/data/severity.js',
  'src/data/symptoms.js',
  'src/js/acciones.js',
  'src/js/api.js',
  'src/js/audio.js',
  'src/js/avatar.js',
  'src/js/centro.js',
  'src/js/comparativa.js',
  'src/js/dom.js',
  'src/js/evaluation.js',
  'src/js/export.js',
  'src/js/fintrax-background.js',
  'src/js/format.js',
  'src/js/form.js',
  'src/js/intro.js',
  'src/js/main.js',
  'src/js/organ-avatar.js',
  'src/js/organs.js',
  'src/js/progress.js',
  'src/js/results.js',
  'src/js/starfield.js',
  'src/js/state.js',
  'src/js/symptoms-ui.js',
  'src/js/toast.js',
  'src/js/transition.js',
  'src/js/validation.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then(async (cache) => {
        await cache.addAll(PRECACHE);
        // Opcionales: sin configuración la app sigue en modo de conexión manual.
        await cache.add('config.json').catch(() => {});
        await cache.add('config.demo.json').catch(() => {});
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((clave) => clave !== VERSION).map((clave) => caches.delete(clave))))
      .then(() => self.clients.claim())
  );
});

async function primeroRed(request) {
  const cache = await caches.open(VERSION);
  try {
    const respuesta = await fetch(request);
    if (respuesta.ok) cache.put(request, respuesta.clone());
    return respuesta;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

async function cacheYActualiza(request) {
  const cache = await caches.open(VERSION);
  // Las navegaciones con parámetros (?mantenimiento, ?api=) usan el mismo index.
  const guardada = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
  const deRed = fetch(request)
    .then((respuesta) => {
      if (respuesta.ok && respuesta.type === 'basic') cache.put(request, respuesta.clone());
      return respuesta;
    })
    .catch(() => null);
  if (guardada) return guardada;
  return (await deRed) || (request.mode === 'navigate' ? cache.match('index.html') : Response.error());
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const esConfig = url.pathname.endsWith('/config.json') || url.pathname.endsWith('/config.demo.json');
  event.respondWith(esConfig ? primeroRed(request) : cacheYActualiza(request));
});
