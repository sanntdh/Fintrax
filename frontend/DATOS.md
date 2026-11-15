# Datos, umbrales y contrato del registro

Todo lo descrito aquí vive en `src/data/` y `src/js/evaluation.js`. Las pruebas
de `tests/` comprueban que catálogo, motor y exportación sigan coherentes.

## 1. Perfil

Cinco campos obligatorios, más el sexo biológico:

| Campo | Clave interna | Validación |
| --- | --- | --- |
| Nombre completo | `nombre` | No vacío |
| Edad | `edad` | 1–120 años |
| Peso | `peso` | > 0 kg |
| Estatura | `estatura` | 0,5–2,5 m |
| Grupo sanguíneo | `sangre` | Uno de A±, B±, AB±, O± |
| Sexo biológico | `sexo` | `Femenino` o `Masculino` |

El sexo cambia el avatar y el catálogo de síntomas. Sin sexo no se muestra la
zona pélvica; al cambiarlo se retiran las molestias que dejan de existir.

## 2. Indicadores

Cinco secciones y **23 indicadores contados**. El resto de campos son auxiliares
(texto libre, metadatos o la vista previa de peso/estatura) y no suman progreso.

### 01 · Cardiovascular

| Indicador | Clave | Tipo | Cuenta |
| --- | --- | --- | --- |
| Frecuencia cardíaca en reposo | `fc_reposo` | número (bpm) | sí |
| Presión sistólica | `pa_sistolica` | número (mmHg) | sí |
| Presión diastólica | `pa_diastolica` | número (mmHg) | sí |
| Electrocardiograma | `ecg_estado` | selección | sí |
| Saturación de oxígeno | `spo2` | número (%) | sí |
| Observaciones del ECG | `ecg_informe` | texto | no |

### 02 · Óseo y muscular

| Indicador | Clave | Tipo | Cuenta |
| --- | --- | --- | --- |
| Densidad mineral ósea (DXA) | `densidad_osea` | número (g/cm²) | sí |
| Región DXA | `region_dxa` | selección | no |
| Masa muscular | `masa_muscular` | número (kg) | sí |
| Fuerza muscular | `fuerza_muscular` | número (kgf) | sí |
| Método de fuerza | `metodo_fuerza` | selección | no |

### 03 · Inmunológico

| Indicador | Clave | Tipo | Cuenta |
| --- | --- | --- | --- |
| Glóbulos blancos | `leucocitos` | número (/µL) | sí |
| Cortisol | `cortisol` | número (µg/dL) | sí |
| Momento de toma | `hora_cortisol` | selección | no |
| Marcadores inmunológicos | `marcadores_inmunes` | texto | sí |
| Hormonas de estrés | `hormonas_estres` | texto | sí |

Los dos campos de texto cuentan como «completados» cuando tienen contenido; el
motor no les asigna puntos.

### 04 · Psicológico

| Indicador | Clave | Tipo | Cuenta |
| --- | --- | --- | --- |
| Estrés percibido | `estres` | escala 0–10 | sí |
| Estado de ánimo | `estado_animo` | escala 0–10 | sí |
| Ansiedad percibida | `ansiedad` | escala 0–10 | sí |
| Duración del sueño | `sueno_horas` | número (h) | sí |
| Calidad del sueño | `sueno_calidad` | escala 0–10 | sí |
| Memoria | `memoria` | escala 0–10 | sí |
| Atención | `atencion` | escala 0–10 | sí |
| Concentración | `concentracion` | escala 0–10 | sí |

**Las escalas solo cuentan si la persona movió el control.** El valor inicial 5
es una posición visual, no una respuesta; por eso se guarda `ratingsTouched`.

### 05 · Neurológico

| Indicador | Clave | Tipo | Cuenta |
| --- | --- | --- | --- |
| Equilibrio | `equilibrio` | selección | sí |
| Coordinación | `coordinacion` | selección | sí |
| Tiempo de reacción | `reaccion_ms` | número (ms) | sí |

