/**
 * Aviso flotante no bloqueante.
 *
 * Una sola instancia en el DOM; se reutiliza reiniciando el temporizador.
 * `kind` controla el color: `ok` (verde) o `warn` (ámbar).
 */

import { $ } from './dom.js';

let timer = null;

/**
 * @param {string} message
 * @param {'ok'|'warn'} kind
 * @param {number} duration
 */
export function showToast(message, kind = 'ok', duration = 3800) {
  const node = $('[data-toast]');
  if (!node) return;
  node.textContent = message;
  node.dataset.kind = kind;
  node.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => node.classList.remove('show'), duration);
}

/** Oculta el aviso de inmediato. */
export function hideToast() {
  const node = $('[data-toast]');
  if (!node) return;
  clearTimeout(timer);
  node.classList.remove('show');
}
