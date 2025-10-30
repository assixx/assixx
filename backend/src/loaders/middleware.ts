/**
 * Additional Middleware Loader
 * Handles tenant checks, CSRF protection, and other middleware
 */
import { Application, NextFunction, Request, Response } from 'express';

import { validateCSRFToken } from '../middleware/security-enhanced.js';
import { checkTenantStatus } from '../middleware/tenantStatus.js';

/**
 * Load additional middleware
 * @param app - Express application instance
 */
export function loadMiddleware(app: Application): void {
  // Tenant Status Middleware - check tenant deletion status
  if (process.env.NODE_ENV !== 'production') {
    console.info('[DEBUG] Applying tenant status middleware');
  }
  app.use('/api', checkTenantStatus);

  // CSRF Protection for state-changing operations
  // Apply to specific routes that need CSRF protection
  const csrfProtectedPaths = [
    '/api/v2/auth/logout',
    '/api/v2/users/delete',
    '/api/v2/tenant/delete',
    '/api/v2/settings/update',
  ];

  app.use((req: Request, res: Response, next: NextFunction): void => {
    // Only check CSRF for protected paths and state-changing methods
    if (
      csrfProtectedPaths.some((path: string) => req.path.startsWith(path)) &&
      ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)
    ) {
      validateCSRFToken(req, res, next);
      return;
    }
    next();
  });

  console.log('✅ Additional middleware configured');
}
