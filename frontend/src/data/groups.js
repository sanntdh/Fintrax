/**
 * Agrupación de los datos exportados.
 *
 * Reproduce el orden y las etiquetas de `collectData()` del prototipo, pero sin
 * leer el DOM: `export.js` resuelve cada `id` contra el estado.
 *
 * `format` indica cómo componer el valor:
 * - `pressure`: une sistólica/diastólica.
 * - por defecto: valor + unidad.
 */

export const REPORT_GROUPS = [
  {
    title: 'CARDIOVASCULAR',
    fields: [
      { label: 'Resting heart rate', id: 'fc_reposo', unit: 'bpm' },
      { label: 'Blood pressure', id: 'pa_sistolica', format: 'pressure', unit: 'mmHg' },
      { label: 'Electrocardiogram (ECG)', id: 'ecg_estado' },
      { label: 'Oxygen saturation (SpO₂)', id: 'spo2', unit: '%' },
      { label: 'Respiratory rate', id: 'fr', unit: 'rpm' },
      { label: 'Body temperature', id: 'temp', unit: '°C' }
    ]
  },
  {
    title: 'BONE AND MUSCLE',
    fields: [
      { label: 'Bone mineral density (DXA)', id: 'densidad_osea', unit: 'g/cm²' },
      { label: 'DXA region', id: 'region_dxa' },
      { label: 'Muscle mass', id: 'masa_muscular', unit: 'kg' },
      { label: 'Muscle strength', id: 'fuerza_muscular', unit: 'kgf' },
      { label: 'Strength method', id: 'metodo_fuerza' },
      { label: 'Body weight', id: 'peso', unit: 'kg', profile: true },
      { label: 'Height', id: 'estatura', unit: 'm', profile: true }
    ]
  },
  {
    title: 'IMMUNE',
    fields: [
      { label: 'White blood cells', id: 'leucocitos', unit: '/µL' },
      { label: 'Immune markers', id: 'marcadores_inmunes' },
      { label: 'Cortisol', id: 'cortisol', unit: 'µg/dL' },
      { label: 'Measurement time', id: 'hora_cortisol' },
      { label: 'Other stress hormones', id: 'hormonas_estres' }
    ]
  },
  {
    title: 'PSYCHOLOGICAL · SELF-ASSESSMENT',
    fields: [
      { label: 'Perceived stress', id: 'estres', unit: '/10', rating: true },
      { label: 'Mood', id: 'estado_animo', unit: '/10', rating: true },
      { label: 'Anxiety', id: 'ansiedad', unit: '/10', rating: true },
      { label: 'Sleep duration', id: 'sueno_horas', unit: 'h' },
      { label: 'Sleep quality', id: 'sueno_calidad', unit: '/10', rating: true },
      { label: 'Memory', id: 'memoria', unit: '/10', rating: true },
      { label: 'Attention', id: 'atencion', unit: '/10', rating: true },
      { label: 'Concentration', id: 'concentracion', unit: '/10', rating: true }
    ]
  },
  {
    title: 'NEUROLOGICAL',
    fields: [
      { label: 'Balance', id: 'equilibrio' },
      { label: 'Coordination', id: 'coordinacion' },
      { label: 'Reaction time', id: 'reaccion_ms', unit: 'ms' }
    ]
  }
];
