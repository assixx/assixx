/**
 * Login Redirect Loader
 * Provides friendly /login URL that redirects to /pages/login
 *
 * RENAMED: 2025-11-07 (was legacy-compat.ts)
 * - Better name reflects actual purpose: login redirect
 * - No longer handles "legacy compatibility" (v1 removed)
 *
 * CLEANED UP: 2025-11-07
 * - Removed v1 auth controller imports (deleted)
 * - Removed POST /login endpoint (use /api/v2/auth/login instead)
 * - Removed /api/v1 handler (not used anymore)
 *
 * WHY THIS EXISTS:
 * - Frontend code uses window.location.href = '/login' extensively (50+ locations)
 * - This provides a single redirect point to the actual login page
 * - Easier to change login page location in future (just change redirect here)
 * - Clean URL: /login is friendlier than /pages/login
 */
import { Application, Request, Response } from 'express';

/**
 * Load login redirect route
 * Redirects /login to /pages/login
 * @param app - Express application instance
 */
export function loadLoginRedirect(app: Application): void {
  // Login redirect (heavily used by frontend in 50+ locations)
  // ALL frontend redirects use '/login' which redirects to '/pages/login'
  app.get('/login', (_req: Request, res: Response): void => {
    res.redirect('/pages/login');
  });

  console.log('✅ Login redirect configured (/login → /pages/login)');
}
