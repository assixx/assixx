# ADR-048: Distributed Tracing mit Grafana Tempo + OpenTelemetry (additiv zu Sentry)

| Metadata                | Value                                                                            |
| ----------------------- | -------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                         |
| **Date**                | 2026-04-18                                                                       |
| **Decision Makers**     | SCS-Technik                                                                      |
| **Affected Components** | docker-compose, Grafana (Datasources), Backend (Phase 2), Pino Logger (Phase 3)  |
| **Supersedes**          | —                                                                                |
| **Related ADRs**        | ADR-002 (Alerting & Monitoring), ADR-006 (CLS), ADR-019 (RLS), PINO-LOGGING-PLAN |

---

## Context

Assixx hat seit ADR-002 Phase 5 einen vollen Observability-Stack:

- **Metrics**: Prometheus + `@willsoto/nestjs-prometheus` + `postgres-exporter` + `redis-exporter` + remote_write nach Grafana Cloud.
- **Logs**: Pino → `pino-loki` → Loki lokal + Grafana Cloud (PINO-LOGGING-PLAN Phase 4 abgeschlossen).
- **Errors + Traces**: Sentry (`@sentry/nestjs` v10.49 im Backend, `@sentry/sveltekit` im Frontend) mit Session Replay, Feedback-Widget, `tracesSampleRate: 0.1` in Prod.
- **Alerting**: Grafana Alert-Rules as Code + Sentry Issue Rules.

Was **fehlt**: Trace-Analyse im Grafana-Workflow. Konkret drei Lücken, die Sentry strukturell nicht schließen kann:

1. **Log → Trace Click-through in Grafana.** Ein Engineer sieht im Loki-Explore einen Error-Log mit `trace_id=abc123`. Um den Trace zu untersuchen muss er derzeit nach Sentry wechseln, dort manuell suchen. Kontext-Switch-Kosten in jedem Debug-Flow.
2. **Metric → Trace via Prometheus Exemplars.** Ein p95-Spike im Latency-Dashboard ist heute nur durch nebenher-Loki-Suche + Zeitabgleich aufzuspüren. Mit Exemplars + Tempo: direkter Klick von Metric-Datenpunkt zum verursachenden Trace.
3. **Tail-Sampling.** Sentry macht Head-Sampling (`tracesSampleRate: 0.1` entscheidet vor Request-Beginn, ob der Trace gesendet wird). Ergebnis: 90 % der Errors + langsamen Requests gehen verloren. Tail-Sampling (Entscheidung nach vollständigem Request-Verlauf) kann **alle** Errors + langsamen Requests behalten und zusätzlich X % der schnellen.

Darüber hinaus als „nice-to-have": 4. TraceQL — deutlich stärkere Trace-Suche als Sentry UI. 5. Günstige Langzeit-Retention auf Object-Storage (bei Assixx-Skala nicht kritisch, aber strategisch). 6. Vendor-Neutralität — OTel ist der Industriestandard, Instrumentierung wird bei Bedarf auf andere Backends schwenkbar.

### Anforderungen

- **Sentry bleibt.** Session Replay, Feedback-Widget, `sentry-tunnel` (Adblocker-Bypass) sind Sentry-exklusive Features, die nicht aufgegeben werden.
- **Single-SDK-Korrelation.** Trace-IDs müssen zwischen Sentry und Tempo identisch sein (W3C Trace-Context), sodass der gleiche Trace in beiden UIs auffindbar ist.
- **Rollback möglich.** Wenn Tempo-Integration Probleme macht, müssen alle Änderungen ohne Datenverlust rückgängig machbar sein.
- **Kein Backend-Blocking.** Wenn Tempo oder der OTel-Collector ausfallen, darf das die normale Request-Verarbeitung nicht beeinträchtigen.

---

## Decision

**Additive Integration:** Grafana Tempo + OpenTelemetry-Collector als neue Container hinzufügen. Sentry-SDK bleibt unverändert.

Backend wird dual-instrumentiert:

