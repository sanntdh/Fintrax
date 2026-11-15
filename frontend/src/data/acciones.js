/**
 * Qué hacer según las molestias: acciones respaldadas por las fuentes locales
 * del proyecto (docs/FUENTES.md en la rama Backend).
 *
 * - EXON: Microgravity-Induced Alterations in Human Physiology... (2026).
 * - FISIO: Physiotherapy Beyond Earth (IJFMR).
 * - LIMEN: Astronaut Genetic Persona Mapping (paper de congreso).
 *
 * `pagina` es la página del PDF contada desde 1 y `cita` el texto literal que
 * respalda la acción. Las fuentes describen contramedidas y rehabilitación,
 * no primeros auxilios ni signos de alarma: un área sin respaldo se muestra
 * como tal, sin inventar acciones. Los `id` coinciden con los códigos de
 * condición del backend.
 */

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
  sans: { titulo: 'Visión', acciones: [] },
  salud_mental_sueno: { titulo: 'Sueño, ánimo y concentración', acciones: [] }
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
