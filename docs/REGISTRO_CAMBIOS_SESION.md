# Registro integral de cambios de la sesión

## 1. Alcance y criterio de este registro

Se registra el trabajo realizado desde la primera solicitud de identificación de
enfermedades espaciales hasta las seis correcciones de seguridad, integración y
limpieza del repositorio. También se incluyen los cambios del entorno local.

El punto de corte versionado es el commit `c60fefe` de la rama `Backend`. La
reconstrucción utiliza la conversación, la memoria de trabajo, el historial de
Git y las salidas observadas de pruebas. No se atribuye al asistente la creación
del prototipo original ni del frontend ASTRA proporcionado por el usuario.

Se distingue entre escribir un cambio y ejecutar su commit. Varias primeras
implementaciones se dejaron sin commit por indicación del usuario. Posteriormente
se observaron incorporadas en Git. Los commits ejecutados expresamente por el
asistente se identifican en la sección 12.

Este documento es un registro técnico, no una certificación clínica. El puntaje
National Early Warning Score 2 (NEWS2) pertenece al Royal College of Physicians,
no a NASA, y no está validado en vuelo.
Los parámetros identificados como `[CALIBRAR]` continúan siendo hipótesis de diseño.

## 2. Estado inicial y aclaración del archivo de trabajo

Al comenzar existían `parametros.py`, el README del reto y tres documentos PDF
aportados por el usuario. El módulo clasificaba riesgo mediante NEWS2, desviación
respecto a una línea base y CO₂ de cabina. Incluía ajustes de contexto.

La primera solicitud mencionó `riesgo_salud.py` y después `parametrod.py`. Se
comprobó que el archivo real era `parametros.py`; no se renombró. Se corrigió su
cabecera, que todavía utilizaba el nombre anterior.

El problema inicial era de alcance: signos vitales y CO₂ no bastan para identificar
todas las afecciones descritas en la literatura espacial. Se decidió añadir
evidencia complementaria sin convertirla en diagnósticos automáticos.

## 3. Primera ampliación: cribado de riesgos espaciales

### Qué se añadió

Se creó `enfermedades_espaciales.py` con entradas y resultados específicos de
cribado. Se añadieron `DatosComplementarios`, `Dosimetria`, `MedicionComparada`,
los estados de evaluación y la función `evaluar_condiciones`.

Se cubrieron ocho áreas: exposición a radiación, pérdida mineral ósea, deterioro
muscular, riesgo neuro-ocular, intolerancia ortostática, sueño/ánimo/cognición,
alteraciones vestibulares y evaluación inmunitaria anormal.

Se amplió `parametros.evaluar` con el argumento opcional `complementarios` y se
añadió `Resultado.condiciones`. Se conservaron las capas agudas existentes.

### Por qué se hizo así

Una entrada ausente no equivale a una medición normal. Por eso se separaron los
estados no evaluable, sin señales en los datos aportados, hallazgo compatible,
exposición registrada y límite de protocolo alcanzado o superado.

La dosimetría compara una dosis con un límite suministrado para un período
declarado. No se inventó un límite universal ni una predicción de cáncer. Las
comparaciones óseas y musculares requieren mediciones comparables y su margen de
cambio significativo. Las tasas poblacionales de pérdida ósea no se usaron como
criterios diagnósticos.

Se rechazaron números no finitos y booleanos utilizados como números. Se corrigió
además un caso de redondeo decimal para no señalar como significativa una pérdida
igual al margen del instrumento.

### Archivos y comprobaciones

Los cambios principales quedaron en `enfermedades_espaciales.py`, `parametros.py`,
el README y `test_enfermedades_espaciales.py`, hoy ubicado en `tests/`.
Se alcanzaron nueve pruebas del cribado y su compatibilidad con la evaluación
aguda. La demostración previa conservó su salida y código de retorno.

El trabajo se observó después en el commit `d9e5ae1`. Su commit no se ejecutó
como parte de aquella intervención del asistente.

## 4. Primera API, persistencia y seguridad OIDC

El usuario solicitó validación de frontera, persistencia, líneas base, configuración
versionada, lógica temporal, alertas, roles y auditoría. Para esa etapa eligió un
servidor con datos reales y autenticación externa OpenID Connect (OIDC).

