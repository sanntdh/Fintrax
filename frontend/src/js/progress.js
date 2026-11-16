/**
 * Progreso del registro, IMC y contadores del HUD.
 *
 * Se cuentan todos los campos válidos, incluidos metadatos y observaciones.
 */

import { $ } from './dom.js';
import { subscribe, getState } from './state.js';
import { progresoRegistro } from './validation.js';
import { categoriaImc, formatearImc, imcDe, plural } from './format.js';

const COLORES_IMC = {
  bajo: 'var(--warn)',
  normal: 'var(--ok)',
  sobrepeso: 'var(--warn)',
  obesidad: 'var(--alert)',
  'sin-datos': 'var(--cy)'
};

function pintarImc(state) {
  const valor = $('[data-imc-value]');
  const categoria = $('[data-imc-category]');
  if (!valor || !categoria) return;

  const imc = imcDe(state.profile.peso, state.profile.estatura);
  const clase = categoriaImc(imc);
  valor.textContent = formatearImc(imc);
  categoria.textContent = clase.label;
  categoria.style.color = COLORES_IMC[clase.key] || 'var(--cy)';
}

function pintarZonas(state) {
  const contador = $('[data-zone-count]');
  const estado = $('[data-zone-status]');
  if (!contador || !estado) return;

  const zonas = new Set([...state.symptoms].map((clave) => clave.slice(0, clave.indexOf('|'))));
  contador.textContent = String(zonas.size);

  if (zonas.size === 0) {
    estado.textContent = 'NOMINAL STATUS';
    estado.style.color = 'var(--ok)';
  } else if (zonas.size <= 2) {
    estado.textContent = 'MILD WARNING';
    estado.style.color = 'var(--warn)';
  } else {
    estado.textContent = 'MULTIPLE ALERT';
    estado.style.color = 'var(--alert)';
  }
}

function pintarConteoSintomas(state) {
  const nodo = $('[data-count="form"]');
  if (!nodo) return;

  if (state.wellBeing) {
    nodo.textContent = 'No symptoms reported';
    nodo.style.color = 'var(--ok)';
  } else if (state.symptoms.size > 0) {
    nodo.textContent = `⚠ ${plural(state.symptoms.size, 'symptom recorded', 'symptoms recorded')}`;
    nodo.style.color = 'var(--warn)';
  } else {
    nodo.textContent = '';
  }
}

function pintarEscaneo(state) {
  const titulo = $('[data-scan-title]');
  const subtitulo = $('[data-scan-sub]');
  const sexo = state.profile.sexo;
  if (titulo) {
    titulo.textContent = sexo ? `BIOMETRIC SCAN · ${sexo.toUpperCase()}` : '3D BIOMETRIC SCAN';
  }
  if (subtitulo) {
    subtitulo.textContent = sexo
      ? (state.activeRecord === 'current' ? 'TAP AN AREA TO MARK A CURRENT SYMPTOM' : 'RECORD OF YOUR USUAL VALUES')
      : 'SELECT YOUR SEX TO CALIBRATE THE HOLOGRAM';
  }
}

export function actualizarProgreso(state) {
  const { porcentaje, completos, total } = progresoRegistro(state, state.activeRecord);

  const barra = $('[data-progress-bar]');
  if (barra) barra.style.width = `${porcentaje}%`;

  const texto = $('[data-progress-text]');
  if (texto) texto.textContent = `${porcentaje}% · ${completos}/${total} fields`;

  pintarImc(state);
  pintarZonas(state);
  pintarConteoSintomas(state);
  pintarEscaneo(state);
}

export function initProgress() {
  subscribe(actualizarProgreso);
  actualizarProgreso(getState());
}
