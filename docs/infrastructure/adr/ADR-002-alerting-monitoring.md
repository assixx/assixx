# ADR-002: Alerting and Monitoring Stack

**Date:** 2026-01-11

## Status

**Accepted** - Implementation Phase 1, 2 & 3 Complete (2026-01-12)

### Implementation Progress

| Phase | Component         | Status            | Notes                                                        |
| ----- | ----------------- | ----------------- | ------------------------------------------------------------ |
| 1a    | Pino Backend      | \u2705 Complete   | Replaced Winston, pino-pretty in dev, JSON in prod           |
| 1b    | Pino Frontend     | \u2705 Complete   | logger.ts utility, esbuild.drop, security fixes (2026-01-12) |
| 1c    | Console Migration | \u2705 Complete   | 334 calls \u2192 createLogger() - Best Practice (2026-01-13) |
| 2     | Sentry Backend    | \u2705 Complete   | @sentry/nestjs integrated, 5xx errors only                   |
| 3     | Sentry Frontend   | \u2705 Complete   | @sentry/sveltekit with Session Replay, explicit capture      |
| 4     | Source Maps       | \U0001f532 Future | CI/CD Pipeline - not blocking for dev                        |
| 5     | PLG Stack         | \u2705 Complete   | Prometheus + Loki + Grafana + pino-loki (2026-01-12)         |

### Files Created/Modified (Phase 1-3)

```
# Backend (Phase 1a + Phase 2)
backend/src/nest/instrument.ts           # Sentry init (MUST be first import)
backend/src/nest/common/logger/          # Pino logging module
  \u251c\u2500\u2500 logger.module.ts
  \u2514\u2500\u2500 logger.constants.ts
backend/src/utils/logger.ts              # Standalone Pino logger
backend/src/nest/main.ts                 # Import instrument.js first
backend/src/nest/app.module.ts           # SentryModule + LoggerModule
backend/src/nest/common/filters/         # Sentry.captureException for 5xx
  \u2514\u2500\u2500 all-exceptions.filter.ts
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
  \u2514\u2500\u2500 +page.svelte
frontend/src/routes/sentry-example-api/  # Test API route with explicit capture
  \u2514\u2500\u2500 +server.ts
```

### Environment Variables

| Variable            | Where    | Description                                 |
| ------------------- | -------- | ------------------------------------------- |
| `SENTRY_DSN`        | Backend  | NestJS Sentry DSN (process.env)             |
| `PUBLIC_SENTRY_DSN` | Frontend | SvelteKit Sentry DSN (build-time + runtime) |

**Frontend requires both:**

1. **Build ARG** in Dockerfile.frontend \u2192 embedded in client bundle via `$env/static/public`
2. **Runtime ENV** in docker-compose.yml \u2192 used by `instrumentation.server.ts` (SSR)

**DSN = Public** (not a secret): Only allows event submission, not data access. Can be rotated in Sentry dashboard if abused.

### Important Notes (Phase 3)

- **SvelteKit +server.ts routes**: Sentry does NOT auto-capture errors. Use explicit `Sentry.captureException(error)` before throwing.
- **Separate DSNs**: Backend and Frontend can share DSN or use different projects
- **Session Replay**: Enabled for frontend (10% sessions, 100% on error)
- **GitHub Issue #13224**: Reference for +server.ts capture limitation
- **Optional Sentry**: Leave `PUBLIC_SENTRY_DSN=""` to disable frontend Sentry

## Context

After completing the SvelteKit migration (Phase 3), we need an alerting and monitoring system for production. Without error tracking, we are blind when the app crashes.

Our tech stack consists of SvelteKit 5 (Frontend), NestJS 11 + Fastify 5 (Backend), TypeScript, PostgreSQL 17, Redis 7, Nginx, and Docker Compose. Logging is being migrated to Pino (see PINO-LOGGING-PLAN.md).

We evaluated three options:

**Option 1: Sentry SaaS** - Error tracking as a cloud service with native SDKs for SvelteKit (`@sentry/sveltekit`) and NestJS (`@sentry/nestjs`). Features: Automatic error capture, source maps, distributed tracing, session replay, alerting. No infrastructure required.

