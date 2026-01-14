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
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createReadStream, existsSync } from 'fs';
import { Logger } from 'nestjs-pino';
import path from 'path';
import 'reflect-metadata';

import { ChatWebSocketServer } from '../websocket.js';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { REDACTED_VALUE, REDACT_PATHS } from './common/logger/logger.constants.js';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe.js';

/** Frontend routes that map to HTML pages */
const FRONTEND_ROUTES = [
  'dashboard',
  'employees',
  'departments',
  'teams',
  'settings',
  'calendar',
  'chat',
  'shifts',
  'blackboard',
  'documents',
  'kvp',
  'surveys',
  'machines',
  'notifications',
  'areas',
  'features',
  'plans',
  'reports',
  'role-switch',
  'root',
  'signup',
  'profile',
  'admin',
  'account-settings',
  'admin-dashboard',
  'admin-profile',
  'blackboard-detail',
  'documents-explorer',
  'employee-dashboard',
  'employee-profile',
  'kvp-detail',
  'logs',
  'manage-admins',
  'manage-areas',
  'manage-departments',
  'manage-employees',
  'manage-machines',
  'manage-root',
  'manage-teams',
  'root-dashboard',
  'root-features',
  'root-profile',
  'survey-admin',
  'survey-employee',
  'survey-results',
] as const;

interface ProjectPaths {
  projectRoot: string;
  distPath: string;
  publicPath: string;
  srcPath: string;
  uploadsPath: string;
  pagesPath: string;
  storybookPath: string;
}

/** Calculate project paths based on Docker setup */
function getProjectPaths(): ProjectPaths {
  // In Docker: process.cwd() = /app (backend directory)
  // Uploads are at /app/uploads (volume mounted)
  // Frontend is at /app/../frontend = /frontend (not used in Docker)
  const backendRoot = process.cwd(); // /app
  const projectRoot = path.resolve(backendRoot, '..');
  const frontendPath = path.join(projectRoot, 'frontend');
  const distPath = path.join(frontendPath, 'dist');

  return {
    projectRoot,
    distPath,
    publicPath: path.join(frontendPath, 'public'),
    srcPath: path.join(frontendPath, 'src'),
    // Uploads are in backend directory, not project root
    uploadsPath: path.join(backendRoot, 'uploads'),
    pagesPath: path.join(distPath, 'pages'),
    storybookPath: path.join(projectRoot, 'storybook-static'),
  };
}

/** Setup health check endpoint for Docker health checks */
function setupHealthCheck(fastify: FastifyInstance): void {
  fastify.get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env['NODE_ENV'] ?? 'development',
    framework: 'NestJS+Fastify',
  }));

  // Debug route for testing Sentry - ONLY in development
  // Access: GET /debug-sentry
  if (process.env['NODE_ENV'] !== 'production') {
    fastify.get('/debug-sentry', () => {
      throw new Error('Test Sentry error from debug endpoint');
    });
  }
}

/** Register static file serving for frontend assets */
async function setupStaticAssets(app: NestFastifyApplication, paths: ProjectPaths): Promise<void> {
  const { distPath, srcPath, uploadsPath, publicPath, storybookPath } = paths;

  // Main dist directory (Vite build output) - serves /css, /js, /images, /fonts, /pages
  await app.register(fastifyStatic, {
    root: distPath,
    prefix: '/',
    decorateReply: false,
  });

  // Source assets (non-bundled)
  await app.register(fastifyStatic, {
    root: path.join(srcPath, 'assets'),
    prefix: '/assets/',
    decorateReply: false,
  });

  // Scripts from src
  await app.register(fastifyStatic, {
    root: path.join(srcPath, 'scripts'),
    prefix: '/scripts/',
    decorateReply: false,
  });

  // Uploads (user-generated content)
  await app.register(fastifyStatic, {
    root: uploadsPath,
    prefix: '/uploads/',
    decorateReply: false,
  });

  // Public folder (favicon, robots.txt, etc.)
  await app.register(fastifyStatic, {
    root: publicPath,
    prefix: '/public/',
    decorateReply: false,
  });

  // Storybook (dev only)
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path from getProjectPaths() built with process.cwd() + known constants
  if (process.env['NODE_ENV'] !== 'production' && existsSync(storybookPath)) {
    await app.register(fastifyStatic, {
      root: storybookPath,
      prefix: '/storybook/',
      decorateReply: false,
    });
  }
}

