/**
 * Page Routes Configuration Loader
 * Handles HTML page serving and clean URL redirects
 */
import { Application, NextFunction, Request, Response } from 'express';
import path from 'path';

import htmlRoutes from '../routes/pages/html.routes.js';

/**
 * SECURITY: Validate that a redirect path is safe (local only)
 * Prevents open redirect vulnerabilities (CWE-601)
 * @param redirectPath - The path to validate
 * @returns true if path is safe for redirect
 */
function isSafeRedirectPath(redirectPath: string): boolean {
  // Must start with single slash (local path)
  if (!redirectPath.startsWith('/')) {
    return false;
  }
  // Must NOT start with // (protocol-relative URL)
  if (redirectPath.startsWith('//')) {
    return false;
  }
  // Must NOT contain :// (absolute URL)
  if (redirectPath.includes('://')) {
    return false;
  }
  // Must NOT contain backslash (Windows path injection)
  if (redirectPath.includes('\\')) {
    return false;
  }
  return true;
}

/**
 * Load page routes and clean URL configuration
 * @param app - Express application instance
 */
export function loadPageRoutes(app: Application): void {
  // Clean URLs middleware - Redirect .html to clean paths
  app.use((req: Request, res: Response, next: NextFunction): void => {
    // Only process GET requests for .html files
    if (req.method !== 'GET' || !req.path.endsWith('.html')) {
      next();
      return;
    }

    // Don't redirect rate-limit.html (special case)
    if (req.path === '/rate-limit.html') {
      next();
      return;
    }

    // Redirect .html to clean URL
    const cleanPath = req.path.slice(0, -5); // Remove .html

    // SECURITY: Validate redirect path is safe (prevents open redirect)
    if (!isSafeRedirectPath(cleanPath)) {
      res.status(400).send('Bad Request');
      return;
    }

    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    res.redirect(301, cleanPath + queryString);
  });

  // Rate limit page handler
  app.get('/rate-limit', (_req: Request, res: Response): void => {
    if (process.env['NODE_ENV'] !== 'production') {
      console.info('[DEBUG] GET /rate-limit - serving rate limit page');
    }
    const projectRoot = process.cwd();
    const rateLimitPath = path.join(projectRoot, 'frontend', 'dist', 'pages', 'rate-limit.html');
    res.sendFile(rateLimitPath);
  });

  // Mount HTML routes for pages
  // All page permissions are handled by requireRoleV2 middleware in html.routes.ts
  app.use(htmlRoutes);

  console.log('✅ Page routes and clean URLs configured');
}
