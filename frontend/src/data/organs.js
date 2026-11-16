/**
 * Catálogo de órganos de la Etapa 2.
 *
 * `anchor` es el centro del órgano en el viewBox 941×1672 del avatar.
 * `labelAt` es el extremo de la línea guía (leader) y `line` su recorrido.
 * Los colores se usan solo en formas y halos; el estado siempre lleva texto.
 *
 * Las coordenadas se calibraron sobre la silueta real del avatar: la figura
 * está centrada en x≈442 (no en 470, el centro del lienzo) y ocupa de y≈131
 * (coronilla) a y≈1547 (pies), con los hombros en y≈386 y la cadera en y≈800.
 * Por eso el tronco va de 386 a 800: pecho 386–600, abdomen 600–800.
 */

export const ORGAN_ORDER = [
  'cerebro',
  'corazon',
  'pulmones',
  'higado',
  'estomago',
  'rinones',
  'intestinos'
];

export const ORGANOS = {
  cerebro: {
    key: 'cerebro',
    label: 'Brain',
    color: '#b388ff',
    anchor: { x: 455, y: 218 },
    labelAt: { x: 250, y: 176, anchor: 'end' },
    line: [
      [455, 218],
      [318, 218],
      [250, 176]
    ],
    description: 'Coordinates balance, coordination, memory and reaction time.',
    guidance:
      'If dizziness, confusion or loss of balance appear, stop the activity and notify the flight surgeon.',
    symptoms: [
      'Headache',
      'Migraine',
      'Dizziness or vertigo',
      'Ringing in ears',
      'Confusion'
    ]
  },

  corazon: {
    key: 'corazon',
    label: 'Heart',
    color: '#ff5c7a',
    anchor: { x: 494, y: 470 },
    labelAt: { x: 690, y: 330, anchor: 'start' },
    line: [
      [494, 470],
      [620, 470],
      [690, 330]
    ],
    description: 'Pumps blood; assessed with heart rate, blood pressure and ECG.',
    guidance:
      'Repeat the resting blood pressure and report crushing pain, palpitations or fainting.',
    symptoms: ['Crushing pain', 'Chest pain', 'Palpitations']
  },

  pulmones: {
    key: 'pulmones',
    label: 'Lungs',
    color: '#4dd7ff',
    anchor: { x: 462, y: 505 },
    labelAt: { x: 250, y: 430, anchor: 'end' },
    line: [
      [462, 505],
      [318, 505],
      [250, 430]
    ],
    description: 'Exchange oxygen; assessed with saturation and breathing.',
    guidance:
      'If saturation drops or you are short of breath at rest, seek medical assessment.',
    symptoms: ['Difficulty breathing', 'Shortness of breath', 'Stabbing pain']
  },

  higado: {
    key: 'higado',
    label: 'Liver',
    color: '#ffb84d',
    anchor: { x: 412, y: 625 },
    labelAt: { x: 250, y: 620, anchor: 'end' },
    line: [
      [412, 625],
      [318, 625],
      [250, 620]
    ],
    description: 'Filters and metabolizes; requires specific liver markers.',
    guidance:
      'There are no liver markers (ALT/AST) in this record. Add them in a check-up if you need to assess it.',
    symptoms: []
  },

  estomago: {
    key: 'estomago',
    label: 'Stomach',
    color: '#7dffb0',
    anchor: { x: 512, y: 620 },
    labelAt: { x: 690, y: 560, anchor: 'start' },
    line: [
      [512, 620],
      [620, 620],
      [690, 560]
    ],
    description: 'Upper digestion; assessed with nausea, reflux or abdominal pain.',
    guidance:
      'Hydrate, avoid irritating foods and consult if the pain is intense or persistent.',
    symptoms: ['Abdominal pain', 'Nausea', 'Vomiting', 'Heartburn or reflux']
  },

  rinones: {
    key: 'rinones',
    label: 'Kidneys',
    color: '#7aa2ff',
    anchor: { x: 462, y: 690 },
    labelAt: { x: 690, y: 720, anchor: 'start' },
    line: [
      [462, 690],
      [620, 690],
      [690, 720]
    ],
    description: 'Filter blood and regulate fluids; assessed with urinary symptoms.',
    guidance:
      'If there is painful urination, fever or lower back pain, seek medical attention.',
    symptoms: ['Painful urination', 'Discomfort when urinating', 'Lower back pain']
  },

  intestinos: {
    key: 'intestinos',
    label: 'Intestines',
    color: '#ff9f7a',
    anchor: { x: 463, y: 755 },
    labelAt: { x: 250, y: 800, anchor: 'end' },
    line: [
      [463, 755],
      [318, 755],
      [250, 800]
    ],
    description: 'Absorb nutrients; assessed with bloating or abdominal pain.',
    guidance:
      'Record changes in habits and consult if there is blood, fever or severe pain.',
    symptoms: ['Bloating', 'Abdominal pain']
  }
};
