/**
 * Catálogo de síntomas por zona corporal.
 *
 * Extraído sin cambios de ASTRA_version2_con_resultados.html (líneas 1284–1301).
 * Es la única fuente de verdad para construir los chips del formulario y la
 * vista de resultados.
 */

export const SINTOMAS_BASE = {
  cabeza: ['Cabeza', 'Dolor de cabeza|Mareo o vértigo|Zumbido en oídos|Confusión'],
  ojos: ['Ojos', 'Visión borrosa|Ardor o sequedad|Sensibilidad a luz|Fatiga ocular'],
  pecho: ['Pecho', 'Dolor opresivo|Palpitaciones|Dificultad al respirar|Punzadas'],
  estomago: ['Estómago', 'Dolor abdominal|Náuseas|Vómito|Acidez o reflujo|Hinchazón'],
  pelvis: ['Pelvis', 'Molestia pélvica'],
  extremidades: ['Extremidades', 'Hormigueo|Dolor muscular|Calambres|Rigidez articular']
};

export const SINTOMAS_ESPECIFICOS = {
  Masculino: {
    pelvis: ['Pelvis', 'Dolor al orinar|Dolor lumbar bajo|Molestia inguinal|Pesadez testicular']
  },
  Femenino: {
    cabeza: ['Cabeza', 'Dolor de cabeza|Migraña|Mareo o vértigo|Zumbido en oídos|Confusión'],
    pecho: ['Pecho y Mamas', 'Dolor en pecho|Palpitaciones|Sensibilidad mamaria|Falta de aire'],
    pelvis: ['Pelvis', 'Cólicos menstruales|Retraso menstrual|Dolor pélvico bajo|Molestia al orinar']
  }
};

/** Nombres cortos usados por el estado de órganos y las etiquetas del avatar. */
export const ZONAS_NOMBRES = {
  cabeza: 'Cabeza',
  ojos: 'Ojos',
  pecho: 'Pecho',
  estomago: 'Estómago',
  pelvis: 'Pelvis',
  extremidades: 'Extremidades'
};

/**
 * Devuelve las zonas activas para un sexo biológico.
 * Sin sexo seleccionado se omite la pelvis, igual que en el prototipo.
 * @param {string} sexo
 * @returns {Record<string, [string, string]>}
 */
export function zonasPara(sexo) {
  const zonas = { ...SINTOMAS_BASE, ...(SINTOMAS_ESPECIFICOS[sexo] || {}) };
  if (!sexo) delete zonas.pelvis;
  return zonas;
}

/**
 * Lista plana de síntomas disponibles para un sexo.
 * @param {string} sexo
 * @returns {{zone: string, nombre: string, value: string}[]}
 */
export function listaSintomas(sexo) {
  return Object.entries(zonasPara(sexo)).flatMap(([zone, [nombre, lista]]) =>
    lista.split('|').map((value) => ({ zone, nombre, value }))
  );
}

/** Clave estable usada en el estado para recordar una selección. */
export const claveSintoma = (zone, value) => `${zone}|${value}`;

/**
 * Indica si una selección sigue siendo válida tras cambiar de sexo.
 * @param {string} zone
 * @param {string} value
 * @param {string} sexo
 */
export function sintomaValido(zone, value, sexo) {
  return listaSintomas(sexo).some((s) => s.zone === zone && s.value === value);
}
