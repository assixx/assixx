# How to Debug with Traces — from User Complaint to Root Cause

> **Audience:** Backend engineers debugging a slow or failing request.
> **Goal:** Starting from a vague user complaint ("it was slow at ~14:30"), land on the exact span that caused it.
> **Stack:** OpenTelemetry SDK → local OTel Collector (tail-sampled) → local Tempo + Grafana Cloud Tempo (Phase 5 fan-out). See [ADR-048](../infrastructure/adr/ADR-048-distributed-tracing-tempo-otel.md) and [FEAT_TEMPO_OTEL_MASTERPLAN.md](../FEAT_TEMPO_OTEL_MASTERPLAN.md).

---

## Quick Reference

```bash
# Local Tempo (dev): direct query by trace_id
curl -s "http://localhost:3200/api/traces/<TRACE_ID>" | jq '.batches[].scopeSpans[].spans | length'

# Local Tempo: search recent backend traces
curl -s 'http://localhost:3200/api/search?tags=service.name%3Dassixx-backend&limit=10' | jq

# Backend log → extract trace_id
docker logs assixx-backend --since 10s 2>&1 | grep -E 'trace_id' | head -3

# Grafana UI (local, dev):
#   http://localhost:3050 → Explore → Loki → {service="backend"} |~ "trace_id"
#   Click log → "View Trace" link → Tempo waterfall opens

# Grafana UI (Cloud, same trace_id resolves here too after ~2 min):
#   https://assixx.grafana.net → Explore → grafanacloud-traces → Search → service.name=assixx-backend
```

