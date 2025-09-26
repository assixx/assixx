/**
 * Express Application Setup
 * Separated from server.js for better testing
 */
import cookieParser from 'cookie-parser';
import cors from 'cors';
import 'dotenv/config';
import express, { Application, NextFunction, Request, Response } from 'express';
import fs from 'fs';
import morgan from 'morgan';
import path from 'path';
import swaggerUi from 'swagger-ui-express';

import { swaggerSpec } from './config/swagger';
import { swaggerSpecV2 } from './config/swagger-v2';
import authController from './controllers/auth.controller';
import { deprecationMiddleware } from './middleware/deprecation';
import { contentSecurityPolicy, protectPage, redirectToDashboard } from './middleware/pageAuth';
import { rateLimiter } from './middleware/rateLimiter';
import {
  apiSecurityHeaders,
  authLimiter,
  corsOptions,
  generalLimiter,
  sanitizeInputs,
  securityHeaders,
  uploadLimiter,
  validateCSRFToken,
} from './middleware/security-enhanced';
import { checkTenantStatus } from './middleware/tenantStatus';
import routes from './routes/v1';
import htmlRoutes from './routes/v1/html.routes';
import legacyRoutes from './routes/v1/legacy.routes';
import roleSwitchRoutes from './routes/v1/role-switch';
import { getCurrentDirPath } from './utils/getCurrentDir.js';

/**
 * Express Application Setup
 * Separated from server.js for better testing
 */

// Get current directory path using helper function
// This avoids import.meta issues with Jest
const currentDirPath = getCurrentDirPath();

// Constants
const CONTENT_TYPE_HEADER = 'Content-Type';
const MIME_TYPE_JAVASCRIPT = 'application/javascript';
const X_CONTENT_TYPE_OPTIONS = 'X-Content-Type-Options';
const RATE_LIMIT_PATH = '/rate-limit';

// Security middleware
// Page protection middleware
// Routes
// Swagger documentation
// Create Express app
const app: Application = express();

// Static file interface removed - not used

// Basic middleware
app.use(morgan('combined'));
app.use(cors(corsOptions));
app.use(securityHeaders);
app.use(contentSecurityPolicy); // Add CSP headers
// codeql[js/missing-token-validation] - Application uses JWT Bearer tokens as primary auth
// Cookies are only fallback with SameSite=strict protection
app.use(cookieParser());
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization middleware - apply globally to all routes
app.use(sanitizeInputs);

// CSRF Protection - MUST be applied BEFORE routes to protect them
// This middleware:
// - Skips validation for Bearer token auth (JWT)
// - Skips validation for public endpoints (login, signup)
// - Validates CSRF tokens for cookie-based sessions
console.info('[DEBUG] Applying CSRF protection middleware');
app.use(validateCSRFToken);

// Define paths early for feature-flags.js handler
const distPath = path.join(currentDirPath, '../../frontend/dist');

// Serve feature-flags.js with correct MIME type
// codeql[js/missing-rate-limiting] - False positive: Rate limiting is applied via rateLimiter.public middleware
app.get('/feature-flags.js', rateLimiter.public, (_req: Request, res: Response): void => {
  let featureFlagsPath = '';

  // Security: Use try-catch with fs.accessSync to avoid non-literal warnings
  // Check each whitelisted path explicitly
  const distFeaturePath = path.join(distPath, 'feature-flags.js');
  const publicPath = path.join(currentDirPath, '../../frontend/public/feature-flags.js');
  const altDistPath = path.join(currentDirPath, '../../dist/feature-flags.js');

  // Try each path in order
  try {
    fs.accessSync(distFeaturePath, fs.constants.R_OK);
    featureFlagsPath = distFeaturePath;
  } catch {
    try {
      fs.accessSync(publicPath, fs.constants.R_OK);
      featureFlagsPath = publicPath;
    } catch {
      try {
        fs.accessSync(altDistPath, fs.constants.R_OK);
        featureFlagsPath = altDistPath;
      } catch {
        // None of the paths exist
      }
    }
  }

  if (featureFlagsPath === '') {
    res.status(404).send('feature-flags.js not found');
    return;
  }

  res.setHeader(CONTENT_TYPE_HEADER, `${MIME_TYPE_JAVASCRIPT}; charset=utf-8`);
  res.setHeader(X_CONTENT_TYPE_OPTIONS, 'nosniff');
  res.sendFile(featureFlagsPath);
});

