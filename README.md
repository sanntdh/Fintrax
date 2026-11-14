Long-duration missions expose astronauts to space radiation, isolation and confinement, altered gravity, and a hostile closed environment, which can bring immune changes, bone loss, cardiovascular events, and behavioral health problems. On long missions, astronauts carry much of the responsibility for spotting these changes in themselves. Your challenge is to build a health monitoring software that gathers health indicators and enables astronauts to evaluate and act on the status of their health.

## Space-health screening

`parametros.py` retains its NEWS2, personal-baseline and cabin CO2 layers.
`Resultado.nivel` is **acute physiological/environmental risk**, not an overall
clearance for spaceflight. A low level does not exclude chronic disease.
The new `Resultado.condiciones` reports complementary screening separately.
This is an exploratory prototype, **not a validated medical device or diagnostic
system**; seek flight-medical assessment for concerning findings. Do not defer
urgent care because a score is low.

### Necessary complementary inputs

All fields in `DatosComplementarios` are optional. Collect only the area being
assessed; use `None` for unavailable measurements or unanswered questions.
`False` means explicitly assessed and absent, not a default for missing data.

| Area | Input | What it supports (not a diagnosis) |
| --- | --- | --- |
| Radiation | `Dosimetria(dosis_msv, limite_msv, periodo)` | Records dose; compares against a supplied mission-medical/radiation-protection limit only when the dose and limit share the stated period. No built-in dose limit, cancer prediction, or DNA-damage inference. A recorded dose of zero also does not exclude injury. |
| Bone | `densidad_osea=MedicionComparada(...)` | Baseline/current density, instrument-specific significant change (e.g. DXA least significant change), and explicit comparability. Flags a decrease greater than measurement uncertainty, not osteoporosis. |
| Muscle | `fuerza_muscular=MedicionComparada(...)` | Baseline/current strength from the same test, units, muscle group and protocol, with a supplied significant-change threshold. Flags functional deterioration, not confirmed atrophy. |
| Neuro-ocular/SANS | `cambio_visual`, `hallazgo_ocular` | New visual change and a clinician-interpreted ocular finding. Either positive prompts assessment; neither alone establishes SANS. Fundus examination/OCT may be needed. |
| Orthostatic intolerance | `sintomas_al_incorporarse` | Dizziness/presyncope specifically on standing. Not a generic baseline blood-pressure drop. Requires supervised clinical assessment. |
| Sleep/behavioral health | `alteracion_sueno`, `alteracion_animo`, `dificultad_cognitiva` | Reported sleep, mood or cognitive difficulty; no invented hours-of-sleep cutoff or diagnosis of depression/anxiety. |
| Vestibular function | `mareo_desorientacion` | Reported dizziness/disorientation; the cause remains undetermined. |
| Immune function | `evaluacion_inmune_anormal` | An abnormal laboratory assessment already interpreted by a clinician; no diagnosis from fever or a fabricated leukocyte cutoff. |

For `MedicionComparada(basal, actual, cambio_minimo, comparables)`, all numerical
values share the measurement's units; `comparables=True` must confirm the same
site/test and technique. Baseline/current values must be positive and finite;
the significant-change value must be finite and nonnegative. A change equal to
this value is not flagged (strictly greater is required). Missing uncertainty or
noncomparable measurements yield `no_evaluable`, not a negative result. Units,
dates and comparability must be established by the measurement workflow; the
prototype cannot independently verify these assertions.

### Example

```python
from enfermedades_espaciales import DatosComplementarios, Dosimetria, MedicionComparada
from parametros import Ambiente, Perfil, Signos, evaluar

# Synthetic example only; 10 mSv is NOT a recommended clinical/mission limit.
datos = DatosComplementarios(
    dosimetria=Dosimetria(12, 10, "same synthetic observation period"),
    densidad_osea=MedicionComparada(1.00, 0.96, 0.02, True),
    cambio_visual=True,
)
r = evaluar(
    Perfil("M", 1.80, 80, 40),
    Signos(fr=14, spo2=98, pas=115, fc=64, temp=36.7),
    Ambiente(),
    complementarios=datos,
)
print("Acute risk:", r.nivel.name)
for condicion in r.condiciones:
    print(condicion.nombre, condicion.estado.value)
    print("Evidence:", condicion.evidencia)
    print("Missing:", condicion.datos_faltantes)
    print("Action:", condicion.recomendacion)
    print("Limits:", condicion.limitacion)
    print("Sources:", condicion.fuentes)
```

