/**
 * Contenido de orientación clínica y textos de la interfaz.
 *
 * Extraído sin cambios de ASTRA_version2_con_resultados.html (líneas 1745–1809).
 * Son textos informativos, no diagnósticos: no se generan causas ni consejos
 * fuera de este catálogo.
 */

/** Posibles causas por síntoma. Separadas por «|». */
export const CAUSAS = {
  'Dolor de cabeza':
    'Tensión muscular o estrés|Deshidratación o poco sueño|Fatiga visual o cambios de presión',
  'Migraña': 'Migraña por estrés o cambios hormonales|Falta de sueño|Desencadenantes como luz o ruido',
  'Mareo o vértigo':
    'Deshidratación o presión baja|Desorientación por movimiento o microgravedad|Alteración del oído interno',
  'Zumbido en oídos': 'Ruido o presión ambiental|Estrés o fatiga|Tapón de cerumen o alteración del oído',
  Confusión:
    'Falta de oxígeno o glucosa baja|Deshidratación o agotamiento|Alteración neurológica que requiere valoración',
  'Visión borrosa':
    'Fatiga ocular por pantallas|Deshidratación o cambios de presión|Alteración ocular o neurológica que debe revisarse',
  'Ardor o sequedad': 'Ojos secos por ambiente y pantallas|Irritación o alergia|Uso prolongado de lentes',
  'Sensibilidad a luz': 'Fatiga ocular o migraña|Irritación ocular|Deshidratación',
  'Fatiga ocular': 'Exceso de pantallas|Poco parpadeo en ambiente seco|Posible necesidad de graduación',
  'Dolor opresivo':
    'Problema cardíaco, como angina (debe descartarse)|Crisis de ansiedad|Tensión muscular o respiratoria',
  Palpitaciones: 'Estrés, ansiedad o cafeína|Deshidratación o falta de sueño|Arritmia que requiere un ECG',
  'Dificultad al respirar': 'Ansiedad o hiperventilación|Baja oxigenación o problema respiratorio|Causa cardíaca',
  'Falta de aire': 'Ansiedad o hiperventilación|Baja oxigenación o problema respiratorio|Causa cardíaca',
  'Dolor en pecho': 'Tensión muscular o inflamación costal|Reflujo o acidez|Causa cardíaca (debe descartarse)',
  Punzadas: 'Tensión muscular o nervios intercostales|Ansiedad|Gases o reflujo',
  'Sensibilidad mamaria':
    'Cambios hormonales del ciclo|Estrés o fatiga|Posible embarazo, si hay retraso menstrual',
  'Dolor abdominal': 'Gastritis o indigestión|Gases o estreñimiento|Infección intestinal o apendicitis si es muy intenso',
  Náuseas: 'Indigestión o comida en mal estado|Mareo por movimiento|Estrés o infección leve',
  Vómito: 'Gastroenteritis o intoxicación alimentaria|Mareo por movimiento|Deshidratación asociada',
  'Acidez o reflujo': 'Reflujo gastroesofágico|Comidas copiosas o irritantes|Gastritis',
  Hinchazón: 'Gases o digestión lenta|Intolerancia alimentaria|Retención de líquidos',
  'Molestia pélvica': 'Tensión muscular o estreñimiento|Infección urinaria|Causa ginecológica o urológica a evaluar',
  'Dolor al orinar': 'Infección urinaria|Deshidratación o irritación|Cálculos renales',
  'Dolor lumbar bajo': 'Contractura muscular|Mala postura|Problema renal o urinario',
  'Molestia inguinal': 'Esfuerzo muscular|Hernia inguinal|Inflamación o infección local',
  'Pesadez testicular': 'Várices (varicocele) o inflamación|Infección|Torsión, una urgencia si el dolor es súbito',
  'Cólicos menstruales': 'Menstruación normal (dismenorrea)|Endometriosis u otra causa|Estrés o cambios hormonales',
  'Retraso menstrual': 'Estrés o cambios de rutina|Alteración hormonal|Posible embarazo',
  'Dolor pélvico bajo': 'Cólico menstrual u ovulación|Infección urinaria o ginecológica|Quiste u otra causa a evaluar',
  'Molestia al orinar': 'Infección urinaria|Irritación|Deshidratación',
  Hormigueo: 'Postura o presión sobre un nervio|Mala circulación o falta de minerales|Alteración neurológica si persiste',
  'Dolor muscular': 'Sobreesfuerzo o ejercicio|Pérdida muscular por microgravedad|Deshidratación o falta de descanso',
  Calambres: 'Deshidratación o falta de electrolitos|Fatiga muscular|Mala circulación',
  'Rigidez articular':
    'Inactividad o mala postura|Inflamación articular|Efecto de la microgravedad en huesos y articulaciones'
};

