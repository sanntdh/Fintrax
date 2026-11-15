# ASTRA · Registro Biomédico Premisión

Prototipo local de registro y evaluación orientativa pre-misión. La persona
usuaria completa un perfil y una batería de indicadores; la aplicación resume el
estado por zona corporal y por sistema médico, muestra un avatar holográfico y
permite descargar el registro en JSON.

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

## Pruebas

```bash
npm test           # node --test tests/
```

20 pruebas unitarias y estructurales: catálogo de datos, motor de evaluación,
contrato del HTML y ausencia de `innerHTML`/manejadores inline.

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

- Formulario generado desde datos (`src/data/metrics.js`): 5 secciones y 23 indicadores contados.
- Avatar holográfico con zonas interactivas, conmutación por sexo y estados por color.
- Evaluación por zona y por sistema, con estado explícito «SIN DATOS» cuando no hay medición.
- Telemetría de cuatro series: solo se dibuja si existe una medición real.
- Tarjetas de orientación por síntoma (posible causa, qué hacer, señal de alarma).
- Exportación del registro a `ASTRA_registro_premision.json`.
- Accesibilidad: foco visible, etiquetas, `aria-live`, navegación por teclado y
  respeto global de `prefers-reduced-motion`.

## Origen

Integración modular de `ASTRA_version2_con_resultados.html`, que se conserva en
el repositorio como referencia histórica. El prototipo original no se modifica.
