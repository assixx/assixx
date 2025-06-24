/**
 * Express Application Setup
 * Separated from server.js for better testing
 */

import 'dotenv/config';
import express, { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import fs from 'fs';

// ES modules equivalent of __dirname - only define if not already defined
const __filename =
  typeof global.__filename !== 'undefined'
    ? global.__filename
    : fileURLToPath(import.meta.url);
const __dirname =
  typeof global.__dirname !== 'undefined'
    ? global.__dirname
    : path.dirname(__filename);
import cors from 'cors';
import cookieParser from 'cookie-parser';

// Security middleware
import {
  securityHeaders,
  corsOptions,
  generalLimiter,
  authLimiter,
  uploadLimiter,
  apiSecurityHeaders,
  validateCSRFToken,
  sanitizeInputs,
} from './middleware/security-enhanced';

// Page protection middleware
import { protectPage, contentSecurityPolicy } from './middleware/pageAuth';

// Routes
import routes from './routes';

// Swagger documentation
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

// Create Express app
const app: Application = express();

// Static file interface removed - not used

// Basic middleware
app.use(morgan('combined'));
app.use(cors(corsOptions));
app.use(securityHeaders);
app.use(contentSecurityPolicy); // Add CSP headers
app.use(cookieParser());
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization middleware - apply globally to all routes
app.use(sanitizeInputs as any);

// Protect HTML pages based on user role
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.endsWith('.html')) {
    return (protectPage as any)(req, res, next);
  }
  next();
});

// Static files - serve from frontend dist directory (compiled JavaScript)
const distPath = path.join(__dirname, '../../frontend/dist');
const srcPath = path.join(__dirname, '../../frontend/src');

// Serve built files first (HTML, JS, CSS)
app.use(
  express.static(distPath, {
    setHeaders: (res: Response, filePath: string): void => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');

      // Set correct MIME types
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      } else if (filePath.endsWith('.html')) {
        res.setHeader('Content-Type', 'text/html');
      }
    },
  })
);

// Development mode: Handle TypeScript files
app.use('/scripts', (req: Request, res: Response, next: NextFunction): void => {
  if (!req.path.endsWith('.ts')) {
    return next();
  }

  const filename = req.path.slice(1, -3); // Remove leading / and .ts extension

  // In development, check if compiled JS exists first
  const jsPath = path.join(distPath, 'js', `${filename}.js`);
  if (fs.existsSync(jsPath)) {
    console.log(`[DEBUG] Serving compiled JS instead of TS: ${jsPath}`);
    res.type('application/javascript').sendFile(jsPath);
    return;
  }

  // In production, use mappings
  const mappings: { [key: string]: string } = {
    'unified-navigation': 'unified-navigation-CL4_3UZb.js',
    'root-dashboard': 'root-dashboard-Dfu_VQDO.js',
    'header-user-info': 'header-user-info-BRS5ypTV.js',
    'admin-dashboard': 'admin-dashboard-N_R6RCKQ.js',
    'admin-config': 'admin-config-ev_UCVpb.js',
    auth: 'auth-CLt6HVJ3.js',
    blackboard: 'blackboard-CkcWnHK8.js',
    calendar: 'calendar-CM3Czewy.js',
    chat: 'chat-BMxgIT7z.js',
    'dashboard-scripts': 'dashboard-scripts-ctg6MSn3.js',
    shifts: 'shifts-CzuLC6lB.js',
    'storage-upgrade': 'storage-upgrade-CaOJRvXh.js',
    'admin-profile': 'admin-profile-DrPj6ROD.js',
    'manage-admins': 'manage-admins-Bo1AiG2V.js',
    'components/unified-navigation': 'unified-navigation-CL4_3UZb.js',
    'role-switch': 'role-switch-C7a6BNLX.js',
    'employee-dashboard': 'employee-dashboard-egyM3xDp.js',
    documents: 'documents-BIog5ddL.js',
  };

  const compiledFile = mappings[filename];
  if (compiledFile) {
    console.log(`[DEBUG] Redirecting ${req.path} to /js/${compiledFile}`);
    res.redirect(`/js/${compiledFile}`);
  } else {
    // For missing files, return empty module to avoid syntax errors
    console.warn(
      `[DEBUG] No mapping found for ${filename}, returning empty module`
    );
    res
      .type('application/javascript')
      .send(
        `// Empty module for ${filename}\nconsole.warn('Module ${filename} not found, loaded empty placeholder');`
      );
  }
});

// Fallback to src directory for assets (images, etc.)
app.use(
  express.static(srcPath, {
    setHeaders: (res: Response): void => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
    },
  })
);

// Uploads directory (always served)
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// API security headers and additional validation
app.use('/api', apiSecurityHeaders);

// Additional security for API routes
app.use('/api', (req: Request, res: Response, next: NextFunction): void => {
  // Validate Content-Type for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    if (
      !contentType ||
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
  if (
    req.get('Content-Length') &&
    parseInt(req.get('Content-Length')!) > 50 * 1024 * 1024
  ) {
    // 50MB max
    res.status(413).json({ error: 'Request entity too large' });
    return;
  }

  next();
});