Se reprodujeron entradas inválidas aceptadas silenciosamente: sexo desconocido,
fase de misión inexistente, presión negativa, frecuencia respiratoria NaN y una
fase lútea incompatible con ciclo suprimido. En la reproducción, presión negativa
y NaN dieron MEDIO; el defecto era su aceptación, no el nombre del nivel obtenido.

Se incorporaron FastAPI y Pydantic para los contratos de entrada, SQLAlchemy para
persistencia, validación de tokens firmados y asignaciones de usuarios a astronautas.
También se añadieron auditoría y eventos de alertas.

En esta primera API se cifraron los bloques clínicos con Fernet. La configuración
de producción exigía PostgreSQL, verificación TLS y parámetros del proveedor OIDC.
No se conectó con un proveedor real ni se desplegó en producción.

Se añadieron reglas YAML con versión y huella de contenido. Los resultados
conservaron los insumos, reglas y referencias utilizados para su reproducción.
Se incorporaron servicios de mediana/MAD, calendario y secuencia temporal.

Los archivos de esa etapa incluyen `validacion.py`, `reglas.py`, `reglas.yaml`,
`servicios.py` y los módulos `app/almacen.py`, `app/clinica.py`, `app/config.py`,
`app/esquemas.py`, `app/seguridad.py` y `app/admin.py`.

Se observaron 49 pruebas aprobadas con SQLite y PostgreSQL 17 desechable, incluidas
pruebas de concurrencia y rollback. La comparación con la demostración anterior
no mostró diferencias en su salida ni en el código de retorno.

El trabajo apareció posteriormente en `80a8e0e`. La implementación OIDC se conserva
como legado; no debe confundirse con la API actual de claves descrita más adelante.

## 5. Simulador de tripulación sintética

Se creó `simulador.py` para demostrar el comportamiento sin registros reales.
Se añadieron una semilla reproducible, perfiles ficticios `SIM-01` a `SIM-06`,
salida resumida y exportación JSON.

Los escenarios incluyen estabilidad, CO₂ persistente, urgencia NEWS2, regreso a
gravedad, EVA y hallazgos complementarios. También se representan transiciones de
alertas y ausencia de mediciones.

Cada ejecución utiliza SQLite temporal y una clave de cifrado efímera. No recibe
una base de producción ni necesita credenciales reales. Se normalizan los
identificadores internos para que el informe sea reproducible.

Se añadieron cuatro pruebas del simulador: reproducción por semilla, escenarios,
aislamiento respecto al entorno real y funcionamiento de la interfaz de comandos.
La demostración predeterminada produjo 78 evaluaciones en su contrato original.

Ese conteo pertenece al simulador legado: usa `Almacen` y `Clinica`, donde las
lecturas preflight también se evaluaban. No describe el flujo actual de
`app.seed`, en el que preflight solo se guarda.

La suite de aquella etapa descubrió 53 pruebas: 40 aprobadas y 13 de PostgreSQL
omitidas. El trabajo se observó posteriormente en `f998b9b`.

## 6. Entorno local y reproducción para el equipo

Se creó `.venv` en la raíz con Python 3.14.4 y las bibliotecas de
`requirements.lock`. Se comprobó la instalación mediante `pip check`, el
simulador y las pruebas. No se modificó la instalación global de Python.

Se conservaron dos manifiestos: `requirements.txt` para las dependencias directas
y `requirements.lock` para el conjunto fijado y probado. Más adelante se añadió
pytest y se actualizaron sus dependencias en el archivo fijado.

Se documentó cómo recrear el entorno en otra máquina. No se añadió `.venv` a Git,
porque contiene rutas y binarios específicos del equipo. La instalación local
se conservó por solicitud del usuario; los entornos de prueba desechables se retiraron.

El asistente ejecutó el commit `a3b3465`, solicitado expresamente para compartir
la guía. Las instrucciones de Windows/macOS no se ejecutaron en esta máquina Linux.
En el cierre se dejó explícito que Python 3.13 no estaba disponible para comprobarlo.

## 7. Incorporación del frontend ASTRA proporcionado por el usuario

Se accedió, con autorización, a la carpeta descargada `NASA hackathon 1`.
El usuario eligió incorporarla dentro de `frontend/`, conservando el README de
la raíz. En ese momento estaba activa la rama `Frontend`.

Se copiaron 50 archivos, con un total de 6 118 416 bytes. Se excluyeron los
metadatos `.git` del proyecto de origen para evitar un repositorio anidado.
Se compararon contenido mediante SHA-256 y permisos de todos los archivos copiados.