States distinguish unavailable evidence, no signals **in the supplied data**,
compatible findings requiring assessment, recorded radiation exposure, and a
supplied protocol limit reached/exceeded. A positive finding is retained even
when other inputs are missing. Every entry reports missing inputs and source
pages. No complementary state lowers or replaces the existing acute safety floor.
Existing calls and the original demonstration remain supported:

```sh
python3 parametros.py
python3 -m unittest discover -v
```

### Evidence and limits

Page references in the results use physical PDF pages (one-based), with printed
pages supplied for LIMEN:

- `Documentación/LIMEN.S.P.2024.169.pdf`: *Personalized Products For the Space Economy: The Astronaut Genetic Persona Mapping*, physical pp. 2–3 (printed 170–171): cardiovascular, bone/muscle, ocular and behavioral risks.
- `Documentación/ef91c634202c62c63a17ee801c4a2c4a1021.pdf`: *Microgravity-Induced Alterations in Human Physiology and Cellular Homeostasis During Long-Duration Spaceflight*, pp. 3–4 (radiation, ocular and immune), 8–9 (musculoskeletal, vestibular and psychological effects).
- `Documentación/9f6c57e2e18d8e6baa6a8ea8d4c7a5841539.pdf`: *Physiotherapy Beyond Earth: A Literature Review on Rehabilitation And Functional Performance In Astronauts*, pp. 2, 12: functional deterioration, orthostatic symptoms and other systemic effects.

These reviews justify the monitored areas, **not the validity of the implemented
screening rules**. The reported 1–2% monthly bone loss is a population observation,
not a diagnostic cutoff. The software does not identify every disease mentioned
in these reviews: cancer, cataracts, skin disease, infection and molecular injury
require condition-specific clinical investigations. Genetic/omics testing and
direct intracranial-pressure measurement are not required inputs to this prototype.
Keep the source PDFs with the project for local references to resolve.

## Clinical API

This backend adds persistence and access control, **not clinical certification**.
Use synthetic data until clinical calibration, infrastructure controls and the
remaining independent verification have been completed. No deployment is performed
by installing this repository.

### Setup and mandatory configuration

The tested interpreter is Python 3.14.4. In an isolated virtual environment,
install `requirements.lock` for the tested package set; `requirements.txt` records
the direct dependency ranges. Other interpreter/package combinations need testing.
Production uses PostgreSQL with the psycopg driver and certificate-verified TLS.
SQLite is restricted to explicitly constructed test configurations; there is no
environment switch that opens a production API in anonymous/test mode.

Supply these through your deployment secret manager, **never commit their values**:

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | `postgresql+psycopg://...` URL with `sslmode=verify-full`; configure a trusted CA and a restricted application database role. |
| `HEALTH_ENCRYPTION_KEY` | Persistent Fernet key generated and held outside the repository. Losing it makes stored clinical data unreadable. |
| `OIDC_ISSUER` | Exact trusted HTTPS issuer. |
| `OIDC_AUDIENCE` | Audience dedicated to this API's access tokens; do not use an ID-token client audience. |
| `OIDC_JWKS_URL` | Trusted HTTPS JWKS URL configured by the operator, never taken from token headers. |
| `HEALTH_RULES_PATH` | Optional path to a validated calibration YAML, otherwise repository `reglas.yaml`. |

The API requires signed RS256 or ES256 tokens with `kid`, `sub`, `iss`, `aud`,
`exp` and `iat`; it verifies signature, issuer, audience and time claims. Key-set
fetching has a three-second timeout and a five-minute cache. Token roles and
astronaut IDs **never grant permissions**. Roles/assignments are managed locally.
Use opaque subjects from the identity provider rather than names or emails.

With a separate database-owner credential, initialize an **empty** database:

```sh
python -m app.admin init-db
```

The command refuses an existing schema; it is not an upgrade/migration command.
Then provision local permissions using the operator's trusted host session:

```sh
python -m app.admin grant --subject SUBJECT --role oficial_medico
python -m app.admin grant --subject OTHER_SUBJECT --role astronauta
# After the medical officer creates an astronaut, assign the opaque UUID:
python -m app.admin assign --subject OTHER_SUBJECT --astronauta ASTRONAUT_UUID
# Revokes both local role and assignments; a still-valid OIDC token loses access:
python -m app.admin revoke --subject OTHER_SUBJECT
```

Run the service with a restricted DML-only database credential, not the owner
used for setup (omit DDL, grant management, UPDATE/DELETE on audit/event tables):

