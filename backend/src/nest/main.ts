// IMPORTANT: Sentry MUST be imported BEFORE any other modules for auto-instrumentation!
// Side-effect import runs Sentry.init(), then we get the Sentry reference for graceful shutdown
import { Sentry } from './instrument.js';

/**
 * NestJS Application Bootstrap - Fastify Adapter
 *
 * Entry point for the NestJS application using Fastify.
 * Configures global pipes, filters, interceptors, and middleware.
 *
 * Logging: Uses Pino via nestjs-pino (replaces Winston)
 * Error Tracking: Uses Sentry (must be imported FIRST!)
 *
 * @see docs/PINO-LOGGING-PLAN.md
 * @see docs/adr/ADR-002-alerting-monitoring.md
 */
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import { Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { trace } from '@opentelemetry/api';
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction,
} from 'fastify';
import { Logger } from 'nestjs-pino';
import path from 'path';
import 'reflect-metadata';

import { ChatWebSocketServer } from '../websocket.js';
import { AppModule } from './app.module.js';
import { PresenceStore } from './chat/presence.store.js';
import { REDACTED_VALUE, REDACT_PATHS } from './common/logger/logger.constants.js';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe.js';
import { getErrorMessage } from './common/utils/error.utils.js';
import { DatabaseService } from './database/database.service.js';
import { PartitionHealthService } from './database/partition-health.service.js';
import { httpRequestDurationHistogram } from './metrics/http-request-duration.metric.js';

/** Get uploads directory path (Docker: /app/uploads, volume mounted) */
function getUploadsPath(): string {
  return path.join(process.cwd(), 'uploads');
}

/** Setup health check endpoints for Docker health checks and monitoring */
function setupHealthCheck(fastify: FastifyInstance, partitionHealth: PartitionHealthService): void {
  fastify.get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env['NODE_ENV'] ?? 'development',
    framework: 'NestJS+Fastify',
  }));

  fastify.get(
    '/health/partitions',
    async (
      _request: unknown,
      reply: { code: (n: number) => { send: (d: unknown) => unknown } },
    ) => {
      const result = await partitionHealth.check();
      return await reply.code(result.healthy ? 200 : 503).send(result);
    },
  );

  // Debug route for testing Sentry - ONLY in development
  // Access: GET /debug-sentry
  if (process.env['NODE_ENV'] !== 'production') {
    fastify.get('/debug-sentry', () => {
      throw new Error('Test Sentry error from debug endpoint');
    });
  }
}

/**
 * Register Fastify `onResponse` hook that observes the
 * `assixx_http_request_duration_seconds` histogram for every HTTP request.
 *
 * Why `onResponse` (and not a NestJS interceptor):
 *   - `reply.elapsedTime` measures the full Fastify lifecycle (routing,
 *     hooks, handler, serialization, response-sent), which is the
 *     canonical duration a latency metric should reflect.
 *   - Interceptors only wrap the NestJS handler call, missing the time
 *     spent in Fastify plugins (helmet, cookie, multipart, CORS).
 *
 * Exemplar emission is gated by PROMETHEUS_EXEMPLARS_ENABLED (Session 3b /
 * Step 3.3.2). Stage 3b-a default is OFF → histogram observes without
 * exemplars; on-wire output matches pre-3b metrics for backward compat.
 * Flag ON → pulls `trace_id`/`span_id` from the active OTel span (shared
 * via the Phase 2 NodeTracerProvider) and attaches them as OpenMetrics
 * exemplar labels.
 *
 * @see docs/FEAT_TEMPO_OTEL_MASTERPLAN.md — Session 3b / Step 3.3.2
 * @see docs/infrastructure/adr/ADR-048-distributed-tracing-tempo-otel.md
 */
