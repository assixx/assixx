// Enhanced Security Middleware für Assixx
import * as cors from 'cors';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import helmet from 'helmet';
// import mongoSanitize from 'express-mongo-sanitize'; // Disabled - not compatible with Express 5.x
// import xss from 'xss-clean'; // Disabled - not compatible with Express 5.x
import hpp from 'hpp';

// import { doubleCsrf } from 'csrf-csrf'; // Package not installed

import type { AuthenticatedRequest } from '../types/request.types.js';

// Type definitions
interface AuditEntry {
  timestamp: string;
  tenant_id: number | string;
  userId: number | string;
  action: string;
  resource: string;
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  ip: string;
  userAgent: string | undefined;
  success: boolean;
}

// CSRF Protection Configuration - Simplified implementation
// const csrfSecret = process.env.CSRF_SECRET  ?? 'assixx-csrf-secret-change-in-production';

// Simple CSRF token generation
function generateToken(_req: AuthenticatedRequest, _res: Response): string {
  // Simple token generation - in production, use a proper CSRF library
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2);
  return `${timestamp}-${random}`;
}

// CSRF protection middleware stub
function doubleCsrfProtection(
  _req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  // Skip CSRF for now - implement proper CSRF protection in production
  next();
}

// CSRF Token Generation Endpoint
export const generateCSRFTokenMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const token = generateToken(req as AuthenticatedRequest, res);
    res.locals.csrfToken = token;
    next();
  } catch (error: unknown) {
    console.error('Error generating CSRF token:', error);
    res.status(500).json({ error: 'Could not generate CSRF token' });
  }
};

// CSRF Token Validation Middleware using doubleCsrf protection
export const validateCSRFToken = (req: Request, res: Response, next: NextFunction): void => {
  // Skip CSRF validation for API endpoints that use Bearer token authentication
  if (req.headers.authorization?.startsWith('Bearer ') === true) {
    next();
    return;
  }

  // Skip CSRF validation for public endpoints
  const publicEndpoints = [
    '/api/signup',
    '/api/check-subdomain',
    '/api/auth/login',
    '/api/auth/register',
    '/login',
    '/signup',
  ];

  if (publicEndpoints.some((endpoint) => req.path.startsWith(endpoint))) {
    next();
    return;
  }

  // Use the CSRF protection middleware
  doubleCsrfProtection(req as AuthenticatedRequest, res, next);
};

// CSRF Token Response Helper
export const attachCSRFToken = (_req: Request, res: Response, next: NextFunction): void => {
  if (res.locals.csrfToken != null) {
    res.setHeader('X-CSRF-Token', res.locals.csrfToken as string);
  }
  next();
};

// HTTPS Enforcement
export const enforceHTTPS = (req: Request, res: Response, next: NextFunction): void => {
  if (req.header('x-forwarded-proto') !== 'https' && process.env.NODE_ENV === 'production') {
    res.redirect(`https://${String(req.header('host'))}${req.url}`);
    return;
  }
  next();
};

// Enhanced Security Headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com',
      ],
      styleSrcElem: [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com',
      ],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com',
      ],
      scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      fontSrc: [
        "'self'",
        'data:',
        'https://fonts.gstatic.com',
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com',
      ],
      connectSrc: ["'self'"],
      frameSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'same-origin' },
  ieNoOpen: true,
  frameguard: { action: 'deny' },
});

// CORS with Subdomain Whitelist
export const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (origin == null || origin === '') {
      callback(null, true);
      return;
    }

    // Check if origin matches allowed patterns
    const allowedPatterns = [
      /^https:\/\/[-0-9a-z]+\.assixx\.com$/, // Production subdomains
      /^https:\/\/[-0-9a-z]+\.assixx\.de$/, // German domain
      /^http:\/\/localhost:\d+$/, // Local development
      /^http:\/\/127\.0\.0\.1:\d+$/, // Local development
    ];

    const isAllowed = allowedPatterns.some((pattern) => pattern.test(origin));

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['X-CSRF-Token'],
  maxAge: 86400, // 24 hours
};