## 3. Progreso

`total = 5 (perfil) + 1 (sexo) + 23 (indicadores) = 29`.

El porcentaje es `round(((campos de perfil + sexo + indicadores completados) / 29) * 100)`.
Un campo vale como completo si no está vacío y no es un valor «pendiente».

## 4. Síntomas

33 síntomas únicos entre ambos sexos (25 en masculino, 26 en femenino). La zona
pélvica solo aparece al elegir sexo; el catálogo femenino reemplaza cabeza,
pecho y pelvis por listas específicas.

| Zona | Masculino | Femenino |
| --- | --- | --- |
| Cabeza | 4 | 5 |
| Ojos | 4 | 4 |
| Pecho | 4 | 4 («Pecho y Mamas») |
| Estómago | 5 | 5 |
| Pelvis | 4 | 4 |
| Extremidades | 4 | 4 |

Puntos por síntoma (los no listados valen 1):

| Puntos | Síntomas |
| --- | --- |
| 3 | Confusión · Dolor opresivo · Dificultad al respirar · Dolor en pecho · Falta de aire |
| 2 | Migraña · Visión borrosa · Palpitaciones · Dolor abdominal · Vómito · Dolor al orinar · Pesadez testicular · Dolor pélvico bajo |

Estado de una zona: `bad` con ≥ 3 puntos, `warn` con 1–2, `ok` con 0. Si no hay
síntomas ni datos asociados, `na`.

«Me siento en óptimas condiciones» es excluyente: al marcarlo se limpian los
síntomas, y al marcar un síntoma se desactiva.

## 5. Umbrales

Definidos en `src/data/severity.js` (`UMBRALES`). Se conservan los del prototipo
v2 para mantener la paridad.

| Ámbito | Advertencia (1 punto) | Grave (3 puntos) |
| --- | --- | --- |
| FC en reposo | < 60 o > 100 bpm | < 50 o > 120 bpm |
| Presión sistólica | ≥ 130, < 90 | ≥ 160, < 80 mmHg |
| Presión diastólica | ≥ 85, < 60 | ≥ 100 mmHg |
| SpO₂ | < 95 % | < 91 % |
| Densidad ósea | < 0,9 g/cm² | < 0,75 g/cm² |
| Fuerza | < 27 kgf (H) / 16 kgf (M) | < 70 % de esa referencia |
| Leucocitos | < 4 000 o > 11 000 /µL | < 3 500 o > 15 000 /µL |
| Cortisol | > 25 µg/dL | — |
| Escalas «altas» (estrés, ansiedad) | ≥ 6 | ≥ 8 |
| Escalas «bajas» (ánimo, sueño, memoria, atención, concentración) | ≤ 4 | ≤ 2 |
| Horas de sueño | < 6 o > 10 h | < 5 h |
| Tiempo de reacción | > 350 ms | > 500 ms |
| ECG | — | +2 puntos si «Con hallazgos por revisar» |
| Dificultad declarada | leve = 1 · moderada = 2 · intensa = 3 | — |

Reglas adicionales:

- IMC ≥ 30 → +1 a `pecho` y `extremidades` con la nota «IMC elevado».
- IMC < 18,5 → +1 a `estómago` con «IMC bajo».
- Edad ≥ 60 → +1 a `pecho` con la nota de edad.
- Los valores «Pendiente de…» y «Seleccionar…» **no** cuentan como medición.

### Sistemas y zonas

| Sistema | Campos | Zona resumen |
| --- | --- | --- |
| Cardiovascular | FC, PA, ECG, SpO₂ | Pecho |
| Óseo y muscular | DXA, masa, fuerza | Extremidades |
| Inmunológico | leucocitos, cortisol, marcadores, hormonas | — |
| Psicológico | escalas y sueño | — |
| Neurológico | equilibrio, coordinación, reacción | Cabeza |

