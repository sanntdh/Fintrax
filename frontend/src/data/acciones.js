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
    nombre: 'NASA HRP · Sleep Evidence Report',
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
  texto: 'You can request a private medical conference with your flight surgeon at any time.',
  fuente: 'ISS-MEDOPS',
  pagina: 1,
  cita: 'Private medical conferences (PMCs) are conducted regularly and upon crew request'
};

export const AREAS = {
  alteracion_vestibular: {
    titulo: 'Dizziness and orientation',
    acciones: [
      {
        texto: 'Do visual-vestibular and sensorimotor training exercises on an ongoing basis.',
        fuente: 'FISIO',
        pagina: 5,
        cita: 'continuous sensorimotor training and visual-vestibular exercises could reduce adaptation time and improve functional recovery'
      },
      {
        texto: 'After returning, ask for vestibular, gait and strength rehabilitation.',
        fuente: 'FISIO',
        pagina: 5,
        cita: 'structured rehabilitation phases involving vestibular training, strength conditioning, gait retraining, and cardiovascular exercises'
      }
    ]
  },
  intolerancia_ortostatica: {
    titulo: 'Dizziness when standing up',
    acciones: [
      {
        texto: 'Do aerobic and strength exercise regularly to protect your heart and blood vessels.',
        fuente: 'EXON',
        pagina: 7,
        cita: 'doing aerobic and resistance exercises on a regular basis has been shown to help keep your heart and blood vessels healthy and lessen the effects of orthostatic intolerance'
      },
      {
        texto: 'Ask for the reconditioning protocol: graded exercise and lower body negative pressure (LBNP).',
        fuente: 'FISIO',
        pagina: 5,
        cita: 'targeted cardiovascular reconditioning protocols, including graded exercise and lower body negative pressure training'
      }
    ]
  },
  deterioro_muscular: {
    titulo: 'Muscle',
    acciones: [
      {
        texto: 'Complete your scheduled high-intensity aerobic and strength training.',
        fuente: 'FISIO',
        pagina: 12,
        cita: 'High-intensity aerobic and resistance training maintained aerobic capacity and muscle strength'
      },
      {
        texto: 'After returning, ask for early physiotherapy with gradual exercise progression.',
        fuente: 'FISIO',
        pagina: 5,
        cita: 'early initiation of physiotherapy and gradual progression of exercise intensity significantly enhanced recovery'
      }
    ]
  },
  perdida_osea: {
    titulo: 'Bone',
    acciones: [
      {
        texto: 'Exercise daily on the treadmill with harness, cycle ergometer and resistance device.',
        fuente: 'FISIO',
        pagina: 2,
        cita: 'treadmills with harnesses, cycle ergometers, and resistive exercise devices simulate the effects of weight-bearing activities in microgravity, helping to preserve bone density'
      }
    ]
  },
  alteracion_inmunitaria: {
    titulo: 'Immune defenses',
    acciones: [
      {
        texto: 'Look after your nutrition, manage stress and exercise to keep your defenses up.',
        fuente: 'FISIO',
        pagina: 5,
        cita: 'countermeasures such as nutritional support, stress management, and physical exercise to maintain immune resilience during long missions'
      }
    ]
  },
  sans: {
    titulo: 'Vision',
    acciones: [
      {
        texto: 'If your vision is blurred, use the adjustable glasses carried on board.',
        fuente: 'SANS-MTB',
        pagina: 12,
        cita: 'All crew fly with at least 3 pairs of prescription lenses of varying power to help compensate for vision decrements in-flight.'
      },
      {
        texto: 'Report the change: in-flight visual acuity and Amsler grid tests are available.',
        fuente: 'SANS-MTB',
        pagina: 7,
        cita: 'Amsler Grid … Pre-, in-, and post-flight'
      }
    ]
  },
  salud_mental_sueno: {
    titulo: 'Sleep, mood and concentration',
    acciones: [
      {
        texto: 'Avoid activities with extra light before sleep.',
        fuente: 'SLEEP-ER',
        pagina: 34,
        cita: 'access to activities that do not involve supplemental light exposure before sleep'
      },
      {
        texto: 'Discuss sleep, fatigue, mood or concentration in your private psychological conference.',
        fuente: 'BHP-OPS',
        pagina: 16,
        cita: 'Sleep (duration and quality) and sleep shift issues; Fatigue level; Mood and Cognition'
      }
    ]
  }
};

/** Molestias que activan cada área (mismos criterios que los complementarios del backend). */
export const SINTOMAS_POR_AREA = {
  alteracion_vestibular: ['Dizziness or vertigo', 'Confusion'],
  sans: ['Blurred vision', 'Light sensitivity'],
  salud_mental_sueno: ['Confusion']
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
export const SINTOMAS_URGENTES = ['Crushing pain', 'Chest pain', 'Difficulty breathing', 'Shortness of breath'];
