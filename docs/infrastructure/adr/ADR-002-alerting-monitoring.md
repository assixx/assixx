# ADR-002: Alerting und Monitoring Stack

**Date:** 2026-01-11

## Status

**Accepted** - Implementation Phase 1, 2 & 3 Complete (2026-01-12)

### Implementation Progress

| Phase | Component         | Status      | Notes                                                        |
| ----- | ----------------- | ----------- | ------------------------------------------------------------ |
| 1a    | Pino Backend      | ✅ Complete | Replaced Winston, pino-pretty in dev, JSON in prod           |
| 1b    | Pino Frontend     | ✅ Complete | logger.ts utility, esbuild.drop, security fixes (2026-01-12) |
| 1c    | Console Migration | ✅ Complete | 334 calls → createLogger() - Best Practice (2026-01-13)      |
| 2     | Sentry Backend    | ✅ Complete | @sentry/nestjs integrated, 5xx errors only                   |
| 3     | Sentry Frontend   | ✅ Complete | @sentry/sveltekit with Session Replay, explicit capture      |
| 4     | Source Maps       | 🔲 Future   | CI/CD Pipeline - nicht blockierend für Dev                   |
| 5     | PLG Stack         | ✅ Complete | Prometheus + Loki + Grafana + pino-loki (2026-01-12)         |

### Files Created/Modified (Phase 1-3)

```
# Backend (Phase 1a + Phase 2)
backend/src/nest/instrument.ts           # Sentry init (MUST be first import)
backend/src/nest/common/logger/          # Pino logging module
  ├── logger.module.ts
  └── logger.constants.ts
backend/src/utils/logger.ts              # Standalone Pino logger
backend/src/nest/main.ts                 # Import instrument.js first
backend/src/nest/app.module.ts           # SentryModule + LoggerModule
backend/src/nest/common/filters/         # Sentry.captureException for 5xx
  └── all-exceptions.filter.ts
docker/.env.example                      # SENTRY_DSN placeholder
docker/docker-compose.yml                # SENTRY_DSN environment variable

# Frontend (Phase 1b - Pino/Security)
frontend/src/lib/utils/logger.ts         # NEW: Central Pino logger utility
frontend/src/lib/utils/token-manager.ts  # Fixed: import.meta.env.DEV security
frontend/src/lib/utils/session-manager.ts # Fixed: import.meta.env.DEV security
frontend/vite.config.ts                  # esbuild.drop for console stripping
frontend/eslint.config.mjs               # ESLint exception for logger.ts

# Frontend (Phase 3 - Sentry)
frontend/src/hooks.client.ts             # Sentry client-side init + handleError
frontend/src/instrumentation.server.ts   # Sentry server-side init (SSR)
frontend/src/hooks.server.ts             # Sentry.sentryHandle() + handleError
frontend/svelte.config.js                # experimental.instrumentation.server
frontend/vite.config.ts                  # sentrySvelteKit() plugin
frontend/src/routes/sentry-example-page/ # Test page for Sentry errors
  └── +page.svelte
frontend/src/routes/sentry-example-api/  # Test API route with explicit capture
  └── +server.ts
```

### Environment Variables

| Variable            | Where    | Description                                 |
| ------------------- | -------- | ------------------------------------------- |
| `SENTRY_DSN`        | Backend  | NestJS Sentry DSN (process.env)             |
| `PUBLIC_SENTRY_DSN` | Frontend | SvelteKit Sentry DSN (build-time + runtime) |

**Frontend requires both:**

1. **Build ARG** in Dockerfile.frontend → embedded in client bundle via `$env/static/public`
2. **Runtime ENV** in docker-compose.yml → used by `instrumentation.server.ts` (SSR)

**DSN = Public** (not a secret): Only allows event submission, not data access. Can be rotated in Sentry dashboard if abused.

### Important Notes (Phase 3)

- **SvelteKit +server.ts routes**: Sentry does NOT auto-capture errors. Use explicit `Sentry.captureException(error)` before throwing.
- **Separate DSNs**: Backend and Frontend can share DSN or use different projects
- **Session Replay**: Enabled for frontend (10% sessions, 100% on error)
- **GitHub Issue #13224**: Reference for +server.ts capture limitation
- **Optional Sentry**: Leave `PUBLIC_SENTRY_DSN=""` to disable frontend Sentry

## Context

Nach Abschluss der SvelteKit-Migration (Phase 3) benötigen wir ein Alerting- und Monitoring-System für Production. Ohne Error Tracking sind wir blind wenn die App crasht.

Unser Tech-Stack besteht aus SvelteKit 5 (Frontend), NestJS 11 + Fastify 5 (Backend), TypeScript, PostgreSQL 17, Redis 7, Nginx und Docker Compose. Logging wird auf Pino migriert (siehe PINO-LOGGING-PLAN.md).

Wir haben drei Optionen evaluiert:

