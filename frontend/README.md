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
node --test        # desde frontend/, con Node 22
```

46 pruebas unitarias y estructurales: catálogo de datos, motor de evaluación,
contrato del HTML, cliente HTTP y contrato de lecturas, pasos de línea base y
misión, y series del historial. La clave y las funciones puras se prueban con
`fetch` y almacenes simulados, sin navegador.

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

## Enlace con el backend de monitoreo

El cálculo local es **orientación por zonas** y así queda etiquetado («Orientación
local, no resultado oficial»). El nivel clínico (NEWS2 y capas de riesgo) lo
emite el backend y la interfaz lo muestra sin reinterpretarlo.

Pasos en la pantalla **Enlace con el backend**:

1. **Conexión.** Indica la URL del backend (`http`/`https`, sin credenciales) y
   la clave `X-API-Key`. La clave se guarda solo en `sessionStorage` de esa
   pestaña; la URL puede venir además de `?api=` o de `localStorage`.
2. **Astronauta.** Elige uno de la lista que devuelve el backend o escribe su id.
3. **Paso 1 · Línea base.** Registra las cinco lecturas en reposo (FC, PAS, FR,
   temperatura y SpO₂) y envíalas: cada una viaja por separado con contexto
   `preflight`, sin complementarios. El borrador se conserva si un envío falla y
   el reintento continúa desde la primera lectura fallida (no reenvía las ya
   aceptadas). El botón **Calcular línea base** está disponible para médico y
   administrador (el servidor autoriza); si faltan muestras, muestra el conteo
   del error 409.
4. **Paso 2 · Misión.** Registra una lectura en vuelo. Los siete complementarios
   solo se activan con síntomas nombrados explícitamente o con los checkboxes
   dedicados (una escala baja sin confirmación no infiere nada; un mareo genérico
   no implica síntomas al incorporarse). El resultado oficial (nivel, desglose
   NEWS2, capas, alertas, notas y su fecha) aparece al pie; registrar otra misión
   invalida el anterior y un error no deja un resultado viejo en pantalla.

Cambiar de astronauta o de conexión descarta el borrador, el historial, la línea
base y el resultado anterior: el borrador es por astronauta y no persiste PHI.

Las gráficas de resultados se alimentan del historial y de la línea base del
backend: no generan datos aleatorios y muestran «sin datos» cuando no hay
lecturas.

> **Seguridad:** nunca se escribe la clave en el repositorio, en la URL ni en
> `localStorage`. El cliente no abre el backend sin clave y omite credenciales de
> navegador, por lo que el CORS del backend puede seguir siendo restrictivo.

## Características

- Formulario generado desde datos (`src/data/metrics.js`): 5 secciones y 23 indicadores contados.
- Avatar holográfico con zonas interactivas, conmutación por sexo y estados por color.
- Evaluación por zona y por sistema, con estado explícito «SIN DATOS» cuando no hay medición.
- Enlace con el backend: línea base (cinco lecturas en reposo) y lectura de misión, con resultado oficial NEWS2 y complementarios.
- Gráficas del historial oficial (NEWS2 y signos frente a la línea base); sin datos aleatorios ni curvas inventadas.
- Tarjetas de orientación por síntoma (posible causa, qué hacer, señal de alarma).
- Exportación del registro a `ASTRA_registro_premision.json`.
- Accesibilidad: foco visible, etiquetas, `aria-live`, navegación por teclado y
  respeto global de `prefers-reduced-motion`.

## Origen

Integración modular de `ASTRA_version2_con_resultados.html`, que se conserva en
el repositorio como referencia histórica. El prototipo original no se modifica.
