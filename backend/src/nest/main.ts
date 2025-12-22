/**
 * NestJS Application Bootstrap - Fastify Adapter
 *
 * Entry point for the NestJS application using Fastify.
 * Configures global pipes, filters, interceptors, and middleware.
 */
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createReadStream, existsSync } from 'fs';
import path from 'path';
import 'reflect-metadata';

import { ChatWebSocketServer } from '../websocket.js';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
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
  const projectRoot = path.resolve(process.cwd(), '..');
  const frontendPath = path.join(projectRoot, 'frontend');
  const distPath = path.join(frontendPath, 'dist');

  return {
    projectRoot,
    distPath,
    publicPath: path.join(frontendPath, 'public'),
    srcPath: path.join(frontendPath, 'src'),
    uploadsPath: path.join(projectRoot, 'uploads'),
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
  // Helmet with CSP disabled (frontend needs inline scripts)
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false,
  });

  // Cookie parser
  await app.register(fastifyCookie);

  // Multipart for file uploads
  await app.register(import('@fastify/multipart'));

  // CORS
  app.enableCors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
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

/** Graceful shutdown handler - closes NestJS app and releases port */
async function gracefulShutdown(signal: string): Promise<void> {
  const logger = new Logger('Shutdown');
  logger.log(`Received ${signal}. Starting graceful shutdown...`);

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
  const logger = new Logger('Bootstrap');

  // Create Fastify adapter with trust proxy for Docker
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: {
        level: 'warn',
      },
      trustProxy: true,
    }),
  );

  // Store reference for graceful shutdown
  appInstance = app;

  app.setGlobalPrefix('api/v2');

  const fastify = app.getHttpAdapter().getInstance();
  const paths = getProjectPaths();

  logger.log(`[Static] Project root: ${paths.projectRoot}`);
  logger.log(`[Static] Frontend dist: ${paths.distPath}`);

  // Setup in order
  setupHealthCheck(fastify);
  await setupStaticAssets(app, paths);
  setupHtmlRoutes(fastify, paths.pagesPath, paths.publicPath);
  logger.log('✅ Static file serving configured');

  await setupSecurity(app);
  setupGlobalMiddleware(app);

  // Fastify v5: listen with object syntax, 0.0.0.0 for Docker
  const port = Number.parseInt(process.env['PORT'] ?? '3000', 10);
  await app.listen({ port, host: '0.0.0.0' });

  // Setup WebSocket server for chat (attaches to the same HTTP server)
  const httpServer = app.getHttpServer();
  const chatWs = new ChatWebSocketServer(httpServer);
  chatWs.startHeartbeat();
  logger.log('✅ WebSocket server started on /chat-ws');

  logger.log(`NestJS+Fastify application running on port ${port}`);
  logger.log(`Environment: ${process.env['NODE_ENV'] ?? 'development'}`);
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application', error);
  process.exit(1);
});
