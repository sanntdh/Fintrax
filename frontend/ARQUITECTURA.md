# Arquitectura

## Principio general

`index.html` es la única página. Todo lo demás son módulos ES nativos que el
navegador carga sin empaquetar ni transpilar. No hay dependencias de ejecución,
ni framework, ni paso de build: `npm start` solo sirve archivos estáticos.

La aplicación se monta bajo `#astra-app`. Nada se cuelga de `window` y ningún
módulo lee el valor de un control para decidir: el **estado** es la fuente de
verdad y el DOM es una proyección de ese estado.

## Capas

```
index.html
  ├─ src/css/*.css        presentación (encapsulada bajo #astra-app)
  └─ src/js/main.js       composición
        ├─ src/data/*     catálogos constantes y puros
        ├─ state.js       estado + acciones + suscripciones
        ├─ evaluation.js  motor puro (sin DOM)
        ├─ api.js         cliente HTTP + contrato de lecturas (sin DOM)
        └─ UI             form · symptoms-ui · progress · avatar · results · charts
                          backend-panel · export · toast · audio · starfield
```

### Datos (`src/data/`)

| Módulo | Contenido |
| --- | --- |
| `symptoms.js` | Síntomas base y específicos por sexo, nombres de zona, helpers `zonasPara`, `listaSintomas`, `sintomaValido`. |
| `severity.js` | Puntos por síntoma, sistemas, estados (`ok/warn/bad/na`), dificultad declarada, valores «pendientes» y umbrales clínicos. |
| `metrics.js` | Definición declarativa de las 5 secciones y sus campos; deriva `FIELD_IDS`, `COUNTED_IDS`, `RATING_IDS`, `AUX_IDS` y `COUNTED_BY_SECTION`. |
| `content.js` | Causas orientativas, acciones, señales de alarma, contexto por zona y mensajes del banner. |
| `groups.js` | Agrupación y etiquetas de los datos que se exportan. |
| `schema.js` | Constantes del registro y typedefs del contrato JSON/estado. |

Los catálogos no importan nada de la interfaz. Se pueden probar con `node:test`
sin navegador.

### Estado (`src/js/state.js`)

Un único objeto mutable con `profile`, `values`, `ratingsTouched`, `symptoms`,
`wellBeing`, `otherText`, `view`, `result` y `exportData`.

- `subscribe(fn)` registra una vista; `emit()` notifica a todas.
- `actions.*` son las únicas mutaciones (`setProfile`, `setValue`, `setRating`,
  `setSymptom`, `setWellBeing`, `setOtherText`, `setView`, `setResult`…).
- Al cambiar `sexo` se podan las molestias que ya no existen en el catálogo de
  ese sexo, para no dejar selecciones invisibles.
- Marcar un síntoma desactiva «me siento en óptimas condiciones», y viceversa.

No hay observadores del DOM ni lectura de inputs: un control escribe con una
acción y la vista se vuelve a pintar desde el estado.

### Motor (`src/js/evaluation.js`)

Funciones puras:

- `evaluate(input)`: recibe un snapshot (`profile`, `values`, `symptoms`,
  `ratingsTouched`, `wellBeing`) y devuelve zonas, sistemas, estado global, IMC,
  banderas de completitud y conteos.
- `configurarSeries(result)`: define las cuatro series de telemetría y si cada
  una tiene medición real (`hasData`).
- `isFilled` / `isPending`: qué cuenta como dato y qué es «pendiente».

Las zonas se calculan sumando síntomas y los sistemas asociados
(`cardio→pecho`, `osteo→extremidades`, `neuro→cabeza`). Un sistema sin datos
reales queda en `na`; una zona sin síntomas ni sistemas con datos también. El
resultado global solo considera estados con datos, por lo que `na` nunca
degrada ni mejora el resultado.

### Interfaz (`src/js/`)