function setupMetricsHook(fastify: FastifyInstance): void {
  // Resolved at module-level boot — flag flip requires container recreation
  // (same ceremony as OTEL_TEMPO_ENABLED). Keeping the read here (not
  // top-level) localizes the env dependency to this function.
  const exemplarsEnabled = process.env['PROMETHEUS_EXEMPLARS_ENABLED'] === 'true';

  fastify.addHook(
    'onResponse',
    (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): void => {
      // Fastify reply.elapsedTime is in milliseconds; Prometheus convention
      // for `*_seconds` histograms is seconds.
      const durationSec = reply.elapsedTime / 1000;

      // routeOptions.url gives the parameterized pattern (e.g. /users/:id),
      // keeping label cardinality bounded. Missing on 404 fallback paths;
      // fall back to 'unknown' to stay defensive.
      const labels = {
        method: request.method,
        route: request.routeOptions.url ?? 'unknown',
        status: String(reply.statusCode),
      };

      if (exemplarsEnabled) {
        const span = trace.getActiveSpan();
        const ctx = span?.spanContext();
        if (ctx !== undefined) {
          httpRequestDurationHistogram.observe({
            labels,
            value: durationSec,
            exemplarLabels: { trace_id: ctx.traceId, span_id: ctx.spanId },
          });
        } else {
          // Active span missing (worker path, probes, startup edge) — still
          // record the duration without exemplar annotation.
          httpRequestDurationHistogram.observe(labels, durationSec);
        }
      } else {
        httpRequestDurationHistogram.observe(labels, durationSec);
      }

      done();
    },
  );
}

/** Register static file serving for user uploads only.
 * Frontend is served by SvelteKit (:3001 via Nginx), NOT by the backend.
 */
async function setupUploadsServing(
  app: NestFastifyApplication,
  uploadsPath: string,
): Promise<void> {
  await app.register(fastifyStatic, {
    root: uploadsPath,
    prefix: '/uploads/',
    decorateReply: false,
  });
}

/** Register security plugins */
async function setupSecurity(app: NestFastifyApplication): Promise<void> {
  // CSP is handled by SvelteKit (nonce-based, see frontend/svelte.config.js)
  // Backend only serves JSON API responses — CSP is irrelevant for non-HTML responses
  // Helmet still sets other security headers (X-Content-Type-Options, HSTS, etc.)
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false,
  });

  // Cookie parser
  await app.register(fastifyCookie);

  // Multipart for file uploads — load-bearing content-type parser.
  // DO NOT REMOVE: required peer for @webundsoehne/nest-fastify-file-upload
  // (FileInterceptor in 9 controllers). Removing this returns HTTP 415 on
  // every upload endpoint. See docs/infrastructure/adr/ADR-042-multipart-file-upload-pipeline.md
  await app.register(import('@fastify/multipart'));

  // CORS — origin allowlist via regex callback (ADR-050 §Step 2.4).
  //
  // Static list (old behavior) doesn't scale to wildcard subdomain routing:
  // every <slug>.assixx.com is a valid origin once ADR-050 ships, and the
  // set is DB-driven, not env-driven. A callback with a pinned regex shape
  // is the cleanest contract — the regex itself IS the policy.
  //
  // Allowed:
  //   - apex:       https://assixx.com, https://www.assixx.com
  //   - subdomain:  https://<slug>.assixx.com   (slug matches extractSlug regex)
  //   - dev:        http://localhost:5173, http://*.localhost:5173
  //
  // Same-origin / non-browser requests arrive with `origin === undefined`;
  // @fastify/cors short-circuits those before reaching the callback, but we
  // accept explicitly for defense-in-depth on any future adapter change.
  // Matches @fastify/cors `OriginFunction` signature — NestJS's Fastify
  // adapter forwards `enableCors` straight to @fastify/cors, so the callback
  // shape is dictated by that plugin (callback's 2nd arg is `origin`, not
  // `allow`). Locally-declared instead of imported because `@fastify/cors`
  // is a transitive dep via `@nestjs/platform-fastify` and not listed in
  // `backend/package.json`. Declaring the type here keeps the import graph
  // clean while preserving full type-safety at the call site.
  type FastifyCorsOriginFn = (
    origin: string | undefined,
    callback: (err: Error | null, origin: boolean | string | RegExp) => void,
  ) => void;

  const corsOriginHandler: FastifyCorsOriginFn = (
    requestOrigin: string | undefined,
    callback: (err: Error | null, origin: boolean | string | RegExp) => void,
  ) => {
    if (requestOrigin === undefined || isAllowedCorsOrigin(requestOrigin)) {
      // `true` = "reflect the request origin" — conventional dynamic-allowlist pattern.
      callback(null, true);
      return;
    }
    callback(new Error(`CORS origin not allowed: ${requestOrigin}`), false);
  };

  app.enableCors({
    origin: corsOriginHandler,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });
}

