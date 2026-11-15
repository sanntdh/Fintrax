# Monitoreo de salud de astronautas

Backend de demostración para misiones largas. **NEWS2 pertenece al Royal College
of Physicians, no a NASA, y no está validado en vuelo.** Los ajustes, la estimación
del ciclo, la tendencia y los parámetros **[CALIBRAR]** son hipótesis de diseño.
El cribado complementario no confirma ni descarta enfermedades.

## Instalar y ejecutar

Desde la raíz, con Python 3.14.4 (versión probada):

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m app.seed
uvicorn app.main:app --reload
```

Documentación interactiva: **http://127.0.0.1:8000/docs**. El seed imprime claves
**demo**, generadas al azar, para admin, médico, tierra y cada astronauta. Úsalas
en `Authorize` o como cabecera `X-API-Key`. Solo sus SHA-256 se guardan.
El seed rechaza una base con usuarios/astronautas y no sobrescribe datos.
`requirements.lock` contiene las versiones probadas para una instalación fijada.
Esta entrega se ejecutó con **Python 3.14.4 y Node 22.22.1**. Python 3.13 no está
disponible en esta máquina y no se afirma una prueba local con esa versión.

Variables opcionales:
- `MONITOREO_DB`: por defecto `sqlite:///monitoreo.db`. Usa una base **distinta** de
  la API anterior; no hay migración automática ni borrado de datos existentes.
- `MONITOREO_ADMIN_KEY`: crea un admin al arrancar únicamente si no hay usuarios.
  No se imprime, no se guarda en claro y nunca debe versionarse.
- `MONITOREO_REVISION_MIN`: intervalo de revisión de ausencia; `0` desactiva la
  tarea (predeterminado). Para vigilancia automática, configura un valor positivo.
  También existe `POST /alertas/revisar-sin-medicion` para una revisión explícita.
- `MONITOREO_CORS_ORIGINS`: orígenes separados por coma, vacío por defecto (sin
  CORS). Ejemplo: `http://localhost:5173,http://127.0.0.1:5173`. Solo orígenes
  explícitos, sin rutas, credenciales ni `*`; no se habilitan cookies cross-origin.

Para usar ASTRA, inicia el backend con esos orígenes y, en otra terminal,
`npm --prefix frontend start`. Abre `http://localhost:5173/?api=http://127.0.0.1:8000`.
Introduce una clave demo y el astronauta correspondiente en «Enlace con el backend».
La clave queda solo en `sessionStorage`; la URL puede guardarse en `localStorage`.
El rol seleccionado en pantalla solo orienta los controles: autoriza el servidor.

## Flujo

1. Crear un astronauta y registrar lecturas en reposo con `contexto: "preflight"`.
   **Solo se guardan**: no crean evaluaciones ni alertas; no admiten complementarios.
2. Un médico/admin llama a `POST /astronautas/{id}/linea-base`: mediana, filtro MAD
   y mínimo de muestras. Si faltan, responde **409** con el número faltante.
3. Registrar lecturas de misión; **siempre** se evalúan NEWS2 y CO₂. Si falta la
   línea base, solo la desviación queda en BAJO y se avisa al médico mediante
   `sin_linea_base` (MEDIO). No se bloquea una urgencia por no tener referencia.
   La evaluación y su reproducción admiten `base=None`.

Ejemplo de lectura (cambia el id y usa tu clave demo):

```bash
curl -X POST http://127.0.0.1:8000/astronautas/2/mediciones \
  -H "X-API-Key: TU_CLAVE_DEMO" -H "Content-Type: application/json" \
  -d '{"contexto":"vuelo","signos":{"fr":26,"spo2":94,"pas":100,"fc":135,"temp":38.5},"co2_mmhg":5.5}'
```

`ts` es opcional y se normaliza a UTC sin zona. Se admiten lecturas históricas;
solo la más reciente puede actualizar la masa actual. La variación de masa no
desactiva referencias: calcula el indicador `desactualizada` en línea base y resumen
y añade una nota de recalibración. Se sigue usando la referencia vigente; solo
`POST /linea-base` de médico/admin reemplaza las bases. No se inventan signos por peso.

La fase se estima desde última menstruación y duración (21–45 días), suponiendo
ciclos regulares. Más de dos ciclos sin actualizar la fecha devuelve un aviso y
fase desconocida. La fase declarada en una lectura debe ser coherente con el perfil.
El general excluye la fase lútea si quedan suficientes muestras; las bases por
fase tienen su propio mínimo. Las versiones antiguas se conservan para reproducir.

## Seguridad y alertas

Astronauta: solo sus datos, registra lecturas, reconoce alertas, modifica masa y
última menstruación. Médico: clínica, bases y resolución. Tierra: lectura y
reconocimiento, **sin cribado/evidencias, ciclo/fase/fechas ni notas que los mencionan**. Admin: además,
usuarios, reglas y auditoría. Todo acceso se autoriza y audita, incluidos los 403.

