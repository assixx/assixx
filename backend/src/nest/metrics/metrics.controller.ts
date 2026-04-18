/**
 * Prometheus Metrics Controller
 *
 * Exposes /api/v2/metrics endpoint for Prometheus scraping.
 * Standalone controller (not extending PrometheusController) to avoid
 * Fastify "Reply already sent" errors with the \@Res decorator.
 *
 * Content-Type behaviour (ADR-048 / Session 3b):
 *   PROMETHEUS_EXEMPLARS_ENABLED=false (default) →
 *     `text/plain; version=0.0.4; charset=utf-8` — legacy Prometheus format.
 *     Backward-compatible with pre-3b scrape behaviour (Stage 3b-a invariant).
 *   PROMETHEUS_EXEMPLARS_ENABLED=true →
 *     `application/openmetrics-text; version=1.0.0; charset=utf-8`
 *     Required so exemplars serialize on the wire. Source: prom-client
 *     README L407 — "When using exemplars, the registry used for metrics
 *     should be set to OpenMetrics type". Verified upstream in Session 3.5
 *     pre-flight review.
 *
 * Flag resolution happens at module load (container boot). Flipping the
 * flag requires container recreation — same ceremony as OTEL_TEMPO_ENABLED
 * in Phase 2b. Per-request Accept-header negotiation was considered but
 * would require `@Res`/FastifyReply, which was previously rejected in this
 * codebase due to "Reply already sent" errors.
 *
 * @see docs/FEAT_TEMPO_OTEL_MASTERPLAN.md — Session 3b / Step 3.3.3
 * @see docs/adr/ADR-002-alerting-monitoring.md
 */
import { Controller, Get, Header } from '@nestjs/common';
import { Registry, type RegistryContentType, register } from 'prom-client';

import { Public } from '../common/decorators/public.decorator.js';

const exemplarsEnabled = process.env['PROMETHEUS_EXEMPLARS_ENABLED'] === 'true';

// Configure the global registry to OpenMetrics format once at module load
// when exemplars are enabled. The global `register` is the same instance
// used by @willsoto/nestjs-prometheus defaultMetrics (see metrics.module.ts),
// so this switch affects the full output surface of /api/v2/metrics.
//
// Cast to Registry<RegistryContentType>: the exported `register` is typed as
// `Registry<PrometheusContentType>` (default generic), which rejects the
// OpenMetrics literal. RegistryContentType is the union `Prometheus |
// OpenMetrics`, so the widened type accepts both at compile time; runtime
// behaviour is identical (same singleton, same setContentType body).
if (exemplarsEnabled) {
  (register as Registry<RegistryContentType>).setContentType(Registry.OPENMETRICS_CONTENT_TYPE);
}

/**
 * Content-Type header value resolved at module load. Static string allows
 * \@Header() decorator to evaluate at class-definition time without requiring
 * per-request \@Res injection.
 *
 * Type annotation `: string` widens the inferred union of literals so the
 * value satisfies NestJS `@Header(name: string, value: string)` without
 * triggering narrow-literal contextual typing.
 */
const metricsContentType: string =
  exemplarsEnabled ?
    'application/openmetrics-text; version=1.0.0; charset=utf-8'
  : 'text/plain; version=0.0.4; charset=utf-8';

/**
 * Metrics Controller
 *
 * Returns Prometheus metrics in text format.
 * This endpoint is public (no auth required) for Prometheus scraping.
 */
@Controller('metrics')
export class MetricsController {
  /**
   * GET /api/v2/metrics
   *
   * Returns all registered Prometheus metrics. Content-Type reflects the
   * boot-time PROMETHEUS_EXEMPLARS_ENABLED flag.
   */
  @Public()
  @Get()
  @Header('Content-Type', metricsContentType)
  async index(): Promise<string> {
    return await register.metrics();
  }
}
