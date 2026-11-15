/** Validación compartida por formularios, progreso y transiciones de etapa. */
import { FORM_FIELDS } from '../data/metrics.js';
import { sintomaValido } from '../data/symptoms.js';

export const PROFILE_FIELDS = [
  { id: 'sexo', label: 'Sexo biológico', kind: 'select', options: ['Femenino', 'Masculino'] },
  { id: 'nombre', label: 'Nombre completo', kind: 'text' },
  { id: 'edad', label: 'Edad', kind: 'number', min: 18, max: 80, step: 1 },
  { id: 'peso', label: 'Peso corporal', kind: 'number', min: 30, max: 200, step: 0.1 },
  { id: 'estatura', label: 'Estatura', kind: 'number', min: 1.2, max: 2.2, step: 0.01 },
  { id: 'sangre', label: 'Grupo sanguíneo', kind: 'select', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] }
];

function errorCampo(field, value, confirmado = true) {
  const texto = String(value ?? '').trim();
  if (!texto) return `Completa «${field.label}».`;
  if (!confirmado) return `Selecciona o confirma el valor de «${field.label}».`;
  if (field.kind === 'select' && !field.options.includes(texto)) return `Selecciona una opción de «${field.label}».`;
  if (field.kind !== 'number' && field.kind !== 'range') return '';

  const numero = Number(texto);
  const min = field.kind === 'range' ? 0 : field.min;
  const max = field.kind === 'range' ? 10 : field.max;
  const step = field.kind === 'range' ? 1 : field.step;
  if (!Number.isFinite(numero)) return `Introduce un número en «${field.label}».`;
  if (numero < min || (max !== undefined && numero > max)) {
    return max === undefined
      ? `«${field.label}» debe ser al menos ${min}.`
      : `«${field.label}» debe estar entre ${min} y ${max}.`;
  }
  const pasos = (numero - (min ?? 0)) / step;
  if (step && Math.abs(pasos - Math.round(pasos)) > 0.000001) {
    return `Usa incrementos de ${step} en «${field.label}».`;
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
      errores.symptoms = 'Selecciona tus molestias o «Me siento en óptimas condiciones».';
    }
    if (!String(record.otherText ?? '').trim()) {
      errores.otherText = 'Completa las observaciones; puedes escribir «Sin observaciones».';
    }
  }
  return errores;
}

export function progresoRegistro(record, etapa = 'baseline') {
  const errores = erroresRegistro(record, etapa);
  const total = PROFILE_FIELDS.length + FORM_FIELDS.length + (etapa === 'current' ? 2 : 0);
  const completos = total - Object.keys(errores).length;
  return { errores, total, completos, porcentaje: Math.floor(completos / total * 100) };
}