La revisión previa acotada no detectó enlaces simbólicos ni credenciales evidentes.
No fue una auditoría exhaustiva. Se conservaron los archivos locales preexistentes
de backend y cachés. No se ejecutaron scripts del proyecto durante la copia.

No se hizo staging, commit ni push en esa operación, conforme a la indicación
«yo hago el commit». Después se observó la incorporación del frontend y cachés
en `1be1a4e`, dentro de `Backend`. No se atribuye ese comando de commit al asistente.

El diseño original de ASTRA, sus imágenes, fuentes y motor local proceden del
proyecto aportado. El trabajo posterior del asistente fue su integración con la API.

## 8. Reespecificación: API de claves y flujo preflight

Posteriormente se recibió una especificación distinta y detallada para el
hackathon. Se implementó una API nueva sin eliminar el contrato OIDC anterior.

### Reglas y validación del núcleo

Se añadió `parametros.Reglas` con los campos, límites y valores predeterminados
solicitados. Incluye validación, serialización, rechazo de claves desconocidas,
booleanos numéricos, NaN e infinito. Se expusieron `REGLAS_DEFAULT`, `DESV`,
`RANGOS_SIGNOS`, `FASES_CICLO`, `FASES_MISION` y `validar_entradas`.

Los ajustes de contexto, desviación, CO₂ y carga metabólica pasan a leer esas
reglas. Las tablas absolutas NEWS2 permanecen iguales. Se mantuvo un adaptador
para que el antiguo `reglas.Reglas` siguiera funcionando con sus consumidores.

### Persistencia y contratos nuevos

Se creó `app/db.py` con nueve modelos ORM: `Usuario`, `Astronauta`, `Medicion`,
`LineaBaseDB`, `ReglasVersion`, `Evaluacion`, `Alerta`, `AlertaEvento` y `Auditoria`.
Se establecieron fechas UTC sin zona, claves foráneas SQLite y soporte de memoria
compartida para las pruebas.

Se creó `app/schemas.py` con contratos Pydantic y `app/servicios.py` con el flujo
de negocio. La referencia se calcula explícitamente con mediana y filtro MAD
(desviación absoluta mediana), con mínimos para el general y cada fase.

Las lecturas preflight dejaron de crear evaluaciones en esta API. La misión
guarda una evaluación y sus insumos, con la versión de reglas necesaria para
reproducir nivel, NEWS2, capas y alertas.

Se implementaron estimación de fase del ciclo, tendencia NEWS2, persistencia de
desviaciones, deduplicación y escalada de alertas, reconocimiento, resolución y
revisión por ausencia. El calendario advierte cuando la fecha supera dos ciclos.

### Seguridad y convivencia de contratos

La aplicación actual se expone mediante `app.main:app` y `create_app`. Usa
`X-API-Key`, conserva solo SHA-256 de las claves y aplica los roles `astronauta`,
`medico`, `tierra` y `admin`. Se incorporaron auditoría y restricciones de salida.

El `main.py` anterior se conservó en `app/legacy_api.py`. Su fábrica `crear_app`
se reexporta por compatibilidad. La documentación anterior se trasladó a
`docs/BACKEND_LEGADO.md`.

La API nueva utiliza el esquema SQLite/JSON solicitado. No hereda automáticamente
el cifrado clínico ni los requisitos de despliegue de la API OIDC. El README
declara esa diferencia y limita su uso a demostraciones sin controles adicionales.

### Seed y pruebas de esa etapa

Se añadió `app/seed.py` con usuarios demo y tres astronautas ficticios. Ana tiene
28 lecturas preflight y misión lútea sin alertas; Luis presenta deterioro; Sofía
tiene una lectura suficientemente antigua para activar ausencia.

El seed usa `registrar_medicion`, no inserta evaluaciones prefabricadas, e imprime
las claves demo. Rechaza una base ya poblada. Se añadieron `pytest.ini`, nuevas
pruebas y la primera reubicación del archivo de nueve pruebas originales.

Se observaron 141 pruebas aprobadas, 13 omitidas y un recorrido real con Uvicorn
y curl sobre SQLite temporal. El seed produjo ocho evaluaciones y cinco alertas.
El trabajo se observó posteriormente en `a73ef2d`.

Esta versión todavía bloqueaba misión sin referencia y desactivaba bases por masa.
Las seis tareas siguientes corrigieron esos comportamientos y completaron la integración.

