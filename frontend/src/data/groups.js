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
      { label: 'Frecuencia cardíaca en reposo', id: 'fc_reposo', unit: 'bpm' },
      { label: 'Presión arterial', id: 'pa_sistolica', format: 'pressure', unit: 'mmHg' },
      { label: 'Electrocardiograma (ECG)', id: 'ecg_estado' },
      { label: 'Saturación de oxígeno (SpO₂)', id: 'spo2', unit: '%' },
      { label: 'Frecuencia respiratoria', id: 'fr', unit: 'rpm' },
      { label: 'Temperatura corporal', id: 'temp', unit: '°C' }
    ]
  },
  {
    title: 'ÓSEO Y MUSCULAR',
    fields: [
      { label: 'Densidad mineral ósea (DXA)', id: 'densidad_osea', unit: 'g/cm²' },
      { label: 'Región DXA', id: 'region_dxa' },
      { label: 'Masa muscular', id: 'masa_muscular', unit: 'kg' },
      { label: 'Fuerza muscular', id: 'fuerza_muscular', unit: 'kgf' },
      { label: 'Método de fuerza', id: 'metodo_fuerza' },
      { label: 'Peso corporal', id: 'peso', unit: 'kg', profile: true },
      { label: 'Estatura', id: 'estatura', unit: 'm', profile: true }
    ]
  },
  {
    title: 'INMUNOLÓGICO',
    fields: [
      { label: 'Glóbulos blancos', id: 'leucocitos', unit: '/µL' },
      { label: 'Marcadores inmunológicos', id: 'marcadores_inmunes' },
      { label: 'Cortisol', id: 'cortisol', unit: 'µg/dL' },
      { label: 'Momento de medición', id: 'hora_cortisol' },
      { label: 'Otras hormonas del estrés', id: 'hormonas_estres' }
    ]
  },
  {
    title: 'PSICOLÓGICO · AUTOEVALUACIÓN',
    fields: [
      { label: 'Estrés percibido', id: 'estres', unit: '/10', rating: true },
      { label: 'Estado de ánimo', id: 'estado_animo', unit: '/10', rating: true },
      { label: 'Ansiedad', id: 'ansiedad', unit: '/10', rating: true },
      { label: 'Duración de sueño', id: 'sueno_horas', unit: 'h' },
      { label: 'Calidad del sueño', id: 'sueno_calidad', unit: '/10', rating: true },
      { label: 'Memoria', id: 'memoria', unit: '/10', rating: true },
      { label: 'Atención', id: 'atencion', unit: '/10', rating: true },
      { label: 'Concentración', id: 'concentracion', unit: '/10', rating: true }
    ]
  },
  {
    title: 'NEUROLÓGICO',
    fields: [
      { label: 'Equilibrio', id: 'equilibrio' },
      { label: 'Coordinación', id: 'coordinacion' },
      { label: 'Tiempo de reacción', id: 'reaccion_ms', unit: 'ms' }
    ]
  }
];
