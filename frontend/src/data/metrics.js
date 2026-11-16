/**
 * Estructura del registro médico: 5 secciones y 25 indicadores contados.
 *
 * Cada campo describe cómo se pinta y cómo se lee. El motor de evaluación
 * consume los mismos `id`, de modo que no hay dos listas que puedan divergir.
 *
 * `counted: true` identifica las 25 mediciones del informe. Todos los campos,
 * incluidos los metadatos, son obligatorios y suman al progreso del formulario.
 */

/** Ids de las escalas subjetivas 0–10 (solo cuentan si se tocan). */
export const RATING_IDS = ['estres', 'estado_animo', 'ansiedad', 'sueno_calidad', 'memoria', 'atencion', 'concentracion'];

/** Resultado resumido de un análisis de laboratorio; evita escribir informes. */
export const OPCIONES_LABORATORIO = ['Within range', 'Out of range', 'Not available'];

/** Opciones compartidas por equilibrio y coordinación. */
const OPCIONES_NEURO = [
  'No perceived difficulty',
  'Mild difficulty',
  'Moderate difficulty',
  'Severe difficulty',
  'Test pending'
];

export const METRIC_SECTIONS = [
  {
    id: 'cardio',
    icon: '♡',
    title: 'VITAL SIGNS',
    subtitle: 'Vital signs and resting cardiopulmonary assessment',
    index: '01 / 05',
    fields: [
      {
        kind: 'number',
        id: 'fc_reposo',
        label: 'Resting heart rate',
        unit: 'BPM',
        min: 25,
        max: 240,
        step: 1,
        placeholder: 'e.g. 68',
        helper: 'Record after a rest period',
        counted: true
      },
      {
        kind: 'pressure',
        label: 'Blood pressure',
        ids: [
          { id: 'pa_sistolica', label: 'Systolic', placeholder: '120', min: 50, max: 300, step: 1 },
          { id: 'pa_diastolica', label: 'Diastolic', placeholder: '80', min: 20, max: 200, step: 1 }
        ],
        counted: true
      },
      {
        kind: 'select',
        id: 'ecg_estado',
        label: 'Electrocardiogram (ECG)',
        placeholder: 'Select result',
        options: ['No findings reported', 'Findings to review', 'Not done yet'],
        helper: 'Copy the report conclusion, if you have it',
        counted: true
      },
      {
        kind: 'number',
        id: 'spo2',
        label: 'Oxygen saturation (SpO₂)',
        unit: '%',
        min: 50,
        max: 100,
        step: 0.1,
        placeholder: 'e.g. 98',
        counted: true
      },
      {
        kind: 'number',
        id: 'fr',
        label: 'Respiratory rate',
        unit: 'RPM',
        min: 4,
        max: 60,
        step: 1,
        placeholder: 'e.g. 14',
        helper: 'Breaths per minute at rest',
        counted: true
      },
      {
        kind: 'number',
        id: 'temp',
        label: 'Body temperature',
        unit: '°C',
        min: 30,
        max: 43,
        step: 0.1,
        placeholder: 'e.g. 36.6',
        counted: true
      }
    ]
  },
  {
    id: 'muscular',
    soloHabitual: true,
    icon: '◇',
    title: 'BONE AND MUSCLE',
    subtitle: 'Body composition and baseline strength',
    index: '02 / 05',
    fields: [
      {
        kind: 'number',
        id: 'densidad_osea',
        optional: true,
        label: 'Bone mineral density (DXA)',
        unit: 'g/cm²',
        min: 0,
        max: 3.5,
        step: 0.001,
        placeholder: 'e.g. 1.120',
        helper: 'Value for the assessed body region',
        wideUnit: true,
        counted: true
      },
      {
        kind: 'select',
        id: 'region_dxa',
        optional: true,
        label: 'Assessed region (DXA)',
        placeholder: 'Select region',
        options: ['Lumbar spine', 'Total hip', 'Femoral neck', 'Whole body', 'Other / not specified']
      },
      {
        kind: 'number',
        id: 'masa_muscular',
        label: 'Muscle mass',
        unit: 'KG',
        min: 0,
        max: 250,
        step: 0.1,
        placeholder: 'e.g. 31.5',
        helper: 'Using the available measurement method',
        counted: true
      },
      {
        kind: 'number',
        id: 'fuerza_muscular',
        label: 'Muscle strength',
        unit: 'kgf',
        min: 0,
        max: 300,
        step: 0.1,
        placeholder: 'e.g. 42',
        helper: 'Hand grip or another test; state the method',
        counted: true
      },
      {
        kind: 'select',
        id: 'metodo_fuerza',
        label: 'Strength assessment method',
        placeholder: 'Select method',
        options: [
          'Hand grip (dynamometer)',
          'Other strength test (specify)',
          'No test available'
        ],
        wide: true
      },
      {
        kind: 'preview',
        label: 'Body weight and height',
        helper: 'Taken automatically from your personal data, without duplicating it.',
        wide: true
      }
    ]
  },
  {
    id: 'inmune',
    soloHabitual: true,
    icon: '✧',
    title: 'IMMUNE',
    subtitle: 'Blood count, markers and stress response',
    index: '03 / 05',
    fields: [
      {
        kind: 'number',
        id: 'leucocitos',
        optional: true,
        label: 'White blood cell count',
        unit: '/µL',
        min: 0,
        max: 200000,
        step: 1,
        placeholder: 'e.g. 6500',
        helper: 'Leukocytes in peripheral blood',
        wideUnit: true,
        counted: true
      },
      {
        kind: 'number',
        id: 'cortisol',
        optional: true,
        label: 'Cortisol',
        unit: 'µg/dL',
        min: 0,
        max: 300,
        step: 0.01,
        placeholder: 'Lab value',
        helper: 'State when the sample was taken',
        wideUnit: true,
        counted: true
      },
      {
        kind: 'select',
        id: 'hora_cortisol',
        optional: true,
        label: 'Cortisol sample time',
        placeholder: 'Select',
        options: ['Morning', 'Afternoon', 'Night', 'Time not recorded'],
        wide: true
      },
      {
        kind: 'select',
        id: 'marcadores_inmunes',
        optional: true,
        label: 'Immune markers',
        placeholder: 'Select result',
        options: OPCIONES_LABORATORIO,
        helper: 'From your latest lab test',
        counted: true
      },
      {
        kind: 'select',
        id: 'hormonas_estres',
        optional: true,
        label: 'Other stress-related hormones',
        placeholder: 'Select result',
        options: OPCIONES_LABORATORIO,
        helper: 'From your latest lab test',
        counted: true
      }
    ]
  },
  {
    id: 'psico',
    icon: '☾',
    title: 'PSYCHOLOGICAL',
    subtitle: 'Subjective self-assessment of wellbeing and sleep',
    index: '04 / 05',
    note:
      'The 0–10 scales are subjective self-reports. They do not replace validated psychological tests.',
    fields: [
      {
        kind: 'range',
        id: 'estres',
        label: 'Perceived stress level',
        ends: ['0 · None', '10 · Very high'],
        wide: true,
        counted: true
      },
      {
        kind: 'range',
        id: 'estado_animo',
        label: 'Mood',
        ends: ['0 · Very low', '10 · Very good'],
        counted: true
      },
      {
        kind: 'range',
        id: 'ansiedad',
        label: 'Perceived anxiety level',
        ends: ['0 · None', '10 · Very high'],
        counted: true
      },
      {
        kind: 'number',
        id: 'sueno_horas',
        label: 'Sleep duration',
        unit: 'H',
        min: 0,
        max: 24,
        step: 0.25,
        placeholder: 'e.g. 7.5',
        helper: 'Hours slept last night',
        counted: true
      },
      {
        kind: 'range',
        id: 'sueno_calidad',
        label: 'Sleep quality',
        ends: ['0 · Very poor', '10 · Excellent'],
        counted: true
      },
      { kind: 'divider', label: 'MEMORY, ATTENTION AND CONCENTRATION · SELF-ASSESSMENT' },
      {
        kind: 'range',
        id: 'memoria',
        label: 'Memory',
        ends: ['0 · Great difficulty', '10 · No difficulty'],
        counted: true
      },
      {
        kind: 'range',
        id: 'atencion',
        label: 'Attention',
        ends: ['0 · Great difficulty', '10 · No difficulty'],
        counted: true
      },
      {
        kind: 'range',
        id: 'concentracion',
        label: 'Concentration',
        ends: ['0 · Great difficulty', '10 · No difficulty'],
        wide: true,
        counted: true
      }
    ]
  },
  {
    id: 'neuro',
    icon: '⌁',
    title: 'NEUROLOGICAL',
    subtitle: 'Balance, coordination and motor response',
    index: '05 / 05',
    fields: [
      {
        kind: 'select',
        id: 'equilibrio',
        label: 'Balance',
        placeholder: 'Select',
        options: OPCIONES_NEURO,
        counted: true
      },
      {
        kind: 'select',
        id: 'coordinacion',
        label: 'Coordination',
        placeholder: 'Select',
        options: OPCIONES_NEURO,
        counted: true
      },
      {
        kind: 'number',
        id: 'reaccion_ms',
        label: 'Reaction time',
        note: '(digital test)',
        unit: 'MS',
        min: 0,
        max: 10000,
        step: 1,
        placeholder: 'e.g. 245',
        helper: 'Record the measured value, not an estimate',
        wide: true,
        counted: true
      }
    ]
  }
];