## 9. Seis correcciones finales, con explicación

### 9.1. Evaluar misión aunque no exista línea base

La exigencia de una referencia se había implementado como respuesta 409. Se
reprodujo que una lectura grave no alcanzaba el cálculo NEWS2 ni generaba alertas.

Se retiró el bloqueo. La misión evalúa NEWS2, CO₂ y cribado aunque `base=None`.
La desviación queda en BAJO y se genera `sin_linea_base`, MEDIO, dirigido al médico.
La reproducción admite la ausencia de referencia sin fallar.

Se añadieron casos de urgencia, CO₂ y cribado sin base, y se corrigieron las
expectativas antiguas de los tests. El cambio quedó en `8d49558`.

### 9.2. Conservar la referencia cuando cambia la masa

Antes, una variación de masa podía desactivar las bases y bloquear lecturas
posteriores. Ese efecto también podía provocarse desde el perfil del astronauta.

Se cambió a un indicador calculado `desactualizada`, sin añadir una columna.
Se expone en línea base y resumen. La evaluación sigue usando la referencia
vigente y añade la nota de masa y recálculo. Los insumos de reproducción conservan
la masa de referencia utilizada.

Se cubrieron lectura y PATCH con un descenso del 6 %. Solo el cálculo explícito
de médico/admin reemplaza la referencia. El cambio quedó en `5560448`.

### 9.3. Aplicar destinatarios y minimizar información por rol

El campo `destinatarios` existía, pero no protegía las consultas y todas las
alertas se dirigían inicialmente a los mismos roles. Se aplicó esta política:

| Tipo | Destinatarios |
| --- | --- |
| NEWS2, CO₂, desviación y tendencia en ALTO | Astronauta, médico y tierra. |
| Los tipos anteriores en MEDIO | Astronauta y médico. |
| `sin_medicion` | Médico y tierra. |
| `sin_linea_base` | Médico. |
| `cribado:*` | Médico y el propio astronauta. |

Listado, detalle y reconocimiento verifican destinatarios y alcance. Médico y
admin mantienen acceso global. El filtro se aplica antes del límite del listado.
Se protegen también alertas antiguas con destinatarios demasiado amplios.

Para tierra se eliminan condiciones, evidencias y alertas de cribado, además de
los datos del ciclo ya restringidos. Se conservaron las notas no sensibles y los
valores desconocidos para evitar cambios innecesarios en la respuesta.

Se añadieron 23 pruebas de política, endpoints y minimización. El cambio quedó
en `818da1e`.

### 9.4. Corregir citas sin modificar el cribado

Se ajustó la referencia de intolerancia ortostática a FISIO, páginas 2 y 5,
y EXON, páginas 2 y 6. La página 12 de FISIO se conservó para músculo únicamente
con la aclaración «contramedidas».

Se creó `docs/FUENTES.md` con páginas de PDF, numeración impresa de LIMEN y
limitaciones. Se dejó pendiente verificar las primarias NASA y otras referencias
indicadas por el usuario. No se inventaron pasajes ni páginas.

Una comparación del árbol de sintaxis abstracta (AST) confirmó equivalencia con
el baseline salvo las listas de fuentes. Las recomendaciones no cambiaron.
El cambio quedó en `3721fdf`.

### 9.5. Conectar ASTRA con la API

El frontend no hacía peticiones HTTP y calculaba el riesgo con un motor local.
Se añadieron `api.js` y `backend-panel.js` para la conexión, selección de astronauta,
preflight, cálculo de base y registro de misión.

La URL puede proceder de `?api=` o de `localStorage`; la clave se guarda únicamente
en `sessionStorage`. Se traducen los estados 401, 403, 409 y 422 a mensajes de
interfaz. Un 200 sin JSON válido ya no se acepta como un registro satisfactorio.

El nivel mostrado como oficial procede del backend. «Oficial» identifica su
origen dentro del sistema, no una aprobación clínica. El motor `evaluation.js`
permanece como orientación local por zonas, con una etiqueta visible.

Las gráficas pasan a usar historial y referencias del servidor, sin temporizadores
que inventen valores. Se añadió CORS configurable, vacío por defecto, con orígenes
explícitos y sin cookies cross-origin. Se rechaza `*`.

Durante la integración se corrigieron reintentos parciales, doble envío concurrente,
limpieza al cambiar de astronauta/conexión y respuestas tardías. Se eliminó una
inferencia de síntomas mediante un umbral de escala no solicitado. Un mareo
genérico no se convierte automáticamente en síntoma al incorporarse.