// Enhanced Rate Limiting per Tenant
const createTenantRateLimiter = (windowMs: number, max: number): RateLimitRequestHandler =>
  rateLimit({
    windowMs,
    max,
    // Remove custom keyGenerator to use default IP handling (IPv4/IPv6 compatible)
    // Rate limiting will be based on IP address only
    handler: (_req, res) => {
      const retryAfter = Math.ceil(windowMs / 1000 / 60); // in minutes
      res.status(429).send(`
        <!DOCTYPE html>
        <html lang="de">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Zu viele Anfragen - Assixx</title>
          <link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&display=swap" rel="stylesheet">
          <style>
            :root {
              --primary-color: #2196f3;
              --primary-dark: #1976d2;
              --text-primary: #ffffff;
              --text-secondary: rgba(255, 255, 255, 0.7);
              --spacing-md: 16px;
              --spacing-lg: 24px;
              --spacing-xl: 32px;
              --radius-md: 12px;
            }

            * { margin: 0; padding: 0; box-sizing: border-box; }

            body {
              font-family: 'Ubuntu', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: #000000;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
              position: relative;
              overflow-x: hidden;
            }

            body::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: radial-gradient(circle at 50% 50%, #1e1e1e 0%, #121212 50%, #0a0a0a 100%);
              opacity: 0.9;
              z-index: -1;
            }

            body::after {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: linear-gradient(5deg, transparent, rgba(0, 142, 255, 0.1) 100%, #01000482 0, rgba(0, 0, 4, 0.6) 100%, #000);
              z-index: -1;
            }

            .rate-limit-card {
              width: 100%;
              max-width: 450px;
              background: rgba(255, 255, 255, 0.02);
              backdrop-filter: blur(20px) saturate(180%);
              padding: var(--spacing-xl);
              border-radius: var(--radius-md);
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05);
              border: 1px solid hsla(0, 0%, 100%, 0.1);
              text-align: center;
              animation: fadeInUp 0.6s ease-out;
            }

            @keyframes fadeInUp {
              from { opacity: 0; transform: translateY(30px); }
              to { opacity: 1; transform: translateY(0); }
            }

            .icon {
              font-size: 64px;
              margin-bottom: var(--spacing-lg);
              display: inline-block;
              animation: pulse 2s infinite;
            }

            @keyframes pulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.1); opacity: 0.8; }
            }

            h1 {
              color: var(--text-primary);
              font-size: 28px;
              font-weight: 700;
              margin-bottom: var(--spacing-md);
            }

            .message {
              color: var(--text-secondary);
              font-size: 16px;
              line-height: 1.6;
              margin-bottom: var(--spacing-xl);
            }

            .retry-info {
              background: rgba(33, 150, 243, 0.1);
              border: 1px solid rgba(33, 150, 243, 0.2);
              border-radius: var(--radius-md);
              padding: var(--spacing-lg);
              margin-bottom: var(--spacing-xl);
            }

            .retry-label {
              color: var(--text-secondary);
              font-size: 14px;
              margin-bottom: 12px;
            }

            .retry-time {
              font-size: 32px;
              color: var(--primary-color);
              font-weight: 700;
            }

            .btn-primary {
              display: inline-block;
            padding: var(--spacing-2sm);
              background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
              color: #fff;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 500;
              font-size: 16px;
              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
              box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
            }

            .btn-primary:hover {
              transform: translateY(-2px);
              box-shadow: 0 6px 20px rgba(33, 150, 243, 0.4);
            }

            .btn-primary:active {
              transform: translateY(0);
            }
          </style>
        </head>
        <body>
          <div class="rate-limit-card">
            <div class="icon">⏱️</div>
            <h1>Zu viele Anfragen</h1>
            <p class="message">
              Sie haben die maximale Anzahl an Anfragen überschritten.
              Bitte warten Sie einen Moment, bevor Sie es erneut versuchen.
            </p>
            <div class="retry-info">
              <div class="retry-label">Versuchen Sie es wieder in:</div>
              <div class="retry-time">${retryAfter} Minuten</div>
            </div>
            <a href="/" class="btn-primary">Zurück zur Startseite</a>
          </div>
        </body>
        </html>
      `);
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test', // Skip rate limiting in tests
  });

// API Rate Limiters - Enhanced with more granular controls
export const generalLimiter = createTenantRateLimiter(
  15 * 60 * 1000,
  process.env.NODE_ENV === 'test' ? 100000
  : process.env.NODE_ENV === 'development' ? 50000
  : 1000,
); // 100000 requests per 15 minutes in test, 50000 in dev (erhöht für Testing), 1000 in prod
export const authLimiter = createTenantRateLimiter(
  15 * 60 * 1000,
  process.env.NODE_ENV === 'test' ? 100000
  : process.env.NODE_ENV === 'development' ? 100
  : 5,
); // 100000 auth attempts in test, 100 in dev, 5 in prod
export const uploadLimiter = createTenantRateLimiter(
  15 * 60 * 1000,
  process.env.NODE_ENV === 'development' ? 100 : 10,
); // 100 uploads per 15 minutes in dev, 10 in prod

// Specific API endpoint rate limiters
export const strictAuthLimiter = createTenantRateLimiter(
  5 * 60 * 1000,
  process.env.NODE_ENV === 'development' ? 50 : 3,
); // 50 login attempts in dev, 3 in prod
export const apiLimiter = createTenantRateLimiter(
  60 * 1000,
  process.env.NODE_ENV === 'development' ? 1000 : 100,
); // 1000 API requests per minute in dev, 100 in prod
export const searchLimiter = createTenantRateLimiter(
  60 * 1000,
  process.env.NODE_ENV === 'development' ? 300 : 30,
); // 300 search requests per minute in dev, 30 in prod
export const bulkOperationLimiter = createTenantRateLimiter(60 * 60 * 1000, 5); // 5 bulk operations per hour
export const reportLimiter = createTenantRateLimiter(60 * 60 * 1000, 20); // 20 reports per hour

// Progressive Rate Limiting - increases delay based on violations
const createProgressiveRateLimiter = (windowMs: number, max: number): RateLimitRequestHandler =>
  rateLimit({
    windowMs,
    max,
    // Remove custom keyGenerator to use default IP handling (IPv4/IPv6 compatible)
    message: {
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil(windowMs / 1000),
      message: 'Too many requests. Please slow down and try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Log rate limit violations using a handler function
    handler: (req, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      console.warn('Rate limit exceeded:', {
        ip: authReq.ip,
        tenant: authReq.tenant?.id,
        path: authReq.path,
        userAgent: authReq.get('User-Agent'),
        timestamp: new Date().toISOString(),
      });

      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(windowMs / 1000),
        message: 'Too many requests. Please slow down and try again later.',
      });
    },
  });

