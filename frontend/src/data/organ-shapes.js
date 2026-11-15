/**
 * Formas de los órganos, en coordenadas locales.
 *
 * Cada forma se dibuja alrededor de `(0, 0)` y se traslada después al ancla
 * del órgano (`ORGANOS[key].anchor`) dentro del viewBox 941×1672. Están aquí,
 * separadas del render, para que la transición y la Etapa 2 dibujen lo mismo.
 *
 * Las medidas están tomadas de la silueta real del avatar (`assets/*.webp`):
 * la figura mide 1084 px de alto sobre un lienzo de 1279 px, lo que equivale a
 * 1.416 unidades del viewBox. De ahí salen las proporciones: torso de 300
 * unidades de ancho, cabeza de 150, cadera a 800. Las formas son estilizadas,
 * no anatómicamente exactas, pero guardan la escala correcta para que se lean
 * sobre el cuerpo.
 *
 * `stroke` indica que la forma se pinta como línea (no como relleno); se usa
 * en los intestinos, donde una sola silueta no representa el tubo digestivo.
 */

export const ORGAN_SHAPES = {
  cerebro: {
    hit: 78,
    paths: [
      'M-58,-8 C-64,-40 -42,-64 -13,-57 C-4,-72 18,-73 30,-57 C54,-61 72,-40 63,-13 C75,7 58,30 36,32 C25,48 2,50 -12,39 C-36,45 -60,30 -61,7 C-69,1 -64,-5 -58,-8 Z'
    ],
    details: [
      'M0,-55 C-9,-29 -9,17 2,39',
      'M-60,5 C-32,1 -8,7 -3,21',
      'M63,-6 C41,-2 21,4 15,19'
    ]
  },

  corazon: {
    hit: 46,
    paths: [
      'M0,35 C-11,23 -43,3 -43,-25 C-43,-47 -19,-56 -7,-39 L0,-31 L7,-39 C19,-56 43,-47 43,-25 C43,3 11,23 0,35 Z'
    ],
    details: ['M-35,-26 C-19,-19 -7,-7 0,8', 'M35,-26 C19,-19 7,-7 0,8']
  },

  pulmones: {
    hit: 96,
    paths: [
      'M-15,-73 C-21,-45 -21,-19 -17,-3 C-52,3 -94,26 -102,63 C-108,91 -85,106 -63,93 C-38,78 -27,44 -23,10 Z',
      'M15,-73 C21,-45 21,-19 17,-3 C52,3 94,26 102,63 C108,91 85,106 63,93 C38,78 27,44 23,10 Z'
    ],
    details: ['M0,-80 L0,-3', 'M0,-80 L-17,-65', 'M0,-80 L17,-65']
  },

  higado: {
    hit: 78,
    paths: [
      'M-73,-21 C-46,-45 4,-43 51,-27 C72,-16 76,6 55,23 C22,45 -27,47 -52,31 C-72,18 -82,1 -73,-21 Z'
    ],
    details: ['M-42,11 C-14,21 17,19 42,9']
  },

  estomago: {
    hit: 55,
    paths: [
      'M-19,-41 C4,-58 35,-45 41,-20 C49,11 29,41 2,45 C-25,49 -45,32 -45,8 C-45,-15 -35,-31 -19,-41 Z'
    ],
    details: ['M35,-31 C21,-19 19,4 27,23']
  },

  rinones: {
    hit: 48,
    paths: [
      'M-27,-41 C-48,-47 -60,-27 -56,-6 C-52,21 -35,45 -18,41 C-4,37 0,21 -4,2 C-8,-19 -13,-35 -27,-41 Z',
      'M27,-41 C48,-47 60,-27 56,-6 C52,21 35,45 18,41 C4,37 0,21 4,2 C8,-19 13,-35 27,-41 Z'
    ],
    details: []
  },

  intestinos: {
    hit: 82,
    stroke: 14,
    paths: [
      'M-78,-48 C-56,-67 -23,-59 -27,-32 C-31,-10 -67,-4 -67,23 C-67,53 -32,61 -4,49 C22,37 20,4 45,-10 C69,-24 91,-6 85,21 C79,47 52,63 29,59'
    ],
    details: []
  }
};