1. `@sentry/nestjs` (unverändert) — bedient Sentry-Error-UI, Session-Context, Performance-Monitoring.
2. `@opentelemetry/sdk-node` (neu, Phase 2) — bedient OTel-Collector → Tempo.

Da `@sentry/nestjs` v8+ intern auf OpenTelemetry basiert, werden beide SDKs denselben TracerProvider sharen (via `skipOpenTelemetrySetup: true` in Sentry + eigener NodeTracerProvider mit zwei SpanProcessors: `SentrySpanProcessor` + `BatchSpanProcessor(OTLPTraceExporter)`). Ergebnis: **eine** Instrumentierung, **identische** Trace-IDs, zwei Backends.

### Architektur

```
┌───────────────────────────────────────────────────────────────┐
│  APPLIKATION                                                    │
├───────────────────────────────────────────────────────────────┤
│                                                                 │
│  NestJS Backend                     SvelteKit Frontend          │
│  ├─ @sentry/nestjs         (bleibt) ├─ @sentry/sveltekit (bleibt)│
│  │   → Errors, Session, Performance │   → Errors + Replay + Tracing │
│  └─ @opentelemetry/sdk-node  (neu)  │                           │
│      → OTLP gRPC :4317              │                           │
└────────────┬───────────────────────────────────────────────────┘
             │ OTLP
             ▼
┌───────────────────────────────────────────────────────────────┐
│  OTEL-COLLECTOR (otel/opentelemetry-collector-contrib:0.115.1) │
│  ├─ receiver: otlp (4317 gRPC, 4318 HTTP)                      │
│  ├─ processor: memory_limiter (400 MiB)                        │
│  ├─ processor: tail_sampling                                   │
│  │   ├─ errors-keep-all     (Status: ERROR)                    │
│  │   ├─ slow-keep-all       (latency > 500 ms)                 │
│  │   └─ random-sample       (10 % probabilistic)               │
│  ├─ processor: batch (10 s / 512 spans)                        │
│  └─ exporter: otlp/tempo → tempo:4317                          │
└────────────┬──────────────────────────────────────────────────┘
             ▼
┌───────────────────────────────────────────────────────────────┐
│  TEMPO (grafana/tempo:2.6.1, Single-Binary)                    │
│  ├─ OTLP-Receiver :4317 (internal only)                        │
│  ├─ Storage: Local Volume (Dev) / S3-Compat (Prod-Option)      │
│  ├─ Retention: 72 h                                            │
│  └─ Query API :3200                                            │
└────────────┬──────────────────────────────────────────────────┘
             ▼
┌───────────────────────────────────────────────────────────────┐
│  GRAFANA (bereits vorhanden, lokal + Cloud)                    │
│  ├─ Datasource: Tempo (neu, uid=tempo-ds)                      │
│  ├─ Datasource: Loki → Phase 3: derivedField trace_id → Tempo  │
│  └─ Datasource: Prometheus → Phase 3: exemplars → Tempo        │
└───────────────────────────────────────────────────────────────┘
```

### Tail-Sampling-Policies (initial)

| Policy            | Typ           | Keep-Rule                       | Begründung                                    |
| ----------------- | ------------- | ------------------------------- | --------------------------------------------- |
| `errors-keep-all` | status_code   | Jeder Trace mit Status ERROR    | 100 % Errors — das ist der Debug-Goldstandard |
| `slow-keep-all`   | latency       | Trace-Dauer > 500 ms            | Performance-Investigations brauchen alles     |
| `random-sample`   | probabilistic | 10 % aller übrigen (Happy-Path) | Baseline für Trends, günstig in Storage       |

Tuning nach ~2 Wochen Betrieb. Threshold 500 ms ist konservativ — Assixx-Endpoints haben p95 typischerweise <50 ms (k6-Smoke-Baseline), d. h. Slow-Trigger fängt nur echte Ausreißer.

### Komponentenwahl — Begründung

