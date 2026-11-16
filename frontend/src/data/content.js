/**
 * Contenido de orientación clínica y textos de la interfaz.
 *
 * Extraído sin cambios de ASTRA_version2_con_resultados.html (líneas 1745–1809).
 * Son textos informativos, no diagnósticos: no se generan causas ni consejos
 * fuera de este catálogo.
 */

/** Posibles causas por síntoma. Separadas por «|». */
export const CAUSAS = {
  'Headache':
    'Muscle tension or stress|Dehydration or little sleep|Eye strain or pressure changes',
  'Migraine': 'Migraine from stress or hormonal changes|Lack of sleep|Triggers such as light or noise',
  'Dizziness or vertigo':
    'Dehydration or low blood pressure|Disorientation from motion or microgravity|Inner ear disturbance',
  'Ringing in ears': 'Noise or ambient pressure|Stress or fatigue|Earwax plug or ear disturbance',
  'Confusion':
    'Lack of oxygen or low glucose|Dehydration or exhaustion|Neurological disturbance that needs assessment',
  'Blurred vision':
    'Eye strain from screens|Dehydration or pressure changes|Eye or neurological disturbance that should be checked',
  'Burning or dryness': 'Dry eyes from environment and screens|Irritation or allergy|Prolonged lens use',
  'Light sensitivity': 'Eye strain or migraine|Eye irritation|Dehydration',
  'Eye strain': 'Too much screen time|Little blinking in a dry environment|Possible need for a new prescription',
  'Crushing pain':
    'Heart problem such as angina (must be ruled out)|Anxiety attack|Muscle or respiratory tension',
  'Palpitations': 'Stress, anxiety or caffeine|Dehydration or lack of sleep|Arrhythmia that requires an ECG',
  'Difficulty breathing': 'Anxiety or hyperventilation|Low oxygenation or respiratory problem|Cardiac cause',
  'Shortness of breath': 'Anxiety or hyperventilation|Low oxygenation or respiratory problem|Cardiac cause',
  'Chest pain': 'Muscle tension or rib inflammation|Reflux or heartburn|Cardiac cause (must be ruled out)',
  'Stabbing pain': 'Muscle tension or intercostal nerves|Anxiety|Gas or reflux',
  'Breast tenderness':
    'Hormonal cycle changes|Stress or fatigue|Possible pregnancy, if the period is late',
  'Abdominal pain': 'Gastritis or indigestion|Gas or constipation|Intestinal infection or appendicitis if very intense',
  'Nausea': 'Indigestion or spoiled food|Motion sickness|Stress or mild infection',
  'Vomiting': 'Gastroenteritis or food poisoning|Motion sickness|Associated dehydration',
  'Heartburn or reflux': 'Gastroesophageal reflux|Large or irritating meals|Gastritis',
  'Bloating': 'Gas or slow digestion|Food intolerance|Fluid retention',
  'Pelvic discomfort': 'Muscle tension or constipation|Urinary infection|Gynecological or urological cause to assess',
  'Painful urination': 'Urinary infection|Dehydration or irritation|Kidney stones',
  'Lower back pain': 'Muscle contracture|Poor posture|Kidney or urinary problem',
  'Groin discomfort': 'Muscle strain|Inguinal hernia|Local inflammation or infection',
  'Testicular heaviness': 'Varicose veins (varicocele) or inflammation|Infection|Torsion, an emergency if the pain is sudden',
  'Menstrual cramps': 'Normal menstruation (dysmenorrhea)|Endometriosis or another cause|Stress or hormonal changes',
  'Late period': 'Stress or routine changes|Hormonal disturbance|Possible pregnancy',
  'Lower pelvic pain': 'Menstrual cramp or ovulation|Urinary or gynecological infection|Cyst or another cause to assess',
  'Discomfort when urinating': 'Urinary infection|Irritation|Dehydration',
  'Tingling': 'Posture or pressure on a nerve|Poor circulation or mineral deficiency|Neurological disturbance if it persists',
  'Muscle pain': 'Overexertion or exercise|Muscle loss from microgravity|Dehydration or lack of rest',
  'Cramps': 'Dehydration or electrolyte deficiency|Muscle fatigue|Poor circulation',
  'Joint stiffness':
    'Inactivity or poor posture|Joint inflammation|Effect of microgravity on bones and joints'
};

/** Recomendaciones generales por zona. */
export const ACC = {
  cabeza: [
    'Hydrate and rest in a quiet, dim place',
    'Note when it started and how strong it is',
    'Measure your blood pressure and temperature if you can'
  ],
  ojos: [
    'Rest your eyes and blink often',
    'Avoid touching your eyes and lower screen brightness',
    'Use artificial tears if the flight surgeon approves'
  ],
  pecho: [
    'Stop exertion and sit down',
    'Breathe slowly and deeply; measure pulse and oxygen',
    'Notify the flight surgeon or Mission Control'
  ],
  estomago: [
    'Drink water in small sips',
    'Avoid heavy or fatty meals and alcohol',
    'Rest and watch for fever or repeated vomiting'
  ],
  pelvis: [
    'Hydrate and do not hold urine',
    'Note symptoms and how long they last',
    'See the flight surgeon if it lasts more than 24 h'
  ],
  extremidades: [
    'Rest and stretch gently',
    'Hydrate and check your mineral intake',
    'Avoid straining the affected area'
  ]
};

/** Señales de alarma que obligan a buscar atención inmediata. */
export const ALERTA = {
  cabeza: 'sudden severe pain, confusion, trouble speaking, weakness on one side of the body or double vision',
  ojos: 'sudden vision loss, severe eye pain or flashes with shadows',
  pecho: 'pain spreading to the arm, jaw or back, cold sweat, dizziness or severe shortness of breath',
  estomago: 'very severe pain with a hard abdomen, vomiting blood, dehydration or high fever',
  pelvis: 'sudden severe pain, blood in the urine, fever or abnormal bleeding',
  extremidades: 'loss of strength or sensation, painful swelling in a leg or severe pain after a blow'
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
    '✓ OPTIMAL STATUS · ALL GOOD',
    'All recorded organs are within normal parameters. Continue your routine monitoring.'
  ],
  warn: [
    '◆ CAUTION · MEDIUM LEVEL',
    'Moderate changes detected in: {nombres}. Rest and hydrate, keep monitoring and consult if they persist or worsen.'
  ],
  bad: [
    '⚠ SEVERE ALERT',
    'Severe changes detected in: {nombres}. Immediate medical attention and a report to Mission Control are recommended.'
  ],
  unknown: [
    '◇ NOT ENOUGH DATA',
    'No measurements or symptoms recorded yet. Complete at least one clinical indicator or mark a symptom to get guidance.'
  ]
};

/** Consejo breve por estado, usado en las tarjetas de órganos. */
export const CONSEJO_ESTADO = {
  ok: 'Normal function.',
  warn: 'Monitor progress and rest.',
  bad: 'Requires immediate medical evaluation.',
  na: 'No measurements recorded.'
};

export const SIN_ALTERACIONES = 'No changes recorded';