La prueba DOM con la API real encontró además un contrato incorrecto entre
`getState()` y `respuestaVigente`. Se añadió una regresión con el estado real,
se corrigió el acceso a `estado.backend` y se repitió la prueba: 40/40 comprobaciones.

El cambio completo quedó en `fafa4b4`. La arquitectura y el uso se documentaron
en los archivos de ASTRA correspondientes.

### 9.6. Ordenar pruebas y retirar archivos generados del índice

Se trasladaron seis archivos de pruebas de la raíz a `tests/`, ajustando imports
y la ruta del simulador. Se eliminó el mecanismo anterior de reexportación de
clases para no duplicar la colección.

Se retiró `dir="/tmp/opencode"` del temporal legado y se comprobó un directorio
alternativo del sistema. Se cambió el script npm a `node --test` para Node 22.
Ambas correcciones tienen pruebas de regresión.

Se retiraron del índice 18 `.pyc` y tres notas internas de `odd/`. Las copias
locales se conservaron y quedaron ignoradas. No se purgó el historial de Git.

Se documentaron los módulos vigentes y los legados en el README. No se borró
código legado: se propuso una consolidación condicionada a migrar sus consumidores.
Se aclaró que no existe `esquemas.py` en la raíz; el legado está en `app/esquemas.py`.

También se creó `docs/PRUEBAS.md`. El cambio quedó en `c60fefe`.

## 10. Mapa de archivos por responsabilidad

| Responsabilidad | Archivos o directorios |
| --- | --- |
| Núcleo y cribado compartidos | `parametros.py`, `enfermedades_espaciales.py`, `validacion.py`. |
| API actual | `app/main.py`, `app/db.py`, `app/schemas.py`, `app/servicios.py`, helpers de claves en `app/seguridad.py`. |
| Datos ficticios de la API actual | `app/seed.py`. |
| Cliente e interfaz ASTRA integrados | `frontend/src/js/api.js`, `backend-panel.js`, cambios en estado, resultados, gráficas, HTML y estilos. |
| API OIDC y simulación anterior | `app/legacy_api.py`, `app/almacen.py`, `app/clinica.py`, `app/config.py`, `app/esquemas.py`, `simulador.py`. |
| Configuración y servicios anteriores | `reglas.py`, `reglas.yaml`, `servicios.py` de la raíz. |
| Pruebas vigentes y compatibilidad | `tests/`, `frontend/tests/`, `pytest.ini`. |
| Instalación | `.venv/` local e ignorado, `requirements.txt`, `requirements.lock`, `.gitignore`. |
| Documentación complementaria | [Fuentes](FUENTES.md), [pruebas](PRUEBAS.md), [backend legado](BACKEND_LEGADO.md). |

## 11. Evidencia observada y sus límites

| Etapa | Resultado registrado |
| --- | --- |
| Cribado inicial y compatibilidad | Nueve pruebas aprobadas al cerrar esa ampliación. |
| Primera API OIDC | 49 pruebas con SQLite y PostgreSQL 17 desechable, incluida concurrencia. No demuestra el funcionamiento en producción. |
| Simulador y entorno inicial | 53 pruebas descubiertas: 40 aprobadas y 13 PostgreSQL omitidas. Simulador predeterminado: 78 evaluaciones ficticias. |
| API preflight antes de las seis tareas | 141 aprobadas, 13 omitidas; Uvicorn/curl con ocho evaluaciones y cinco alertas del seed. |
| Frontend antes de las seis tareas | 20 pruebas Node aprobadas. |
| Cierre de las seis tareas | 177 pruebas Python aprobadas, 13 omitidas y un aviso; 55 Node aprobadas. `npm test` también aprobado. |
| Panel con DOM y API reales | 40/40 comprobaciones con jsdom y SQLite desechable. No equivale a render visual de Chrome. |

Las salidas reales iniciales y finales de las seis tareas se conservaron en
[PRUEBAS.md](PRUEBAS.md). Allí se detallan las omisiones PostgreSQL y el aviso de
deprecación preexistente de Starlette/httpx.

La cifra histórica de PostgreSQL 17 pertenece a la primera API. Las 13 pruebas
PostgreSQL omitidas en el cierre no deben presentarse como ejecutadas entonces.
Tampoco se afirmó una ejecución local con Python 3.13 ni una prueba en Windows/macOS.

