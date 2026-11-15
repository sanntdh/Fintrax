/**
 * «Qué hacer»: traduce las molestias y los sistemas alterados en acciones
 * respaldadas por las fuentes (ver `src/data/acciones.js`).
 */

import { el, limpiar } from './dom.js';
import { AREAS, FUENTES, CONFERENCIA_MEDICA, SINTOMAS_POR_AREA, SISTEMAS_POR_AREA, SINTOMAS_URGENTES } from '../data/acciones.js';

const NOMBRES_SISTEMA = {
  cardio: 'signos vitales',
  muscular: 'evaluación musculoesquelética',
  inmune: 'evaluación inmunológica',
  psico: 'evaluación psicológica',
  neuro: 'evaluación neurológica'
};

const alterado = (sistema) => sistema?.st === 'warn' || sistema?.st === 'bad';

/** Etiqueta de un síntoma guardado como `zona|Etiqueta`. */
const etiqueta = (clave) => String(clave).slice(String(clave).indexOf('|') + 1);

/**
 * @param {{symptoms?: Iterable<string>, systems?: Record<string, {st: string}>}} entrada
 * @returns {{urgente: boolean, areas: Array<{id: string, titulo: string, motivos: string[], acciones: object[], respaldada: boolean}>}}
 */
export function accionesPara({ symptoms = [], systems = {} } = {}) {
  const sintomas = [...symptoms].map(etiqueta);
  const urgente = sintomas.some((sintoma) => SINTOMAS_URGENTES.includes(sintoma)) || systems.cardio?.st === 'bad';

  const areas = [];
  for (const [id, area] of Object.entries(AREAS)) {
    const motivos = (SINTOMAS_POR_AREA[id] || []).filter((sintoma) => sintomas.includes(sintoma));
    for (const clave of SISTEMAS_POR_AREA[id] || []) {
      if (alterado(systems[clave])) motivos.push(`Resultado de tu ${NOMBRES_SISTEMA[clave]}`);
    }
    if (!motivos.length) continue;
    areas.push({ id, titulo: area.titulo, motivos, acciones: area.acciones, respaldada: area.acciones.length > 0 });
  }
  // Primero lo que el astronauta puede hacer; después lo que debe consultar.
  areas.sort((a, b) => Number(b.respaldada) - Number(a.respaldada));
  return { urgente, areas };
}

/** Referencia visible: nombre y página; las de NASA enlazan al documento público. */
function referencia(accion) {
  const fuente = FUENTES[accion.fuente] || { nombre: accion.fuente };
  const texto = `${fuente.nombre} · p. ${accion.pagina}`;
  if (!fuente.url) return el('cite', { text: texto });
  const cita = el('cite');
  cita.append(el('a', { href: fuente.url, target: '_blank', rel: 'noopener noreferrer', text: texto }));
  return cita;
}

function tarjeta(area) {
  const card = el('article', { class: 'fintrax-accion', dataset: { respaldada: String(area.respaldada) } });
  card.append(el('h3', { text: area.titulo }), el('p', { class: 'fintrax-accion__motivo', text: `Por: ${area.motivos.join(' · ')}` }));
  if (!area.respaldada) {
    card.append(el('p', { text: 'Las fuentes del proyecto no describen acciones para esto. Coméntalo con el equipo médico de vuelo.' }));
    return card;
  }
  const lista = el('ol');
  for (const accion of area.acciones) {
    const item = el('li');
    item.append(el('span', { text: accion.texto }), referencia(accion));
    lista.append(item);
  }
  card.append(lista);
  return card;
}

/** Pinta «Qué hacer» en `host`. */
export function createAcciones(host) {
  return {
    update({ symptoms, systems }) {
      if (!host) return;
      limpiar(host);
      const { urgente, areas } = accionesPara({ symptoms, systems });

      if (urgente) {
        const aviso = el('div', { class: 'fintrax-accion-urgente', role: 'alert' });
        aviso.append(
          el('strong', { text: 'Avisa ahora al equipo médico de vuelo.' }),
          el('span', { text: 'Protocolo Fintrax ante dolor en el pecho, falta de aire o signos vitales en rango de atención.' }),
          el('span', { text: CONFERENCIA_MEDICA.texto }),
          referencia(CONFERENCIA_MEDICA)
        );
        host.append(aviso);
      }

      if (!areas.length) {
        if (!urgente) {
          host.append(el('p', {
            class: 'fintrax-accion-vacio',
            text: 'Sin acciones específicas. Mantén tu rutina de contramedidas y repite el registro si aparecen molestias.'
          }));
        }
      } else {
        const grid = el('div', { class: 'fintrax-acciones-grid' });
        for (const area of areas) grid.append(tarjeta(area));
        host.append(grid);
      }

      host.append(el('p', {
        class: 'fintrax-acciones-nota',
        text: 'Acciones de las fuentes del proyecto (EXON, FISIO) y de documentos públicos de NASA, con su página. No sustituyen al equipo médico.'
      }));
    }
  };
}
