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

4. **Mailpit healthy** (`assixx-mailpit` Container, Profile `dev`, Port `8025`)
   Pflicht seit ADR-054 — jeder Password-Login löst Mandatory-Email-2FA aus, k6 holt den 6-Zeichen-Code aus Mailpit-API in `setup()`. Stack-Default-Profile (`docker/.env: COMPOSE_PROFILES=dev,observability`) enthält Mailpit, also normalerweise schon up.

   ```bash
   curl -s http://localhost:8025/api/v1/info | jq .Version  # -> "v1.29.7"
   ```

   Bridge-Helper: `load/lib/2fa-helper.ts` · Setup-Doku: [HOW-TO-DEV-SMTP.md](../docs/how-to/HOW-TO-DEV-SMTP.md) · Limitation: nur lokaler Dev-Stack (Staging/Prod-Load gegen echtes SMTP wäre out-of-band Token-Mint, queued in FEAT_2FA_EMAIL_MASTERPLAN §Phase 7).

5. **Docker-Image** (einmalig, läuft automatisch beim ersten Run)
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
│   ├── config.ts    # BASE_URL, Credentials, Thresholds
│   ├── auth.ts      # loginApitest() + authOnly/authHeaders Helpers
│   └── payloads.ts  # POST-Body-Builder (Blackboard) + makeRunId()
├── tests/
│   ├── smoke.ts     # 1 VU × 1 min × 10 Endpoints (Pre-Release-Gate)
│   └── baseline.ts  # 70/30 Read+Write Mix + WS-Soak (Capacity-Baseline)
├── baselines/       # eingecheckte JSON-Snapshots (CI-Diff-Quelle)
├── results/         # JSON-Summaries (gitignored)
├── tsconfig.json    # IDE-Types + standalone type-check
└── README.md        # ← du bist hier
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

| Symptom                                                                                                | Ursache                                                                  | Lösung                                                                                                |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `login returns 200: false, got 429`                                                                    | Redis-Throttle voll                                                      | `docker exec assixx-redis redis-cli ... FLUSHDB`                                                      |
| `login returns 200: false, got 401`                                                                    | Passwort geändert oder Tenant fehlt                                      | HOW-TO-CREATE-TEST-USER folgen                                                                        |
| `pollMailpitForCode: no fresh mail to <email> within 15000ms (Mailpit at http://localhost:8025)`       | Mailpit down ODER Backend-SMTP-Send broken ODER `SMTP_HOST≠mailpit`      | `docker-compose ps mailpit` → `(healthy)`; `docker logs assixx-backend \| grep -i 'send.*2fa\|smtp'`  |
| `pollMailpitForCode: ... mailpit search returned 404`                                                  | `MAILPIT_URL` zeigt auf falschen Host (rare — nur wenn `__ENV` gesetzt)  | `docker run ... -e MAILPIT_URL=http://localhost:8025 ...`                                             |
| `2FA verify failed for <email>: status=401`                                                            | Code stale/expired (>10 min) ODER Cookie-Jar-Race in setup()             | `pnpm test:load:smoke` erneut starten — k6 setup() ist deterministisch ein Login pro Run             |
| `2FA verify response for <email> missing accessToken cookie`                                           | Backend-`setAuthCookies` regressed                                       | `auth.controller.ts:174` prüfen; sollte `accessToken`/`refreshToken`/`accessTokenExp` setzen          |
| `2FA code not found in Mailpit message body — template drift?`                                         | `2fa-code.template.ts:renderCodeMailText` Marker `Ihr Code:` geändert    | Regex in `load/lib/2fa-helper.ts:CODE_REGEX` UND `backend/test/helpers.ts:_extract2faCode` syncen     |
| `connect: connection refused`                                                                          | Backend down                                                             | `cd docker && docker-compose up -d`                                                                   |
| `permission denied` auf `$PWD/load`                                                                    | Docker-Mount-Rechte (selten)                                             | Absoluter Pfad: `-v /home/scs/projects/Assixx/load:/scripts`                                          |
| Thresholds passen alle, aber `/tpm/plans/cards` → 403                                                  | Addon `tpm` nicht für apitest aktiviert                                  | `INSERT INTO tenant_addons ...` (siehe HOW-TO-TEST §3)                                                |
| Endpoints liefern 404 statt 200                                                                        | Route-Pfad hat sich geändert                                             | Smoke-Test updaten (`load/tests/smoke.ts`)                                                            |

---

