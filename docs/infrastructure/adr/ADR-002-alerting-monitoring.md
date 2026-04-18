# ADR-002: Alerting and Monitoring Stack

**Date:** 2026-01-11

## Status

**Accepted** - Implementation Phase 1-5 + Production-Hardening (5f, 5g) Complete (2026-04-18)

### Implementation Progress

| Phase | Component             | Status            | Notes                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----- | --------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1a    | Pino Backend          | \u2705 Complete   | Replaced Winston, pino-pretty in dev, JSON in prod                                                                                                                                                                                                                                                                                                                                                                           |
| 1b    | Pino Frontend         | \u2705 Complete   | logger.ts utility, esbuild.drop, security fixes (2026-01-12)                                                                                                                                                                                                                                                                                                                                                                 |
| 1c    | Console Migration     | \u2705 Complete   | 334 calls \u2192 createLogger() - Best Practice (2026-01-13)                                                                                                                                                                                                                                                                                                                                                                 |
| 2     | Sentry Backend        | \u2705 Complete   | @sentry/nestjs integrated, 5xx errors only                                                                                                                                                                                                                                                                                                                                                                                   |
| 3     | Sentry Frontend       | \u2705 Complete   | @sentry/sveltekit with Session Replay, explicit capture                                                                                                                                                                                                                                                                                                                                                                      |
| 4     | Source Maps           | \U0001f532 Future | CI/CD Pipeline - not blocking for dev                                                                                                                                                                                                                                                                                                                                                                                        |
| 5     | PLG Stack             | \u2705 Complete   | Prometheus + Loki + Grafana + pino-loki (2026-01-12)                                                                                                                                                                                                                                                                                                                                                                         |
| 5f    | DB + Cache Visibility | \u2705 Complete   | postgres-exporter v0.18.0 + redis-exporter v1.74.0 scraped by Prometheus (2026-04-18)                                                                                                                                                                                                                                                                                                                                        |
| 5g    | Alert Rules as Code   | \u2705 Complete   | 3 critical rules in `docker/grafana/alerts/*.json`, idempotent `apply.sh` (2026-04-18)                                                                                                                                                                                                                                                                                                                                       |
| 5h    | Distributed Tracing   | \u2705 Complete   | OTel SDK + local Tempo + Grafana Cloud Tempo fan-out + log↔trace + exemplars + quota alert. See [ADR-048](./ADR-048-distributed-tracing-tempo-otel.md) + [FEAT_TEMPO_OTEL_MASTERPLAN.md](../../FEAT_TEMPO_OTEL_MASTERPLAN.md). Phase 1–5 shipped 2026-04-18 to 2026-04-19 (9 sessions). 7 Alert Rules live (added `07-tempo-cloud-quota-high`). Debug workflow: [HOW-TO-TRACE-DEBUG.md](../../how-to/HOW-TO-TRACE-DEBUG.md). |

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

### New Containers (Phase 5 + 5f)

| Container                | Image                                         | Port | Purpose                                      |
| ------------------------ | --------------------------------------------- | ---- | -------------------------------------------- |
| assixx-loki              | grafana/loki:3.7.1                            | 3100 | Log aggregation                              |
| assixx-grafana           | grafana/grafana:12.4.2                        | 3050 | Dashboards                                   |
| assixx-prometheus        | prom/prometheus:v3.11.1                       | 9090 | Metrics scraper                              |
| assixx-postgres-exporter | prometheuscommunity/postgres-exporter:v0.18.0 | 9187 | DB metrics (connections, locks, bgwriter)    |
| assixx-redis-exporter    | oliver006/redis_exporter:v1.74.0-alpine       | 9121 | Cache metrics (hit ratio, memory, evictions) |

### Environment Variables (Phase 5 + 5f + 5g)