| Módulo | Responsabilidad |
| --- | --- |
| `main.js` | Compone todo, crea los dos avatares, conmuta vistas, ejecuta el análisis y la exportación. |
| `form.js` | Genera perfil y secciones desde `metrics.js`, valida y envía. |
| `symptoms-ui.js` | Construye chips en formulario y resultados, sincroniza selección y pinta tarjetas de orientación. |
| `progress.js` | Barra, desglose por sección, IMC, zonas marcadas, conteo de molestias y cabecera del escaneo. |
| `avatar.js` | Crea el avatar (imagen + hotspots SVG) y expone `setSex`, `setActive`, `setSelection`, `setGlow`, `setStatuses`. |
| `results.js` | Banner, órganos, sistemas, integración con avatar y gráficas. |
| `charts.js` | Gráficas del historial oficial (NEWS2 y signos frente a la línea base) y dibujo responsive. |
| `api.js` | Cliente HTTP del backend: URL base, clave, errores y contrato de las lecturas. |
| `backend-panel.js` | Pasos de línea base y misión contra la API; nunca decide el nivel clínico. |
| `export.js` | Construye y descarga el JSON desde el estado. |
| `toast.js`, `audio.js`, `starfield.js` | Aviso flotante, señales sonoras opcionales y fondo animado. |
| `dom.js`, `format.js` | Utilidades sin estado: creación segura de nodos, delegación, formato numérico y de IMC. |

### Enlace con el backend (`api.js` + `backend-panel.js`)

El cálculo local (`evaluation.js`) sigue siendo **orientación por zonas**, con
la etiqueta visible «Orientación local, no resultado oficial». El nivel clínico
lo decide siempre el backend y se muestra tal cual llega; si la API falla o no
hay conexión, no se sustituye por el resultado local.

Decisiones:

1. **Transporte aislado.** `api.js` concentra la URL base, la clave, el mapeo de
   errores y el contrato de las lecturas. Recibe `fetch` y los almacenes por
   inyección, de modo que sus funciones puras se prueban con `node:test` sin
   navegador.
2. **La clave vive solo en `sessionStorage`.** Nunca se escribe en
   `localStorage`, en la URL ni en el repositorio. La URL base sí puede venir de
   `?api=` o de `localStorage`, pero siempre validada: solo `http`/`https`, sin
   credenciales embebidas, sin query ni fragmento.
3. **No hay backend anónimo.** Sin clave configurada el cliente no abre ninguna
   conexión. Las peticiones usan `credentials: 'omit'`, así que un CORS con
   comodín nunca viaja con cookies.
4. **Errores en español.** 401/403/409/422 (y 404/red) se traducen a mensajes
   claros; el 409 de la línea base conserva el conteo («faltan N muestras») tal
   como lo entrega el backend. Un fallo nunca borra el borrador ni simula éxito,
   y una respuesta 200 sin JSON válido (HTML, JSON roto o vacío) se rechaza con
   un error explícito en lugar de devolverse como `null`.
5. **Pasos explícitos.** El panel ofrece la conexión, la selección de astronauta
   (por lista o por id, sin inventar un «whoami»), cinco lecturas de línea base
   enviadas una a una con contexto `preflight` (sin complementarios ni
   ejercicio), el botón de cálculo (solo médico/admin en la interfaz; el servidor
   autoriza) y la lectura de misión. La cantidad real enviada se conserva aunque
   falle una lectura, de modo que el reintento continúa desde la primera fallida
   y un segundo clic concurrente no duplica envíos. Cambiar de astronauta o de
   conexión descarta borradores, historial, línea base y resultado oficial del
   paciente anterior (el borrador es por astronauta y no persiste PHI), y las
   respuestas asíncronas se aceptan solo si su generación e identidad siguen
   vigentes. Registrar otra misión invalida el resultado anterior y el oficial
   siempre muestra su fecha; sin JSON no hay resultado.
6. **Mapeo de síntomas a complementarios.** Los siete booleanos
   (`cambio_visual`, `sintomas_al_incorporarse`, `alteracion_sueno`,
   `alteracion_animo`, `dificultad_cognitiva`, `mareo_desorientacion`,
   `evaluacion_inmune_anormal`) solo se activan con síntomas nombrados
   explícitamente o con los checkboxes dedicados. Una escala subjetiva baja sin
   confirmación no activa ninguna bandera (no se valida ningún umbral de escala),
   y un síntoma no marcado queda como desconocido (`null`, se omite), nunca como
   negativo. Un mareo o vértigo genérico activa `mareo_desorientacion`, pero NO
   `sintomas_al_incorporarse`: ese flag solo lo activa el checkbox posicional
   explícito. La última bandera solo se activa con su checkbox (informe de
   laboratorio interpretado), no se deduce por fatiga.
7. **Gráficas con datos reales.** `charts.js` se alimenta de `GET /historial` y
   de `GET /linea-base`: NEWS2 y los cinco signos ordenados por tiempo, con la
   línea base como referencia. Se eliminaron los temporizadores y los valores
   aleatorios del prototipo; un dato ausente queda en `null` y no se inventa.
