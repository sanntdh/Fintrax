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
    label: 'Cerebro',
    color: '#b388ff',
    anchor: { x: 455, y: 218 },
    labelAt: { x: 250, y: 176, anchor: 'end' },
    line: [
      [455, 218],
      [318, 218],
      [250, 176]
    ],
    description: 'Coordina equilibrio, coordinación, memoria y tiempo de reacción.',
    guidance:
      'Si aparecen mareos, confusión o pérdida de equilibrio, detén la actividad y avisa al médico de vuelo.',
    symptoms: [
      'Dolor de cabeza',
      'Migraña',
      'Mareo o vértigo',
      'Zumbido en oídos',
      'Confusión'
    ]
  },

  corazon: {
    key: 'corazon',
    label: 'Corazón',
    color: '#ff5c7a',
    anchor: { x: 494, y: 470 },
    labelAt: { x: 690, y: 330, anchor: 'start' },
    line: [
      [494, 470],
      [620, 470],
      [690, 330]
    ],
    description: 'Bombea la sangre; se valora con frecuencia, presión y ECG.',
    guidance:
      'Repite la presión en reposo y reporta dolor opresivo, palpitaciones o desmayo.',
    symptoms: ['Dolor opresivo', 'Dolor en pecho', 'Palpitaciones']
  },

  pulmones: {
    key: 'pulmones',
    label: 'Pulmones',
    color: '#4dd7ff',
    anchor: { x: 462, y: 505 },
    labelAt: { x: 250, y: 430, anchor: 'end' },
    line: [
      [462, 505],
      [318, 505],
      [250, 430]
    ],
    description: 'Intercambian oxígeno; se valoran con la saturación y la respiración.',
    guidance:
      'Si la saturación baja o falta el aire en reposo, busca valoración médica.',
    symptoms: ['Dificultad al respirar', 'Falta de aire', 'Punzadas']
  },

  higado: {
    key: 'higado',
    label: 'Hígado',
    color: '#ffb84d',
    anchor: { x: 412, y: 625 },
    labelAt: { x: 250, y: 620, anchor: 'end' },
    line: [
      [412, 625],
      [318, 625],
      [250, 620]
    ],
    description: 'Filtra y metaboliza; requiere marcadores hepáticos específicos.',
    guidance:
      'No hay marcadores hepáticos (ALT/AST) en este registro. Añádelos en una revisión si necesitas valorarlo.',
    symptoms: []
  },

  estomago: {
    key: 'estomago',
    label: 'Estómago',
    color: '#7dffb0',
    anchor: { x: 512, y: 620 },
    labelAt: { x: 690, y: 560, anchor: 'start' },
    line: [
      [512, 620],
      [620, 620],
      [690, 560]
    ],
    description: 'Digestión alta; se orienta con náuseas, reflujo o dolor abdominal.',
    guidance:
      'Hidrátate, evita comidas irritantes y consulta si el dolor es intenso o persistente.',
    symptoms: ['Dolor abdominal', 'Náuseas', 'Vómito', 'Acidez o reflujo']
  },

  rinones: {
    key: 'rinones',
    label: 'Riñones',
    color: '#7aa2ff',
    anchor: { x: 462, y: 690 },
    labelAt: { x: 690, y: 720, anchor: 'start' },
    line: [
      [462, 690],
      [620, 690],
      [690, 720]
    ],
    description: 'Filtran la sangre y regulan líquidos; se orientan con síntomas urinarios.',
    guidance:
      'Si hay dolor al orinar, fiebre o dolor lumbar bajo, busca atención médica.',
    symptoms: ['Dolor al orinar', 'Molestia al orinar', 'Dolor lumbar bajo']
  },

  intestinos: {
    key: 'intestinos',
    label: 'Intestinos',
    color: '#ff9f7a',
    anchor: { x: 463, y: 755 },
    labelAt: { x: 250, y: 800, anchor: 'end' },
    line: [
      [463, 755],
      [318, 755],
      [250, 800]
    ],
    description: 'Absorben nutrientes; se orientan con hinchazón o dolor abdominal.',
    guidance:
      'Registra cambios de hábito y consulta si hay sangre, fiebre o dolor intenso.',
    symptoms: ['Hinchazón', 'Dolor abdominal']
  }
};