**Tempo (statt Jaeger/Zipkin):** Object-Storage-nativ = billigste Retention. Native Grafana-Integration. 35-MB-Image. LGTM-Stack-Konsistenz (Loki, Grafana, Tempo, Mimir/Prometheus).

**Collector-Contrib (statt Core):** `tail_sampling` ist nur in der Contrib-Distribution verfügbar. Core hat ausschließlich `probabilistic_sampling` (Head-Sampling, was wir gerade NICHT wollen).

**Dual-Export statt Collector-zu-Sentry-Exporter:** Der OTel-Collector-Contrib hat theoretisch einen `sentryexporter`, aber:

- Community-Plugin-Qualität, weniger Test-Coverage als Sentry-eigene SDKs.
- Session Replay + Feedback-Widget brauchen die `@sentry/sveltekit`-Bundles ohnehin auf der Frontend-Seite → Sentry-SDK kann nicht komplett weg.
- Dual-Export im Backend (~1 ms Overhead) ist akzeptabler Preis für proven code paths.

**Keine Metrics/Logs im Collector (yet):** Logs fließen weiter direkt via `pino-loki` → Loki (etabliertes Setup aus PINO-LOGGING-PLAN). Metrics via `prom-client` → Prometheus-Scrape (etabliert aus ADR-002). Collector macht hier initial **nur Traces**. Später evaluieren, ob Collector-zentrale Log/Metric-Aggregation Mehrwert bringt.

---

## Alternatives Considered

### Alternative 1: Sentry durch Tempo ersetzen

Sentry-SDK raus, OTel-SDK rein, Tempo übernimmt alle Traces.

**Verworfen:**

- Session Replay ist nicht nachbaubar ohne Sentry-SDK im Frontend (DOM-Video-Capture via eigenes Bundle).
- Feedback-Widget + `sentry-tunnel` ebenfalls Sentry-exklusiv.
- Error-UI von Sentry (Releases, Issue-Gruppierung, Alert-Rules) ist deutlich weiter als Grafana Alerting für Error-Tracking.
- Rollback-Risiko hoch: ein Schritt-für-Schritt-Ersatz ist nicht möglich, sondern Big-Bang.

### Alternative 2: Nichts tun — Sentry-only beibehalten

**Verworfen:**

- Die drei identifizierten Lücken (Log↔Trace-Jump, Exemplars, Tail-Sampling) sind reale tägliche Debug-Zeit-Kosten, nicht vanity.
- Strategisch: OTel als Industriestandard ist „Optionalität kaufen" — wenn Sentry in Zukunft teurer wird oder Priorities sich ändern, haben wir instrumentation die woanders hin routet.

### Alternative 3: Grafana Cloud Traces only (managed, kein lokales Tempo)

Keine lokalen Tempo-Container — alles direkt zu Grafana Cloud Traces (50 GB Free-Tier).

**Verworfen für Dev:**

- Dev-Traces wollen offline arbeiten können.
- Grafana-Cloud-Free-Tier hat keine Trace-Retention-Garantien.
- **Prod:** ist sehr wohl eine Option — Phase 5 beschreibt den Prod-Export parallel zu lokalem Tempo.

### Alternative 4: Zipkin/Jaeger statt Tempo

**Verworfen:**

- Jaeger braucht Cassandra/Elasticsearch als Backend → Ops-Overhead und Kosten.
- Zipkin ist bequem für simple Setups, aber schlechtere Grafana-Integration.
- Tempo = für den LGTM-Stack gebaut. Konsistente Storage-Philosophie (Object Store).

### Alternative 5: Collector weglassen, App → Tempo direkt

**Verworfen:**

- Ohne Collector kein Tail-Sampling möglich (das ist clientseitig nicht machbar — Client weiß beim Sampling-Entscheid nicht, ob Request errored oder slow wird).
- Kein Backpressure-Buffer — App-seitige Exporter-Failure würde unter Last Request-Handling blocken.
- Kein fan-out zu mehreren Backends ohne App-Änderung.

---

## Consequences

