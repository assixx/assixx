/**
 * Express Application Setup
 * Modularized architecture with loader pattern
 */
import express, { Application } from 'express';

// Import all loaders in the correct order
import { loadAPIRoutes } from './loaders/api-routes';
import { loadErrorHandler } from './loaders/error-handler';
import { loadExpress } from './loaders/express';
import { loadHealthCheck } from './loaders/health';
import { loadLegacyCompat } from './loaders/legacy-compat';
import { loadMiddleware } from './loaders/middleware';
import { loadPageRoutes } from './loaders/page-routes';
import { loadRateLimiting } from './loaders/rate-limiting';
import { loadSecurity } from './loaders/security';
import { loadStaticFiles } from './loaders/static-files';

// Create Express application
const app: Application = express();

/**
 * Application Bootstrap
 * Loads all middleware and routes in the correct order
 *
 * CRITICAL: Order matters! Each loader depends on the previous ones.
 * DO NOT change the order without understanding the dependencies.
 */

// 1. Basic Express configuration (body-parser, logging, etc.)
loadExpress(app);

// 2. Health check endpoint (must be before rate limiting)
loadHealthCheck(app);

// 3. Security configuration (CORS, CSP, headers)
loadSecurity(app);

// 4. Rate limiting configuration
loadRateLimiting(app);

// 5. HTML page routes and clean URLs
loadPageRoutes(app);

// 6. Additional middleware (tenant checks, CSRF)
loadMiddleware(app);

// 7. API v2 routes
loadAPIRoutes(app);

// 8. Static file serving (must be after API routes)
loadStaticFiles(app);

// 9. Legacy compatibility routes
loadLegacyCompat(app);

// 10. Error handling (MUST BE LAST!)
loadErrorHandler(app);

// Log successful initialization
if (process.env.NODE_ENV !== 'production') {
  console.log('🚀 Application initialized successfully');
  console.log(`📝 Environment: ${process.env.NODE_ENV ?? 'development'}`);
  console.log(`🔒 Trust Proxy: ${String(app.get('trust proxy'))}`);
}

export default app;
