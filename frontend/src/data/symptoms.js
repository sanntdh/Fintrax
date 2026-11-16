/**
 * Catálogo de síntomas por zona corporal.
 *
 * Extraído sin cambios de ASTRA_version2_con_resultados.html (líneas 1284–1301).
 * Es la única fuente de verdad para construir los chips del formulario y la
 * vista de resultados.
 */

export const SINTOMAS_BASE = {
  cabeza: ['Head', 'Headache|Dizziness or vertigo|Ringing in ears|Confusion'],
  ojos: ['Eyes', 'Blurred vision|Burning or dryness|Light sensitivity|Eye strain'],
  pecho: ['Chest', 'Crushing pain|Palpitations|Difficulty breathing|Stabbing pain'],
  estomago: ['Stomach', 'Abdominal pain|Nausea|Vomiting|Heartburn or reflux|Bloating'],
  pelvis: ['Pelvis', 'Pelvic discomfort'],
  extremidades: ['Limbs', 'Tingling|Muscle pain|Cramps|Joint stiffness']
};

export const SINTOMAS_ESPECIFICOS = {
  'Male': {
    pelvis: ['Pelvis', 'Painful urination|Lower back pain|Groin discomfort|Testicular heaviness']
  },
  'Female': {
    cabeza: ['Head', 'Headache|Migraine|Dizziness or vertigo|Ringing in ears|Confusion'],
    pecho: ['Chest and Breasts', 'Chest pain|Palpitations|Breast tenderness|Shortness of breath'],
    pelvis: ['Pelvis', 'Menstrual cramps|Late period|Lower pelvic pain|Discomfort when urinating']
  }
};

/** Nombres cortos usados por el estado de órganos y las etiquetas del avatar. */
export const ZONAS_NOMBRES = {
  cabeza: 'Head',
  ojos: 'Eyes',
  pecho: 'Chest',
  estomago: 'Stomach',
  pelvis: 'Pelvis',
  extremidades: 'Limbs'
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