// IP-based strict rate limiting for suspicious activity
export const suspiciousActivityLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour for suspicious IPs
  // Remove custom keyGenerator to use default IP handling (IPv4/IPv6 compatible)
  message: {
    error: 'Suspicious activity detected',
    message: 'Your IP has been temporarily restricted due to unusual activity patterns.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip for authenticated users with valid sessions
    return req.headers.authorization !== undefined || 'user' in req;
  },
});

// Enhanced progressive limiters
export const progressiveApiLimiter = createProgressiveRateLimiter(60 * 1000, 200); // 200 requests per minute
export const progressiveAuthLimiter = createProgressiveRateLimiter(
  15 * 60 * 1000,
  process.env.NODE_ENV === 'development' ? 100 : 10,
); // 100 auth attempts in dev, 10 in prod

// Tenant Context Validation
export const validateTenantContext = (req: Request, res: Response, next: NextFunction): void => {
  if ('user' in req && 'tenant' in req) {
    const authReq = req as AuthenticatedRequest;
    const userTenant = authReq.user.tenant_id;
    const requestTenant = authReq.tenant?.id;

    if (
      userTenant !== 0 &&
      requestTenant !== undefined &&
      requestTenant !== 0 &&
      userTenant !== requestTenant
    ) {
      console.error('Tenant access violation:', {
        user: authReq.user.id,
        userTenant,
        requestTenant,
        ip: authReq.ip,
      });
      res.status(403).json({
        error: 'Access denied: Tenant context mismatch',
      });
      return;
    }
  }
  next();
};

