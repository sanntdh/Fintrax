/**
 * Servidor estático mínimo para desarrollo local (sin dependencias).
 *
 * Uso: `npm start` y abrir http://localhost:5173
 */

import { createServer } from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PUERTO = Number.parseInt(process.env.PORT || '5173', 10);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function dentroDeRaiz(ruta) {
  const normalizada = normalize(ruta);
  return normalizada === RAIZ || normalizada.startsWith(RAIZ + sep);
}

const servidor = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://localhost');
    const relativa = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const ruta = resolve(join(RAIZ, relativa));

    if (!dentroDeRaiz(ruta)) {
      response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Prohibido');
      return;
    }

    const info = await fs.stat(ruta).catch(() => null);
    if (!info || !info.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('No encontrado');
      return;
    }

    response.writeHead(200, {
      'Content-Type': TIPOS[extname(ruta).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    createReadStream(ruta).pipe(response);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`Error interno: ${error.message}`);
  }
});

servidor.listen(PUERTO, () => {
  console.log(`FINTRAX disponible en http://localhost:${PUERTO}`);
});
