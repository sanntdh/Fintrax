# FINTRAX · Registro Biomédico Premisión

Página única que integra la presentación FINTRAX, el registro biomédico habitual
y la captura de datos actuales con su evaluación. Muestra un avatar holográfico,
resultados por órganos y sistemas, y permite descargar ambos registros en JSON.

> **Aviso:** los datos son autodeclarados o mediciones previas. El resultado es
> informativo, no constituye diagnóstico ni determina aptitud para vuelo.

## Arranque

No hay build ni dependencias de ejecución. Basta con servir la carpeta por HTTP
(los módulos ES no funcionan con `file://`):

```bash
npm start          # http://localhost:5173
```

o cualquier servidor estático equivalente:

```bash
python3 -m http.server 5173
```

## Recorrido

1. Al abrir `index.html` desde el servidor se reproduce una vez la animación de
   `Fintrax Código Error.html` (10 segundos). Con movimiento reducido, el emblema
   se muestra estático durante 1,2 segundos.
2. **Etapa 1 · Datos habituales**, basada en `ASTRA_registro_etapa1.html`:
   completar los 35 campos y pulsar **COMENZAR ANÁLISIS**. El formulario se recorre
   por pasos (perfil y una sección médica por pantalla) con **Anterior** y
   **Siguiente**; la barra de pasos permite saltar a cualquiera.
3. **Etapa 2 · Datos actuales**, basada en `ASTRA_version2_con_resultados.html`:
   nombre, sexo, edad y grupo sanguíneo aparecen precargados y editables; peso,
   estatura, mediciones, molestias y observaciones se registran para el momento
   actual. Las molestias tienen su propio paso, justo después del perfil; tocar el
   holograma lleva a él. Completar sus 37 campos y pulsar **ANALIZAR DATOS ACTUALES**.
4. Tras la transición se muestra la revisión: órganos, gráficas, síntomas y el
   detalle de ambos registros en la pestaña **Registro**.

Todos los campos son obligatorios, incluidos metadatos y textos. En las escalas
se puede mover el control o pulsar **Confirmar 5/10** para aceptar el valor
central. En molestias se elige un síntoma o **Me siento en óptimas condiciones**;
las observaciones pueden indicar **Sin observaciones**.

**Editar datos habituales** y **Editar datos actuales** conservan las respuestas
de cada etapa. Los datos viven en memoria durante la visita; el botón de descarga
guarda las dos etapas en `FINTRAX_registro_premision.json`.

## Centro médico (backend)

La conexión es opcional: sin ella la evaluación es local. Arranca el backend
(rama `Backend`) permitiendo el origen del frontend:

```bash
MONITOREO_ADMIN_KEY=<clave> MONITOREO_CORS_ORIGINS=http://localhost:5173 uvicorn app.main:app --port 8000
```

En la barra superior, **CENTRO MÉDICO · SIN CONEXIÓN** abre el diálogo: URL del
backend y clave de API. La URL se recuerda en `localStorage` (también admite
`?api=`); la clave vive solo en `sessionStorage`. Si la clave no tiene ficha de
astronauta, se crea con el perfil al analizar.

Al pulsar **ANALIZAR DATOS ACTUALES** se envía el registro habitual como lectura
`preflight` (una vez por astronauta y sesión) y el actual como lectura `vuelo`,
con las molestias traducidas a `complementarios`. La franja **CENTRO MÉDICO
FINTRAX** de los resultados muestra el nivel, el NEWS2 y, plegadas, las
recomendaciones de los hallazgos que requieren evaluación.

## Pruebas

```bash
npm test           # node --test tests/
```

63 pruebas unitarias y estructurales: catálogo de datos, motor de evaluación,
cliente del backend y traducción de lecturas,
validación completa, orden de las etapas, conservación de registros, exportación
y contrato del HTML.

## Estructura

```
index.html               entrada única con los puntos de montaje (data-*)
assets/                  avatar en PNG/WebP y fuentes Orbitron/Rajdhani
src/css/                 tokens, base, layout, formulario, avatar, resultados, a11y
src/data/                catálogos puros: síntomas, métricas, gravedad, contenido
src/js/                  módulos ES: estado, motor, UI, gráficas, exportación
scripts/serve.mjs        servidor estático sin dependencias
scripts/extract-assets.mjs  extracción de assets desde el prototipo original
tests/                   pruebas con node:test
```

Documentación detallada:

- [`ARQUITECTURA.md`](ARQUITECTURA.md): capas, módulos, flujo de datos y decisiones.
- [`DATOS.md`](DATOS.md): catálogos, umbrales, algoritmo y contrato del JSON.
- [`PARIDAD.md`](PARIDAD.md): matriz de funcionalidades conservadas respecto al prototipo v2.

## Características

- Dos registros con formulario compartido (`src/data/metrics.js`): 5 secciones,
  25 indicadores médicos y 4 campos auxiliares, además del perfil.
- Avatar holográfico con zonas interactivas, conmutación por sexo y estados por color.
- Evaluación por zona y por sistema, con estado explícito «SIN DATOS» cuando no hay medición.
- Telemetría de cuatro series: solo se dibuja si existe una medición real.
- Tarjetas de orientación por síntoma (posible causa, qué hacer, señal de alarma).
- Exportación del registro a `FINTRAX_registro_premision.json`.
- Accesibilidad: foco visible, etiquetas, `aria-live`, navegación por teclado y
  respeto global de `prefers-reduced-motion`.

## Origen

Integración modular de `Fintrax Código Error.html`, `ASTRA_registro_etapa1.html`
y `ASTRA_version2_con_resultados.html`, disponibles como documentos de referencia.