// Rate limiting with exemptions
app.use('/api', (req: Request, res: Response, next: NextFunction): void => {
  // Exempt /api/auth/user from general rate limiting
  if (req.path === '/auth/user' || req.path === '/auth/check') {
    return next();
  }
  generalLimiter(req, res, next);
});

// Auth endpoints have stricter limits, but exempt /api/auth/user
app.use(
  '/api/auth',
  (req: Request, res: Response, next: NextFunction): void => {
    // Exempt /api/auth/user and /api/auth/check from auth rate limiting
    if (req.path === '/user' || req.path === '/check') {
      return next();
    }
    authLimiter(req, res, next);
  }
);

app.use('/api/login', authLimiter);
app.use('/api/upload', uploadLimiter);

// Clean URLs middleware - Redirect .html to clean paths
app.use((req: Request, res: Response, next: NextFunction): void => {
  if (req.path.endsWith('.html')) {
    const cleanPath = req.path.slice(0, -5);
    res.redirect(
      301,
      cleanPath +
        (req.originalUrl.includes('?')
          ? req.originalUrl.substring(req.originalUrl.indexOf('?'))
          : '')
    );
    return;
  }
  next();
});

// Debug middleware to log all requests
app.use((req: Request, _res: Response, next: NextFunction): void => {
  console.log(
    `[DEBUG] ${req.method} ${req.originalUrl} - Body:`,
    req.body ? Object.keys(req.body) : 'No body'
  );
  next();
});

// Root redirect - redirect / to /pages/index.html
app.get('/', (_req: Request, res: Response): void => {
  res.redirect('/pages/index.html');
});

// Health check route - MUST BE BEFORE OTHER ROUTES
app.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
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
  console.log('[DEBUG] /api/test POST received');
  res.json({ message: 'POST test successful', body: req.body });
});

// Import auth controller directly for legacy endpoint
import authController from './controllers/auth.controller';

// Legacy login endpoints (for backward compatibility) - MUST BE BEFORE OTHER ROUTES
app.get('/login', (_req: Request, res: Response): void => {
  console.log('[DEBUG] GET /login - serving login page');
  res.sendFile(path.join(__dirname, '../../frontend/src/pages', 'login.html'));
});

app.post(
  '/login',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    console.log('[DEBUG] POST /login endpoint hit');
    console.log('[DEBUG] Original URL:', req.originalUrl);
    console.log('[DEBUG] Request body:', req.body);

    try {
      // Call auth controller directly
      await authController.login(req, res);
    } catch (error: any) {
      console.error('[DEBUG] Error in /login endpoint:', error);
      res
        .status(500)
        .json({ message: 'Internal server error', error: error.message });
    }
  }
);

// Legacy routes for backward compatibility - MUST BE BEFORE main routes
import legacyRoutes from './routes/legacy.routes';
console.log('[DEBUG] Mounting legacy routes');
app.use(legacyRoutes);

// Role Switch Routes - BEFORE CSRF Protection
import roleSwitchRoutes from './routes/role-switch';
console.log('[DEBUG] Mounting role-switch routes at /api/role-switch');
app.use('/api/role-switch', roleSwitchRoutes);

// Swagger API Documentation - BEFORE CSRF Protection
if (process.env.NODE_ENV === 'development') {
  console.log('[DEBUG] Mounting Swagger UI at /api-docs');

  // Serve OpenAPI JSON spec
  app.get('/api-docs/swagger.json', (_req: Request, res: Response): void => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Serve Swagger UI
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
    })
  );
}

// CSRF Protection - applied to all routes except specified exceptions
console.log('[DEBUG] Applying CSRF protection');
app.use(validateCSRFToken);

// API Routes - Use centralized routing
console.log('[DEBUG] Mounting main routes at /');
app.use(routes);

// HTML Routes - Serve pages
import htmlRoutes from './routes/html.routes';
app.use(htmlRoutes);

// Root redirect - send users to appropriate dashboard based on role
import { redirectToDashboard } from './middleware/pageAuth';
app.get('/', redirectToDashboard as any);
app.get('/dashboard', redirectToDashboard as any);

// Error handling middleware
app.use(
  (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    console.error(err.stack);
    res.status(500).json({
      message: 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
);

// Express Router with stack property interface (removed - not used)

// 404 handler
app.use((req: Request, res: Response): void => {
  console.log(`[DEBUG] 404 hit: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
  });
});

// Error handler
app.use(
  (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    console.error('[ERROR]', err.stack || err.message || err);

    const isDevelopment = process.env.NODE_ENV === 'development';

    res.status(500).json({
      error: 'Internal Server Error',
      message: isDevelopment ? err.message : 'Something went wrong',
      ...(isDevelopment && { stack: err.stack }),
    });
  }
);

export default app;
