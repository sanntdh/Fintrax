#!/usr/bin/env node
/**
 * Fase 0 — Extrae los avatares embebidos en base64 del prototipo original.
 *
 * Uso:
 *   node scripts/extract-assets.mjs
 *
 * - Lee (sin modificar) ASTRA_version2_con_resultados.html.
 * - Escribe assets/avatar-male.png y assets/avatar-female.png.
 * - Si `sharp` está disponible (dependencia opcional de desarrollo), genera
 *   también las versiones WebP optimizadas que usa la aplicación.
 *
 * El HTML original nunca se modifica.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE = path.join(ROOT, 'ASTRA_version2_con_resultados.html');
const OUT_DIR = path.join(ROOT, 'assets');

const TARGETS = [
  { alt: 'avatar-png avatar-male', slug: 'avatar-male' },
  { alt: 'avatar-png avatar-female', slug: 'avatar-female' }
];

const EXPECTED = { width: 941, height: 1672 };

async function main() {
  const html = await readFile(SOURCE, 'utf8');
  const images = [...html.matchAll(/<img[^>]*class="([^"]*avatar-png[^"]*)"[^>]*src="data:image\/png;base64,([A-Za-z0-9+/=]+)"/g)];

  if (images.length !== TARGETS.length) {
    throw new Error(`Se esperaban ${TARGETS.length} avatares, se encontraron ${images.length}`);
  }

  await mkdir(OUT_DIR, { recursive: true });

  let sharp = null;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.warn('· sharp no está instalado: solo se generarán los PNG.');
  }

  for (const [index, match] of images.entries()) {
    const [, , base64] = match;
    const buffer = Buffer.from(base64, 'base64');
    const png = path.join(OUT_DIR, `${TARGETS[index].slug}.png`);
    await writeFile(png, buffer);

    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 16);

    if (width !== EXPECTED.width || height !== EXPECTED.height) {
      throw new Error(`Dimensiones inesperadas en ${png}: ${width}x${height}`);
    }
    console.log(`✓ ${path.relative(ROOT, png)} — ${width}x${height} — sha256:${hash}`);

    if (sharp) {
      const webp = path.join(OUT_DIR, `${TARGETS[index].slug}.webp`);
      const info = await sharp(buffer)
        .resize({ width: 720, withoutEnlargement: true })
        .webp({ quality: 82, alphaQuality: 90, effort: 6 })
        .toFile(webp);
      console.log(`✓ ${path.relative(ROOT, webp)} — ${info.width}x${info.height} — ${(info.size / 1024).toFixed(0)} KB`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