| Variable                        | Where                  | Description                                              |
| ------------------------------- | ---------------------- | -------------------------------------------------------- |
| `LOKI_URL`                      | Backend                | Loki endpoint (http://loki:3100)                         |
| `GF_SECURITY_ADMIN_PASSWORD`    | Grafana                | Admin password                                           |
| `GF_SERVER_ROOT_URL`            | Grafana                | External URL                                             |
| `GRAFANA_CLOUD_USER`            | Prometheus             | Grafana Cloud Prometheus username (2910443)              |
| `GRAFANA_CLOUD_API_KEY`         | Prometheus             | `MetricsPublisher` scope — remote_write (metrics + logs) |
| **`GRAFANA_CLOUD_ADMIN_TOKEN`** | CLI (curl, grafanactl) | `Admin` scope — Provisioning-API (Phase 5g) + grafanactl |
| `LOKI_HOST`                     | Backend                | Grafana Cloud Loki URL for pino-loki transport           |
| `LOKI_USERNAME`                 | Backend                | Grafana Cloud Loki username                              |
| `LOKI_PASSWORD`                 | Backend                | Grafana Cloud Loki API key                               |

> **Separation of scopes:** `GRAFANA_CLOUD_API_KEY` darf NUR Metriken/Logs schreiben (remote_write),
> kann aber keine Alerts/Dashboards verändern. `GRAFANA_CLOUD_ADMIN_TOKEN` hat volle Admin-Rechte —
> nie für Backend-Processes verwenden, nur für CLI/Scripts. Bei Leak einzeln rotieren.

### Grafana Cloud URLs

| Service    | URL                                                   |
| ---------- | ----------------------------------------------------- |
| Prometheus | https://prometheus-prod-65-prod-eu-west-2.grafana.net |
| Loki       | https://logs-prod-042.grafana.net                     |
| Grafana    | https://assixxdev.grafana.net                         |

### Resource Requirements

| Component         | RAM          | CPU      | Storage         |
| ----------------- | ------------ | -------- | --------------- |
| Loki              | 1-2 GB       | 0.5      | 10+ GB (logs)   |
| Grafana           | 512 MB       | 0.25     | 100 MB          |
| Prometheus        | 1-2 GB       | 0.5      | 5+ GB (metrics) |
| postgres-exporter | 32-128 MB    | 0.1-0.5  | minimal         |
| redis-exporter    | 16-64 MB     | 0.1-0.5  | minimal         |
| **Total**         | **3-5.2 GB** | **1.45** | **15+ GB**      |

---

## Phase 5f: DB + Cache Visibility (2026-04-18)

### Motivation

Phase 5c instrumentierte das Backend (`/api/v2/metrics`), aber **PostgreSQL und Redis blieben blind**.
Bei Multi-Tenant-SaaS ist DB-Latenz der #1 Performance-Killer — Backend-Metriken zeigen
"Request slow", aber nicht **warum**. Ohne `up{job="postgres"}` kann Alerting nicht erkennen,
ob die DB ueberhaupt scrapebar ist.

### Implementation

**Containers (siehe Tabelle oben):**

- `assixx-postgres-exporter` — `prometheuscommunity/postgres-exporter:v0.18.0`
  - DATA_SOURCE_URI/USER/PASS via Doppler (vermeidet URL-Encoding-Issues)
  - `PG_EXPORTER_AUTO_DISCOVER_DATABASES=false` (Single-DB-Setup)
  - Liefert: `pg_up`, `pg_stat_database_*`, `pg_locks_count`, `pg_stat_bgwriter_*`, replication lag
- `assixx-redis-exporter` — `oliver006/redis_exporter:v1.74.0-alpine`
  - `REDIS_PASSWORD` via Doppler
  - Liefert: `redis_up`, `redis_keyspace_hits_total`, `redis_memory_used_bytes`,
    `redis_connected_clients`, `redis_evicted_keys_total`

**Prometheus scrape_configs:**

```yaml
- job_name: 'postgres'
  static_configs:
    - targets: ['postgres-exporter:9187']
  scrape_interval: 30s

- job_name: 'redis'
  static_configs:
    - targets: ['redis-exporter:9121']
  scrape_interval: 30s
```

### Verification

```bash
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job:.labels.job, health}'
# All 4 jobs (assixx-backend, postgres, prometheus, redis) must show health=up
```

### Why This Matters

Vor 5f: Prometheus konnte nicht zwischen "Backend slow" und "DB slow" unterscheiden.
Nach 5f: Alert-Rule `up{job="postgres"} == 0` triggert SLO-Verletzungen direkt
auf der DB-Ebene, bevor Backend ueberhaupt einen 500er erzeugt.

---

## Phase 5g: Alert Rules as Code (2026-04-18)

### Motivation

UI-erstellte Alert-Rules sind unsichtbar fuer Code-Review, nicht reproduzierbar
(verschwinden bei Cloud-Account-Migration), und kollidieren mit der KISS-Disziplin
"Single-Source-of-Truth in Git". Provisioning-API + JSON-in-Repo loest beides.

### Implementation

**Verzeichnisstruktur:**

```
docker/grafana/alerts/
├── 01-backend-down.json          # critical, for=2m, up{job="assixx-backend"} < 1
├── 02-postgres-down.json         # critical, for=2m, up{job="postgres"} < 1
├── 03-backend-memory-high.json   # warning, for=5m, assixx_process_resident_memory_bytes > 800 MB
├── apply.sh                      # idempotent (PUT mit deterministischen UIDs, 404→POST fallback)
└── README.md                     # Workflow + Add/Edit/Rotate guidance
```

**Folder & Group:**

- Folder UID: `assixx-prod-alerts` (separate von Cloud-Default-Folder `GrafanaCloud`)
- Group `assixx-critical` — `severity=critical` Rules (Service-Outages)
- Group `assixx-warning` — `severity=warning` Rules (OOM-Frueh-Warnungen)

**Workflow:**

```bash
# Apply alle Rules (idempotent, jederzeit re-runnable)
doppler run -- ./docker/grafana/alerts/apply.sh

# Verify
curl -s -H "Authorization: Bearer $GRAFANA_CLOUD_ADMIN_TOKEN" \
  https://assixx.grafana.net/api/v1/provisioning/alert-rules \
  | jq '.[] | select(.folderUID=="assixx-prod-alerts") | {title, severity:.labels.severity}'
```

### Provisioning-Strategie

`X-Disable-Provenance: true` Header wird gesetzt, damit Rules in der UI
fuer **Notfall-Hot-Fixes editierbar** bleiben. Die JSON in Git bleibt aber
die Wahrheit — naechster `apply.sh`-Run ueberschreibt UI-Edits.

### Token-Management

| Variable                    | Where                | Scope                             |
| --------------------------- | -------------------- | --------------------------------- |
| `GRAFANA_CLOUD_API_KEY`     | Doppler / Prometheus | `MetricsPublisher` (remote_write) |
| `GRAFANA_CLOUD_ADMIN_TOKEN` | Doppler / Manual-CLI | `Admin` (Provisioning-API)        |

**Rotation:** alle 90 Tage (siehe `docker/grafana/alerts/README.md` Workflow).

### Open Items (NOT in this ADR's Scope)

| Item                                                              | Owner       | When               |
| ----------------------------------------------------------------- | ----------- | ------------------ |
| Notification Channel routing (Email/Slack/PagerDuty per severity) | Operations  | Vor erstem Go-Live |
| Token-Rotation-Reminder (Calendar entry, 90d)                     | Operations  | T+90d nach Setup   |
| Dashboards-as-Code (folgender ADR-Pass)                           | Engineering | Wenn 5+ Dashboards |
| `grafanactl` evaluieren (ggf. Migration von curl-Script)          | Engineering | Wenn 10+ Rules     |
