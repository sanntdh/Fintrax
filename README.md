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

Variables opcionales:
- `MONITOREO_DB`: por defecto `sqlite:///monitoreo.db`. Usa una base **distinta** de
  la API anterior; no hay migración automática ni borrado de datos existentes.
- `MONITOREO_ADMIN_KEY`: crea un admin al arrancar únicamente si no hay usuarios.
  No se imprime, no se guarda en claro y nunca debe versionarse.
- `MONITOREO_REVISION_MIN`: intervalo de revisión de ausencia; `0` desactiva la
  tarea (predeterminado). Para vigilancia automática, configura un valor positivo.
  También existe `POST /alertas/revisar-sin-medicion` para una revisión explícita.

## Flujo

1. Crear un astronauta y registrar lecturas en reposo con `contexto: "preflight"`.
   **Solo se guardan**: no crean evaluaciones ni alertas; no admiten complementarios.
2. Un médico/admin llama a `POST /astronautas/{id}/linea-base`: mediana, filtro MAD
   y mínimo de muestras. Si faltan, responde **409** con el número faltante.
3. Registrar lecturas de misión; se evalúan con línea base y reglas versionadas.

Ejemplo de lectura (cambia el id y usa tu clave demo):

```bash
curl -X POST http://127.0.0.1:8000/astronautas/2/mediciones \
  -H "X-API-Key: TU_CLAVE_DEMO" -H "Content-Type: application/json" \
  -d '{"contexto":"vuelo","signos":{"fr":26,"spo2":94,"pas":100,"fc":135,"temp":38.5},"co2_mmhg":5.5}'
```

`ts` es opcional y se normaliza a UTC sin zona. Se admiten lecturas históricas;
solo la más reciente puede actualizar la masa actual. Los cambios de masa de
al menos el porcentaje configurado desactivan las bases antiguas. Recalcular la
base es una acción explícita, no una invención de signos a partir del peso.

La fase se estima desde última menstruación y duración (21–45 días), suponiendo
ciclos regulares. Más de dos ciclos sin actualizar la fecha devuelve un aviso y
fase desconocida. La fase declarada en una lectura debe ser coherente con el perfil.
El general excluye la fase lútea si quedan suficientes muestras; las bases por
fase tienen su propio mínimo. Las versiones antiguas se conservan para reproducir.

## Seguridad y alertas

Astronauta: solo sus datos, registra lecturas, reconoce alertas, modifica masa y
última menstruación. Médico: clínica, bases y resolución. Tierra: lectura y
reconocimiento, **sin ciclo/fase/fechas ni notas que los mencionan**. Admin: además,
usuarios, reglas y auditoría. Todo acceso se autoriza y audita, incluidos los 403.

NEWS2 y CO₂ en MEDIO o más, y cualquier desviación ALTO, alertan inmediatamente.
Solo la desviación MEDIO requiere persistencia. La tendencia es una regresión de
NEWS2 por lectura (no por hora) [CALIBRAR]. El cribado produce alertas separadas.
Las alertas abiertas se deduplican; escalar las devuelve a `nueva`. Se pueden
reconocer y resolver, o resolver directamente, siempre con nota para la resolución.
La ausencia se resuelve automáticamente con una lectura reciente de misión.

Rutas principales: `/usuarios`, `/astronautas`, `/astronautas/{id}/mediciones`,
`/linea-base`, `/historial`, `/resumen`, `/evaluaciones/{id}/reproducir`, `/alertas`,
`/alertas/{id}/reconocer`, `/resolver`, `/reglas`, `/reglas/versiones`, `/auditoria`
y `/salud`. Los sufijos de línea base, historial y resumen pertenecen al astronauta;
consulta `/docs` para los contratos completos. Dominio inválido: 422; falta de
base: 409; sin clave: 401; permisos insuficientes: 403.

## Pruebas

```bash
python -m pytest
```

El seed usa el flujo real: Ana tiene 28 preflight y misión lútea sin alertas; Luis
muestra deterioro NEWS2/CO₂ y tendencia; Sofía tiene ciclo suprimido y más de 12 h
sin lecturas. Son datos ficticios, no un modelo fisiológico validado.

Este esquema SQLite/JSON es para demostración local: no ofrece cifrado de columnas,
TLS ni notificaciones externas. Para datos reales hacen falta infraestructura
segura, protección/retención de datos y validación clínica. La fábrica OIDC anterior
se conserva como `crear_app`; su documentación está en `docs/BACKEND_LEGADO.md`.
