/** Validación compartida por formularios, progreso y transiciones de etapa. */
import { FORM_FIELDS, SOLO_HABITUAL_IDS } from '../data/metrics.js';
import { sintomaValido } from '../data/symptoms.js';

export const PROFILE_FIELDS = [
  { id: 'sexo', label: 'Biological sex', kind: 'select', options: ['Female', 'Male'] },
  { id: 'nombre', label: 'Full name', kind: 'text' },
  { id: 'edad', label: 'Age', kind: 'number', min: 18, max: 80, step: 1 },
  { id: 'peso', label: 'Body weight', kind: 'number', min: 30, max: 200, step: 0.1 },
  { id: 'estatura', label: 'Height', kind: 'number', min: 1.2, max: 2.2, step: 0.01 },
  { id: 'sangre', label: 'Blood type', kind: 'select', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] }
];

function errorCampo(field, value, confirmado = true) {
  const texto = String(value ?? '').trim();
  if (!texto) return field.optional ? '' : `Complete “${field.label}”.`;
  if (!confirmado) return `Select or confirm the value of “${field.label}”.`;
  if (field.kind === 'select' && !field.options.includes(texto)) return `Select an option for “${field.label}”.`;
  if (field.kind !== 'number' && field.kind !== 'range') return '';

  const numero = Number(texto);
  const min = field.kind === 'range' ? 0 : field.min;
  const max = field.kind === 'range' ? 10 : field.max;
  const step = field.kind === 'range' ? 1 : field.step;
  if (!Number.isFinite(numero)) return `Enter a number in “${field.label}”.`;
  if (numero < min || (max !== undefined && numero > max)) {
    return max === undefined
      ? `“${field.label}” must be at least ${min}.`
      : `“${field.label}” must be between ${min} and ${max}.`;
  }
  const pasos = (numero - (min ?? 0)) / step;
  if (step && Math.abs(pasos - Math.round(pasos)) > 0.000001) {
    return `Use steps of ${step} in “${field.label}”.`;
  }
  return '';
}

export function erroresRegistro(record, etapa = 'baseline') {
  const errores = {};
  for (const field of PROFILE_FIELDS) {
    const error = errorCampo(field, record.profile[field.id]);
    if (error) errores[field.id] = error;
  }
  for (const field of FORM_FIELDS) {
    const confirmado = field.kind !== 'range' || record.ratingsTouched.has(field.id);
    const error = errorCampo(field, record.values[field.id], confirmado);
    if (error) errores[field.id] = error;
  }
  if (etapa === 'current') {
    const sintomas = [...record.symptoms];
    const validos = sintomas.every((key) => {
      const corte = key.indexOf('|');
      return corte > 0 && sintomaValido(key.slice(0, corte), key.slice(corte + 1), record.profile.sexo);
    });
    if ((!sintomas.length && !record.wellBeing) || !validos || (sintomas.length && record.wellBeing)) {
      errores.symptoms = 'Select your symptoms or “I feel in optimal condition”.';
    }
  }
  return errores;
}

export function progresoRegistro(record, etapa = 'baseline') {
  const errores = erroresRegistro(record, etapa);
  // Solo cuentan los obligatorios; un opcional mal escrito sí resta. En la etapa
  // 2, perfil y datos «solo habituales» vienen del registro habitual y no cuentan.
  const obligatorios = FORM_FIELDS.filter((field) => !field.optional);
  const total = etapa === 'current'
    ? obligatorios.filter((field) => !SOLO_HABITUAL_IDS.includes(field.id)).length + 1
    : PROFILE_FIELDS.length + obligatorios.length;
  const completos = Math.max(0, total - Object.keys(errores).length);
  return { errores, total, completos, porcentaje: Math.floor(completos / total * 100) };
}