```sh
uvicorn app.main:crear_app --factory --host 127.0.0.1 --port 8000 --no-access-log
```

Put it behind an authenticated deployment boundary/TLS reverse proxy with body
limits, rate limits, timeouts and redacted request logging. Do not log Authorization
headers or request bodies. OpenAPI/docs are disabled for production instances.

### Endpoints

All endpoints require `Authorization: Bearer ACCESS_TOKEN` and server-side grants.

| Method / path | Purpose / permission |
| --- | --- |
| `POST /astronautas` | Medical officer creates an opaque astronaut record and its profile; creator gets an assignment. |
| `PUT /astronautas/{id}/perfil` | Assigned astronaut/medical officer submits a complete new profile revision. |
| `POST /evaluaciones` | Assigned astronaut/medical officer submits a measurement and atomically stores its evaluation/alerts. |
| `GET /astronautas/{id}/historial?limite=50&desplazamiento=0` | Assigned users; stable timestamp ordering, maximum 100 items. Ground gets no phase estimate or contextual cycle notes. |
| `GET /astronautas/{id}/alertas` | Assigned users; astronauts/ground see their recipient channel; medical officers see all channels. Most recent 100 alerts. |
| `PATCH /alertas/{id}` | `{ "estado": "reconocido" }` then `{ "estado": "resuelto" }`; each event records actor and timestamp. Only an assigned medical officer may resolve; others may acknowledge only their own recipient channel. |
| `POST /astronautas/{id}/comprobar-ausencia` | Assigned medical/ground user checks overdue measurements, including astronauts with no readings. |
| `POST /evaluaciones/{id}/reproducir` | Assigned medical officer recomputes from the encrypted immutable input/rule/baseline snapshot; refuses if engine source fingerprint changed. |

Example creation body (synthetic):

```json
{"perfil":{"sexo":"F","estatura_m":1.65,"masa_kg":60,"edad":36,"ciclo":"natural","ultima_menstruacion":"2026-11-01","duracion_ciclo":28}}
```

Example measurement body (replace the UUID and timestamp with a real authorized
record and an aware timestamp no later than the acquisition server clock):

```json
{
  "astronauta_id": "00000000-0000-4000-8000-000000000001",
  "timestamp": "2026-11-14T12:00:00Z",
  "signos": {"fr":14,"spo2":98,"pas":115,"fc":64,"temp":36.7},
  "ambiente": {"fase":"vuelo","co2_mmhg":3.0},
  "preflight": false,
  "reposo": true,
  "fase_ciclo": null,
  "complementarios": {"cambio_visual":true}
}
```

Validation returns 422 with field locations and clear messages but no echoed
input values/bodies. Unknown fields, invalid enums, strings/bools in numerical
fields and NaN/infinity are rejected. Capture bounds for adults are FC 0–300,
FR 0–100, PAS 0–300, SpO2 0–100, temperature 25–45 °C, mass 2–400 kg, height
0.5–2.5 m and integer age 18–100. These are engineering capture limits, **not
normal ranges**, and include emergency values such as zero HR/respiration.
Invalid measurements are not scored as reassuring or pathological: they are
rejected. NEWS2 scale 2 (`hipercapnico`) requires prior clinical indication;
the system does not infer hypercapnic respiratory failure. Only an assigned
medical officer may submit this flag; an astronaut cannot self-select scale 2
to lower their oxygen subscore.

The domain dataclasses also reject invalid values, including objects mutated
after construction. Existing valid calls to `evaluar` remain supported. New
keyword argument `reglas` accepts the validated snapshot for deterministic use.

### Baselines, cycle estimation and calibration

Preflight baseline samples require `preflight=true`, `reposo=true`, no exercise/EVA
and NEWS2=0. The service uses up to the latest 1,000 current-profile preflight
measurements, with a per-parameter median/MAD filter (scaled MAD 1.4826). A row
is retained only if all parameters pass. When MAD=0, only exact median values
pass for that parameter. At least five **retained** readings are required by
default. Retained/excluded counts and method are saved with the baseline.
This provisional filter can discard meaningful variation and needs calibration.

General and explicitly observed phase-specific baselines are stored separately;
each requires its own retained sample minimum. Calendar estimates never label
preflight samples as confirmed phase observations. Any new profile revision
(including a weight change) invalidates the previous baseline for future use;
new comparable preflight readings are required. Old evaluations retain their
original baseline. **The software does not fabricate new vital baselines from
weight alone**; Harris–Benedict context uses the current profile's mass.

