/**
 * Page Routes Configuration Loader
 * Handles HTML page serving and clean URL redirects
 */
import { Application, NextFunction, Request, Response } from 'express';
import path from 'path';

import htmlRoutes from '../routes/pages/html.routes.js';

/** Base origin for URL validation (localhost for relative URL parsing) */
const VALIDATION_BASE_ORIGIN = 'http://localhost';

/**
 * SECURITY: Validate that a redirect URL is safe (local only)
 * Prevents open redirect vulnerabilities (CWE-601)
 * Uses URL parsing as recommended by CodeQL to verify redirect stays local
 * @param redirectUrl - The full redirect URL to validate (path + query string)
 * @returns true if URL is safe for redirect
 */
function isSafeLocalRedirect(redirectUrl: string): boolean {
  // Must start with single slash (local path)
  if (!redirectUrl.startsWith('/')) {
    return false;
  }
  // Must NOT start with // (protocol-relative URL that could redirect externally)
  if (redirectUrl.startsWith('//')) {
    return false;
  }
  // Must NOT contain :// anywhere (absolute URL injection)
  if (redirectUrl.includes('://')) {
    return false;
  }
  // Must NOT contain backslash (Windows path injection / URL confusion)
  if (redirectUrl.includes('\\')) {
    return false;
  }

  // SECURITY: Parse URL to verify it stays on localhost (CodeQL recommended approach)
  try {
    const parsedUrl = new globalThis.URL(redirectUrl, VALIDATION_BASE_ORIGIN);
    // Verify the parsed URL stays on our origin (didn't redirect to external host)
    if (parsedUrl.origin !== VALIDATION_BASE_ORIGIN) {
      return false;
    }
    // Verify pathname is still what we expect (no URL manipulation)
    if (!parsedUrl.pathname.startsWith('/')) {
      return false;
    }
  } catch {
    // URL parsing failed - reject as potentially malicious
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
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';

    // SECURITY: Build full redirect URL and validate BEFORE redirecting (CWE-601 fix)
    const redirectUrl = cleanPath + queryString;
    if (!isSafeLocalRedirect(redirectUrl)) {
      res.status(400).send('Bad Request');
      return;
    }

    res.redirect(301, redirectUrl);
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
