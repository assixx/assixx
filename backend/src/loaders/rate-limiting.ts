/**
 * Rate Limiting Configuration Loader
 * Sets up API rate limiting with intelligent exemptions
 */
import { Application, NextFunction, Request, Response } from 'express';

import {
  apiLimiter,
  authLimiter,
  generalLimiter,
  uploadLimiter,
} from '../middleware/security-enhanced';

// Constants
const RATE_LIMIT_PATH = '/rate-limit';
const STATIC_FILE_EXTENSIONS = [
  '.css',
  '.js',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.webp',
];

const STATIC_PATHS = [
  '/styles/',
  '/js/',
  '/scripts/',
  '/assets/',
  '/images/',
  '/css/',
  '/fonts/',
  '/static/',
  '/dist/',
];

/**
 * Check if a request is for a static asset
 * @param path - The request path to check
 * @returns true if the path is for a static asset
 */
function isStaticAsset(path: string): boolean {
  const lowercasePath = path.toLowerCase();
  return (
    STATIC_FILE_EXTENSIONS.some((ext: string) => lowercasePath.endsWith(ext)) ||
    STATIC_PATHS.some((dir: string) => path.startsWith(dir))
  );
}

/**
 * Load rate limiting configuration
 * @param app - Express application instance
 */
export function loadRateLimiting(app: Application): void {
  // General rate limiting with intelligent exemptions
  app.use((req: Request, res: Response, next: NextFunction): void => {
    // Skip rate limiting for health check
    if (req.path === '/health') {
      next();
      return;
    }

    // Skip rate limiting for rate limit page itself (prevent loops)
    if (req.path === RATE_LIMIT_PATH) {
      next();
      return;
    }

    // Skip rate limiting for static assets
    if (isStaticAsset(req.path)) {
      next();
      return;
    }

    // Apply rate limiter for all other routes
    generalLimiter(req, res, next);
  });

  // API-specific rate limiting with exemptions
  app.use('/api', (req: Request, _res: Response, next: NextFunction): void => {
    // IMPORTANT: req.path is RELATIVE to the mount point '/api'
    // So '/api/v2/auth/login' becomes '/v2/auth/login' in this middleware

    // Exempt specific endpoints that need higher limits
    const exemptPaths = [
      '/auth/user', // User info endpoint (polled frequently) - v1 legacy
      '/documents/download', // File downloads
      '/health', // Health checks
    ];

    if (exemptPaths.some((path: string) => req.path.startsWith(path))) {
      next();
      return;
    }

    // Skip rate limiting for static assets
    if (isStaticAsset(req.path)) {
      next();
      return;
    }

    // Apply specific rate limiters for API v2 endpoints
    // NOTE: Paths are relative to /api mount point, so /api/v2/auth/login → /v2/auth/login

    // Strict auth limiter ONLY for login/register (5 attempts per 15 min)
    if (req.path.startsWith('/v2/auth/login') || req.path.startsWith('/v2/auth/register')) {
      authLimiter(req, _res, next);
      return;
    }

    // Upload limiter for file uploads (100 uploads per 15 min in prod, 200 in dev)
    if (req.path.includes('/upload') || req.path.includes('/attachment')) {
      uploadLimiter(req, _res, next);
      return;
    }

    // General API rate limiting for all other v2 routes (30000 requests per 20 sec in dev)
    if (req.path.startsWith('/v2/')) {
      apiLimiter(req, _res, next);
      return;
    }

    next();
  });

  // Specific endpoint rate limiters
  app.use('/api/upload', uploadLimiter);

  console.log('✅ Rate limiting configured');
}

// Export helper function for use in other loaders if needed