Last-menstruation date and cycle duration must be provided together for natural
cycles only. A 21–45 day calendar may estimate menstrual/follicular/ovulatory/luteal
phase using configurable assumptions (default five menstrual days, 14 luteal
days). It is not a validated ovulation detector. A future start date is rejected;
once the stated cycle has elapsed the estimate becomes unavailable instead of
projecting indefinitely. **Estimated phase does not enable physiological offsets**.
The optional measurement `fase_ciclo` is a separately supplied/confirmed phase;
it is not permitted for suppressed/nonapplicable cycles or as a permanent profile
phase. Irregular cycles require clinical assessment rather than a calendar claim.

Edit/version `reglas.yaml` and restart the service to load a new calibration;
no Python edit is needed. It holds deviation margins, cycle/gravity offsets,
metabolic/context multipliers and baseline/temporal/calendar policies. Absolute
NEWS2 and cabin-CO2 safety tables remain fixed. Configuration is validated,
hashed and saved with each result, together with the engine version/fingerprint,
exact profile, baseline, complementary data and prior temporal context. Reusing
a version label with different configuration returns 409 and rolls back the
measurement. Keep the original versioned application artifact to replay results
after upgrades; a source fingerprint is not an archive of the executable.

### Temporal alerts and unattended monitoring

NEWS2 trend is the difference from the preceding comparable reading (rising,
falling, stable, or no comparison), not a forecast. Debounce defaults to three
consecutive non-low results separated by at most one hour. A normal reading,
long gap, profile/configuration change or change between preflight and mission
readings resets the sequence. Duplicate/out-of-order timestamps return 409;
per-astronaut transactions and an active-alert unique index prevent double counts.

**Never delayed:** ALTO from any original acute layer, NEWS2 total ≥5, or any
NEWS2 subscore=3. These emit immediately. The acute classification itself is
never lowered by debounce. Higher-risk and urgent events use distinct alert
types so an acknowledged persistent warning cannot suppress an acute alert.
Complementary chronic screening remains separate; these alerts are not automated
diagnoses or treatment instructions.

The absence threshold defaults to six hours. A scheduler **must invoke** the
monitor even when no reading arrives. The API does not silently start a background
thread in each worker. Schedule a periodic invocation on the trusted server:

```sh
python -m app.admin monitor --subject MONITOR_SERVICE_SUBJECT
```

Provision this identity as medical/ground and assign its monitored astronauts.
For example, a host scheduler can invoke it every five minutes with secrets
injected by the deployment system. Without that scheduler or explicit endpoint
checks, absence alerts are not evaluated unattended. Alerts persist per recipient
(`astronauta`, `oficial_medico`, `tierra`) and are retrieved through the API;
external email, paging and ground-telemetry delivery are not implemented.

### Privacy and operations

Health profiles (including menstrual dates), raw observations, baselines and full
evaluation snapshots are Fernet-encrypted before storage. Phase lookup keys and
identity subjects use keyed hashes; no raw cycle dates or payloads enter the audit
trail. Opaque record IDs, times, assignments and alert routing/state metadata remain
in plaintext and are still sensitive. Application access is scoped by assignment;
database credentials must not be exposed to users.

Authorized/denied requests and validation failures are audited; payloads, tokens,
medical notes and secrets are not. Audit and alert-event tables have append-only
UPDATE/DELETE rejection triggers. Backups, disk encryption, retention/deletion
policy, external append-only audit export, operational access and incident response
remain deployment responsibilities. Trigger protection is not proof against a
database owner or host administrator. Key rotation/recovery requires a planned
data/identity-hash migration; **do not replace the encryption key or issuer
in-place**. Identity hashes are also bound to the configured issuer.
This implementation does not claim HIPAA/GDPR certification or clinical readiness.

### Verification

```sh
python -B -m unittest discover -v
# Optional: explicitly authorized disposable PostgreSQL ONLY (never real records).
# Each case creates and deletes its own randomized schema:
HEALTH_TEST_POSTGRES_URL='postgresql+psycopg://postgres@127.0.0.1:PORT/postgres' python -B -m unittest test_postgres -v
```

Tests use synthetic OIDC keys and isolated temporary state. No real provider or
production database is contacted. PostgreSQL tests include simultaneous duplicate
submissions, transactional rollback, encrypted storage, alert transitions and
permission denial. Live-provider integration and operational deployment validation
are separate, require the destination/credentials to be explicitly authorized,
and have not been performed here.