## Baseline-Test (Capacity + WS-Soak)

Geht über Smoke hinaus — gemischte Read/Write-Last + optionaler WebSocket-Soak,
mit per-Tag-Thresholds und CI-Diff. Siehe Header-Kommentar in
[`tests/baseline.ts`](./tests/baseline.ts) für die volle Begründung.

### Zwei Profile (THROTTLER-CONSTRAINT, ADR-001)

Rate-Limits sind PRO JWT-User-ID getrackt: `admin` = 2000/15min ≈ 2.2 req/s.
**Single-Tenant @ >5 VU produziert 429s, keine Latency-Daten.** Daher:

| Profil  | VU-Peak | Pool-Mindest | Wall-Time | Ziel                             |
| ------- | ------- | ------------ | --------- | -------------------------------- |
| `light` | 5       | 1 (apitest)  | ~5 min    | Regression-Detection + p95-Drift |
| `full`  | 500     | 5+           | ~8 min    | Pool-Saturation-Bruchpunkt       |

```bash
# Light (Default — pre-merge regression check)
pnpm run test:load:baseline

# +WebSocket-Soak (50 persistente /chat-ws Verbindungen parallel)
WS=1 pnpm run test:load:baseline

# Full Capacity-Test (benötigt Multi-Tenant-Pool)
PROFILE=full LOGINS='[
  {"email":"info@assixx.com","password":"ApiTest12345!"},
  {"email":"admin@tenant2.de","password":"…"},
  {"email":"admin@tenant3.de","password":"…"},
  {"email":"admin@tenant4.de","password":"…"},
  {"email":"admin@tenant5.de","password":"…"}
]' pnpm run test:load:baseline
```

Setup() validiert Pool-Größe und bricht ab, wenn `PROFILE=full && pool<5`.

### Cleanup (writes hinterlassen Blackboard-Einträge)

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "DELETE FROM blackboard_entries WHERE title LIKE 'LOAD-%';"
```

### Per-Tag-Thresholds

```ts
'http_req_duration{op:read}':  ['p(95)<100', 'p(99)<300']
'http_req_duration{op:write}': ['p(95)<250', 'p(99)<800']
'http_req_failed':             ['rate<0.001']
'ws_connecting{scenario:ws_soak}': ['p(95)<500']
```

Tighter als Smoke (500/1000ms) — fängt echte Regressions, nicht erst Katastrophen.

### CI-Diff (Regression-Gate)

```bash
# 1× initial: Baseline-Snapshot einchecken (nach approved perf-change)
mv load/results/baseline-latest.json load/baselines/baseline-light.json

# In CI bei jedem PR:
pnpm run test:load:baseline
pnpm run test:load:diff -- \
  --baseline=load/baselines/baseline-light.json \
  --current=load/results/baseline-latest.json
# Exit 1 wenn p95/p99 um >20% regressed oder error-rate um >0.5pp gestiegen
```

### Baseline-Harvest (manuell, nach jedem Run)

```bash
# Top-10 langsamste Queries während des Test-Runs
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "SELECT left(query,80), calls, round(mean_exec_time::numeric,2) AS avg_ms \
   FROM pg_stat_statements WHERE query NOT LIKE '%pg_stat%' \
   ORDER BY total_exec_time DESC LIMIT 10;"

# Connection-Pool-Saturation prüfen
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname='assixx';"

# Slow-Traces (>200ms) aus Tempo seit Test-Start (Tail-Sampling-Threshold ist 200ms — ADR-048)
curl -s 'http://localhost:3200/api/search?minDuration=200ms&limit=20' | jq
```

---

## Nächste Schritte (Post-MVP)

1. **Multi-Tenant-Seed-Skript** — `scripts/seed-load-test-tenants.ts` (5 Tenants + Admin-User je) damit `PROFILE=full` aus dem Stand der Box läuft
2. **GitHub-Action** — Pre-Merge: light-Baseline + diff vs `load/baselines/baseline-light.json`. Nightly: full-Baseline + Grafana-Cloud-Push
3. **Grafana-Dashboard "k6 Load Run"** — k6 → Prometheus remote_write, Panels: HTTP-p95-by-Tag, Top-Slow-Traces (Tempo), pg-Connections (postgres-exporter), Loki-Errors-mit-trace_id (Click-through)

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
- [HOW-TO-TEST](../docs/how-to/HOW-TO-TEST.md) — apitest-Tenant-Setup, Pattern-Referenz
