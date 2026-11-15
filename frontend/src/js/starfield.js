/**
 * Campo de estrellas decorativo sobre `<canvas>`.
 *
 * Diferencia con el prototipo: si la persona pide movimiento reducido se dibuja
 * una sola vez y no se inicia el bucle; además se pausa cuando la pestaña queda
 * oculta para no gastar CPU en segundo plano.
 */

import { movimientoReducido } from './dom.js';

/**
 * @param {HTMLCanvasElement|null} canvas
 * @returns {{destroy: () => void}}
 */
export function initStarfield(canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') return { destroy() {} };
  const ctx = canvas.getContext('2d');
  if (!ctx) return { destroy() {} };

  let stars = [];
  let shootingStar = null;
  let raf = 0;
  let running = false;
  const reducido = movimientoReducido();

  function medir() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height };
  }

  function init() {
    const { width, height } = medir();
    const count = Math.min(100, Math.floor(width / 12));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.5 + 0.3,
      p: Math.random() * Math.PI * 2,
      vx: (Math.random() - 0.5) * 0.1,
      vy: Math.random() * 0.1 + 0.02,
      isCyan: Math.random() < 0.4
    }));
  }

  function dibujar(time = 0, mover = true) {
    const { width, height } = medir();
    ctx.clearRect(0, 0, width, height);

    if (mover) {
      for (const s of stars) {
        s.x += s.vx;
        s.y += s.vy;
        if (s.y > height) s.y = 0;
        if (s.x < 0) s.x = width;
        if (s.x > width) s.x = 0;
      }
    }

    ctx.lineWidth = 0.5;
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const d = Math.hypot(stars[i].x - stars[j].x, stars[i].y - stars[j].y);
        if (d < 110) {
          ctx.globalAlpha = (1 - d / 110) * 0.2;
          ctx.strokeStyle = '#00f0ff';
          ctx.beginPath();
          ctx.moveTo(stars[i].x, stars[i].y);
          ctx.lineTo(stars[j].x, stars[j].y);
          ctx.stroke();
        }
      }
    }

    for (const s of stars) {
      const alpha = 0.35 + 0.55 * Math.abs(Math.sin(time / 1400 + s.p));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.isCyan ? '#38e1ff' : '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (mover && !shootingStar && Math.random() < 0.005) {
      shootingStar = {
        x: Math.random() * width * 0.7,
        y: Math.random() * height * 0.3,
        len: 0
      };
    }
    if (mover && shootingStar) {
      const grad = ctx.createLinearGradient(
        shootingStar.x,
        shootingStar.y,
        shootingStar.x - 80,
        shootingStar.y - 45
      );
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, 'transparent');
      ctx.globalAlpha = 1 - shootingStar.len / 60;
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(shootingStar.x, shootingStar.y);
      ctx.lineTo(shootingStar.x - 80, shootingStar.y - 45);
      ctx.stroke();
      shootingStar.x += 12;
      shootingStar.y += 6.5;
      if (++shootingStar.len > 60) shootingStar = null;
    }

    ctx.globalAlpha = 1;
  }

  function frame(time) {
    if (!running) return;
    dibujar(time, true);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (reducido || running) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function onResize() {
    init();
    if (!running) dibujar(0, false);
  }

  function onVisibility() {
    if (document.hidden) stop();
    else start();
  }

  init();
  dibujar(0, false);
  start();

  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    destroy() {
      stop();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
}