/** Todos los campos con `id` propio, en orden de aparición. */
export const FIELD_IDS = METRIC_SECTIONS.flatMap((section) =>
  section.fields.flatMap((field) => {
    if (field.kind === 'pressure') return field.ids.map((item) => item.id);
    if (field.id) return [field.id];
    return [];
  })
);

/**
 * Campos que no cambian de un día para otro (pruebas con equipo o laboratorio):
 * solo se piden en el registro habitual y la etapa 2 los toma de él.
 */
export const SOLO_HABITUAL_IDS = METRIC_SECTIONS.filter((section) => section.soloHabitual).flatMap((section) =>
  section.fields.flatMap((field) => (field.ids ? field.ids.map((item) => item.id) : field.id ? [field.id] : []))
);

/** Los 23 indicadores que cuentan para el progreso y la evaluación. */
export const COUNTED_IDS = METRIC_SECTIONS.flatMap((section) =>
  section.fields.flatMap((field) => {
    if (!field.counted) return [];
    if (field.kind === 'pressure') return field.ids.map((item) => item.id);
    return field.id ? [field.id] : [];
  })
);

/** Ids de texto libre o metadatos (no cuentan como medición). */
export const AUX_IDS = FIELD_IDS.filter((id) => !COUNTED_IDS.includes(id));

/** Secciones con su lista de ids contados, para el desglose del progreso. */
export const COUNTED_BY_SECTION = METRIC_SECTIONS.map((section) => ({
  id: section.id,
  title: section.title,
  ids: COUNTED_IDS.filter((id) =>
    section.fields.some((field) => field.id === id || (field.ids || []).some((item) => item.id === id))
  )
}));

/** Controles editables, con las dos presiones normalizadas como números. */
export const FORM_FIELDS = METRIC_SECTIONS.flatMap((section) =>
  section.fields.flatMap((field) => {
    if (field.kind === 'pressure') return field.ids.map((item) => ({ ...item, kind: 'number' }));
    return field.id ? [field] : [];
  })
);