NEWS2 y CO₂ en MEDIO o más, y cualquier desviación ALTO, alertan inmediatamente.
Solo la desviación MEDIO requiere persistencia. La tendencia es una regresión de
NEWS2 por lectura (no por hora) [CALIBRAR]. El cribado produce alertas separadas.
Las alertas abiertas se deduplican; escalar las devuelve a `nueva`. Se pueden
reconocer y resolver, o resolver directamente, siempre con nota para la resolución.
La ausencia se resuelve automáticamente con una lectura reciente de misión.
NEWS2/CO₂/desviación/tendencia ALTO se dirigen a astronauta, médico y tierra;
MEDIO solo a astronauta y médico. `sin_medicion` va a médico y tierra;
`sin_linea_base` solo a médico; `cribado:*` solo a médico y el astronauta propio.
Listado, detalle y reconocimiento respetan destinatarios y alcance. Médico/admin
ven todo. Las notas no sensibles y valores desconocidos se conservan.

Rutas principales: `/usuarios`, `/astronautas`, `/astronautas/{id}/mediciones`,
`/linea-base`, `/historial`, `/resumen`, `/evaluaciones/{id}/reproducir`, `/alertas`,
`/alertas/{id}/reconocer`, `/resolver`, `/reglas`, `/reglas/versiones`, `/auditoria`
y `/salud`. Los sufijos de línea base, historial y resumen pertenecen al astronauta;
consulta `/docs` para los contratos completos. Dominio inválido: 422; cálculo de
base con muestras insuficientes: 409; sin clave: 401; permisos insuficientes: 403.

## Pruebas

```bash
python -m pytest
npm --prefix frontend test
```

Todas las pruebas Python viven en `tests/` y se descubren con `pytest.ini`;
las de PostgreSQL se omiten sin una instancia desechable configurada explícitamente.
Los temporales usan la ubicación del sistema, no una carpeta propia del equipo.
Las salidas iniciales/finales de esta entrega están en [docs/PRUEBAS.md](docs/PRUEBAS.md).

El seed usa el flujo real: Ana tiene 28 preflight y misión lútea sin alertas; Luis
muestra deterioro NEWS2/CO₂ y tendencia; Sofía tiene ciclo suprimido y más de 12 h
sin lecturas. Son datos ficticios, no un modelo fisiológico validado.

Este esquema SQLite/JSON es para demostración local: no ofrece cifrado de columnas,
TLS ni notificaciones externas. Para datos reales hacen falta infraestructura
segura, protección/retención de datos y validación clínica. La fábrica OIDC anterior
se conserva como `crear_app`; su documentación está en `docs/BACKEND_LEGADO.md`.
Las fuentes y sus límites están en [docs/FUENTES.md](docs/FUENTES.md): los tres PDF
de cribado no son documentos de NASA; las fuentes primarias pendientes no se dan
por verificadas.

## Módulos vigentes y legado

| Uso | Módulos |
| --- | --- |
| API actual X-API-Key | `app.main:app`, `app.main.create_app`, `app/db.py`, `app/schemas.py`, `app/servicios.py`; helpers API-key en `app/seguridad.py`. |
| Núcleo compartido | `parametros.py`, `enfermedades_espaciales.py`; `validacion.py` sigue siendo dependencia de compatibilidad, no se elimina. |
| Contrato OIDC legado | `app.legacy_api.crear_app`, reexportado como `app.main.crear_app`; `app/almacen.py`, `app/clinica.py`, `app/config.py`, `app/esquemas.py`. |
| Servicios/configuración antiguos | `servicios.py`, `reglas.py`, `reglas.yaml` de la raíz; no confundir con `app/servicios.py` y `parametros.Reglas`. |
| Demo anterior | `simulador.py` conserva su flujo OIDC/almacén local aislado para compatibilidad; no es el seed de la API actual (`app.seed`). |
| Frontend | `api.js`/`backend-panel.js` consumen la API oficial; `evaluation.js` queda solo como orientación local por zonas. |

No existe un `esquemas.py` en la raíz: el de contrato anterior es
`app/esquemas.py`, distinto del vigente `app/schemas.py`.

**Propuesta de consolidación, no ejecutada:** migrar primero el simulador y sus
consumidores/tests y después considerar retirar `app/legacy_api.py`,
`app/almacen.py`, `app/clinica.py`, `app/config.py`, `app/esquemas.py`,
`servicios.py`, `reglas.py` y `reglas.yaml`. No se borró código legado en esta
entrega. Los 18 `.pyc` y las notas internas `odd/` se retiraron solo del índice;
siguen disponibles localmente e ignorados por Git.
