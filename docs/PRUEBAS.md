# Evidencia de las seis tareas ASTRA

Corridas reales en Linux, Python **3.14.4**, pytest **9.2.0** y Node **22.22.1**.
No se ejecutó Python 3.13: no está disponible en esta máquina. No se utilizaron
datos, bases ni credenciales reales. Los tiempos son los impresos por cada corrida.

## Antes de modificar archivos

`python -m pytest` (usando el intérprete de `.venv`):

```text
collected 154 items
141 passed, 13 skipped, 1 warning in 8.76s
```

`node --test`, desde `frontend/`:

```text
1..20
# tests 20
# suites 0
# pass 20
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 388.697665
```

## Después de las correcciones e higiene

`python -m pytest`:

```text
collected 190 items
tests/test_api.py ............
tests/test_compatibilidad_legada.py ..
tests/test_cors.py .....
tests/test_destinatarios.py .......................
tests/test_enfermedades_espaciales.py .........
tests/test_flujo.py .........
tests/test_fuentes.py .
tests/test_infra.py ....................................
tests/test_nucleo.py .....................................................
tests/test_parametros.py ........
tests/test_postgres.py sssssssssssss
tests/test_seed.py .
tests/test_seguridad.py ..
tests/test_servicios.py .....
tests/test_servicios_monitoreo.py .......
tests/test_simulador.py ....
177 passed, 13 skipped, 1 warning in 8.59s
```

`node --test`, desde `frontend/` (resumen exacto de TAP):

```text
1..55
# tests 55
# suites 0
# pass 55
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 537.029867
```

`npm test`, desde `frontend/`:

```text
> astra-registro-biomedico@5.0.0 test
> node --test
1..55
# tests 55
# suites 0
# pass 55
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 526.872405
```

Las 13 omisiones corresponden a pruebas PostgreSQL legadas: no hay una instancia
desechable configurada para esta corrida. El aviso preexistente de Starlette
indica la deprecación de httpx en su TestClient; no es un fallo de prueba.

## Regresiones reproducidas antes de corregir

- T1: misión grave sin base devolvía 409; tras el cambio devuelve 201, conserva
  NEWS2/CO₂/cribado y reproduce `base=None`. Pruebas en `tests/test_flujo.py`.
- T2: el indicador no existía y el cambio de masa desactivaba referencias.
  Cubiertas lectura y PATCH con descenso del 6 %, base activa y aviso de recalibración.
- T3: fallaban 21 casos de política/visibilidad; se conservaron notas no sensibles
  y los valores desconocidos, sin exponer condiciones/evidencias a tierra.
- T4: fallaba la cita de ortostatismo. Comparación AST contra el baseline:
  **idéntico salvo listas de fuentes**; recomendaciones y lógica conservadas.
- T5: fallaban cliente/contratos nuevos; además se probó y corrigió reintento
  parcial, aislamiento por paciente y la forma real de `getState()`.
- T6: fallaban el temporal alternativo del sistema, la ausencia de tests en raíz
  y el script npm con `tests/`. Todos esos casos están ahora protegidos por pruebas.

## Prueba del panel contra la API real

Sin Chrome disponible, se ejecutó una prueba DOM con jsdom temporal **fuera del
repositorio**, `index.html` y módulos reales, más Uvicorn y SQLite desechables.
No es una prueba visual ni de render de Chrome.

La primera corrida detectó un defecto real de `respuestaVigente`: los handlers
pasaban `getState()` y el guard buscaba propiedades del subestado. Después de
corregirlo y añadir la regresión con el estado raíz real:

```text
RESULTADO 40/40 checks ok
probe_exit=0
```

Observado: conexión y listado; cinco lecturas guardadas; referencia general activa
con FC 64/PAS 115/FR 14/T 36.6/SpO₂ 98; misión con **ALTO, NEWS2 12**, fecha del
servidor e historial; API key solo en sessionStorage; cambio de paciente limpia
resultado/historial/borrador. Un fallo en la tercera lectura dejó dos persistidas,
con mensaje de error y borrador conservado. No se afirmaron resultados visuales.

Los servidores propios se detuvieron; las bases, herramientas y copias de prueba
temporales se retiraron. No se añadió jsdom como dependencia del frontend.
