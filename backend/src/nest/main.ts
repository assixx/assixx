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
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { FastifyInstance } from 'fastify';
import { Logger } from 'nestjs-pino';
import path from 'path';
import 'reflect-metadata';

import { ChatWebSocketServer } from '../websocket.js';
import { AppModule } from './app.module.js';
import { PresenceStore } from './chat/presence.store.js';
import {
  REDACTED_VALUE,
  REDACT_PATHS,
} from './common/logger/logger.constants.js';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe.js';
import { getErrorMessage } from './common/utils/error.utils.js';
import { DatabaseService } from './database/database.service.js';
import { PartitionHealthService } from './database/partition-health.service.js';

/** Get uploads directory path (Docker: /app/uploads, volume mounted) */
function getUploadsPath(): string {
  return path.join(process.cwd(), 'uploads');
}

/** Setup health check endpoints for Docker health checks and monitoring */
function setupHealthCheck(
  fastify: FastifyInstance,
  partitionHealth: PartitionHealthService,
): void {
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

  // Multipart for file uploads
  await app.register(import('@fastify/multipart'));

  // CORS - supports multiple origins from ALLOWED_ORIGINS env var (comma-separated)
  const allowedOrigins = (
    process.env['ALLOWED_ORIGINS'] ??
    'http://localhost:3000,http://localhost:5173'
  )
    .split(',')
    .map((origin: string) => origin.trim());
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });
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
  await setupUploadsServing(app, uploadsPath);
  bootstrapLogger.log(`Uploads serving configured: ${uploadsPath}`);

  await setupSecurity(app);
  app.useGlobalPipes(new ZodValidationPipe());

  // Fastify v5: listen with object syntax, 0.0.0.0 for Docker
  const port = Number.parseInt(process.env['PORT'] ?? '3000', 10);
  await app.listen({ port, host: '0.0.0.0' });

  // Setup WebSocket server for chat (attaches to the same HTTP server)
  const httpServer = app.getHttpServer();
  const dbService = app.get(DatabaseService);
  const presenceStore = app.get(PresenceStore);
  chatWsInstance = new ChatWebSocketServer(
    httpServer,
    dbService,
    presenceStore,
  );
  chatWsInstance.startHeartbeat();
  bootstrapLogger.log('WebSocket server started on /chat-ws');

  bootstrapLogger.log(`NestJS+Fastify application running on port ${port}`);
  bootstrapLogger.log(
    `Environment: ${process.env['NODE_ENV'] ?? 'development'}`,
  );
}

bootstrap().catch((error: unknown) => {
  const errorLogger = new NestLogger('Bootstrap');
  errorLogger.error('Failed to start application', error);
  process.exit(1);
});