// Clean URLs redirect middleware - MUST BE BEFORE static files
app.use((req: Request, res: Response, next: NextFunction): void => {
  if (req.path.endsWith('.html') && req.path.startsWith('/pages/')) {
    const cleanPath = req.path.replace('/pages/', '/').slice(0, -5);
    res.redirect(
      301,
      cleanPath +
        (req.originalUrl.includes('?') ?
          req.originalUrl.substring(req.originalUrl.indexOf('?'))
        : ''),
    );
    return;
  }
  next();
});

// Protect HTML pages based on user role with rate limiting
// codeql[js/missing-rate-limiting] - False positive: Rate limiting is applied via rateLimiter.public middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  // Skip rate limiting for /rate-limit page to avoid redirect loops
  if (req.path === RATE_LIMIT_PATH) {
    // Also skip protectPage for /rate-limit
    next();
    return;
  }

  // Skip rate limiting for static files (CSS, JS, images, fonts, etc.)
  const staticFileExtensions = [
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
  ];
  const isStaticFile = staticFileExtensions.some((ext) => req.path.endsWith(ext));

  // Skip rate limiting for static paths
  const staticPaths = ['/styles/', '/js/', '/scripts/', '/assets/', '/images/', '/css/', '/fonts/'];
  const isStaticPath = staticPaths.some((path) => req.path.startsWith(path));

  if (isStaticFile || isStaticPath) {
    // Only protect HTML pages
    if (req.path.endsWith('.html')) {
      protectPage(req, res, next);
      return;
    }
    next();
    return;
  }

  // Apply rate limiter only for non-static routes
  // Using callback pattern as required by express-rate-limit library
  rateLimiter.public(req, res, (err?: unknown) => {
    if (err) {
      next(err);
      return;
    }
    // Only protect HTML pages
    if (req.path.endsWith('.html')) {
      protectPage(req, res, next);
      return;
    }
    next();
  });
});

// Static files - serve from frontend dist directory (compiled JavaScript)
// distPath already defined above
const srcPath = path.join(currentDirPath, '../../frontend/src');

