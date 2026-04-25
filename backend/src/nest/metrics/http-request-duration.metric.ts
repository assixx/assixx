/**
 * HTTP Request Duration Histogram (ADR-048 Phase 3b / FEAT_TEMPO_OTEL_MASTERPLAN)
 *
 * Hot-path histogram for request latency. When PROMETHEUS_EXEMPLARS_ENABLED
 * is ON, each observation carries the active OTel trace_id + span_id as
 * OpenMetrics exemplar labels, enabling one-click metric→trace navigation
 * in Grafana (click exemplar dot on a latency graph → Tempo opens the
 * corresponding trace).
 *
 * `enableExemplars: true` is set unconditionally and is safe when the env
 * flag is OFF: it only permits exemplar emission via the
 * `observe({labels, value, exemplarLabels})` form, which the Fastify hook
 * in main.ts calls only when the flag is ON. With the flag OFF, `observe()`
 * is called with the legacy 2-arg form and no exemplars are attached — the
 * on-wire output is byte-identical to pre-3b metrics (Stage 3b-a invariant).
 *
 * @see docs/FEAT_TEMPO_OTEL_MASTERPLAN.md — Session 3b / Step 3.3.1
 * @see docs/infrastructure/adr/ADR-048-distributed-tracing-tempo-otel.md
 */
import { Histogram, register } from 'prom-client';

/**
 * Prometheus metric name. Matches the existing `assixx_` prefix convention
 * used by `defaultMetrics` (see metrics.module.ts).
 */
export const HTTP_REQUEST_DURATION_SECONDS = 'assixx_http_request_duration_seconds';

/**
 * Gate exemplar construction on the env flag. prom-client throws
 * `TypeError: Exemplars are supported only on OpenMetrics registries` if
 * the Histogram constructor is called with `enableExemplars: true` while
 * the global registry is still in plain-Prometheus mode. With the flag
 * OFF (Stage 3b-a default) the controller does NOT call setContentType,
 * so the registry stays in plain-Prometheus mode — we therefore must also
 * set `enableExemplars: false` on the histogram. Flag ON → controller
 * switches registry to OpenMetrics first (ES-module depth-first load
 * order: app.module → metrics.module → metrics.controller runs
 * setContentType BEFORE main.ts's histogram import resolves), then the
 * Histogram construction with `enableExemplars: true` is accepted.
 */
const exemplarsEnabled = process.env['PROMETHEUS_EXEMPLARS_ENABLED'] === 'true';

/**
 * Latency histogram with bounded label cardinality (method × route × status).
 *
 * Buckets tuned to k6 smoke baseline 2026-04-18: p50 ~10 ms, p95 ~24 ms,
 * p99 ~38 ms. Fine-grained below 100 ms; coarser above to catch outliers
 * (DB contention, cold cache, network stall) without wasting cardinality.
 *
 * Generic type is intentionally `string` (not the narrow `'method' | 'route'
 * | 'status'` union that would be inferred): prom-client's
 * `observe({exemplarLabels})` restricts exemplarLabels to the same generic
 * `T`, but OpenMetrics exemplars carry orthogonal labels (trace_id/span_id)
 * that are not dimensions of the metric. Widening `T` to `string` lets us
 * attach exemplar labels at runtime without declaring them as metric
 * dimensions (which would explode cardinality). Runtime label validation
 * is still enforced via `labelNames`.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-arguments -- explicit <string> prevents TS from narrowing T to the labelNames union ('method'|'route'|'status'), which would reject arbitrary exemplarLabels (trace_id/span_id) that prom-client's runtime accepts. See https://github.com/siimon/prom-client README §Exemplars + OpenMetrics spec.
export const httpRequestDurationHistogram: Histogram<string> = new Histogram<string>({
  name: HTTP_REQUEST_DURATION_SECONDS,
  help: 'Duration of HTTP requests in seconds (labels: method, route, status)',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  enableExemplars: exemplarsEnabled,
  registers: [register],
});
