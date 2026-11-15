# Arquitectura

## Principio general

`index.html` es la única página. Todo lo demás son módulos ES nativos que el
navegador carga sin empaquetar ni transpilar. No hay dependencias de ejecución,
ni framework, ni paso de build: `npm start` solo sirve archivos estáticos.

La aplicación se monta bajo `#fintrax-app`. Nada se cuelga de `window` y ningún
módulo lee el valor de un control para decidir: el **estado** es la fuente de
verdad y el DOM es una proyección de ese estado.

## Capas

```
index.html
  ├─ src/css/*.css        presentación (encapsulada bajo #fintrax-app)
  └─ src/js/main.js       composición
        ├─ src/data/*     catálogos constantes y puros
        ├─ state.js       estado + acciones + suscripciones
        ├─ validation.js  validación de todos los campos y progreso
        ├─ evaluation.js  motor puro (sin DOM)
        ├─ intro.js       animación FINTRAX de un ciclo + fintrax-background.js
        └─ UI             form · symptoms-ui · progress · avatar · results · acciones · comparativa
                          export · toast · audio · starfield
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
`wellBeing`, `otherText`, `step`, `activeRecord`, `records`, `result` y `exportData`.
Los campos superiores son el borrador activo. `records.baseline` y
`records.current` conservan copias independientes de perfil, valores y conjuntos
al cambiar de etapa. `copiarRegistro()` evita compartir objetos o `Set` entre
registros.

- `subscribe(fn)` registra una vista; `emit()` notifica a todas.
- `actions.*` son las únicas mutaciones (`setProfile`, `setValue`, `setRating`,
  `setSymptom`, `setWellBeing`, `setOtherText`, `completarHabituales`,
  `comenzarAnalisis`, `terminarAnalisis`, `setResult`…).
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
- `isFilled` / `isPending`: qué cuenta como dato y qué es «pendiente».

Las zonas se calculan sumando síntomas y los sistemas asociados
(`cardio→pecho`, `osteo→extremidades`, `neuro→cabeza`). Un sistema sin datos
reales queda en `na`; una zona sin síntomas ni sistemas con datos también. El
resultado global solo considera estados con datos, por lo que `na` nunca
degrada ni mejora el resultado.

### Interfaz (`src/js/`)

| Módulo | Responsabilidad |
| --- | --- |
| `main.js` | Compone todo, crea los avatares, controla la secuencia, ejecuta el análisis actual y la exportación. |
| `intro.js`, `fintrax-background.js` | Reproducen el SVG y el fondo originales de FINTRAX; liberan animaciones, temporizadores y listeners al terminar. |
| `api.js` | Cliente HTTP del backend (clave en `sessionStorage`) y traducción perfil/lecturas/evaluación. |
| `sw.js` (raíz) | Service worker PWA: precarga de toda la app, caché con actualización en segundo plano y `config.json` primero de la red. |
| `centro.js` | Conexión opcional con el centro médico: diálogo, envío de lecturas y franja de resultados. |
| `form.js` | Genera las secciones desde `metrics.js`, las muestra como pasos (un bloque por pantalla, `irAPaso`), restaura el borrador de cada etapa, valida y envía. |
| `validation.js` | Valida perfil, cada medición, metadatos, confirmaciones de escalas y respuesta de molestias; calcula el progreso. |
| `symptoms-ui.js` | Construye chips en formulario y resultados, sincroniza selección y pinta tarjetas de orientación. |
| `progress.js` | Barra, desglose por sección, IMC, zonas marcadas, conteo de molestias y cabecera del escaneo. |
| `avatar.js` | Crea el avatar (imagen + hotspots SVG) y expone `setSex`, `setActive`, `setSelection`, `setGlow`, `setStatuses`. |
| `results.js` | Banner, órganos, sistemas, integración con avatar y gráficas. |
| `acciones.js` | «Qué hacer»: acciones con fuente y página según molestias y sistemas; aviso urgente (protocolo Fintrax). |
| `comparativa.js` | Comparativa estática habitual/actual en SVG; anomalías por rango o por cambio notable. |
| `export.js` | Construye y descarga el JSON de ambas etapas desde el estado. |
| `toast.js`, `audio.js`, `starfield.js` | Aviso flotante, señales sonoras opcionales y fondo animado. |
| `dom.js`, `format.js` | Utilidades sin estado: creación segura de nodos, delegación, formato numérico y de IMC. |

## Flujo de datos

```
control → actions.setX() → estado → emit()
                                   ├─ progress  (barra, IMC, zonas)
                                   ├─ symptoms-ui (chips + tarjetas)
                                   ├─ form (vista previa)
                                   ├─ avatar (sexo, zonas activas)
                                   └─ main (vista y resultado)

intro → terminarIntro → baseline
submit habitual → validar todos los campos → completarHabituales → current
submit actual → validar todos los campos → evaluate(snapshot actual)
              → comenzarAnalisis → transition → terminarAnalisis → body
              → results.render(result) → acciones.update() · comparativa.update()
```

`main.js` guarda una firma del estado relevante. Mientras la vista sea
«resultados», solo recalcula cuando esa firma cambia; si no, vuelve a pintar con
el resultado ya calculado. Así marcar un síntoma en la vista de resultados
actualiza banner, órganos, avatar y tarjetas sin recalcular dos veces.

## Vistas

`#fintrax-app[data-step]` controla cinco estados: `intro`, `baseline`, `current`,
`transition` y `body`. Se reutiliza un formulario para los dos registros, con
identificadores únicos. Las molestias y observaciones se muestran en `current`.
El primer envío guarda la referencia y abre el segundo registro; solo el segundo
envío válido inicia la evaluación y la revisión final.

Las acciones de navegación comprueban la etapa y su validación antes de avanzar.
Desde resultados se vuelve a los datos actuales, y desde allí se pueden editar
los habituales; cada borrador conserva sus valores y las escalas confirmadas.
La pestaña Registro muestra el perfil y las cinco secciones de ambas capturas.

El avatar se crea **dos veces** (formulario y resultados) en lugar de mover el
nodo entre paneles. Cada instancia tiene su propio SVG y comparte coordenadas y
catálogo, lo que evita perder estado y simplifica el responsive.

## Decisiones de implementación

1. **Sin build.** Módulos ES nativos y un servidor estático de ~70 líneas. El
   `package.json` solo declara `start` y `test`.
2. **CSS encapsulado.** Todas las reglas parten de `#fintrax-app`; los tokens
   viven en `tokens.css`. Los selectores se apoyan en hooks `data-*`.
3. **IDs con prefijo `fintrax-`.** Evita colisiones y deja claro qué pertenece a
   la aplicación.
4. **Sin `innerHTML`.** `dom.js` construye nodos con `textContent`, de modo que
   ningún dato de la persona usuaria se interpreta como HTML. Hay una prueba
   estructural que lo verifica.
5. **Estado explícito «sin datos».** Un sistema sin medición no es «BIEN»: es
   `na`. La comparativa tampoco inventa valores: sin medición no hay estado.
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

- El fondo FINTRAX se detiene al terminar la presentación; entonces arranca el
  campo de estrellas del registro, pausado al ocultar la pestaña.
- Gráficas redibujadas solo al actualizar datos o al cambiar de tamaño.
- `ResizeObserver` en las tarjetas; sin listeners globales de scroll.
- La carga usa HTML, CSS y módulos nativos, imágenes WebP y fuentes locales.