// Serve built files first (HTML, JS, CSS)
app.use(
  express.static(distPath, {
    setHeaders: (res: Response, filePath: string): void => {
      res.setHeader(X_CONTENT_TYPE_OPTIONS, 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');

      // Set correct MIME types
      if (filePath.endsWith('.js')) {
        res.setHeader(CONTENT_TYPE_HEADER, MIME_TYPE_JAVASCRIPT);
      } else if (filePath.endsWith('.css')) {
        res.setHeader(CONTENT_TYPE_HEADER, 'text/css');
      } else if (filePath.endsWith('.html')) {
        res.setHeader(CONTENT_TYPE_HEADER, 'text/html');
      }
    },
  }),
);

// Serve styles directory
app.use(
  '/styles',
  express.static(path.join(srcPath, 'styles'), {
    setHeaders: (res: Response, filePath: string): void => {
      res.setHeader(X_CONTENT_TYPE_OPTIONS, 'nosniff');
      if (filePath.endsWith('.css')) {
        res.setHeader(CONTENT_TYPE_HEADER, 'text/css');
      }
    },
  }),
);

// Serve scripts directory for regular JS files
app.use(
  '/scripts',
  express.static(path.join(srcPath, 'scripts'), {
    setHeaders: (res: Response, filePath: string): void => {
      res.setHeader(X_CONTENT_TYPE_OPTIONS, 'nosniff');
      if (filePath.endsWith('.js')) {
        res.setHeader(CONTENT_TYPE_HEADER, MIME_TYPE_JAVASCRIPT);
      }
    },
  }),
);

// Serve assets directory
app.use(
  '/assets',
  express.static(path.join(srcPath, 'assets'), {
    setHeaders: (res: Response, path: string): void => {
      res.setHeader(X_CONTENT_TYPE_OPTIONS, 'nosniff');

      // Set cache headers for images to prevent NS_BINDING_ABORTED
      if (
        path.endsWith('.png') ||
        path.endsWith('.jpg') ||
        path.endsWith('.jpeg') ||
        path.endsWith('.ico') ||
        path.endsWith('.gif')
      ) {
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable'); // 7 days
        res.setHeader('Expires', new Date(Date.now() + 604800000).toUTCString()); // 7 days from now
      }
    },
  }),
);

// Handle /js/ requests - map to TypeScript files in development
// codeql[js/missing-rate-limiting] - False positive: Rate limiting is applied via rateLimiter.public middleware
app.use('/js', (req: Request, res: Response, next: NextFunction): void => {
  // Skip rate limiting if parent path is /rate-limit
  const referer = req.headers.referer ?? '';
  if (referer.includes(RATE_LIMIT_PATH)) {
    next();
    return;
  }

  // Using callback pattern as required by express-rate-limit library
  rateLimiter.public(req, res, (err?: unknown) => {
    if (err) {
      next(err);
      return;
    }
    // Map JS requests to TypeScript source files
    const jsFileName = path.basename(req.path, '.js');

    // Check mappings for TypeScript files
    const tsMapping: Record<string, string> = {
      'unified-navigation': '/scripts/components/unified-navigation.ts',
      'admin-dashboard': '/scripts/admin-dashboard.ts',
      'role-switch': '/scripts/role-switch.ts',
      'header-user-info': '/scripts/header-user-info.ts',
      'root-dashboard': '/scripts/root-dashboard.ts',
      auth: '/scripts/auth.ts',
      blackboard: '/scripts/blackboard.ts',
      calendar: '/scripts/calendar.ts',
      chat: '/scripts/chat.ts',
      shifts: '/scripts/shifts.ts',
      documents: '/scripts/documents.ts',
      'employee-dashboard': '/scripts/employee-dashboard.ts',
      'manage-admins': '/scripts/manage-admins.ts',
      'admin-profile': '/scripts/admin-profile.ts',
      'admin-config': '/scripts/admin-config.ts',
      'components/unified-navigation': '/scripts/components/unified-navigation.ts', // Added mapping for survey-results
    };

    // Security: Use Map instead of object for safe lookups
    const tsMappingMap = new Map(Object.entries(tsMapping));
    const tsPath = tsMappingMap.get(jsFileName) ?? null;
    if (tsPath !== null && tsPath !== '') {
      // Redirect to the TypeScript file
      res.redirect(tsPath);
      return;
    }

    // If no mapping found, try to find it in dist
    // Sanitize the path to prevent directory traversal
    const sanitizedReqPath = req.path.substring(1).replace(/\.\./g, '').replace(/\/+/g, '/');
    const distJsPath = path.resolve(distPath, 'js', sanitizedReqPath);

    // Validate that the resolved path is within the expected directory
    if (!distJsPath.startsWith(path.resolve(distPath, 'js'))) {
      res.status(403).send('Forbidden');
      return;
    }

    // Security: Validate path is within expected directory
    const normalizedDistPath = path.normalize(distJsPath);
    const absoluteDistPath = path.resolve(normalizedDistPath);
    const expectedDistRoot = path.resolve(distPath);

    if (!normalizedDistPath.includes('..') && absoluteDistPath.startsWith(expectedDistRoot)) {
      // Use try-catch for file existence check to avoid non-literal fs warning
      try {
        fs.accessSync(absoluteDistPath, fs.constants.R_OK);
        res.type(MIME_TYPE_JAVASCRIPT).sendFile(absoluteDistPath);
        return;
      } catch {
        // File doesn't exist, continue to fallback
      }
    }

    // Fallback - return empty module
    // Escape filename to prevent XSS
    const escapedFileName = jsFileName.replace(/["'\\]/g, '\\$&').replace(/[<>]/g, '');
    res
      .type(MIME_TYPE_JAVASCRIPT)
      .send(
        `// Module ${escapedFileName} not found\nconsole.warn('Module ${escapedFileName} not found');`,
      );
  });
});

// Helper functions for TypeScript file serving
function sanitizePath(requestPath: string): string {
  return requestPath.replace(/\.\./g, '').replace(/\/+/g, '/');
}

function isPathSecure(absolutePath: string, expectedRoot: string): boolean {
  const normalized = path.normalize(absolutePath);
  return !normalized.includes('..') && path.resolve(normalized).startsWith(expectedRoot);
}

function tryServeCompiledJs(jsPath: string, res: Response): boolean {
  const expectedJsRoot = path.resolve(distPath, 'js');

  if (!isPathSecure(jsPath, expectedJsRoot)) {
    return false;
  }

  try {
    fs.accessSync(jsPath, fs.constants.R_OK);
    console.info(`[DEBUG] Serving compiled JS instead of TS: ${jsPath}`);
    res.type(MIME_TYPE_JAVASCRIPT).sendFile(jsPath);
    return true;
  } catch {
    return false;
  }
}

function mapTypeScriptPath(requestPath: string): string {
  const mappings = new Map<string, string>([
    ['components/unified-navigation', 'scripts/components/unified-navigation.ts'],
  ]);

  const mappedPath = mappings.get(requestPath);
  if (mappedPath !== undefined) {
    return path.resolve(srcPath, mappedPath);
  }

  return path.resolve(srcPath, 'scripts', requestPath);
}

async function serveTypeScriptFile(tsPath: string, res: Response): Promise<void> {
  const expectedSrcRoot = path.resolve(srcPath);

  if (!isPathSecure(tsPath, expectedSrcRoot)) {
    res.status(403).send('Forbidden');
    return;
  }

  await fs.promises.access(tsPath, fs.constants.R_OK);
  console.info(`[DEBUG] Serving TypeScript file: ${tsPath}`);

  // Additional security check
  if (!tsPath.startsWith(expectedSrcRoot)) {
    throw new Error('Invalid file path');
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const tsContent = await fs.promises.readFile(tsPath, 'utf8');

  const transformedContent = tsContent
    // Remove TypeScript-only import type statements
    .replace(/import\s+type\s+\{[^}]+\}\s+from\s+[""'][^""']+[""'];?\s*/g, '')
    // Remove declare global blocks - Security: Simplified regex to prevent ReDoS
    .replace(/declare\s+global\s*\{[^}]*\}/g, '')
    // Handle nested braces with multiple passes if needed
    .replace(/declare\s+global\s*\{[^{}]*\{[^}]*\}[^}]*\}/g, '')
    // Transform regular imports to add .ts extension
    .replace(/from\s+["'](\.\.?\/[^"']+)(?<!\.ts)["']/g, "from '$1.ts'")
    .replace(/import\s+["'](\.\.?\/[^"']+)(?<!\.ts)["']/g, "import '$1.ts'");

  res.type(MIME_TYPE_JAVASCRIPT).send(transformedContent);
}

// Development mode: Handle TypeScript files
app.use(
  '/scripts',
  // codeql[js/missing-rate-limiting] - False positive: Rate limiting is applied via rateLimiter.public middleware
  // eslint-disable-next-line @typescript-eslint/require-await
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip rate limiting if parent path is /rate-limit
    const referer = req.headers.referer ?? '';
    if (referer.includes(RATE_LIMIT_PATH)) {
      next();
      return;
    }

    // Apply rate limiter
    // Using callback pattern as required by express-rate-limit library
    rateLimiter.public(req, res, (err?: unknown) => {
      if (err) {
        next(err);
        return;
      }

      if (!req.path.endsWith('.ts')) {
        next();
        return;
      }

      const sanitized = sanitizePath(req.path);
      const filename = sanitized.slice(1, -3);

      // Try serving compiled JS first
      const jsPath = path.resolve(distPath, 'js', `${filename}.js`);
      const served = tryServeCompiledJs(jsPath, res);
      if (served) {
        return;
      }

      // Map and serve TypeScript file
      const requestPath = sanitized.replace(/^\/scripts\//, '').replace(/\.ts$/, '');
      const tsPath = mapTypeScriptPath(requestPath);

      // Use IIFE to handle async operations without returning a promise from the callback
      void (async () => {
        try {
          await serveTypeScriptFile(tsPath, res);
        } catch {
          // Return empty module for missing files
          const escapedFilename = filename
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/</g, '\\x3C')
            .replace(/>/g, '\\x3E');

          res
            .type(MIME_TYPE_JAVASCRIPT)
            .send(
              `// Empty module for ${escapedFilename}\nconsole.warn('Module ${escapedFilename} not found');`,
            );
        }
      })();
    });
  },
);

// Fallback to src directory for assets (images, etc.)
app.use(
  express.static(srcPath, {
    setHeaders: (res: Response, filePath: string): void => {
      res.setHeader(X_CONTENT_TYPE_OPTIONS, 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');

      // Set correct MIME types
      if (filePath.endsWith('.js')) {
        res.setHeader(CONTENT_TYPE_HEADER, MIME_TYPE_JAVASCRIPT);
      } else if (filePath.endsWith('.css')) {
        res.setHeader(CONTENT_TYPE_HEADER, 'text/css');
      } else if (filePath.endsWith('.html')) {
        res.setHeader(CONTENT_TYPE_HEADER, 'text/html');
      } else if (filePath.endsWith('.json')) {
        res.setHeader(CONTENT_TYPE_HEADER, 'application/json');
      }
    },
  }),
);

// Uploads directory (always served)
app.use('/uploads', express.static(path.join(currentDirPath, '../../uploads')));

// API security headers and additional validation
app.use('/api', apiSecurityHeaders);

// Apply deprecation headers for API v1
app.use(deprecationMiddleware('v1', '2025-12-31'));

// Additional security for API routes
app.use('/api', (req: Request, res: Response, next: NextFunction): void => {
  // Validate Content-Type for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get(CONTENT_TYPE_HEADER);
    if (
      contentType === undefined ||
      (!contentType.includes('application/json') &&
        !contentType.includes('multipart/form-data') &&
        !contentType.includes('application/x-www-form-urlencoded'))
    ) {
      res.status(400).json({
        error:
          'Invalid Content-Type. Expected application/json, multipart/form-data, or application/x-www-form-urlencoded',
      });
      return;
    }
  }

  // Prevent large request bodies (additional protection)
  const contentLength = req.get('Content-Length');
  if (contentLength !== undefined && Number.parseInt(contentLength) > 50 * 1024 * 1024) {
    // 50MB max
    res.status(413).json({ error: 'Request entity too large' });
    return;
  }

  next();
});

// Apply general rate limiting to all routes (HTML and API)
// This provides a baseline protection against DoS attacks
// IMPORTANT: Exclude /rate-limit and static files to prevent redirect loops
app.use((req: Request, res: Response, next: NextFunction): void => {
  // Skip rate limiting for /rate-limit page to avoid redirect loops
  if (req.path === RATE_LIMIT_PATH) {
    next();
    return;
  }

  // Skip rate limiting for static files (CSS, JS, images, fonts, etc.)
  const staticFileExtensions = [
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
  ];
  const isStaticFile = staticFileExtensions.some((ext) => req.path.endsWith(ext));

  // Skip rate limiting for static paths
  const staticPaths = ['/styles/', '/js/', '/scripts/', '/assets/', '/images/', '/css/', '/fonts/'];
  const isStaticPath = staticPaths.some((path) => req.path.startsWith(path));

  if (isStaticFile || isStaticPath) {
    next();
    return;
  }

  // Skip general rate limiting for ALL API v2 requests (they have their own rate limiters)
  // This includes both Bearer token and Cookie-based authentication
  if (req.path.startsWith('/api/v2/')) {
    next();
    return;
  }

  generalLimiter(req, res, next);
});

// Additional rate limiting for API routes with exemptions
app.use('/api', (req: Request, _res: Response, next: NextFunction): void => {
  // Exempt /api/auth/user from additional API rate limiting
  if (req.path === '/auth/user' || req.path === '/auth/check') {
    next();
    return;
  }
  // API routes already have generalLimiter applied above
  next();
});

// Auth endpoints have stricter limits, but exempt /api/auth/user
app.use('/api/auth', (req: Request, res: Response, next: NextFunction): void => {
  // Exempt /api/auth/user and /api/auth/check from auth rate limiting
  if (req.path === '/user' || req.path === '/check') {
    next();
    return;
  }
  authLimiter(req, res, next);
});

app.use('/api/login', authLimiter);
app.use('/api/upload', uploadLimiter);

// Clean URLs middleware - Redirect .html to clean paths
// Moved after HTML routes to prevent conflicts
// Will be activated later in the middleware stack

// Debug middleware to log all requests
app.use((req: Request, _res: Response, next: NextFunction): void => {
  // Use separate arguments to avoid format string issues
  console.info(
    '[DEBUG]',
    req.method,
    req.originalUrl,
    '- Body:',
    req.body !== null && req.body !== undefined ?
      Object.keys(req.body as Record<string, unknown>)
    : 'No body',
  );
  next();
});

// Root redirect handled by HTML routes and redirectToDashboard below

// Health check route - MUST BE BEFORE OTHER ROUTES
app.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV ?? 'development',
  });
});

