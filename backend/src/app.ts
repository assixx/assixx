/**
 * Express Application Setup
 * Separated from server.js for better testing
 */

import 'dotenv/config';
import express, { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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

// Routes
import routes from './routes';

// Create Express app
const app: Application = express();

// Static file interface removed - not used

// Basic middleware
app.use(morgan('combined'));
app.use(cors(corsOptions));
app.use(securityHeaders);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization middleware - apply globally to all routes
app.use(sanitizeInputs);

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

// Fallback to src directory for assets (images, etc.)
app.use(
  express.static(srcPath, {
    setHeaders: (res: Response, filePath: string): void => {
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

// CSRF Protection - applied to all routes except specified exceptions
console.log('[DEBUG] Applying CSRF protection');
app.use(validateCSRFToken);

// API Routes - Use centralized routing
console.log('[DEBUG] Mounting main routes at /');
app.use(routes);

// HTML Routes - Serve pages
import htmlRoutes from './routes/html.routes';
app.use(htmlRoutes);

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

// Express Router with stack property interface
interface ExpressRouter {
  stack: Array<{
    route?: {
      path: string;
      methods: { [key: string]: boolean };
    };
  }>;
}

// 404 handler
app.use((req: Request, res: Response): void => {
  console.log(`[DEBUG] 404 hit: ${req.method} ${req.originalUrl}`);
  console.log(
    '[DEBUG] Available routes:',
    (app._router as ExpressRouter).stack
      .filter((r) => r.route)
      .map((r) => `${Object.keys(r.route!.methods).join(',')} ${r.route!.path}`)
  );
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
  });
});

export default app;