### Positive

1. **Log → Trace Click-through in Grafana** (Phase 3 aktiviert). Daily-debug-accelerator.
2. **Prometheus Exemplars** (Phase 3). Von Latency-Spike direkt zum Root-Cause-Trace.
3. **100 % Errors + 100 % Slow-Requests** werden aufbewahrt (Tail-Sampling) — früher gingen 90 % davon im Sentry-Head-Sample verloren.
4. **TraceQL** für präzise Trace-Queries.
5. **Vendor-neutral** — OTel-Standard, portabel.
6. **Sentry unangetastet** — Error-Tracking + Session Replay + Feedback bleiben Business-as-usual.

### Negative

1. **Zwei SDKs im Backend** (Sentry + OTel). ~1-5 ms Overhead pro Request, zwei Konfigs zu pflegen.
2. **Zusätzliche Container** (tempo + otel-collector). ~300 MiB RAM zusätzlich, zwei Services zu monitoren.
3. **Collector-Healthcheck** fehlt (Image ist distroless ohne `wget`/`curl`). Readiness nur via Logs sichtbar. Workaround: externes Probing, oder auf Collector-Metrics `:8888` scrapen (Phase 5).
4. **Tempo-Retention in Dev** auf lokalem Volume — bei vollem Volume fallen alte Traces raus. 72 h sollte reichen; Alert bei `tempo_data` > 80 % empfehlenswert.
5. **Grafana-Datasource-Provisioning ist ordnungssensitiv** — explizite UIDs auf bereits-referenzierten Datasources (Loki, Prometheus) können Alert-Rules brechen. Daher: nur Tempo bekommt explizite UID, Loki+Prometheus bleiben auf Auto-UID.
6. **Koexistenz Sentry + OTel ist Sentry-Version-spezifisch.** Bei Sentry-Major-Upgrade (v11+) muss die Integration (SentrySpanProcessor API) neu verifiziert werden.

### Risiken & Mitigationen

| Risiko                                                  | Mitigation                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Sentry + OTel-Traces divergieren (unterschiedliche IDs) | Verifikations-Test in Phase 2: assert gleiche `trace_id` in beiden UIs               |
| Collector OOM bei Last-Spikes                           | `memory_limiter`-Processor (400 MiB hard-cap, Spans werden fallen statt OOM)         |
| Tempo-Volume voll                                       | Compactor-Retention 72 h; Prometheus-Alert auf `tempo_data` Volume-Nutzung (Phase 5) |
| Backend-Dual-SDK-Konflikt                               | `skipOpenTelemetrySetup: true` in Sentry-Init; eigener NodeTracerProvider            |
| Grafana-Provisioning bricht Alert-Rules                 | Loki + Prometheus Auto-UIDs erhalten — keine explizite UID-Setzung                   |

---

## Implementation

### Phase 1 — Infrastruktur (2026-04-18, abgeschlossen)

- `docker/tempo/tempo.yaml` — Single-Binary-Config, 72 h Retention, local storage.
- `docker/otel-collector/collector.yaml` — OTLP-Receiver, tail_sampling, memory_limiter, otlp/tempo Exporter.
- `docker-compose.yml` — Neue Services `tempo` + `otel-collector`, Volume `tempo_data`, Profile `observability` + `production`.
- `grafana/provisioning/datasources/datasources.yml` — Tempo-Datasource mit `uid: tempo-ds`.

**Verification (2026-04-18 14:08 UTC):**

- Tempo `/ready` → HTTP 200
- Collector logs: „Everything is ready"
- End-to-End Test-Span (service.name=smoke-test, 1000 ms duration) via OTLP HTTP :4318 → Collector `tail_sampling` (slow-keep-all) → Tempo → queryable via `/api/traces/<id>` und `/api/search/tag/service.name/values`.
- Tail-Sampling bewiesen: 100-ms-Span wurde gedroppt (Probabilistic 10 %), 1000-ms-Span kept.

### Phase 2 — Backend OTel-SDK (folgt)

