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

/** Opciones compartidas por equilibrio y coordinación. */
const OPCIONES_NEURO = [
  'Sin dificultades percibidas',
  'Dificultad leve',
  'Dificultad moderada',
  'Dificultad intensa',
  'Pendiente de prueba'
];

export const METRIC_SECTIONS = [
  {
    id: 'cardio',
    icon: '♡',
    title: 'SIGNOS VITALES',
    subtitle: 'Signos vitales y exploración cardiopulmonar en reposo',
    index: '01 / 05',
    fields: [
      {
        kind: 'number',
        id: 'fc_reposo',
        label: 'Frecuencia cardíaca en reposo',
        unit: 'BPM',
        min: 25,
        max: 240,
        step: 1,
        placeholder: 'Ej. 68',
        helper: 'Registrar tras un periodo de reposo',
        counted: true
      },
      {
        kind: 'pressure',
        label: 'Presión arterial',
        ids: [
          { id: 'pa_sistolica', label: 'Sistólica', placeholder: '120', min: 50, max: 300, step: 1 },
          { id: 'pa_diastolica', label: 'Diastólica', placeholder: '80', min: 20, max: 200, step: 1 }
        ],
        counted: true
      },
      {
        kind: 'select',
        id: 'ecg_estado',
        label: 'Electrocardiograma (ECG)',
        placeholder: 'Seleccionar resultado',
        options: ['Sin hallazgos reportados', 'Con hallazgos por revisar', 'Pendiente de realizar'],
        helper: 'Transcribe la conclusión del informe, si la tienes',
        counted: true
      },
      {
        kind: 'number',
        id: 'spo2',
        label: 'Saturación de oxígeno (SpO₂)',
        unit: '%',
        min: 50,
        max: 100,
        step: 0.1,
        placeholder: 'Ej. 98',
        counted: true
      },
      {
        kind: 'number',
        id: 'fr',
        label: 'Frecuencia respiratoria',
        unit: 'RPM',
        min: 4,
        max: 60,
        step: 1,
        placeholder: 'Ej. 14',
        helper: 'Respiraciones por minuto en reposo',
        counted: true
      },
      {
        kind: 'number',
        id: 'temp',
        label: 'Temperatura corporal',
        unit: '°C',
        min: 30,
        max: 43,
        step: 0.1,
        placeholder: 'Ej. 36.6',
        counted: true
      },
      {
        kind: 'textarea',
        id: 'ecg_informe',
        label: 'Observaciones del ECG',
        placeholder: 'Ej. Ritmo sinusal, fecha de estudio y observaciones del profesional...',
        wide: true
      }
    ]
  },
  {
    id: 'muscular',
    icon: '◇',
    title: 'ÓSEO Y MUSCULAR',
    subtitle: 'Composición corporal y fuerza de referencia',
    index: '02 / 05',
    fields: [
      {
        kind: 'number',
        id: 'densidad_osea',
        label: 'Densidad mineral ósea (DXA)',
        unit: 'g/cm²',
        min: 0,
        max: 3.5,
        step: 0.001,
        placeholder: 'Ej. 1.120',
        helper: 'Valor de la región corporal evaluada',
        wideUnit: true,
        counted: true
      },
      {
        kind: 'select',
        id: 'region_dxa',
        label: 'Región evaluada (DXA)',
        placeholder: 'Seleccionar región',
        options: ['Columna lumbar', 'Cadera total', 'Cuello femoral', 'Cuerpo completo', 'Otra / no especificada']
      },
      {
        kind: 'number',
        id: 'masa_muscular',
        label: 'Masa muscular',
        unit: 'KG',
        min: 0,
        max: 250,
        step: 0.1,
        placeholder: 'Ej. 31.5',
        helper: 'Según el método de medición disponible',
        counted: true
      },
      {
        kind: 'number',
        id: 'fuerza_muscular',
        label: 'Fuerza muscular',
        unit: 'kgf',
        min: 0,
        max: 300,
        step: 0.1,
        placeholder: 'Ej. 42',
        helper: 'Prensión manual u otra prueba; indica el método',
        counted: true
      },
      {
        kind: 'select',
        id: 'metodo_fuerza',
        label: 'Método de evaluación de la fuerza',
        placeholder: 'Seleccionar método',
        options: [
          'Prensión manual (dinamómetro)',
          'Otra prueba de fuerza (especificar)',
          'Sin prueba disponible'
        ],
        wide: true
      },
      {
        kind: 'preview',
        label: 'Peso corporal y estatura',
        helper: 'Se toman automáticamente de los datos personales, sin duplicar información.',
        wide: true
      }
    ]
  },
  {
    id: 'inmune',
    icon: '✧',
    title: 'INMUNOLÓGICO',
    subtitle: 'Hemograma, marcadores y respuesta al estrés',
    index: '03 / 05',
    fields: [
      {
        kind: 'number',
        id: 'leucocitos',
        label: 'Recuento de glóbulos blancos',
        unit: '/µL',
        min: 0,
        max: 200000,
        step: 1,
        placeholder: 'Ej. 6500',
        helper: 'Leucocitos en sangre periférica',
        wideUnit: true,
        counted: true
      },
      {
        kind: 'number',
        id: 'cortisol',
        label: 'Cortisol',
        unit: 'µg/dL',
        min: 0,
        max: 300,
        step: 0.01,
        placeholder: 'Valor de laboratorio',
        helper: 'Indicar horario de toma de la muestra',
        wideUnit: true,
        counted: true
      },
      {
        kind: 'select',
        id: 'hora_cortisol',
        label: 'Momento de toma de cortisol',
        placeholder: 'Seleccionar',
        options: ['Mañana', 'Tarde', 'Noche', 'Hora no registrada'],
        wide: true
      },
      {
        kind: 'textarea',
        id: 'marcadores_inmunes',
        label: 'Marcadores inmunológicos',
        placeholder:
          'Anota marcador, resultado, unidad y fecha. Ej.: subpoblaciones linfocitarias, citocinas, etc.',
        wide: true,
        counted: true
      },
      {
        kind: 'textarea',
        id: 'hormonas_estres',
        label: 'Otras hormonas relacionadas con el estrés',
        placeholder: 'Anota hormona, resultado, unidad y horario de muestra (si aplica).',
        wide: true,
        counted: true
      }
    ]
  },
  {
    id: 'psico',
    icon: '☾',
    title: 'PSICOLÓGICO',
    subtitle: 'Autoevaluación subjetiva del bienestar y sueño',
    index: '04 / 05',
    note:
      'Las escalas de 0 a 10 son registros subjetivos de la persona. No sustituyen pruebas psicológicas validadas.',
    fields: [
      {
        kind: 'range',
        id: 'estres',
        label: 'Nivel de estrés percibido',
        ends: ['0 · Nada', '10 · Muy alto'],
        wide: true,
        counted: true
      },
      {
        kind: 'range',
        id: 'estado_animo',
        label: 'Estado de ánimo',
        ends: ['0 · Muy bajo', '10 · Muy bueno'],
        counted: true
      },
      {
        kind: 'range',
        id: 'ansiedad',
        label: 'Nivel de ansiedad percibida',
        ends: ['0 · Ninguna', '10 · Muy alta'],
        counted: true
      },
      {
        kind: 'number',
        id: 'sueno_horas',
        label: 'Duración del sueño',
        unit: 'H',
        min: 0,
        max: 24,
        step: 0.25,
        placeholder: 'Ej. 7.5',
        helper: 'Horas dormidas la última noche',
        counted: true
      },
      {
        kind: 'range',
        id: 'sueno_calidad',
        label: 'Calidad del sueño',
        ends: ['0 · Muy mala', '10 · Excelente'],
        counted: true
      },
      { kind: 'divider', label: 'MEMORIA, ATENCIÓN Y CONCENTRACIÓN · AUTOEVALUACIÓN' },
      {
        kind: 'range',
        id: 'memoria',
        label: 'Memoria',
        ends: ['0 · Mucha dificultad', '10 · Sin dificultad'],
        counted: true
      },
      {
        kind: 'range',
        id: 'atencion',
        label: 'Atención',
        ends: ['0 · Mucha dificultad', '10 · Sin dificultad'],
        counted: true
      },
      {
        kind: 'range',
        id: 'concentracion',
        label: 'Concentración',
        ends: ['0 · Mucha dificultad', '10 · Sin dificultad'],
        wide: true,
        counted: true
      }
    ]
  },
  {
    id: 'neuro',
    icon: '⌁',
    title: 'NEUROLÓGICO',
    subtitle: 'Equilibrio, coordinación y respuesta motora',
    index: '05 / 05',
    fields: [
      {
        kind: 'select',
        id: 'equilibrio',
        label: 'Equilibrio',
        placeholder: 'Seleccionar',
        options: OPCIONES_NEURO,
        counted: true
      },
      {
        kind: 'select',
        id: 'coordinacion',
        label: 'Coordinación',
        placeholder: 'Seleccionar',
        options: OPCIONES_NEURO,
        counted: true
      },
      {
        kind: 'number',
        id: 'reaccion_ms',
        label: 'Tiempo de reacción',
        note: '(prueba digital)',
        unit: 'MS',
        min: 0,
        max: 10000,
        step: 1,
        placeholder: 'Ej. 245',
        helper: 'Registrar el valor medido, no una estimación',
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
