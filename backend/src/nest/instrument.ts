/**
 * Sentry + OpenTelemetry Instrumentation
 *
 * IMPORTANT: This file MUST be imported BEFORE any other modules!
 * Sentry's decorator-based auto-instrumentation requires this.
 *
 * Behaviour gate (ADR-048 / FEAT_TEMPO_OTEL_MASTERPLAN Phase 2):
 *   OTEL_TEMPO_ENABLED=false (default) → Sentry exactly as before.
 *     No OTel code paths execute. Zero risk to existing behaviour.
 *     Startup log: `[Sentry] Initialized ... otel=OFF`.
 *   OTEL_TEMPO_ENABLED=true            → Shared NodeTracerProvider hosts
 *     Sentry's 4 OTel components (SpanProcessor, Propagator, Sampler,
 *     ContextManager) AND a BatchSpanProcessor exporting to the OTel
 *     Collector (http://otel-collector:4318/v1/traces → Grafana Tempo).
 *     Startup log: `[OTel] Tempo export ACTIVE ...`.
 *
 * Rollback: flip OTEL_TEMPO_ENABLED=false + `docker-compose restart backend`
 * (≈10 s). Zero code revert needed.
 *
 * @see docs/infrastructure/adr/ADR-048-distributed-tracing-tempo-otel.md
 * @see docs/FEAT_TEMPO_OTEL_MASTERPLAN.md — Session 1.5 review closed 5 gaps.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- Sentry SDK convention
import * as Sentry from '@sentry/nestjs';

const sentryDsn = process.env['SENTRY_DSN'];
const otelEnabled = process.env['OTEL_TEMPO_ENABLED'] === 'true';
const isProduction = process.env['NODE_ENV'] === 'production';

/**
 * Bootstrap the OTel pipeline that dual-exports to Sentry + Tempo.
 *
 * Runs only when OTEL_TEMPO_ENABLED=true. Uses dynamic imports so the
 * OFF-path incurs zero runtime cost from these modules — they're loaded
 * lazily on first await, which happens only in the enabled branch.
 *
 * The shared NodeTracerProvider is the key: one provider, two span processors,
 * so Sentry and Tempo see the IDENTICAL trace_id for every request. That is
 * what makes the Log↔Trace jump (Phase 3) work across both backends.
 */
async function bootstrapTempoExport(sentryClient: Sentry.NodeClient): Promise<void> {
  const { SentryPropagator, SentrySampler, SentrySpanProcessor } =
    await import('@sentry/opentelemetry');
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
  const { registerInstrumentations } = await import('@opentelemetry/instrumentation');
  const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
  const { resourceFromAttributes } = await import('@opentelemetry/resources');
  const { BatchSpanProcessor } = await import('@opentelemetry/sdk-trace-base');
  const { NodeTracerProvider } = await import('@opentelemetry/sdk-trace-node');
  const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } =
    await import('@opentelemetry/semantic-conventions');

  const otlpEndpoint =
    process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://otel-collector:4318/v1/traces';

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'assixx-backend',
    [ATTR_SERVICE_VERSION]: process.env['npm_package_version'] ?? 'unknown',
    'deployment.environment': process.env['NODE_ENV'] ?? 'development',
  });

  const provider = new NodeTracerProvider({
    resource,
    // Without SentrySampler, Sentry's tracesSampleRate is ignored — we'd
    // send 100 % of spans to Sentry regardless of config.
    sampler: new SentrySampler(sentryClient),
    spanProcessors: [
      // Order matters only for pre-export mutation; both process every span.
      new SentrySpanProcessor(),
      new BatchSpanProcessor(new OTLPTraceExporter({ url: otlpEndpoint })),
    ],
  });

  provider.register({
    propagator: new SentryPropagator(),
    // SentryContextManager keeps request-scoped context isolated between
    // parallel requests. Without it, CLS values (tenantId, userId) can
    // leak across requests — critical for multi-tenant (ADR-006 / ADR-019).
    contextManager: new Sentry.SentryContextManager(),
  });

  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Off by default — each would multiply span count 10×+ for zero
        // value (file-system, raw TCP, and DNS are not user-facing signals).
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });

  // Sentry's own setup sanity check — warns if any required piece is missing.
  Sentry.validateOpenTelemetrySetup();

  // Using console.info here because the Pino logger module is not yet loaded
  // at this point in the bootstrap sequence.
  console.info(`[OTel] Tempo export ACTIVE — endpoint=${otlpEndpoint} service.name=assixx-backend`);
}

if (sentryDsn !== undefined && sentryDsn !== '') {
  const sentryClient = Sentry.init({
    dsn: sentryDsn,

    environment: process.env['NODE_ENV'] ?? 'development',

    release:
      process.env['SENTRY_RELEASE'] ??
      `assixx-backend@${process.env['npm_package_version'] ?? 'unknown'}`,

    // Performance Monitoring sample rates unchanged from pre-Phase-2.
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    profilesSampleRate: isProduction ? 0.1 : 1.0,

    sendDefaultPii: false,
    debug: process.env['SENTRY_DEBUG'] === 'true',

    // Only take over OTel setup when the flag is ON. Defaults to false →
    // Sentry owns OTel exactly like pre-Phase-2. This is the safe-by-default
    // switch that closes R9 (SentryModule.forRoot() compatibility unknown).
    skipOpenTelemetrySetup: otelEnabled,

    integrations: [],

    beforeSend(event: Sentry.ErrorEvent, hint: Sentry.EventHint): Sentry.ErrorEvent | null {
      if (process.env['NODE_ENV'] === 'test') return null;

      const error = hint.originalException;
      if (
        error instanceof Error &&
        (error.message.includes('Not Found') || error.message.includes('Validation'))
      ) {
        return null;
      }

      return event;
    },

    ignoreErrors: ['Network request failed', 'Failed to fetch', 'Load failed'],
  });

  if (otelEnabled && sentryClient !== undefined) {
    // Async bootstrap — the rest of main.ts continues synchronously. Any spans
    // emitted before this completes (a handful during boot) go only to
    // Sentry's setup if it was active, which with skipOpenTelemetrySetup:true
    // it is not. Startup traces are uninteresting; accepting this tradeoff
    // keeps main.ts sync-loading.
    //
    // If SENTRY_DSN is unset (sentryClient === undefined), we skip OTel too —
    // Tempo-only instrumentation is out of scope for this phase. Re-enable by
    // relaxing this condition and making SentrySampler optional on the
    // TracerProvider config.
    void bootstrapTempoExport(sentryClient);
  } else if (otelEnabled && sentryClient === undefined) {
    console.warn(
      '[OTel] OTEL_TEMPO_ENABLED=true but SENTRY_DSN is not set — skipping OTel setup. Either configure SENTRY_DSN or extend instrument.ts to support Sentry-less Tempo export.',
    );
  }

  // Using console here because logger might not be initialized yet.
  console.info(
    `[Sentry] Initialized env=${process.env['NODE_ENV'] ?? 'development'} otel=${otelEnabled ? 'ON' : 'OFF'}`,
  );
} else {
  console.info('[Sentry] DSN not configured — Sentry disabled');
}

export { Sentry };
