/**
 * Contrato de datos del registro exportado (JSON) y del estado interno.
 *
 * No hay validación en ejecución: es documentación ejecutable por tipos para
 * quien consuma el JSON. Cualquier cambio aquí debe reflejarse en
 * `DATOS.md` y en las pruebas del contrato.
 */

export const PLATAFORMA = 'ASTRA - prototipo local';
export const AVISO =
  'Registro de datos autodeclarados o mediciones previas. No constituye diagnóstico ni aptitud para vuelo.';
export const NOMBRE_ARCHIVO = 'ASTRA_registro_premision.json';

/**
 * @typedef {'Femenino'|'Masculino'|''} Sexo
 *
 * @typedef {Object} PerfilExportado
 * @property {string} nombre
 * @property {Sexo} sexo
 * @property {string} edad
 * @property {string} peso_kg
 * @property {string} estatura_m
 * @property {string} grupo_sanguineo
 *
 * @typedef {Object} MolestiaExportada
 * @property {string} zona  Nombre visible de la zona (p. ej. «Pecho y Mamas»).
 * @property {string} molestia  Síntoma marcado.
 *
 * @typedef {Object} RegistroExportado
 * @property {string} plataforma
 * @property {string} fecha  ISO 8601.
 * @property {PerfilExportado} perfil
 * @property {{categoria: string, registros: {label: string, value: string}[]}[]} variables
 * @property {MolestiaExportada[]} molestias
 * @property {boolean} sinMolestias
 * @property {string} observaciones
 * @property {number} indicadoresCompletados
 * @property {number} indicadoresPosibles
 * @property {string} aviso
 * @property {string} [version] `2.0` al incluir los dos registros.
 * @property {{habituales: RegistroExportado, actuales: RegistroExportado}} [registros]
 * @property {'valores_habituales'|'datos_actuales'} [etapa]
 *
 * @typedef {Object} EstadoInterno
 * @property {PerfilExportado} profile
 * @property {Set<string>} symptoms  Claves «zona|síntoma».
 * @property {boolean} wellBeing
 * @property {string} otherText
 * @property {Record<string, string>} values  Valores crudos de todos los campos.
 * @property {Set<string>} ratingsTouched  Escalas 0–10 movidas por la persona.
 * @property {'intro'|'baseline'|'current'|'transition'|'body'} step
 * @property {'baseline'|'current'} activeRecord
 * @property {{baseline: Object|null, current: Object|null}} records
 */
