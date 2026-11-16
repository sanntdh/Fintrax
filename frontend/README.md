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
   completar los 34 campos y pulsar **COMENZAR ANÁLISIS**. El formulario se recorre
   por pasos (perfil y una sección médica por pantalla) con **Anterior** y
   **Siguiente**; la barra de pasos permite saltar a cualquiera.
3. **Etapa 2 · Datos actuales**, basada en `ASTRA_version2_con_resultados.html`:
   solo pide lo que puede cambiar de un día para otro, en 4 pasos y 19 campos:
   molestias (primero; tocar el holograma lleva a ellas), signos vitales,
   psicológico y neurológico. El perfil y los datos de hueso, músculo y
   laboratorio (`soloHabitual` en `metrics.js`) se copian del registro habitual,
   de modo que la evaluación, el JSON y el backend los siguen recibiendo. Pulsar
   **ANALIZAR DATOS ACTUALES**.
4. Tras la transición se muestra la revisión: órganos, gráficas, síntomas y el
   detalle de ambos registros en la pestaña **Registro**.

Todos los campos son obligatorios salvo los datos de laboratorio (densidad ósea,
glóbulos blancos, cortisol, marcadores y hormonas), que se marcan «(opcional)»:
si se rellenan, se validan igual. En las escalas
se puede mover el control o pulsar **Confirmar 5/10** para aceptar el valor
central. En molestias se elige un síntoma o **Me siento en óptimas condiciones**;
las observaciones actuales son opcionales. Ningún campo obligatorio pide texto
libre: los resultados de laboratorio se eligen entre *Dentro de rango*, *Fuera de
rango* y *No disponible*.

**Editar datos habituales** y **Editar datos actuales** conservan las respuestas
de cada etapa. Los datos viven en memoria durante la visita; el botón de descarga
guarda las dos etapas en `FINTRAX_registro_premision.json`.

## App instalable y sin conexión (PWA)

Fintrax es una PWA: `manifest.webmanifest` la hace instalable y `sw.js` guarda
todos sus archivos la primera vez que se abre desde el servidor (o https). A
partir de ahí abre y funciona sin red: formulario, evaluación local, «Qué hacer»
y comparativa. Sin enlace, el centro médico muestra **SIN ENLACE** y ofrece
**Reintentar**.

- **Instalar:** en Chrome, Edge o Chromium, botón de instalar de la barra de
  direcciones; en Android, «Añadir a pantalla de inicio». Firefox de escritorio
  usa la caché sin conexión pero no instala la app.
- **Actualizar:** la app responde desde la caché y descarga los cambios en
  segundo plano; se ven en la siguiente apertura. Para forzar una recarga completa
  se cambia `VERSION` en `sw.js`.
- **Al añadir o quitar archivos** de `src/` o `assets/` hay que actualizar
  `PRECACHE` en `sw.js`; `tests/pwa.test.js` falla si falta alguno.

## Desplegar en Vercel

El frontend es estático: Vercel lo sirve sin compilar. `vercel.json` fija
`framework: null` (preset «Other») y las cabeceras; `.vercelignore` deja fuera
`config.json` (lleva la clave del equipo), las pruebas, los scripts y los HTML de
referencia: se publican unos 680 KB.

1. En Vercel, **Add New → Project** e importa el repositorio de GitHub.
2. **Root Directory**: `frontend`. **Framework Preset**: Other. Sin Build
   Command ni Output Directory. **Production Branch**: `main`.
3. Deploy. Alternativa por terminal: `cd frontend && npx vercel` (vista previa)
   y `npx vercel --prod`.

Cabeceras de `vercel.json`:

- **CSP**: solo scripts propios (`script-src 'self'`); conexiones al propio sitio,
  a cualquier backend `https:` y a `localhost`; sin incrustación en otros sitios.
  Los estilos en línea están permitidos porque el SVG del logo y el avatar los usan.
- `sw.js` y `config.json` con `max-age=0`: una versión nueva llega sin quedar
  retenida en el CDN.

**Backend.** No se despliega en Vercel tal como está: usa SQLite en un archivo y
una tarea periódica, y las funciones de Vercel no tienen disco persistente ni
procesos permanentes. Opciones: un servicio con proceso y disco (Render, Railway,
Fly.io) o PostgreSQL gestionado (`MONITOREO_DB=postgresql+psycopg://…`; el backend
ya incluye `psycopg`). Debe servirse por **https** y añadir el dominio de Vercel a
`MONITOREO_CORS_ORIGINS` (p. ej. `https://fintrax.vercel.app`).

Sin `config.json`, la versión publicada conecta desde el diálogo (pulsando el
indicador). Una página publicada que conecte con un backend en `localhost` queda
sujeta a la protección de red local del navegador, que puede pedir permiso o
bloquearla: para demostraciones públicas, usa un backend https.

## Centro médico (backend)

La conexión es opcional: sin ella la evaluación es local. Arranca el backend
(rama `Backend`) permitiendo el origen del frontend:

```bash
MONITOREO_ADMIN_KEY=<clave> MONITOREO_CORS_ORIGINS=http://localhost:5173 uvicorn app.main:app --port 8000
```

**En un equipo de a bordo la tripulación no configura nada.** Operaciones copia
`config.example.json` como `config.json` (no se versiona: lleva la clave del
equipo) y rellena el backend, la clave y, si se quiere, `astronautaId`. Al abrir,
la página conecta sola; el indicador de arriba muestra **EN LÍNEA**, **SIN
ENLACE** o **CONECTANDO…**, y al pulsarlo reintenta. Si un análisis se hace sin
enlace, queda en local y la franja ofrece **Reintentar**.

El diálogo de URL y clave es solo para mantenimiento: aparece en equipos sin
`config.json` o abriendo la página con `?mantenimiento`. Prioridad del backend:
`?api=` > `config.json` > URL guardada a mano. Una clave escrita en el diálogo
vive solo en `sessionStorage`. Si la clave no tiene ficha de astronauta, se crea
con el perfil al analizar.

Al pulsar **ANALIZAR DATOS ACTUALES** se envía el registro habitual como lectura
`preflight` (una vez por astronauta y sesión) y el actual como lectura `vuelo`,
con las molestias traducidas a `complementarios`. La franja **CENTRO MÉDICO
FINTRAX** de los resultados muestra el nivel, el NEWS2 y, plegadas, las
recomendaciones de los hallazgos que requieren evaluación.

## Pruebas

```bash
npm test           # node --test tests/
```

67 pruebas unitarias y estructurales: catálogo de datos, motor de evaluación,
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
- **Qué hacer** (pestaña inicial): acciones según molestias y sistemas
  alterados, cada una con fuente y página (`src/data/acciones.js`): EXON y FISIO
  para mareo, músculo, hueso y defensas; documentos públicos de NASA, enlazados,
  para visión, sueño y ánimo (ver «Fuentes de NASA» en `docs/FUENTES.md`).
- **Comparativa** estática habitual frente a actual de seis indicadores, con las
  anomalías primero. No hay telemetría: Fintrax no monitoriza de forma continua.
- Tarjetas de orientación por síntoma (posible causa, qué hacer, señal de alarma).
- Exportación del registro a `FINTRAX_registro_premision.json`.
- Accesibilidad: foco visible, etiquetas, `aria-live`, navegación por teclado y
  respeto global de `prefers-reduced-motion`.

## Origen

Integración modular de `Fintrax Código Error.html`, `ASTRA_registro_etapa1.html`
y `ASTRA_version2_con_resultados.html`, disponibles como documentos de referencia.