// API status route - MUST BE BEFORE OTHER API ROUTES
app.get('/api/status', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'operational',
    version: '0.0.2',
    api: 'v1',
    features: [
      'authentication',
      'multi-tenant',
      'documents',
      'blackboard',
      'calendar',
      'chat',
      'kvp',
      'shifts',
      'surveys',
    ],
  });
});

// Test POST endpoint
app.post('/api/test', (req: Request, res: Response): void => {
  console.info('[DEBUG] /api/test POST received');
  res.json({
    message: 'POST test successful',
    body: req.body as Record<string, unknown>,
  });
});

// Import auth controller directly for legacy endpoint
// Legacy login endpoints (for backward compatibility) - MUST BE BEFORE OTHER ROUTES
app.get('/login', (_req: Request, res: Response): void => {
  console.info('[DEBUG] GET /login - serving login page');
  // Fix path for Docker environment
  const projectRoot = process.cwd(); // In Docker this is /app
  const loginPath = path.join(projectRoot, 'frontend', 'dist', 'pages', 'login.html');
  res.sendFile(loginPath);
});

// Rate limit page endpoint - MUST BE BEFORE OTHER ROUTES
app.get(RATE_LIMIT_PATH, (_req: Request, res: Response): void => {
  console.info('[DEBUG] GET /rate-limit - serving rate limit page');
  const projectRoot = process.cwd(); // In Docker this is /app
  const rateLimitPath = path.join(projectRoot, 'frontend', 'dist', 'pages', 'rate-limit.html');
  res.sendFile(rateLimitPath);
});