8. **CORS.** El backend habilita CORS solo si `MONITOREO_CORS_ORIGINS` declara
   orígenes concretos; vacío equivale a sin CORS y nunca se combina `*` con
   credenciales. El frontend no envía credenciales de navegador.

## Flujo de datos

```
control → actions.setX() → estado → emit()
                                   ├─ progress  (barra, IMC, zonas)
                                   ├─ symptoms-ui (chips + tarjetas)
                                   ├─ form (vista previa)
                                   ├─ avatar (sexo, zonas activas)
                                   └─ main (vista y resultado)

submit → validar perfil → evaluate(snapshot) → setResult → setView('results')
       → results.render(result) → charts.update(configurarSeries(result))
```

`main.js` guarda una firma del estado relevante. Mientras la vista sea
«resultados», solo recalcula cuando esa firma cambia; si no, vuelve a pintar con
el resultado ya calculado. Así marcar un síntoma en la vista de resultados
actualiza banner, órganos, avatar y tarjetas sin recalcular dos veces.

## Vistas

Una sola sección de resultados en el DOM, oculta por CSS hasta que
`#astra-app[data-view="results"]`. Volver al formulario conserva perfil,
mediciones y síntomas; solo descarta `result`, que se recalcula al enviar de
nuevo.

El avatar se crea **dos veces** (formulario y resultados) en lugar de mover el
nodo entre paneles. Cada instancia tiene su propio SVG y comparte coordenadas y
catálogo, lo que evita perder estado y simplifica el responsive.

## Decisiones de implementación

1. **Sin build.** Módulos ES nativos y un servidor estático de ~70 líneas. El
   `package.json` solo declara `start` y `test`.
2. **CSS encapsulado.** Todas las reglas parten de `#astra-app`; los tokens
   viven en `tokens.css`. Los selectores se apoyan en hooks `data-*`.
3. **IDs con prefijo `astra-`.** Evita colisiones y deja claro qué pertenece a
   la aplicación.
4. **Sin `innerHTML`.** `dom.js` construye nodos con `textContent`, de modo que
   ningún dato de la persona usuaria se interpreta como HTML. Hay una prueba
   estructural que lo verifica.
5. **Estado explícito «sin datos».** Un sistema sin medición no es «BIEN»: es
   `na`. La telemetría tampoco inventa curvas.
6. **Formulario generado.** Añadir un indicador es editar `metrics.js`; el
   formulario, el progreso, la evaluación y la exportación lo recogen.
7. **Assets locales.** Avatar en PNG con `<picture>`/WebP y fuentes
   autohospedadas; no hay peticiones a terceros.
8. **Movimiento opcional.** `prefers-reduced-motion` detiene barrido, radar,
   estrellas, transiciones y desplazamientos suaves a nivel global.

## Accesibilidad

- Enlace de salto, jerarquía de encabezados y `aria-label` en paneles.
- Hotspots del avatar como `role="button"` con `tabindex` y activación por
  Enter/Espacio.
- Errores de validación con `aria-invalid` y mensajes `aria-live`.
- Contraste reforzado en textos auxiliares respecto al prototipo.
- Estados nunca comunicados solo por color: cada uno lleva etiqueta textual.

## Cómo extender

**Nuevo indicador:** añadir el campo a `metrics.js` con `counted: true` (o
`false` si es texto libre), incluirlo en `SISTEMA_CAMPOS` de `evaluation.js` si
alimenta un sistema y en `REPORT_GROUPS` si debe exportarse. Actualizar
`tests/data.test.js` si cambia el total de 23.

**Nuevo síntoma:** añadirlo a `symptoms.js`, su causa en `CAUSAS`, su acción en
`ACC` y, si aplica, su puntuación en `SEVERIDAD_SINTOMAS`. Los tests verifican
que no queden síntomas sin causa.

**Nuevo sistema:** declarar etiqueta en `SISTEMAS`, campos en `SISTEMA_CAMPOS` y,
si resume una zona, el par en `SISTEMA_A_ZONA`.

## Rendimiento

- Un único `requestAnimationFrame` para el fondo, pausado al ocultar la pestaña.
- Gráficas redibujadas solo al actualizar datos o al cambiar de tamaño.
- `ResizeObserver` en las tarjetas; sin listeners globales de scroll.
- Sin dependencias: la carga inicial se limita a HTML, 8 CSS, ~15 módulos,
  2 WebP y 4 fuentes.
