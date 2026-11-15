/**
 * Qué hacer según las molestias: acciones respaldadas por las fuentes locales
 * del proyecto (docs/FUENTES.md en la rama Backend).
 *
 * - EXON: Microgravity-Induced Alterations in Human Physiology... (2026).
 * - FISIO: Physiotherapy Beyond Earth (IJFMR).
 * - LIMEN: Astronaut Genetic Persona Mapping (paper de congreso).
 *
 * Más documentos públicos de NASA para visión, sueño y ánimo (ver la sección
 * «Fuentes de NASA» de docs/FUENTES.md).
 *
 * `pagina` es la página del PDF contada desde 1 y `cita` el texto literal que
 * respalda la acción. Ninguna fuente describe signos de alarma: un área sin
 * respaldo se mostraría como tal, sin inventar acciones. Los `id` coinciden
 * con los códigos de condición del backend.
 */

export const FUENTES = {
  EXON: { nombre: 'EXON' },
  FISIO: { nombre: 'FISIO' },
  LIMEN: { nombre: 'LIMEN' },
  'SANS-MTB': {
    nombre: 'NASA · SANS (OCHMO-MTB-001)',
    nasa: true,
    url: 'https://www.nasa.gov/wp-content/uploads/2024/02/ochmo-mtb-001-sans.pdf'
  },
  'SLEEP-ER': {
    nombre: 'NASA HRP · Evidence Report de sueño',
    nasa: true,
    url: 'https://humanresearchroadmap.nasa.gov/Evidence/reports/Sleep.pdf'
  },
  'BHP-OPS': {
    nombre: 'NASA · Behavioral Health and Performance',
    nasa: true,
    url: 'https://ntrs.nasa.gov/api/citations/20170003866/downloads/20170003866.pdf'
  },
  'ISS-MEDOPS': {
    nombre: 'NASA · ISS Medical Operations',
    nasa: true,
    url: 'https://ntrs.nasa.gov/api/citations/20080010877/downloads/20080010877.pdf'
  }
};

/** Respaldo de NASA para «avisa al equipo médico»: la PMC se pide cuando se quiera. */
export const CONFERENCIA_MEDICA = {
  texto: 'Puedes pedir una conferencia médica privada con tu cirujano de vuelo en cualquier momento.',
  fuente: 'ISS-MEDOPS',
  pagina: 1,
  cita: 'Private medical conferences (PMCs) are conducted regularly and upon crew request'
};

export const AREAS = {
  alteracion_vestibular: {
    titulo: 'Mareo y orientación',
    acciones: [
      {
        texto: 'Haz ejercicios visuales-vestibulares y de entrenamiento sensoriomotor de forma continua.',
        fuente: 'FISIO',
        pagina: 5,
        cita: 'continuous sensorimotor training and visual-vestibular exercises could reduce adaptation time and improve functional recovery'
      },
      {
        texto: 'Al regresar, pide rehabilitación vestibular, de la marcha y de fuerza.',
        fuente: 'FISIO',
        pagina: 5,
        cita: 'structured rehabilitation phases involving vestibular training, strength conditioning, gait retraining, and cardiovascular exercises'
      }
    ]
  },
  intolerancia_ortostatica: {
    titulo: 'Mareo al incorporarte',
    acciones: [
      {
        texto: 'Haz ejercicio aeróbico y de fuerza con regularidad para proteger corazón y vasos.',
        fuente: 'EXON',
        pagina: 7,
        cita: 'doing aerobic and resistance exercises on a regular basis has been shown to help keep your heart and blood vessels healthy and lessen the effects of orthostatic intolerance'
      },
      {
        texto: 'Pide el protocolo de reacondicionamiento: ejercicio graduado y presión negativa (LBNP).',
        fuente: 'FISIO',
        pagina: 5,
        cita: 'targeted cardiovascular reconditioning protocols, including graded exercise and lower body negative pressure training'
      }
    ]
  },
  deterioro_muscular: {
    titulo: 'Músculo',
    acciones: [
      {
        texto: 'Cumple tu entrenamiento aeróbico y de fuerza de alta intensidad programado.',
        fuente: 'FISIO',
        pagina: 12,
        cita: 'High-intensity aerobic and resistance training maintained aerobic capacity and muscle strength'
      },
      {
        texto: 'Al volver, pide fisioterapia temprana con progresión gradual del ejercicio.',
        fuente: 'FISIO',
        pagina: 5,
        cita: 'early initiation of physiotherapy and gradual progression of exercise intensity significantly enhanced recovery'
      }
    ]
  },
  perdida_osea: {
    titulo: 'Hueso',
    acciones: [
      {
        texto: 'Haz a diario tu ejercicio con cinta y arnés, cicloergómetro y aparato de resistencia.',
        fuente: 'FISIO',
        pagina: 2,
        cita: 'treadmills with harnesses, cycle ergometers, and resistive exercise devices simulate the effects of weight-bearing activities in microgravity, helping to preserve bone density'
      }
    ]
  },
  alteracion_inmunitaria: {
    titulo: 'Defensas',
    acciones: [
      {
        texto: 'Cuida tu nutrición, maneja el estrés y haz ejercicio para mantener las defensas.',
        fuente: 'FISIO',
        pagina: 5,
        cita: 'countermeasures such as nutritional support, stress management, and physical exercise to maintain immune resilience during long missions'
      }
    ]
  },
  sans: {
    titulo: 'Visión',
    acciones: [
      {
        texto: 'Si ves borroso, usa las gafas de ajuste que lleva la nave.',
        fuente: 'SANS-MTB',
        pagina: 12,
        cita: 'All crew fly with at least 3 pairs of prescription lenses of varying power to help compensate for vision decrements in-flight.'
      },
      {
        texto: 'Comunica el cambio: en vuelo se hacen pruebas de agudeza visual y rejilla de Amsler.',
        fuente: 'SANS-MTB',
        pagina: 7,
        cita: 'Amsler Grid … Pre-, in-, and post-flight'
      }
    ]
  },
  salud_mental_sueno: {
    titulo: 'Sueño, ánimo y concentración',
    acciones: [
      {
        texto: 'Evita actividades con luz adicional antes de dormir.',
        fuente: 'SLEEP-ER',
        pagina: 34,
        cita: 'access to activities that do not involve supplemental light exposure before sleep'
      },
      {
        texto: 'Habla de sueño, fatiga, ánimo o concentración en tu conferencia psicológica privada.',
        fuente: 'BHP-OPS',
        pagina: 16,
        cita: 'Sleep (duration and quality) and sleep shift issues; Fatigue level; Mood and Cognition'
      }
    ]
  }
};

/** Molestias que activan cada área (mismos criterios que los complementarios del backend). */
export const SINTOMAS_POR_AREA = {
  alteracion_vestibular: ['Mareo o vértigo', 'Confusión'],
  sans: ['Visión borrosa', 'Sensibilidad a luz'],
  salud_mental_sueno: ['Confusión']
};

/** Sistemas de la evaluación local que, alterados, activan cada área. */
export const SISTEMAS_POR_AREA = {
  alteracion_vestibular: ['neuro'],
  deterioro_muscular: ['muscular'],
  perdida_osea: ['muscular'],
  alteracion_inmunitaria: ['inmune'],
  salud_mental_sueno: ['psico']
};

/**
 * Protocolo de Fintrax, no de las fuentes (ninguna describe signos de alarma):
 * estas molestias piden avisar de inmediato al equipo médico de vuelo.
 */
export const SINTOMAS_URGENTES = ['Dolor opresivo', 'Dolor en pecho', 'Dificultad al respirar', 'Falta de aire'];
