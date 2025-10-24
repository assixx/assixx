/**
 * Central Loader Index
 * Exports all application loaders for easy import
 */

// Export all loaders
export { loadAPIRoutes } from './api-routes';
export { loadErrorHandler } from './error-handler';
export { loadExpress } from './express';
export { loadHealthCheck } from './health';
export { loadLegacyCompat } from './legacy-compat';
export { loadMiddleware } from './middleware';
export { loadPageRoutes } from './page-routes';
export { loadRateLimiting } from './rate-limiting';
export { loadSecurity } from './security';
export { loadStaticFiles } from './static-files';

/**
 * Recommended loading order:
 * 1. loadExpress       - Basic Express configuration
 * 2. loadHealthCheck   - Health endpoint (before rate limiting)
 * 3. loadSecurity      - Security headers and CORS
 * 4. loadRateLimiting  - Rate limiting
 * 5. loadPageRoutes    - HTML pages and clean URLs
 * 6. loadMiddleware    - Tenant checks, CSRF
 * 7. loadAPIRoutes     - API v2 routes
 * 8. loadStaticFiles   - Static asset serving
 * 9. loadLegacyCompat  - Legacy endpoints
 * 10. loadErrorHandler - 404 and error handling (MUST BE LAST!)
 */