app.post('/login', async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
  console.info('[DEBUG] POST /login endpoint hit');
  console.info('[DEBUG] Original URL:', req.originalUrl);
  console.info('[DEBUG] Request body:', req.body);

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
});

// Legacy routes for backward compatibility - MUST BE BEFORE main routes
// Role Switch Routes - BEFORE CSRF Protection
// Swagger API Documentation - BEFORE CSRF Protection
// TEMPORARY: Enable Swagger in all modes for API documentation
// Currently always enabled - change to conditional if needed for production
console.info('[DEBUG] Mounting Swagger UI at /api-docs');

// Serve OpenAPI JSON spec
app.get('/api-docs/swagger.json', (_req: Request, res: Response): void => {
  res.setHeader(CONTENT_TYPE_HEADER, 'application/json');
  res.send(swaggerSpec);
});

// Serve v2 OpenAPI JSON spec
app.get('/api-docs/v2/swagger.json', (_req: Request, res: Response): void => {
  res.setHeader(CONTENT_TYPE_HEADER, 'application/json');
  res.send(swaggerSpecV2);
});

// Serve Swagger UI for v1
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Assixx API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
      tryItOutEnabled: true,
      persistAuthorization: true,
    },
  }),
);

// Serve Swagger UI for v2
console.info('[DEBUG] Mounting Swagger UI v2 at /api-docs/v2');
app.use(
  '/api-docs/v2',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpecV2, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Assixx API v2 Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
      tryItOutEnabled: true,
      persistAuthorization: true,
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 1,
    },
  }),
);

