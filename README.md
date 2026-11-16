# Astronaut Health Monitoring

Fintrax is a health-monitoring software designed for the conditions astronauts face during long-duration spaceflight missions, such as those aboard the International Space Station. Each astronaut is assigned an ID and records their baseline health parameters while at rest and in good health. Fintrax then compares mission measurements and reported symptoms against that personal baseline, classifies risk as low, medium, or high, and screens for signs of space-related conditions, from physical to cognitive. Built as a PWA that also works offline, Fintrax helps astronauts track their health throughout the mission. Beyond flagging possible issues, it sends alerts to the appropriate roles (such as the flight physician) and provides recommendations based on the NEWS2 (National Early Warning Score 2) and NASA technical documentation. Fintrax is a prototype: it does not diagnose or replace a flight physician.

## Install and run

From the repository root, with Python 3.14.4 (tested version):

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m app.seed
uvicorn app.main:app --reload
```

Interactive documentation: **http://127.0.0.1:8000/docs**. The seed prints randomly
generated **demo** keys for admin, doctor, ground, and each astronaut. Use them in
`Authorize` or as the `X-API-Key` header. Only their SHA-256 hashes are stored.
The seed rejects a database that already has users/astronauts and does not overwrite data.
`requirements.lock` contains the tested versions for a pinned installation.
This release was run with **Python 3.14.4 and Node 22.22.1**. Python 3.13 is not
available on this machine, so no local test with that version is claimed.

Optional variables:
- `MONITOREO_DB`: defaults to `sqlite:///monitoreo.db`. It uses a **different** database
  from the previous API; there is no automatic migration and existing data is not deleted.
- `MONITOREO_ADMIN_KEY`: creates an admin at startup only if there are no users.
  It is never printed, never stored in plain text, and must never be committed.
- `MONITOREO_REVISION_MIN`: interval for the missing-measurement check; `0` disables
  the task (default). For automatic monitoring, set a positive value.
  `POST /alertas/revisar-sin-medicion` is also available for an explicit check.
- `MONITOREO_CORS_ORIGINS`: comma-separated origins, empty by default (no CORS).
  Example: `http://localhost:5173,http://127.0.0.1:5173`. Explicit origins only, with
  no paths, credentials, or `*`; cross-origin cookies are not enabled.

To use the Fintrax frontend, start the
