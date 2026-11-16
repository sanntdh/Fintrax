# AI Use Disclaimer

Fintrax is a health-monitoring **prototype** for astronauts on long-duration missions. It is **not** a validated medical device or diagnostic system, and it does not replace a flight physician.

## How AI was used

AI was used as an implementation and auditing tool, not as the author of the project's decisions. The team defined the problem, scope, design rules and data logic; AI turned them into code, tests and documentation, and reviewed changes made by the team.

| Stage | Tool | Commits | Work |
|---|---|---|---|
| 1 | ChatGPT ("sol 6.1") via opencode | `78fef0e` – `a73ef2d` | Initial backend: FastAPI, clinical parameters, space-disease screening, simulator, strict data input |
| 2 | opencode, after Claude's audit | `8d49558` – `3721fdf` | Corrections: mission without baseline, baseline preservation, role-based alerts, source fixes |
| 3 | Claude Code | `fafa4b4` – `0da9936` | Frontend–API connection, test organization, index cleanup, change log |

**Frontend:** developed with Claude, based on the design and workflow defined by the team.

Tool attribution is a team declaration: all commits appear under a single author ("Santiago") with no AI markers, so git history confirms order and content but not the tool.

## Team decisions vs. AI contributions

- **Defined by the team:** astronaut self-assessment focus; low/medium/high risk based on NEWS2; adjustments for sex, height, weight, space environment and menstrual cycle; personal resting baseline (preflight → baseline → mission); the three source documents for space-disease screening.
- **Suggested by AI, adopted by the team:** X-API-Key authentication with roles (astronaut, doctor, ground, admin), audit log with versioned rules, alert lifecycle (new/acknowledged/resolved) with trend and "no measurement" alerts.
- **AI as auditor:** found and the team corrected a mission without baseline returning 409, baseline deactivated by ≥5% mass change, fixed alert recipients and ground role seeing screening data, a wrong citation page, a frontend disconnected from the API, and fragile tests.

## Human oversight

No AI output was accepted without review:

1. **Team direction** – every task started from a team instruction; the team decided what was merged.
2. **Automated tests** – 190 Python tests (177 pass, 13 skipped: require PostgreSQL); 55 Node frontend tests. See `docs/PRUEBAS.md`.
3. **Real scenarios** – end-to-end runs against the API (Uvicorn + curl) and a real DOM + API interface test (40/40 checks).
4. **Source verification** – each citation checked against its PDF page. See `docs/FUENTES.md`.

## Limitations

- AI can produce plausible but wrong code or citations (this happened with one citation).
- Parameters marked `[CALIBRAR]` are design hypotheses, not clinically validated and not from NASA.
- NEWS2 belongs to the Royal College of Physicians, is not NASA's and is not validated in flight; the three source documents are not from NASA either.
- A low risk level does not rule out chronic disease.
- Vital signs and menstrual-cycle data are role-restricted and audited; no real people's data were used.
- Pending: a complete independent review, visual testing in a real browser (only jsdom), the current PostgreSQL tests (skipped), verification of primary NASA sources, and clinical validation, production deployment or real OIDC integration.

Before any real-world use, an aerospace medicine specialist must review the thresholds.

## Responsibility

The team directed the project, decided what was built, accepted and corrected, and reviewed the results. Responsibility for the project's content, sources and limitations rests with the team.