- `pnpm add -F backend @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/sdk-trace-node @opentelemetry/exporter-trace-otlp-grpc @opentelemetry/auto-instrumentations-node @sentry/opentelemetry`
- `backend/src/nest/instrument.ts` erweitern: `skipOpenTelemetrySetup: true` in Sentry, eigener NodeTracerProvider mit Sentry- + OTLP-SpanProcessor.
- Resource-Attribute: `service.name=assixx-backend`, `deployment.environment`, `service.version` aus `package.json`.
- Auto-Instrumentations: HTTP, Express/Fastify, pg, Redis. Explicit disable: fs, net, dns (zu verbose).
- OTLP-Endpoint: `http://otel-collector:4317` (Docker-Network).

**Definition of Done:**

- Backend läuft mit beiden SDKs, 0 TypeScript-Errors.
- Sentry zeigt weiter Errors + Performance.
- Tempo zeigt gleiche Traces mit identischer `trace_id`.
- k6-Smoke-Test generiert sichtbare Traces in Tempo.

### Phase 3 — Log ↔ Trace Korrelation

- Pino-Mixin in `logger.module.ts`: aktuellen Span aus `@opentelemetry/api` holen, `trace_id`/`span_id` in jeden Log-Record mergen.
- Grafana-Datasources erweitern: Loki `derivedFields` matcht `trace_id=([a-f0-9]{32})` → Tempo.
- Prometheus `exemplarTraceIdDestinations` aktivieren.
- `prom-client` Histograms: `enableExemplars: true`.

### Phase 4 — Dashboards

- Grafana-Dashboard „Backend Traces" — p95/p99 per Endpoint aus Tempo-Metrics, Top-Slow-Traces, Error-Traces-Feed.
- Optional: Tempo `metrics_generator` aktivieren → Service-Graph (automatisches Dependency-Diagram).

### Phase 5 — Prod + Grafana Cloud Traces

- Zweiter Exporter im Collector: `otlp/grafana-cloud` mit Cloud-OTLP-Endpoint + API-Key.
- Prometheus-Exemplar-remote_write zu Grafana Cloud.
- Tempo-Local bleibt als Dev-Backup; Prod-Traces in Cloud-Tempo (Retention + Skalierbarkeit).
- Volume-Usage-Alert für `tempo_data`.

---

## Verification Commands

```bash
# Tempo ready?
curl -s http://localhost:3200/ready  # → "ready"

# Services in Tempo?
curl -s http://localhost:3200/api/search/tag/service.name/values

# Search all recent traces?
curl -s "http://localhost:3200/api/search?limit=10"

# Collector logs zeigen Verarbeitung?
docker logs assixx-otel-collector --tail 30 | grep -iE "traces|error"

# Test-Span schicken (ohne Backend)
curl -s -X POST http://localhost:4318/v1/traces \
  -H 'Content-Type: application/json' \
  -d '{"resourceSpans":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"manual-test"}}]},"scopeSpans":[{"scope":{"name":"curl"},"spans":[{"traceId":"aabbccddeeff00112233445566778899","spanId":"abcdef0123456789","name":"test","startTimeUnixNano":"1776520000000000000","endTimeUnixNano":"1776520001000000000","kind":2}]}]}]}'
```

---

## References

- [Grafana Tempo Documentation](https://grafana.com/docs/tempo/latest/)
- [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/)
- [Tail-Sampling Processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/tailsamplingprocessor)
- [Sentry + OpenTelemetry Integration](https://docs.sentry.io/platforms/javascript/guides/node/opentelemetry/)
- [ADR-002: Alerting & Monitoring](./ADR-002-alerting-monitoring.md)
- [PINO-LOGGING-PLAN](../../plans/PINO-LOGGING-PLAN.md) — upstream der Log-Pipeline
- [FEAT_TEMPO_OTEL_MASTERPLAN](../../FEAT_TEMPO_OTEL_MASTERPLAN.md) — detaillierter Phase-Plan