// Security Audit Logger
export const auditLogger =
  (action: string, resource: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    const startTime = Date.now();

    // Capture original end function
    const originalEnd = res.end.bind(res);

    // Override end function - simplified type assertion for complex overload
    const endFunction = function (
      chunk?: string | Buffer | (() => void),
      encoding?: globalThis.BufferEncoding | (() => void),
      cb?: () => void,
    ): Response {
      // Handle different argument patterns
      if (typeof chunk === 'function') {
        // end(cb)
        (originalEnd as (cb: () => void) => Response).call(res, chunk);
      } else if (typeof encoding === 'function') {
        // end(chunk, cb)
        (originalEnd as (chunk: string | Buffer, cb: () => void) => Response).call(
          res,
          chunk ?? '',
          encoding,
        );
      } else if (typeof cb === 'function') {
        // end(chunk, encoding, cb)
        (
          originalEnd as (
            chunk: string | Buffer,
            encoding: globalThis.BufferEncoding,
            cb: () => void,
          ) => Response
        ).call(res, chunk ?? '', encoding ?? 'utf8', cb);
      } else if (encoding !== undefined) {
        // end(chunk, encoding)
        (
          originalEnd as (chunk: string | Buffer, encoding: globalThis.BufferEncoding) => Response
        ).call(res, chunk ?? '', encoding);
      } else if (chunk !== undefined) {
        // end(chunk)
        (originalEnd as (chunk: string | Buffer) => Response).call(res, chunk);
      } else {
        // end()
        (originalEnd as () => Response).call(res);
      }

      // Log audit entry
      const duration = Date.now() - startTime;
      const auditEntry: AuditEntry = {
        timestamp: new Date().toISOString(),
        tenant_id: authReq.tenant?.id ?? 'public',
        userId: 'user' in authReq && authReq.user.id ? authReq.user.id.toString() : 'anonymous',
        action,
        resource,
        method: authReq.method,
        path: authReq.path,
        statusCode: res.statusCode,
        duration,
        ip: authReq.ip ?? 'unknown',
        userAgent: authReq.get('user-agent'),
        success: res.statusCode < 400,
      };

      // Log to console (in production, send to SIEM)
      console.info('AUDIT:', JSON.stringify(auditEntry));

      // TODO: Save to database or send to SIEM system

      return res;
    };

    // Type-safe assignment of overridden function
    res.end = endFunction as Response['end'];

    next();
  };

// Input Sanitization Middleware
export const sanitizeInputs: RequestHandler = hpp(); // Prevent HTTP Parameter Pollution

// Security Headers for API Responses
export const apiSecurityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

// Content-Type Validation
export const validateContentType =
  (expectedType: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (
      req.is(expectedType) !== false ||
      req.get('content-type') == null ||
      req.get('content-type') === ''
    ) {
      next();
    } else {
      res.status(400).json({
        error: `Invalid content type. Expected: ${expectedType}`,
      });
    }
  };

// File Upload Security
export const fileUploadSecurity = (req: Request, res: Response, next: NextFunction): void => {
  // Type assertion to access files property from express-extensions
  const uploadReq = req as Request & {
    files?: Express.Multer.File[] | Record<string, Express.Multer.File[]>;
  };

  if (!uploadReq.files || Object.keys(uploadReq.files).length === 0) {
    next();
    return;
  }

  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  const files = Array.isArray(uploadReq.files) ? uploadReq.files : Object.values(uploadReq.files);

  for (const file of files) {
    if ('mimetype' in file && !allowedMimeTypes.includes(file.mimetype)) {
      res.status(400).json({
        error: `File type not allowed: ${file.mimetype}`,
      });
      return;
    }

    // Additional file size check (10MB max)
    if ('size' in file && file.size > 10 * 1024 * 1024) {
      res.status(400).json({
        error: 'File size exceeds maximum allowed (10MB)',
      });
      return;
    }
  }

  next();
};

// Export everything including cors for backward compatibility
export { cors };