El sistema psicológico **no** se suma a la zona «cabeza»: un estado de ánimo
bajo no convierte una cefalea en grave. Es una corrección respecto al prototipo.

Los sistemas inmunológico y psicológico no tienen zona resumen; se evalúan solo
como sistema y cuentan para el resultado global.

### Resultado global

Se toma el peor estado entre zonas y sistemas con datos (`na` no participa):

| Condición | Resultado |
| --- | --- |
| Ningún estado con datos | `unknown` → «SIN DATOS SUFICIENTES» |
| Alguno en `bad` | `bad` → «ALERTA GRAVE» |
| Alguno en `warn` | `warn` → «ADVERTENCIA» |
| Todos `ok` | `ok` → «ESTADO NOMINAL» |

El motor devuelve además `flags` (`perfil-incompleto`, `sin-mediciones`,
`sin-sintomas`, `pendientes`, `imc-alto`, `imc-bajo`, `edad-riesgo`,
`psico-grave`) para diagnóstico interno y futuras vistas.

## 6. Telemetría

Cuatro series: frecuencia cardíaca, saturación, presión sistólica y temperatura.

- Se dibujan solo si la medición existe (`hasData`); si no, la tarjeta queda
  vacía con el texto «Sin datos disponibles».
- La temperatura **nunca** tiene datos: el formulario no la registra. Se conserva
  la tarjeta para mantener la composición de cuatro paneles.
- Las bandas de normalidad usan los mismos umbrales de advertencia.
- La columna se rotula «TELEMETRÍA SIMULADA · ÚLTIMOS 60 S» para no confundir la
  variación visual con una medición en vivo.

## 7. Exportación JSON

Archivo: `ASTRA_registro_premision.json`.

```json
{
  "plataforma": "ASTRA - prototipo local",
  "fecha": "2026-11-15T03:45:00.000Z",
  "perfil": {
    "nombre": "Ana Ríos",
    "sexo": "Femenino",
    "edad": "36",
    "peso_kg": "68",
    "estatura_m": "1.68",
    "grupo_sanguineo": "O+"
  },
  "variables": [
    {
      "categoria": "CARDIOVASCULAR",
      "registros": [
        { "label": "Frecuencia cardíaca en reposo", "value": "72 bpm" },
        { "label": "Presión arterial", "value": "165/102 mmHg" },
        { "label": "Electrocardiograma (ECG)", "value": "Con hallazgos por revisar" },
        { "label": "Observaciones del ECG", "value": "—" },
        { "label": "Saturación de oxígeno (SpO₂)", "value": "96 %" }
      ]
    }
  ],
  "molestias": [{ "zona": "Cabeza", "molestia": "Confusión" }],
  "sinMolestias": false,
  "observaciones": "",
  "indicadoresCompletados": 9,
  "indicadoresPosibles": 23,
  "aviso": "Registro de datos autodeclarados o mediciones previas. No constituye diagnóstico ni aptitud para vuelo."
}
```

Reglas del contrato:

- Los valores ausentes se exportan como `"—"`, nunca como `0` ni como un valor
  inventado.
- Las escalas no movidas también se exportan como `"—"`.
- La presión se compone `sistólica/diastólica` solo si existen ambas.
- `molestias` guarda el nombre visible de la zona y el síntoma marcado.
- `fecha` es ISO 8601 en el momento de la descarga.
- Los typedefs viven en `src/data/schema.js`.

## 8. Límites conocidos

- Los umbrales son orientativos y no están validados clínicamente; el aviso del
  banner y del JSON lo declara.
- El IMC se muestra como categoría descriptiva para adultos; no se usa como
  diagnóstico ni como criterio de aptitud.
- La evaluación es determinista salvo el componente visual (curvas y estrellas).
- No hay persistencia: al recargar se pierde el registro, salvo que se descargue
  el JSON.