/**
 * CORS origin allowlist — pure function so the policy is testable in
 * isolation and greppable in one place.
 *
 * Regex shapes mirror `extractSlug()` (backend/src/nest/common/utils/extract-slug.ts)
 * for subdomain matching. The apex/dev patterns are expressed explicitly
 * rather than composed from extractSlug so the CORS surface stays auditable
 * without cross-file reasoning.
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §"CORS"
 */
const PROD_APEX_ORIGIN_REGEX = /^https:\/\/(?:www\.)?assixx\.com$/;
const PROD_SUBDOMAIN_ORIGIN_REGEX = /^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.assixx\.com$/;
// Accepts:
//   - port 5173 (normal `pnpm run dev:svelte`)
//   - port 5174 (Playwright E2E parallel Vite instance, see `playwright.config.ts::webServer`)
//   - no port = port 80 (production-profile local testing via Nginx, per
//     docs/PRODUCTION-AND-DEVELOPMENT-TESTING.md). SvelteKit SSR forwards the
//     browser's `Origin: http://localhost` header on its server-to-server
//     fetch to the backend; without this branch every auth POST 500s with
//     "CORS origin not allowed: http://localhost".
// Security: localhost host literal stays mandatory — no third-party origin
// can match. Subdomain prefix optional (matches `assixx.localhost`, etc.).
const DEV_ORIGIN_REGEX = /^http:\/\/(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)?localhost(?::517[34])?$/;

function isAllowedCorsOrigin(origin: string): boolean {
  return (
    PROD_APEX_ORIGIN_REGEX.test(origin) ||
    PROD_SUBDOMAIN_ORIGIN_REGEX.test(origin) ||
    DEV_ORIGIN_REGEX.test(origin)
  );
}

// =============================================================================
// GRACEFUL SHUTDOWN - Ensures port is released on exit (SIGTERM, SIGINT, SIGHUP)
// =============================================================================
let appInstance: NestFastifyApplication | null = null;
let chatWsInstance: ChatWebSocketServer | null = null;

/** Graceful shutdown handler - closes NestJS app and releases port */
async function gracefulShutdown(signal: string): Promise<void> {
  const logger = new NestLogger('Shutdown');
  logger.log(`Received ${signal}. Starting graceful shutdown...`);

  await flushSentry(logger);
  await shutdownWebSocket(logger);
  await closeApp(logger);

  process.exit(0);
}

async function flushSentry(logger: NestLogger): Promise<void> {
  try {
    await Sentry.close(2000);
    logger.log('Sentry events flushed');
  } catch {
    logger.warn('Failed to flush Sentry events (timeout or error)');
  }
}

async function shutdownWebSocket(logger: NestLogger): Promise<void> {
  if (chatWsInstance === null) return;
  try {
    await chatWsInstance.shutdown();
  } catch (error: unknown) {
    logger.error(`Error during WebSocket shutdown: ${getErrorMessage(error)}`);
  }
}

async function closeApp(logger: NestLogger): Promise<void> {
  if (appInstance === null) return;
  try {
    await appInstance.close();
    logger.log('NestJS application closed successfully. Port released.');
  } catch (error: unknown) {
    logger.error(`Error during shutdown: ${getErrorMessage(error)}`);
  }
}

// Register signal handlers BEFORE bootstrap
// void operator: explicitly discard Promise (fire-and-forget pattern for signal handlers)
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
process.on('SIGHUP', () => void gracefulShutdown('SIGHUP'));

/**
 * Bootstrap the NestJS application with Fastify
 */
