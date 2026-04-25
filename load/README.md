# Load Tests (k6)

Performance-Smoke-Suite für die Assixx-API. Docker-basiert — **kein lokaler k6-Install nötig**.

## Zweck

**Pre-release Regression-Detection**, nicht Capacity-Test. Die Suite rennt 1 VU × 1 min gegen die 10 meistbenutzten Endpoints. Wenn ein PR `p95` um >20 % hochzieht (oder Error-Rate >1 %), fällt es hier auf — bevor Prod es sieht.

**Kein Ersatz für**: API-Integration-Tests (Funktionalität → Vitest `--project api`), E2E (Playwright), Sentry Performance Monitoring (Prod-Traces).

---

## Voraussetzungen

1. **Backend läuft**

   ```bash
   cd docker && doppler run -- docker-compose up -d
   curl -s http://localhost:3000/health | jq .status  # -> "ok"
   ```

2. **apitest-Tenant existiert**
   Siehe [docs/how-to/HOW-TO-CREATE-TEST-USER.md](../docs/how-to/HOW-TO-CREATE-TEST-USER.md). Gleicher Tenant wie Vitest-API-Tests — kein separates Seed nötig, falls du schon `pnpm run test:api` erfolgreich laufen lässt.

3. **Redis-Throttle-Keys geflusht** (empfohlen — sonst blockiert der Login-Throttle nach wenigen Test-Runs)

   ```bash
   docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' \
     --no-auth-warning FLUSHDB
   ```

4. **Docker-Image** (einmalig, läuft automatisch beim ersten Run)
   ```bash
   docker pull grafana/k6:latest
   ```

---

## Ausführen

```bash
pnpm run test:load:smoke
```

Intern ruft das:

```bash
docker run --rm --network=host \
  -v "$PWD/load:/scripts" \
  grafana/k6:latest run /scripts/tests/smoke.ts
```

**Was passiert:**

- k6 loggt sich einmal in `setup()` ein → Token cached
- 1 Virtual User iteriert 60 s lang 10 Endpoints
- Thresholds werden am Ende ausgewertet (Exit-Code 0 = pass, >0 = fail)

**Erwartete Dauer:** ~65 s (1 min Test + 5 s Setup/Teardown)

---

## Struktur

```
load/
├── lib/
│   ├── config.ts   # BASE_URL, Credentials, Thresholds
│   └── auth.ts     # loginApitest() + authOnly/authHeaders Helpers
├── tests/
│   └── smoke.ts    # 1 VU × 1 min × 10 Endpoints
├── results/        # JSON-Summaries (gitignored)
├── tsconfig.json   # IDE-Types + standalone type-check
└── README.md       # ← du bist hier
```

---

## Getestete Endpoints (10)

| #   | Endpoint                                | Warum in Smoke?                                 |
| --- | --------------------------------------- | ----------------------------------------------- |
| 1   | `GET /health`                           | Baseline (kein Auth, kein DB)                   |
| 2   | `GET /api/v2/users/me/org-scope`        | Hot-Path (ADR-035/036/039) — fast jeder Request |
| 3   | `GET /api/v2/users?limit=10`            | List mit Pagination                             |
| 4   | `GET /api/v2/departments`               | Hierarchie-Read (ADR-034)                       |
| 5   | `GET /api/v2/teams`                     | Hierarchie-Read (ADR-034)                       |
| 6   | `GET /api/v2/blackboard`                | RLS-gefilterte Liste (ADR-019)                  |
| 7   | `GET /api/v2/notifications`             | Sidebar-Load                                    |
| 8   | `GET /api/v2/calendar/events?from=&to=` | Date-Range-Filter (heavy)                       |
| 9   | `GET /api/v2/tpm/plans`                 | List + Pagination (Addon, ADR-033)              |
| 10  | `GET /api/v2/addons`                    | Tenant-Addon-Katalog                            |

---

## Thresholds (initial)

```ts
checks: 'rate>0.99'; // ≥99 % Check-Assertions pass
http_req_failed: 'rate<0.01'; // <1 % Transport/5xx errors
http_req_duration: 'p(95)<500ms';
('p(99)<1000ms');
```

> **Tighten nach 3-5 Runs** sobald reale Baseline sichtbar. Aktuelle Werte sind konservativ — sie sollen nicht flaken, aber auch nicht 10 % Regression wegfiltern.

---

## Troubleshooting

| Symptom                                               | Ursache                                 | Lösung                                                             |
| ----------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------ |
| `login returns 200: false, got 429`                   | Redis-Throttle voll                     | `docker exec assixx-redis redis-cli ... FLUSHDB`                   |
| `login returns 200: false, got 401`                   | Passwort geändert oder Tenant fehlt     | HOW-TO-CREATE-TEST-USER folgen                                     |
| `connect: connection refused`                         | Backend down                            | `cd docker && docker-compose up -d`                                |
| `permission denied` auf `$PWD/load`                   | Docker-Mount-Rechte (selten)            | Absoluter Pfad: `-v /home/scs/projects/Assixx/load:/scripts`       |
| Thresholds passen alle, aber `/tpm/plans/cards` → 403 | Addon `tpm` nicht für apitest aktiviert | `INSERT INTO tenant_addons ...` (siehe HOW-TO-TEST-WITH-VITEST §3) |
| Endpoints liefern 404 statt 200                       | Route-Pfad hat sich geändert            | Smoke-Test updaten (`load/tests/smoke.ts`)                         |

---

## Nächste Schritte (Post-MVP)

Wenn Smoke stabil läuft (3+ Runs ohne Flake):

1. **`tests/load-read.ts`** — 10 VUs × 5 min gemischte Read-Patterns (echte Lastkurve)
2. **`tests/load-write.ts`** — POST/PUT (KVP, Blackboard-Post, Chat-Send) mit Cleanup
3. **`tests/hot-path.ts`** — Login + `/me/org-scope` unter Stress → Throttle-Wirkung messen
4. **Grafana Cloud remote_write** — Historie:
   ```bash
   docker run ... grafana/k6 run \
     --out experimental-prometheus-rw=http://<grafana-cloud>/api/prom/push \
     /scripts/tests/smoke.ts
   ```
5. **CI-Integration** — GitHub Action mit Service-Container (Postgres + Redis + Backend), Smoke pre-merge. Braucht Backend-Image im Registry.

---

## Warum Docker statt lokalem k6?

- Keine `brew install k6` / `apt install k6` Diskussion
- Gleiche Version über alle Devs (Image-Tag lockt die)
- CI-ready (GH-Actions hat Docker nativ)
- k6 ≥0.54 (das `latest` Image) supportet **TypeScript nativ** — kein Build-Step

**Trade-off:** ~200 ms Docker-Start-Overhead pro Run. Bei 1-min-Smoke vernachlässigbar.

---

## Referenzen

- [k6 Docs](https://grafana.com/docs/k6/latest/) — TypeScript, Scenarios, Thresholds
- [ADR-018](../docs/infrastructure/adr/ADR-018-testing-strategy.md) — Test-Strategie (Pyramide)
- [HOW-TO-TEST-WITH-VITEST](../docs/how-to/HOW-TO-TEST-WITH-VITEST.md) — apitest-Tenant-Setup, Pattern-Referenz
