/**
 * Legacy Compatibility Loader
 * Handles backward compatibility for old endpoints
 */
import { Application, NextFunction, Request, Response } from 'express';

import authController from '../controllers/auth.controller.js';
import { authLimiter } from '../middleware/security-enhanced.js';

/**
 * Load legacy compatibility routes
 * @param app - Express application instance
 */
export function loadLegacyCompat(app: Application): void {
  // Legacy login redirect
  app.get('/login', (_req: Request, res: Response): void => {
    res.redirect('/pages/login');
  });

  // Legacy login endpoint - still used by some frontend code
  app.post(
    '/login',
    authLimiter,
    async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
      if (process.env.NODE_ENV !== 'production') {
        console.info('[DEBUG] POST /login endpoint hit');
        console.info('[DEBUG] Original URL:', req.originalUrl);
        // NEVER log passwords or sensitive data!
        const bodyKeys = req.body ? Object.keys(req.body as Record<string, unknown>) : [];
        console.info('[DEBUG] Request body keys:', bodyKeys);
      }

      try {
        // Call auth controller directly
        await authController.login(req, res);
      } catch (error: unknown) {
        console.error('[DEBUG] Error in /login endpoint:', error);
        res.status(500).json({
          message: 'Internal server error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  // Legacy API redirects (if any old clients still use v1 endpoints)
  app.use('/api/v1', (_req: Request, res: Response, next: NextFunction): void => {
    // Only handle requests that start with /api/v1
    if (_req.path.startsWith('/')) {
      res.status(410).json({
        error: 'Gone',
        message: 'API v1 has been deprecated. Please use API v2.',
        migration: 'https://docs.assixx.com/api/migration',
      });
      return;
    }
    next();
  });

  console.log('✅ Legacy compatibility routes configured');
}