**Option 2: Sentry Self-Hosted** - Same features as SaaS, but self-hosted. Requires at least 32 GB RAM (16 GB + 16 GB Swap), 4 CPU cores with SSE 4.2, and deploys 23+ Docker containers (Kafka, Zookeeper, ClickHouse, Snuba, etc.). Source: [Sentry Self-Hosted Docs](https://develop.sentry.dev/self-hosted/)

**Option 3: PLG Stack (Prometheus + Loki + Grafana)** - Open-source observability stack. Prometheus for metrics, Loki for log aggregation (perfect Pino integration), Grafana for dashboards. Requires only 4-8 GB RAM and 4 containers. However, does not provide automatic error tracking, source maps, or session replay.

## Decision

We use a **combined observability stack**:

1. **Sentry SaaS** for error tracking (exceptions, session replay, alerting)
2. **PLG Stack** for logs, metrics, and dashboards (Prometheus + Loki + Grafana)
3. **Pino** as the central logger with pino-loki transport to Grafana

Sentry Self-Hosted is rejected due to disproportionate resource requirements (32 GB RAM, 23+ containers for error tracking) - this massively violates the KISS principle.

**Sentry SaaS** is optimal for error tracking because:

- Native SDKs for exactly our stack (SvelteKit + NestJS)
- Zero-config error tracking with source maps
- Session replay enables "video reproduction" of bugs
- Distributed tracing from frontend to backend

**PLG Stack** is necessary for observability because:

- Centralized log aggregation (all Pino logs searchable in Grafana)
- System metrics (CPU, RAM, requests/sec, response times)
- Custom dashboards for team visibility
- Alerting on performance issues (not just errors)
- Sentry only tracks errors, not regular logs or metrics

## Consequences

**Positive:**

- Immediate visibility of production errors (Sentry)
- Session replay accelerates bug reproduction (Sentry)
- Centralized log search across all containers (Loki)
- System metrics and performance monitoring (Prometheus)
- Custom dashboards for team (Grafana)
- Pino logs flow automatically to Grafana (pino-loki)

**Negative:**

- External dependency on Sentry (SaaS)
- Error data stored with third-party provider
- Free tier has limits (5k errors, 1 user, 7-day retention)
- PLG Stack requires ~4-8 GB extra RAM
- 3-4 additional containers (Loki, Prometheus, Grafana)

**Neutral:**

- Sentry and PLG Stack are complementary, not competing
- PLG Stack is self-hosted (full control over log data)

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

### Pino \u2192 Loki Integration

- [pino-loki v3.0.0 (npm)](https://www.npmjs.com/package/pino-loki) - Pino transport for Loki
- [pino-loki (GitHub)](https://github.com/Julien-R44/pino-loki) - Source Code
- [Grafana Dashboard: Pino HTTP Logs](https://grafana.com/grafana/dashboards/21900-pino-http-logs/) - Ready-made dashboard for pino-http

---

## Phase 5: PLG Stack Implementation Plan

### Architecture

```
\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502                     OBSERVABILITY STACK                          \u2502
\u251c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524
\u2502                                                                  \u2502
\u2502  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510     \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510     \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510        \u2502
\u2502  \u2502   Backend   \u2502     \u2502  Frontend   \u2502     \u2502   Nginx     \u2502        \u2502
\u2502  \u2502  (NestJS)   \u2502     \u2502 (SvelteKit) \u2502     \u2502             \u2502        \u2502
\u2502  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2518     \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2518     \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2518        \u2502
\u2502         \u2502                   \u2502                   \u2502                \u2502
\u2502         \u2502 Pino Logs         \u2502 (future)          \u2502 Access Logs   \u2502
\u2502         \u25bc                   \u25bc                   \u25bc                \u2502
\u2502  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510    \u2502
\u2502  \u2502                      pino-loki                           \u2502    \u2502
\u2502  \u2502              (Transport: Pino \u2192 Loki)                   \u2502    \u2502
\u2502  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518    \u2502
\u2502                            \u2502                                     \u2502
\u2502                            \u25bc                                     \u2502
\u2502  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510    \u2502
\u2502  \u2502                        LOKI                              \u2502    \u2502
\u2502  \u2502              (Log Aggregation & Storage)                \u2502    \u2502
\u2502  \u2502                     Port: 3100                          \u2502    \u2502
\u2502  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518    \u2502
\u2502                            \u2502                                     \u2502
\u2502  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510    \u2502
\u2502  \u2502                         \u2502                                \u2502    \u2502
\u2502  \u2502                    \u250c\u2500\u2500\u2500\u2500\u25bc\u2500\u2500\u2500\u2500\u2510                          \u2502    \u2502
\u2502  \u2502                    \u2502 GRAFANA \u2502                          \u2502    \u2502
\u2502  \u2502                    \u2502Port:3050\u2502                          \u2502    \u2502
\u2502  \u2502                    \u2514\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2518                          \u2502    \u2502
\u2502  \u2502                         \u2502                                \u2502    \u2502
\u2502  \u2502            \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510                  \u2502    \u2502
\u2502  \u2502            \u2502            \u2502            \u2502                   \u2502    \u2502
\u2502  \u2502       \u250c\u2500\u2500\u2500\u2500\u25bc\u2500\u2500\u2500\u2510  \u250c\u2500\u2500\u2500\u2500\u2500\u25bc\u2500\u2500\u2500\u2500\u2510  \u250c\u2500\u2500\u2500\u25bc\u2500\u2500\u2500\u2500\u2510             \u2502    \u2502
\u2502  \u2502       \u2502  Logs  \u2502  \u2502 Metrics  \u2502  \u2502 Alerts \u2502             \u2502    \u2502
\u2502  \u2502       \u2502 (Loki) \u2502  \u2502(Promethe)\u2502  \u2502        \u2502             \u2502    \u2502
\u2502  \u2502       \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518             \u2502    \u2502
\u2502  \u2502                                                         \u2502    \u2502
\u2502  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518    \u2502
\u2502                                                                  \u2502
\u2502  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510    \u2502
\u2502  \u2502                    PROMETHEUS                            \u2502    \u2502
\u2502  \u2502              (Metrics Collection)                        \u2502    \u2502
\u2502  \u2502                     Port: 9090                          \u2502    \u2502
\u2502  \u2502                                                         \u2502    \u2502
\u2502  \u2502  Scrapes:                                               \u2502    \u2502
\u2502  \u2502  - Backend /metrics (NestJS)                            \u2502    \u2502
\u2502  \u2502  - Node Exporter (System Metrics)                       \u2502    \u2502
\u2502  \u2502  - PostgreSQL Exporter (DB Metrics)                     \u2502    \u2502
\u2502  \u2502  - Redis Exporter (Cache Metrics)                       \u2502    \u2502
\u2502  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518    \u2502
\u2502                                                                  \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
```

### Implementation Tasks

**Phase 5a: Docker Compose + Loki** \u2705

- [x] Add Loki container to docker-compose.yml
- [x] Add Grafana container to docker-compose.yml
- [x] Configure Loki data source in Grafana
- [x] Test Loki is receiving logs

**Phase 5b: pino-loki Transport** \u2705

- [x] Install pino-loki in backend: `pnpm add pino-loki`
- [x] Configure pino transport to send logs to Loki
- [x] Verify logs appear in Grafana

**Phase 5c: Prometheus Metrics** \u2705

- [x] Add Prometheus container to docker-compose.yml
- [x] Add @willsoto/nestjs-prometheus to backend
- [x] Expose /metrics endpoint in NestJS (/api/v2/metrics)
- [x] Configure Prometheus to scrape backend
- [x] Add Prometheus data source in Grafana
- [x] Configure remote_write to Grafana Cloud

**Phase 5d: Grafana Dashboards** \u2705

- [x] Create custom Assixx Backend Overview dashboard (assixx-overview.json)
- [x] Create Assixx Full Dashboard with Logs (assixx-full-dashboard.json)
- [x] Configure Grafana Cloud remote access

**Phase 5e: Grafana Cloud Integration** \u2705 (2026-01-12)

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