/** Setup HTML page routes */
function setupHtmlRoutes(fastify: FastifyInstance, pagesPath: string, publicPath: string): void {
  // Favicon route
  fastify.get('/favicon.ico', async (_request: FastifyRequest, reply: FastifyReply) => {
    const faviconPath = path.join(publicPath, 'favicon.ico');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path built from trusted publicPath + literal 'favicon.ico'
    if (existsSync(faviconPath)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path built from trusted publicPath + literal 'favicon.ico'
      return await reply.type('image/x-icon').send(createReadStream(faviconPath));
    }
    return await reply.code(404).send({ error: 'Favicon not found' });
  });

  // Root route
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    const indexPath = path.join(pagesPath, 'index.html');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path built from trusted pagesPath + literal filename
    if (existsSync(indexPath)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path built from trusted pagesPath + literal filename
      return await reply.type('text/html').send(createReadStream(indexPath));
    }
    return await reply.code(404).send({ error: 'Page not found' });
  });

  // Login page
  fastify.get('/login', async (_request: FastifyRequest, reply: FastifyReply) => {
    const loginPath = path.join(pagesPath, 'login.html');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path built from trusted pagesPath + literal filename
    if (existsSync(loginPath)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path built from trusted pagesPath + literal filename
      return await reply.type('text/html').send(createReadStream(loginPath));
    }
    return await reply.code(404).send({ error: 'Page not found' });
  });

  // All other frontend routes (FRONTEND_ROUTES is a compile-time constant array)
  for (const route of FRONTEND_ROUTES) {
    fastify.get(`/${route}`, async (_request: FastifyRequest, reply: FastifyReply) => {
      const routePath = path.join(pagesPath, `${route}.html`);
      const fallbackPath = path.join(pagesPath, 'index.html');

      // eslint-disable-next-line security/detect-non-literal-fs-filename -- route is from FRONTEND_ROUTES constant, not user input
      if (existsSync(routePath)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- route is from FRONTEND_ROUTES constant, not user input
        return await reply.type('text/html').send(createReadStream(routePath));
      }
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path built from trusted pagesPath + literal filename
      if (existsSync(fallbackPath)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path built from trusted pagesPath + literal filename
        return await reply.type('text/html').send(createReadStream(fallbackPath));
      }
      return await reply.code(404).send({ error: 'Page not found' });
    });
  }
}

/** Register security plugins */
async function setupSecurity(app: NestFastifyApplication): Promise<void> {
  // Helmet with Content Security Policy
  // Note: 'unsafe-inline' for scripts/styles is needed for SvelteKit
  // TODO: Implement nonce-based CSP for stricter security
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // SvelteKit needs inline scripts
        styleSrc: ["'self'", "'unsafe-inline'"], // SvelteKit needs inline styles
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'"],
        connectSrc: [
          "'self'",
          'wss:',
          'ws:',
          'https://*.ingest.sentry.io', // Sentry telemetry (global)
          'https://*.ingest.de.sentry.io', // Sentry telemetry (EU region)
        ],
        objectSrc: ["'none'"], // Disable plugins/embeds
        frameAncestors: ["'self'"], // Allow same-origin iframe for PDF preview
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [], // Upgrade HTTP to HTTPS
      },
    },
  });

  // Cookie parser
  await app.register(fastifyCookie);

  // Multipart for file uploads
  await app.register(import('@fastify/multipart'));

  // CORS - supports multiple origins from ALLOWED_ORIGINS env var (comma-separated)
  const allowedOrigins = (
    process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:3000,http://localhost:5173'
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

/** Setup global pipes, filters, and interceptors */
function setupGlobalMiddleware(app: NestFastifyApplication): void {
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
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

  // Flush pending Sentry events before shutdown (max 2 seconds)
  // Without this, errors that happen just before shutdown are lost
  try {
    await Sentry.close(2000);
    logger.log('Sentry events flushed');
  } catch {
    logger.warn('Failed to flush Sentry events (timeout or error)');
  }

  // Close WebSocket server and Redis connection before NestJS shutdown
  if (chatWsInstance !== null) {
    try {
      await chatWsInstance.shutdown();
    } catch (error) {
      logger.error('Error during WebSocket shutdown:', error);
    }
  }

  if (appInstance) {
    try {
      await appInstance.close();
      logger.log('NestJS application closed successfully. Port released.');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }

  process.exit(0);
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
    level: process.env['LOG_LEVEL'] ?? (isProduction ? 'info' : 'debug'),
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

  // Enable NestJS shutdown hooks (onModuleDestroy, beforeApplicationShutdown)
  // CRITICAL: Without this, cleanup hooks in services won't be called!
  app.enableShutdownHooks();

  app.setGlobalPrefix('api/v2');

  const fastify = app.getHttpAdapter().getInstance();
  const paths = getProjectPaths();

  bootstrapLogger.log(`[Static] Project root: ${paths.projectRoot}`);
  bootstrapLogger.log(`[Static] Frontend dist: ${paths.distPath}`);

  // Setup in order
  setupHealthCheck(fastify);
  await setupStaticAssets(app, paths);
  setupHtmlRoutes(fastify, paths.pagesPath, paths.publicPath);
  bootstrapLogger.log('Static file serving configured');

  await setupSecurity(app);
  setupGlobalMiddleware(app);

  // Fastify v5: listen with object syntax, 0.0.0.0 for Docker
  const port = Number.parseInt(process.env['PORT'] ?? '3000', 10);
  await app.listen({ port, host: '0.0.0.0' });

  // Setup WebSocket server for chat (attaches to the same HTTP server)
  const httpServer = app.getHttpServer();
  chatWsInstance = new ChatWebSocketServer(httpServer);
  chatWsInstance.startHeartbeat();
  bootstrapLogger.log('WebSocket server started on /chat-ws');

  bootstrapLogger.log(`NestJS+Fastify application running on port ${port}`);
  bootstrapLogger.log(`Environment: ${process.env['NODE_ENV'] ?? 'development'}`);
}

bootstrap().catch((error: unknown) => {
  const errorLogger = new NestLogger('Bootstrap');
  errorLogger.error('Failed to start application', error);
  process.exit(1);
});