**Option 1: Sentry SaaS** - Error Tracking als Cloud-Dienst mit nativen SDKs für SvelteKit (`@sentry/sveltekit`) und NestJS (`@sentry/nestjs`). Features: Automatisches Error Capture, Source Maps, Distributed Tracing, Session Replay, Alerting. Keine Infrastruktur nötig.

**Option 2: Sentry Self-Hosted** - Gleiche Features wie SaaS, aber selbst gehostet. Benötigt mindestens 32 GB RAM (16 GB + 16 GB Swap), 4 CPU Cores mit SSE 4.2, und deployed 23+ Docker Container (Kafka, Zookeeper, ClickHouse, Snuba, etc.). Quelle: [Sentry Self-Hosted Docs](https://develop.sentry.dev/self-hosted/)

**Option 3: PLG Stack (Prometheus + Loki + Grafana)** - Open-Source Observability Stack. Prometheus für Metrics, Loki für Log Aggregation (perfekte Pino-Integration), Grafana für Dashboards. Benötigt nur 4-8 GB RAM und 4 Container. Bietet jedoch kein automatisches Error Tracking, keine Source Maps, kein Session Replay.

## Decision

Wir nutzen einen **kombinierten Observability Stack**:

1. **Sentry SaaS** für Error Tracking (Exceptions, Session Replay, Alerting)
2. **PLG Stack** für Logs, Metrics und Dashboards (Prometheus + Loki + Grafana)
3. **Pino** als zentraler Logger mit pino-loki Transport zu Grafana

Sentry Self-Hosted wird abgelehnt wegen unverhältnismäßigem Ressourcenbedarf (32 GB RAM, 23+ Container für Error Tracking) - dies verletzt das KISS-Prinzip massiv.

**Sentry SaaS** ist optimal für Error Tracking weil:

- Native SDKs für exakt unseren Stack (SvelteKit + NestJS)
- Zero-Config Error Tracking mit Source Maps
- Session Replay ermöglicht "Video-Reproduktion" von Bugs
- Distributed Tracing von Frontend bis Backend

**PLG Stack** ist notwendig für Observability weil:

- Zentrale Log-Aggregation (alle Pino-Logs durchsuchbar in Grafana)
- System-Metriken (CPU, RAM, Requests/sec, Response Times)
- Custom Dashboards für Team-Sichtbarkeit
- Alerting bei Performance-Problemen (nicht nur Errors)
- Sentry trackt nur Errors, nicht normale Logs oder Metrics

## Consequences

**Positiv:**

- Sofortige Sichtbarkeit von Production-Errors (Sentry)
- Session Replay beschleunigt Bug-Reproduktion (Sentry)
- Zentrale Log-Suche über alle Container (Loki)
- System-Metriken und Performance-Monitoring (Prometheus)
- Custom Dashboards für Team (Grafana)
- Pino-Logs fließen automatisch nach Grafana (pino-loki)

**Negativ:**

- Externe Abhängigkeit von Sentry (SaaS)
- Error-Daten liegen bei Drittanbieter
- Free Tier hat Limits (5k Errors, 1 User, 7-Tage Retention)
- PLG Stack benötigt ~4-8 GB RAM extra
- 3-4 zusätzliche Container (Loki, Prometheus, Grafana)

**Neutral:**

- Sentry und PLG Stack sind komplementär, nicht konkurrierend
- PLG Stack ist self-hosted (volle Kontrolle über Log-Daten)

---

## References

### Sentry

- [Sentry SvelteKit Guide](https://docs.sentry.io/platforms/javascript/guides/sveltekit/)
- [Sentry NestJS Guide](https://docs.sentry.io/platforms/javascript/guides/nestjs/)
- [Sentry Fastify Guide](https://docs.sentry.io/platforms/javascript/guides/fastify/)
- [Sentry Self-Hosted Requirements](https://develop.sentry.dev/self-hosted/)

### PLG Stack (Phase 5)

- [Grafana Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Prometheus Documentation](https://grafana.com/docs/grafana/latest/datasources/prometheus/)

### Pino → Loki Integration

- [pino-loki v3.0.0 (npm)](https://www.npmjs.com/package/pino-loki) - Pino Transport für Loki
- [pino-loki (GitHub)](https://github.com/Julien-R44/pino-loki) - Source Code
- [Grafana Dashboard: Pino HTTP Logs](https://grafana.com/grafana/dashboards/21900-pino-http-logs/) - Fertiges Dashboard für pino-http

---

## Phase 5: PLG Stack Implementation Plan

### Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                     OBSERVABILITY STACK                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │   Backend   │     │  Frontend   │     │   Nginx     │        │
│  │  (NestJS)   │     │ (SvelteKit) │     │             │        │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘        │
│         │                   │                   │                │
│         │ Pino Logs         │ (future)          │ Access Logs   │
│         ▼                   ▼                   ▼                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      pino-loki                           │    │
│  │              (Transport: Pino → Loki)                   │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                        LOKI                              │    │
│  │              (Log Aggregation & Storage)                │    │
│  │                     Port: 3100                          │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            │                                     │
│  ┌─────────────────────────┼───────────────────────────────┐    │
│  │                         │                                │    │
│  │                    ┌────▼────┐                          │    │
│  │                    │ GRAFANA │                          │    │
│  │                    │Port:3050│                          │    │
│  │                    └────┬────┘                          │    │
│  │                         │                                │    │
│  │            ┌────────────┼────────────┐                  │    │
│  │            │            │            │                   │    │
│  │       ┌────▼───┐  ┌─────▼────┐  ┌───▼────┐             │    │
│  │       │  Logs  │  │ Metrics  │  │ Alerts │             │    │
│  │       │ (Loki) │  │(Promethe)│  │        │             │    │
│  │       └────────┘  └──────────┘  └────────┘             │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    PROMETHEUS                            │    │
│  │              (Metrics Collection)                        │    │
│  │                     Port: 9090                          │    │
│  │                                                         │    │
│  │  Scrapes:                                               │    │
│  │  - Backend /metrics (NestJS)                            │    │
│  │  - Node Exporter (System Metrics)                       │    │
│  │  - PostgreSQL Exporter (DB Metrics)                     │    │
│  │  - Redis Exporter (Cache Metrics)                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Tasks

**Phase 5a: Docker Compose + Loki** ✅

- [x] Add Loki container to docker-compose.yml
- [x] Add Grafana container to docker-compose.yml
- [x] Configure Loki data source in Grafana
- [x] Test Loki is receiving logs

**Phase 5b: pino-loki Transport** ✅

- [x] Install pino-loki in backend: `pnpm add pino-loki`
- [x] Configure pino transport to send logs to Loki
- [x] Verify logs appear in Grafana

**Phase 5c: Prometheus Metrics** ✅

- [x] Add Prometheus container to docker-compose.yml
- [x] Add @willsoto/nestjs-prometheus to backend
- [x] Expose /metrics endpoint in NestJS (/api/v2/metrics)
- [x] Configure Prometheus to scrape backend
- [x] Add Prometheus data source in Grafana
- [x] Configure remote_write to Grafana Cloud

**Phase 5d: Grafana Dashboards** ✅

- [x] Create custom Assixx Backend Overview dashboard (assixx-overview.json)
- [x] Create Assixx Full Dashboard with Logs (assixx-full-dashboard.json)
- [x] Configure Grafana Cloud remote access

**Phase 5e: Grafana Cloud Integration** ✅ (2026-01-12)

- [x] Create Grafana Cloud account (assixxdev stack)
- [x] Configure remote_write in prometheus.yml
- [x] Set up API key with logs:write + metrics:write scopes
- [x] Verify metrics flowing to Grafana Cloud Prometheus
- [x] Verify logs flowing to Grafana Cloud Loki via pino-loki

### New Containers (Phase 5)

| Container         | Image                | Port | Purpose         |
| ----------------- | -------------------- | ---- | --------------- |
| assixx-loki       | grafana/loki:3.x     | 3100 | Log aggregation |
| assixx-grafana    | grafana/grafana:11.x | 3050 | Dashboards      |
| assixx-prometheus | prom/prometheus:3.x  | 9090 | Metrics         |

### Environment Variables (Phase 5)

| Variable                     | Where      | Description                                        |
| ---------------------------- | ---------- | -------------------------------------------------- |
| `LOKI_URL`                   | Backend    | Loki endpoint (http://loki:3100)                   |
| `GF_SECURITY_ADMIN_PASSWORD` | Grafana    | Admin password                                     |
| `GF_SERVER_ROOT_URL`         | Grafana    | External URL                                       |
| `GRAFANA_CLOUD_USER`         | Prometheus | Grafana Cloud Prometheus username (2910443)        |
| `GRAFANA_CLOUD_API_KEY`      | Prometheus | Grafana Cloud API key (logs:write + metrics:write) |
| `LOKI_HOST`                  | Backend    | Grafana Cloud Loki URL for pino-loki transport     |
| `LOKI_USERNAME`              | Backend    | Grafana Cloud Loki username                        |
| `LOKI_PASSWORD`              | Backend    | Grafana Cloud Loki API key                         |

### Grafana Cloud URLs

| Service    | URL                                                   |
| ---------- | ----------------------------------------------------- |
| Prometheus | https://prometheus-prod-65-prod-eu-west-2.grafana.net |
| Loki       | https://logs-prod-042.grafana.net                     |
| Grafana    | https://assixxdev.grafana.net                         |

### Resource Requirements

| Component  | RAM        | CPU      | Storage         |
| ---------- | ---------- | -------- | --------------- |
| Loki       | 1-2 GB     | 0.5      | 10+ GB (logs)   |
| Grafana    | 512 MB     | 0.25     | 100 MB          |
| Prometheus | 1-2 GB     | 0.5      | 5+ GB (metrics) |
| **Total**  | **3-5 GB** | **1.25** | **15+ GB**      |
