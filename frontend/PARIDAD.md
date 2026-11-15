# Paridad con el prototipo v2

Objetivo: conservar todas las funciones de `ASTRA_version2_con_resultados.html`
sin arrastrar sus defectos. El prototipo se mantiene intacto en el repositorio
como referencia; la aplicación modular vive en `index.html`.

Leyenda: **✅ conservada** · **🔧 conservada con corrección** · **➖ retirada con
justificación**.

## Matriz funcional

| # | Funcionalidad | Prototipo v2 | Implementación actual | Estado |
| --- | --- | --- | --- | --- |
| F1 | Perfil del astronauta (sexo, nombre, edad, peso, estatura, sangre) | Inputs estáticos con validación HTML | `form.js` + `state.profile`, validación propia con mensajes por campo | 🔧 |
| F2 | Avatar holográfico y conmutación por sexo | Una imagen base64 con `src` intercambiado | `avatar.js`, PNG + WebP con `<picture>`, dos instancias (formulario y resultados) | ✅ |
| F3 | Zonas interactivas sobre el avatar | SVG con grupos `.hot` y `syncHotspots()` | `avatar.js` genera hotspots con `role="button"` y activación por teclado | 🔧 |
| F4 | Chips de síntomas por zona y sexo | `SINTOMAS_BASE` / específicos, render con plantillas | `symptoms-ui.js` desde `symptoms.js`; mismas listas y misma exclusividad con «me siento bien» | ✅ |
| F5 | HUD del avatar (IMC, zonas marcadas, estado) | `imcVal`, `imcCategory`, `activeZonesCount`, `zonesStatusText` | `progress.js` con `data-imc-*`, `data-zone-count`, `data-zone-status` | ✅ |
| F6 | Progreso del registro | Barra y contador de campos | Barra, porcentaje y barra de pasos con el conteo de cada paso | 🔧 |
| F7 | Formulario de 5 secciones / 25 indicadores | HTML extenso con campos repetidos | `metrics.js` declarativo; el formulario se genera y comparte ids con el motor | 🔧 |
| F8 | Motor de evaluación | Dos definiciones de `evaluar` (una pisaba a la otra) | `evaluation.js` con una sola `evaluate()` pura y testeada | 🔧 |
| F9 | Banner de resultado con chips de perfil | `mostrar()` escribía el banner | `results.js`: título, texto con nombres y chips de perfil | ✅ |
| F10 | Estado de órganos y sistemas médicos | Tarjetas `.zone` y lista de sistemas | `results.js`: `.fintrax-organ` y `.fintrax-system`, seleccionables | ✅ |
| F11 | Avatar de resultados con estados y etiquetas | Clases `st-ok/warn/bad` y etiquetas SVG | `setStatuses()` pinta clases y etiquetas; glow por resultado global | ✅ |
| F12 | Tarjetas de orientación por síntoma | Causas, contexto, «qué hacer» y alertas | `symptoms-ui.js` con `CAUSAS`, `CTX`, `ACC`, `ALERTA`; además aviso de nivel grave | ✅ |
| F13 | Telemetría de cuatro series | `cfgCharts()` generaba siempre curvas aleatorias | `charts.js` + `configurarSeries()`: solo dibuja con medición real; estados vacíos | 🔧 |
| F14 | Overlay «analizando» | Barra con intervalos | `main.js` con progreso y respeto de movimiento reducido | ✅ |
| F15 | Exportación del registro | `collectData()` leía el DOM y generaba un `.txt`/JSON | `export.js` construye desde el estado y descarga `FINTRAX_registro_premision.json` | 🔧 |
| F16 | Volver al formulario conservando datos | Segundo formulario generado al volver, con pérdida potencial | `actions.volverAlFormulario()`: una sola vista, datos y síntomas intactos | 🔧 |

## Elementos transversales