Se detuvieron los servidores y se retiraron los contenedores, entornos y
directorios desechables cuya limpieza quedó registrada. Se conservó el entorno
`.venv` solicitado por el usuario. Los artefactos administrados por pytest pueden
seguir su propia política de retención; no se afirma una purga general de temporales.

## 12. Trazabilidad de commits y atribución

| Commit | Asunto | Relación con el trabajo registrado |
| --- | --- | --- |
| `78fef0e`, `326fad5` | README y parámetros iniciales | Punto de partida; no se atribuyen a estas intervenciones. |
| `d9e5ae1` | enfermedades espaciales + test de enfermedades | Incorpora el cribado trabajado; el asistente no ejecutó ese commit en aquella etapa. |
| `80a8e0e` | mejoras y añadidos | Incorpora la primera API y servicios; se observó posteriormente en Git. |
| `f998b9b` | datos simulados | Incorpora el simulador; se había dejado sin commit durante su implementación. |
| `a3b3465` | docs: documenta el entorno del backend | Commit ejecutado por el asistente tras solicitud expresa. |
| `1be1a4e` | entrada de datos y parámetros estrictos | Incorpora, entre otros archivos, frontend y cachés; no se ejecutó por el asistente durante la copia. |
| `a73ef2d` | más parámetros | Incorpora la API preflight y claves; base de las seis correcciones posteriores. |
| `8d49558` | fix: evalúa misión sin línea base | Tarea 1; commit ejecutado por el asistente. |
| `5560448` | fix: conserva la base al cambiar masa | Tarea 2; commit ejecutado por el asistente. |
| `818da1e` | fix: limita alertas y cribado por rol | Tarea 3; commit ejecutado por el asistente. |
| `3721fdf` | docs: corrige citas y limita las fuentes | Tarea 4; commit ejecutado por el asistente. |
| `fafa4b4` | feat: conecta ASTRA con la API oficial | Tarea 5; commit ejecutado por el asistente. |
| `c60fefe` | chore: ordena pruebas y limpia el índice | Tarea 6; commit ejecutado por el asistente. |

No se realizaron comandos de push en las acciones del asistente. Las referencias
remotas locales no permiten atribuir operaciones realizadas fuera de esas acciones.
No se consultó GitHub en tiempo real para redactar este registro.

Se delegaron el núcleo y el ORM/seguridad durante la reespecificación. Durante
las correcciones se delegaron las unidades de destinatarios y frontend.
La integración, ajustes y commits autorizados quedaron a cargo de la sesión principal.
Otros trabajadores ejecutaron pruebas desechables de PostgreSQL o DOM/API.

## 13. Pendientes y garantías que no se ofrecen

La verificación independiente completa no produjo un dictamen. Los intentos
fallaron con `Unauthorized: Unauthorized access` antes de la inspección. No se
interpretó ese fallo como una prueba aprobada ni como un permiso de datos pendiente.

Chrome no estaba disponible para la revisión visual. Se utilizó jsdom para probar
eventos y contenido del panel con una API real; no se afirmó equivalencia visual.

La evaluación nativa final indicó `medium`, `review_due=false` y `under_budget`.
No se inició una revisión nativa ni se generó una aprobación a partir de ese estado.
Esto es distinto de las pruebas funcionales que sí se ejecutaron.

No se incorporaron ni verificaron todavía las primarias NASA enumeradas en
`FUENTES.md`. No se efectuó validación clínica en vuelo, certificación sanitaria,
integración con un proveedor OIDC real ni despliegue de producción.

La consolidación del legado sigue siendo una propuesta. Borrar sus módulos sin
migrar imports, simulador y pruebas podría romper consumidores todavía conservados.

## 14. Estado local encontrado al redactar este documento

Al comenzar esta solicitud documental, `HEAD` era `c60fefe` en `Backend` y Git
mostraba los archivos de `frontend/` como eliminados localmente, sin commit.
La comprobación del directorio confirmó que no estaba presente en el espacio de trabajo.

Esas eliminaciones ya existían antes de escribir este registro. No se restauraron,
confirmaron ni modificaron. El frontend descrito aquí corresponde al estado
versionado y probado de los commits, no a una nueva comprobación de esa carpeta ausente.

Para esta solicitud se añadió este documento y su enlace en el README. No se
cambió código, no se repitieron las suites y no se hizo commit ni push del registro.
