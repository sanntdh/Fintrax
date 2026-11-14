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
The source PDFs were already untracked in the working tree; keep them with the
project for local source references to resolve.