// Tenant Status Middleware - check tenant deletion status
console.info('[DEBUG] Applying tenant status middleware');
app.use('/api', checkTenantStatus);

// Legacy routes
console.info('[DEBUG] Mounting legacy routes');
app.use(legacyRoutes);

// Role switch routes
console.info('[DEBUG] Mounting role-switch routes at /api/role-switch');
app.use('/api/role-switch', roleSwitchRoutes);

// API Routes - Use centralized routing
console.info('[DEBUG] Mounting main routes at /');
app.use(routes);

// Root and dashboard redirects
app.get('/', redirectToDashboard);
app.get('/dashboard', redirectToDashboard);

// HTML Routes
app.use(htmlRoutes);

// Root and dashboard redirect - send users to appropriate dashboard or landing page
// HTML Routes - Serve pages (AFTER root redirect)
// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  // Check if it's a ServiceError
  if (err.name === 'ServiceError' && 'statusCode' in err) {
    const serviceError = err as Error & {
      statusCode: number;
      code: string;
      details?: { field: string; message: string }[];
    };
    res.status(serviceError.statusCode).json({
      success: false,
      error: {
        code: serviceError.code,
        message: serviceError.message,
        details: serviceError.details,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Default error handling
  console.error(err.stack);
  res.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Express Router with stack property interface (removed - not used)

// 404 handler
app.use((req: Request, res: Response): void => {
  console.info(`[DEBUG] 404 hit: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('[ERROR]', err.stack ?? (err.message !== '' ? err.message : String(err)));

  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message, // Always show message for debugging
    stack: err.stack, // Always show stack for debugging
    name: err.name,
    details: err,
  });
});

export default app;
