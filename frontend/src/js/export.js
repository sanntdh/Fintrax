/**
 * Exportación del registro a JSON.
 *
 * Sustituye a `collectData()` del prototipo, que leía el DOM. Aquí todo sale del
 * estado, de modo que las escalas no tocadas se exportan como «—» y no como un
 * valor inventado.
 */

import { REPORT_GROUPS } from '../data/groups.js';
import { PLATAFORMA, AVISO, NOMBRE_ARCHIVO } from '../data/schema.js';
import { COUNTED_IDS, RATING_IDS } from '../data/metrics.js';
import { zonasPara } from '../data/symptoms.js';
import { isFilled } from './evaluation.js';

function leer(state, id) {
  if (RATING_IDS.includes(id)) {
    return state.ratingsTouched.has(id) ? String(state.values[id] ?? '').trim() : '';
  }
  const valor = state.values[id];
  if (valor !== undefined) return String(valor).trim();
  return String(state.profile[id] ?? '').trim();
}

function leerGrupo(state, field) {
  if (field.format === 'pressure') {
    const sistolica = leer(state, 'pa_sistolica');
    const diastolica = leer(state, 'pa_diastolica');
    if (!sistolica || !diastolica) return '—';
    return `${sistolica}/${diastolica}${field.unit ? ` ${field.unit}` : ''}`;
  }

  const valor = field.profile ? String(state.profile[field.id] ?? '').trim() : leer(state, field.id);
  if (!valor) return '—';
  return field.unit ? `${valor} ${field.unit}` : valor;
}

/**
 * Construye el objeto exportable.
 * @param {ReturnType<import('./state.js').getState>} state
 */
export function construirRegistro(state) {
  const zonas = zonasPara(state.profile.sexo);
  const molestias = [...state.symptoms].map((clave) => {
    const corte = clave.indexOf('|');
    const zona = clave.slice(0, corte);
    const valor = clave.slice(corte + 1);
    return { zona: zonas[zona]?.[0] || zona, molestia: valor };
  });

  return {
    plataforma: PLATAFORMA,
    fecha: new Date().toISOString(),
    perfil: {
      nombre: String(state.profile.nombre || '').trim(),
      sexo: state.profile.sexo || '',
      edad: String(state.profile.edad || '').trim(),
      peso_kg: String(state.profile.peso || '').trim(),
      estatura_m: String(state.profile.estatura || '').trim(),
      grupo_sanguineo: String(state.profile.sangre || '').trim()
    },
    variables: REPORT_GROUPS.map((grupo) => ({
      categoria: grupo.title,
      registros: grupo.fields.map((field) => ({ label: field.label, value: leerGrupo(state, field) }))
    })),
    molestias,
    sinMolestias: Boolean(state.wellBeing),
    observaciones: String(state.otherText || '').trim(),
    indicadoresCompletados: COUNTED_IDS.filter((id) => isFilled(id, state.values, state.ratingsTouched)).length,
    indicadoresPosibles: COUNTED_IDS.length,
    aviso: AVISO
  };
}

/** Descarga el registro como archivo JSON. */
export function descargarRegistro(state) {
  const datos = construirRegistro(state);
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = NOMBRE_ARCHIVO;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return datos;
}