Detailed commands: [COMMON-COMMANDS.md §10a](../COMMON-COMMANDS.md#10a-tempo--otel-trace-verification-adr-048).

---

## Decision Tree — What info do you have?

```
User complaint received
│
├─ "Request ID: abc123…" or trace_id-like hex
│     → skip to §2 (trace_id lookup)
│
├─ "It was slow around 14:30"
│     → skip to §3 (time-window search)
│
└─ "It's just slow sometimes" / "it feels wrong"
      → skip to §1 (error-rate + dashboard triage first)
```

---

## 1. Triage: is it real? (Error Rate + Latency Dashboard)

Before diving into traces, verify there _is_ a spike. Saves time on phantom issues.

**Open:** Grafana → Dashboards → **Backend Traces** (uid `assixx-traces`).

| Panel                                                  | What to look for                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| p50/p95/p99 latency per route                          | A route where p95 spikes against the rest → that's your target                       |
| 4xx/5xx error rate                                     | Stacked bar: 5xx climbing = server bug, 4xx = client misuse or validation tightening |
| Top 20 slowest traces (TraceQL `{ duration > 500ms }`) | Rows clickable → Tempo trace opens in Explore                                        |
| Top 20 error traces (TraceQL `{ status = error }`)     | Same, for errored traces                                                             |

If **all panels are flat** and user still complains → likely the complaint is off-base, verify the time window + the complaint scope (wrong environment? different tenant?).

If a spike is visible → grab one trace_id from Panel 3 or 4 and jump to §4 (waterfall reading).

---

## 2. Starting from a known `trace_id`

### 2a. Verify it's in local Tempo

```bash
curl -s "http://localhost:3200/api/traces/<TRACE_ID>" \
  | jq '{spans: [.batches[].scopeSpans[].spans[] | {name, kind, duration: ((.endTimeUnixNano|tonumber) - (.startTimeUnixNano|tonumber))}] | length}'
```

If this returns `{spans: 0}` or 404: the trace was dropped by tail-sampling.

**Tail-sampling drops a trace unless:**

- It errored (status_code = ERROR) — `errors-keep-all` policy
- Root span duration > 500 ms — `slow-keep-all` policy
- Random 10 % probabilistic sample — `random-sample` policy

Config reference: `docker/otel-collector/collector.yaml` processors block.

### 2b. Check Grafana Cloud Tempo (fan-out lands the same trace_id there too)

Grafana Cloud → Explore → Datasource `grafanacloud-traces` → Search → paste `<TRACE_ID>` → Run.

Cloud ingestion latency is ~1–2 min; if the request is < 2 min old, wait briefly.

### 2c. If still missing: raise sampling and reproduce

```bash
# Edit docker/otel-collector/collector.yaml:
#   policies → random-sample → sampling_percentage: 10  →  100
# Then:
doppler run -- docker-compose -f docker/docker-compose.yml up -d --force-recreate otel-collector
# Reproduce the request. Restore 10 % when done (commit revert).
```

---

## 3. Starting from a time window only

### 3a. Loki first — find a log line from the affected request

```bash
# Grafana UI:
#   Explore → Loki → {service="backend"} |~ "<error|route|tenant>" for last 30m
```

Find a log matching the complaint (error message, specific route, specific tenantId). Every backend log line has `trace_id` injected via `otelTraceMixin` (Phase 3a). Click the log row → derivedField **View Trace** → Tempo waterfall.

### 3b. TraceQL directly — filter by attribute

Grafana → Explore → Datasource **Tempo** (local: `tempo-ds`, Cloud: `grafanacloud-traces`) → Query Type **TraceQL**:

```traceql
{ resource.service.name = "assixx-backend" && http.route = "/api/v2/users" && duration > 500ms }
```

Swap labels by what you know: `http.status_code = 500`, `db.statement =~ ".*users.*"`, `tenant.id = 42`, etc.

---

## 4. Reading the waterfall

Once the trace is open in Tempo, the flame/waterfall view shows every span. Read top-down:

| Span layer            | Typical name                                                       | What it tells you                                     |
| --------------------- | ------------------------------------------------------------------ | ----------------------------------------------------- |
| Root                  | `assixx-backend: <METHOD> <route> <status>`                        | Total request duration + final status code            |
| Fastify lifecycle     | `request`, `onRequest`, `preHandler`, `onResponse`                 | Framework overhead (normally < 2 ms each)             |
| NestJS route handler  | `<Controller>.<method>`                                            | Where the business logic starts                       |
| Guards / Interceptors | `JwtAuthGuard.canActivate`, `AuditInterceptor.intercept`           | Auth/audit cross-cutting cost                         |
| Service calls         | `<Service>.<method>` (only if manually instrumented — most aren't) | Business logic sub-operations                         |
| `pg` driver           | `pg.query`, `pg.connect`, `pg.release`                             | DB queries — **the #1 source of latency**             |
| Outbound HTTP         | `http.request`                                                     | External API calls (Sentry, Grafana Cloud push, etc.) |

**The 80/20 rule:** in Assixx, ~80 % of slow-trace causes are DB. Look at `pg.*` span durations first.

### Latency pattern cheat sheet

| Pattern in waterfall                                 | Likely cause                                                               | Fix direction                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| One `pg.query` span ≫ all others                     | Slow SQL — missing index, full table scan, cross-tenant leak bypassing RLS | `EXPLAIN ANALYZE` the query in `docker exec assixx-postgres psql ...` |
| Many sequential `pg.query` spans                     | N+1 pattern — loop doing one query per item                                | Use a single `WHERE id = ANY($1)` query or a JOIN                     |
| Many `pg.query` spans that look identical in content | Missing query-level cache or stale Redis                                   | Check Redis connection span; add TTL cache                            |
| Long gap between parent and first child span         | Serial `await` where `Promise.all` would parallelise                       | Refactor service method to `Promise.all([q1, q2])`                    |
| Huge gap in `onResponse`                             | Response body serialisation (large payload)                                | Check payload size; paginate; strip unused fields                     |
| First span after startup is slow, rest normal        | Cold start (connection pool warmup) — usually ignorable                    | Confirm steady-state is fast                                          |
| `http.request` to an external host takes seconds     | Upstream latency (Grafana Cloud OTLP, Sentry)                              | Usually harmless — check if retry happened                            |

### Cross-reference with logs

Every span carries the trace_id. To see what the app _logged_ during that span, open Grafana → Explore → Loki → `{service="backend"} |~ "<TRACE_ID>"`. All log lines within that request show up, in order.

---

## 5. Troubleshooting the tooling itself

If the debug flow breaks somewhere, the issue is usually in the tooling stack, not the application. Check in this order:

### No `trace_id` field in the log line

```bash
# Is OTel active?
docker exec assixx-backend printenv OTEL_TEMPO_ENABLED
# Expected: "true"
```

If empty/false: Phase 2b's feature flag isn't set. Flip it:

```bash
cd docker && OTEL_TEMPO_ENABLED=true doppler run -- docker-compose up -d --force-recreate backend deletion-worker
```

### Trace present in Tempo but no `pg.query` spans

Check that `@opentelemetry/instrumentation-pg` is active (it's part of `getNodeAutoInstrumentations` in `backend/src/nest/instrument.ts`). If spans for HTTP are present but DB is missing → the driver version may not be supported by the auto-instrumenter; open an issue referencing the installed `pg` version.

### Trace is in local Tempo but not in Grafana Cloud

Check collector exporter status:

```bash
docker logs assixx-otel-collector --since 5m 2>&1 | grep -iE "otlphttp|error|4[0-9][0-9]|5[0-9][0-9]"
```

Common issues:

- `401 Unauthorized` → Grafana Cloud token invalid / scope missing `traces:write` → re-set `GRAFANA_CLOUD_OTLP_AUTH_B64` in Doppler and recreate collector
- `missing selected ALPN property` → you reverted Phase 5 D9 and are using the gRPC `otlp/` exporter against Cloud (the gRPC path doesn't work — see [masterplan D9](../FEAT_TEMPO_OTEL_MASTERPLAN.md#spec-deviations))
- `429 Too Many Requests` → Free-Tier quota exceeded (check alert `assixx-tempo-cloud-quota-high` in Grafana Cloud)

### Backend 200 OK, but the error message in Grafana doesn't make sense

The `beforeSend` filter in `instrument.ts` drops Sentry events matching `/Not Found|Validation/` (ADR-002). If the actual error is a 404 or validation, it _will_ appear in Tempo + Loki but _won't_ ping Sentry — that's intentional.

### Spans have gaps larger than the total duration

You're looking at parent spans whose children span-processor batched late. The rendering is correct, the visual gap is rendering artefact from delayed span export. Cross-check with Loki logs — if the log lines are contiguous in wall-clock time, ignore the visual gap.

---

## 6. When NOT to use traces

- **High-cardinality counting** — use Prometheus metrics, not trace scanning
- **Aggregation over weeks** — Tempo retention is 72 h locally, 14 d on Grafana Cloud Free; older data is gone
- **Security audit** — audit_trail table is authoritative; traces are best-effort with tail-sampling holes
- **Business metrics** — not a product of tracing; use dedicated counters/histograms via prom-client

---

## 7. Related

- [ADR-048 Distributed Tracing with Tempo + OTel](../infrastructure/adr/ADR-048-distributed-tracing-tempo-otel.md) — the decision record
- [FEAT_TEMPO_OTEL_MASTERPLAN.md](../FEAT_TEMPO_OTEL_MASTERPLAN.md) — execution history, spec deviations D1–D10
- [COMMON-COMMANDS.md §10a](../COMMON-COMMANDS.md#10a-tempo--otel-trace-verification-adr-048) — raw commands
- [HOW-TO-ENABLE-DEBUG-LOGGING](./HOW-TO-ENABLE-DEBUG-LOGGING.md) — when trace+log-level INFO isn't enough, bump to DEBUG
- [ADR-002 Alerting & Monitoring](../infrastructure/adr/ADR-002-alerting-monitoring.md) — the broader observability stack
- Grafana Cloud quota alert rule: `docker/grafana/alerts/07-tempo-cloud-quota-high.json`

---

**Last updated:** 2026-04-19 (Phase 6, ADR-048)
