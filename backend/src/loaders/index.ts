/**
 * Central Loader Index
 * Exports all application loaders for easy import
 */

// Export all loaders
export { loadAPIRoutes } from './api-routes.js';
export { loadErrorHandler } from './error-handler.js';
export { loadExpress } from './express.js';
export { loadHealthCheck } from './health.js';
export { loadLoginRedirect } from './login-redirect.js';
export { loadMiddleware } from './middleware.js';
export { loadPageRoutes } from './page-routes.js';
export { loadRateLimiting } from './rate-limiting.js';
export { loadSecurity } from './security.js';
export { loadStaticFiles } from './static-files.js';

/**
 * Recommended loading order:
 * 1. loadExpress        - Basic Express configuration
 * 2. loadHealthCheck    - Health endpoint (before rate limiting)
 * 3. loadSecurity       - Security headers and CORS
 * 4. loadRateLimiting   - Rate limiting
 * 5. loadPageRoutes     - HTML pages and clean URLs
 * 6. loadMiddleware     - Tenant checks, CSRF
 * 7. loadAPIRoutes      - API v2 routes
 * 8. loadStaticFiles    - Static asset serving
 * 9. loadLoginRedirect  - Login redirect (/login → /pages/login)
 * 10. loadErrorHandler  - 404 and error handling (MUST BE LAST!)
 */