/** Recomendaciones generales por zona. */
export const ACC = {
  cabeza: [
    'Hidrátate y descansa en un lugar tranquilo y con poca luz',
    'Anota cuándo empezó y qué tan fuerte es',
    'Mide tu presión y temperatura si puedes'
  ],
  ojos: [
    'Descansa la vista y parpadea con frecuencia',
    'Evita tocarte los ojos y reduce el brillo de pantallas',
    'Usa lágrimas artificiales si el médico de vuelo lo autoriza'
  ],
  pecho: [
    'Suspende el esfuerzo y siéntate',
    'Respira lento y profundo; mide pulso y oxígeno',
    'Avisa al médico de vuelo o a Control de Misión'
  ],
  estomago: [
    'Toma agua en sorbos pequeños',
    'Evita comidas pesadas, grasas y alcohol',
    'Reposa y vigila fiebre o vómito repetido'
  ],
  pelvis: [
    'Hidrátate y no retengas la orina',
    'Anota síntomas y su duración',
    'Consulta al médico de vuelo si dura más de 24 h'
  ],
  extremidades: [
    'Descansa y estira con suavidad',
    'Hidrátate y revisa tu ingesta de minerales',
    'Evita forzar la zona afectada'
  ]
};

/** Señales de alarma que obligan a buscar atención inmediata. */
export const ALERTA = {
  cabeza: 'dolor súbito e intenso, confusión, dificultad para hablar, debilidad de un lado del cuerpo o visión doble',
  ojos: 'pérdida repentina de visión, dolor ocular intenso o destellos con sombras',
  pecho: 'dolor que se extiende al brazo, mandíbula o espalda, sudor frío, mareo o falta de aire intensa',
  estomago: 'dolor muy intenso con abdomen duro, vómito con sangre, deshidratación o fiebre alta',
  pelvis: 'dolor intenso y súbito, sangre en la orina, fiebre o sangrado anormal',
  extremidades: 'pérdida de fuerza o sensibilidad, hinchazón dolorosa en una pierna o dolor intenso tras un golpe'
};

/**
 * Sistemas cuyos registros se citan como contexto al orientar una zona.
 *
 * Corrección clínica respecto al prototipo: la zona «cabeza» ya NO incorpora el
 * sistema psicológico. El estrés o el ánimo bajo no deben presentarse como
 * hallazgo neurológico ni elevar la gravedad de una cefalea.
 */
export const CTX = { pecho: ['cardio'], cabeza: ['neuro'], extremidades: ['osteo'] };

/** Mensajes del banner de resultado. `{nombres}` se sustituye en results.js. */
export const MENSAJES = {
  ok: [
    '✓ ESTADO ÓPTIMO · TODO BIEN',
    'Todos los órganos registrados están dentro de parámetros normales. Continúa con tu monitoreo rutinario.'
  ],
  warn: [
    '◆ PRECAUCIÓN · NIVEL MEDIO',
    'Se detectan alteraciones moderadas en: {nombres}. Mantén reposo e hidratación, sigue el monitoreo y consulta si persisten o empeoran.'
  ],
  bad: [
    '⚠ ALERTA GRAVE',
    'Se detectan alteraciones graves en: {nombres}. Se recomienda atención médica inmediata y reportar a Control de Misión.'
  ],
  unknown: [
    '◇ SIN DATOS SUFICIENTES',
    'Todavía no hay mediciones ni molestias registradas. Completa al menos un indicador clínico o marca un síntoma para obtener orientación.'
  ]
};

/** Consejo breve por estado, usado en las tarjetas de órganos. */
export const CONSEJO_ESTADO = {
  ok: 'Funcionamiento normal.',
  warn: 'Vigilar evolución y reposar.',
  bad: 'Requiere evaluación médica inmediata.',
  na: 'Sin mediciones registradas.'
};

export const SIN_ALTERACIONES = 'Sin alteraciones registradas';