async function bootstrap(): Promise<void> {
  // Boot-Duration für Cold-Start-Regression-Tracking. ADR-027 dokumentiert
  // ~11s prod / ~60-120s dev als Soll. Ohne Logging merkt man 30%-Regression
  // erst über User-Reports — `grep "ready on port" logs/` deckt's auf.
  const bootstrapStart = process.hrtime.bigint();
  const bootstrapLogger = new NestLogger('Bootstrap');
  const isProduction = process.env['NODE_ENV'] === 'production';

  // Pino logger configuration for Fastify
  // Development: pino-pretty for readable output
  // Production: JSON to stdout (Docker logs)
  const pinoLoggerConfig = {
    // Default to 'info' - DEBUG only via explicit LOG_LEVEL=debug
    // Best practice: INFO shows significant events, DEBUG for active troubleshooting
    level: process.env['LOG_LEVEL'] ?? 'info',
    // Only include transport in development (pino-pretty)
    // Production uses JSON to stdout
    ...(isProduction ?
      {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
    redact: {
      paths: [...REDACT_PATHS],
      censor: REDACTED_VALUE,
    },
  };

  // Create Fastify adapter with Pino logger and trust proxy for Docker
  // disableRequestLogging: true → Fastify's native request logging is disabled
  // Request logging is handled by nestjs-pino (with EXCLUDED_ROUTES for /health, /metrics)
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: pinoLoggerConfig,
      trustProxy: true,
      disableRequestLogging: true,
    }),
    { bufferLogs: true }, // Buffer logs until nestjs-pino is ready
  );

  // Use nestjs-pino as the NestJS logger (replaces @nestjs/common Logger internally)
  app.useLogger(app.get(Logger));

  // Store reference for graceful shutdown
  appInstance = app;

  // NOTE: Do NOT call app.enableShutdownHooks() here.
  // It registers its own SIGTERM/SIGINT listeners that call app.close(),
  // but we already have custom signal handlers (lines 167-169) that do the same.
  // Having both causes a double-close race condition.
  // app.close() triggers onModuleDestroy hooks regardless of enableShutdownHooks().

  app.setGlobalPrefix('api/v2');

  const fastify = app.getHttpAdapter().getInstance();
  const uploadsPath = getUploadsPath();

  // Setup in order
  const partitionHealth = app.get(PartitionHealthService);
  setupHealthCheck(fastify, partitionHealth);
  // ADR-048 Phase 3b / Session 3b: observe HTTP request duration into the
  // assixx_http_request_duration_seconds histogram. Must register before
  // app.listen() so the hook is active on the first request.
  setupMetricsHook(fastify);
  await setupUploadsServing(app, uploadsPath);
  bootstrapLogger.log(`Uploads serving configured: ${uploadsPath}`);

  await setupSecurity(app);
  app.useGlobalPipes(new ZodValidationPipe());

  // Attach WebSocket upgrade handler to the underlying http.Server BEFORE
  // app.listen() — `ws` registers `server.on('upgrade', …)` synchronously, so
  // no upgrade event can fire before the handler is wired up. Fastify's
  // raw http.Server is created during NestFactory.create() and exposed via
  // app.getHttpServer(); listen() only flips it from "constructed" to
  // "accepting connections".
  //
  // Race-Fix (2026-04-30): without this ordering there is a ~1-50 ms window
  // between listen() and WS-init where a WebSocket upgrade request arrives
  // without a handler → server replies 400 instead of 101 Switching Protocols.
  // Frontend reconnect-logic masks this in prod, but fail-loud > fail-soft.
  const httpServer = app.getHttpServer();
  const dbService = app.get(DatabaseService);
  const presenceStore = app.get(PresenceStore);
  chatWsInstance = new ChatWebSocketServer(httpServer, dbService, presenceStore);

  // Fastify v5: listen with object syntax, 0.0.0.0 for Docker
  const port = Number.parseInt(process.env['PORT'] ?? '3000', 10);
  await app.listen({ port, host: '0.0.0.0' });

  // Heartbeat starts only after server is actively listening — pinging
  // un-connected clients during the listen() async boundary is wasteful
  // and shutdown-safe (heartbeatInterval guard in ChatWebSocketServer.shutdown
  // handles the case where listen() throws after WS instance is assigned).
  chatWsInstance.startHeartbeat();
  bootstrapLogger.log('WebSocket server started on /chat-ws');

  // Boot-Duration: ADR-027 baseline ~11s prod / ~60-120s dev. Greppable
  // marker for Cold-Start-Regression: `grep "ready on port" logs/`.
  const bootMs = Number((process.hrtime.bigint() - bootstrapStart) / 1_000_000n);
  bootstrapLogger.log(`NestJS+Fastify ready on port ${port} in ${bootMs}ms`);
  bootstrapLogger.log(`Environment: ${process.env['NODE_ENV'] ?? 'development'}`);
}

bootstrap().catch((error: unknown) => {
  const errorLogger = new NestLogger('Bootstrap');
  errorLogger.error('Failed to start application', error);
  process.exit(1);
});
