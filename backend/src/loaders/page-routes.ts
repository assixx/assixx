/**
 * Page Routes Configuration Loader
 * Handles HTML page serving and clean URL redirects
 */
import { Application, NextFunction, Request, Response } from 'express';
import path from 'path';

import { protectPage } from '../middleware/pageAuth.js';
import htmlRoutes from '../routes/pages/html.routes.js';

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
  app.use(htmlRoutes);

  // Page protection middleware (must be after routes)
  app.use((req: Request, res: Response, next: NextFunction): void => {
    // Skip for API routes
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }

    // Skip for static assets
    if (req.path.includes('/assets/') || req.path.includes('/images/')) {
      next();
      return;
    }

    // Protect HTML pages
    if (req.path.endsWith('.html')) {
      protectPage(req, res, next);
      return;
    }

    next();
  });

  console.log('✅ Page routes and clean URLs configured');
}