| Elemento | Estado | Nota |
| --- | --- | --- |
| Fondo de estrellas con líneas y estrella fugaz | ✅ | `starfield.js`; pausa al ocultar la pestaña y no anima con movimiento reducido |
| Señales sonoras (clic, alerta, éxito) | ✅ | `audio.js`; contexto perezoso y fallo silencioso |
| Aviso flotante (toast) | ✅ | `toast.js`; reutiliza una instancia |
| Diseño responsive | ✅ | 1440 / 900 / 390 px sin desbordamiento horizontal |
| Foco visible y navegación por teclado | 🔧 | Foco unificado, hotspots accesibles, enlace de salto |
| `prefers-reduced-motion` | 🔧 | Cobertura global (antes solo el barrido) |
| Impresión | ✅ | Oculta fondo, overlay y panel del avatar |

## Correcciones aplicadas

1. **Psicológico ≠ neurológico.** Se eliminó el mapeo `['cabeza', 'psico']`: el
   estrés o el ánimo bajo afectan al sistema psicológico y al resultado global,
   pero no elevan la gravedad de una cefalea. Cubierto por
   `tests/evaluation.test.js`.
2. **Estado «sin datos».** Un sistema sin medición ya no se muestra en verde:
   queda en `na` («SIN DATOS»). `na` no participa en el resultado global, de modo
   que un formulario vacío devuelve `unknown`, no `ok`.
3. **Sin telemetría simulada.** Las curvas aleatorias del prototipo se sustituyen
   por una comparativa estática habitual/actual: no hay monitorización continua.
4. **Síntomas fuera del DOM oculto.** Los chips viven en el formulario y en la
   vista de resultados, no en un contenedor oculto que se movía entre paneles.
5. **Una sola definición de `evaluar` y `cfgCharts`.** El prototipo declaraba dos
   versiones; ahora hay `evaluate()` y `configurarSeries()`.
6. **`renderReport` muerto eliminado.** No quedan funciones sin llamadas.
7. **Sin `innerHTML` con datos de la persona.** Todo se construye con
   `textContent`; una prueba estructural recorre `src/js/*.js`.
8. **Sin manejadores inline ni globales.** No hay `onclick` ni `window.ASTRA_*`;
   el estado sustituye a los globales del prototipo.
9. **Escalas no respondidas.** El valor visual 5 no cuenta como respuesta: se
   registra `ratingsTouched` y la exportación usa «—».
10. **Cambio de sexo coherente.** Al cambiar de sexo se retiran las molestias que
    dejan de existir, evitando selecciones invisibles.
11. **Movimiento reducido global.** Barrido, radar, estrellas, transiciones y
    desplazamiento suave se desactivan con la preferencia del sistema.

## Diferencias visuales deliberadas

- Tipografía y paleta se conservan; el CSS se reescribe encapsulado bajo
  `#fintrax-app` y con tokens.
- El avatar usa imágenes locales (PNG/WebP) en lugar de base64 embebido, lo que
  reduce el HTML y permite caché.
- Las tarjetas sin datos muestran «Sin datos disponibles» en lugar de una curva
  decorativa.
- El panel del formulario mantiene el barrido de escaneo, pero con bordes
  desvanecidos para que no se lea como un bloque rectangular.

## Verificación

| Prueba | Resultado |
| --- | --- |
| `node --test tests/` | 39/39 |
| E2E (Playwright + Chrome, 1440 y 390 px) | FINTRAX → habituales → actuales → análisis → resultados → edición; validación completa, movimiento reducido y cambio de sexo, sin `pageerror` ni recursos fallidos |
| Descarga | `FINTRAX_registro_premision.json` válido, con los dos registros y sus valores independientes |
| Responsive | 1440 y 390 px sin overflow; 7 órganos y 4 gráficas |
| Accesibilidad básica | Foco visible, `aria-live`, hotspots con teclado, `prefers-reduced-motion` |

## Pendientes conscientes

- No hay persistencia entre recargas (solo exportación manual).
- Los umbrales son orientativos y requieren revisión clínica antes de cualquier
  uso real.
- La comparativa muestra dos mediciones puntuales, no una captura en vivo de
  sensores.
