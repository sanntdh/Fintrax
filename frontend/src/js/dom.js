/**
 * Utilidades de DOM. Sin estado propio.
 *
 * Regla del proyecto: nunca se inserta texto de la persona usuaria con
 * `innerHTML`. Todo se construye con `textContent` y nodos reales.
 */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Crea un nodo HTML. */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  aplicar(node, props);
  añadir(node, children);
  return node;
}

/** Crea un nodo SVG. */
export function svg(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    node.setAttribute(key, value === true ? '' : String(value));
  }
  añadir(node, children);
  return node;
}

function aplicar(node, props) {
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style') Object.assign(node.style, value);
    else if (key === 'value' || key === 'checked' || key === 'disabled' || key === 'selected') node[key] = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
}

function añadir(node, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) añadir(node, child);
    else if (child instanceof Node) node.append(child);
    else node.append(document.createTextNode(String(child)));
  }
}

/** Vacía un nodo sin usar innerHTML. */
export function limpiar(node) {
  if (!node) return node;
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Enlaza un evento y devuelve la función para desenlazarlo. */
export function on(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}

/** Delegación de eventos: devuelve el limpiador. */
export function delegar(root, type, selector, handler) {
  return on(root, type, (event) => {
    const target = event.target.closest(selector);
    if (target && root.contains(target)) handler(event, target);
  });
}

/** ¿El sistema pide menos movimiento? */
export function movimientoReducido() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Desplazamiento suave respetando `prefers-reduced-motion`. */
export function desplazarA(node, options = {}) {
  if (!node) return;
  node.scrollIntoView({
    behavior: movimientoReducido() ? 'auto' : options.behavior || 'smooth',
    block: options.block || 'center',
    inline: options.inline || 'nearest'
  });
}

/** Enfoca sin arrastrar el scroll (compatible con navegadores antiguos). */
export function enfocar(node) {
  if (!node || typeof node.focus !== 'function') return;
  try {
    node.focus({ preventScroll: true });
  } catch {
    node.focus();
  }
}

/** Añade/quita una clase de forma idempotente. */
export function alternarClase(node, clase, activo) {
  if (!node) return;
  node.classList.toggle(clase, Boolean(activo));
}

/** Reemplaza el contenido de un nodo con una lista de nodos. */
export function reemplazar(node, children) {
  limpiar(node);
  añadir(node, children);
  return node;
}
