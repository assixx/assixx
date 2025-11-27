/**
 * Enhanced Security Middleware für Assixx
 *
 * RATE LIMITING PHILOSOPHY:
 * ========================
 * Dev = Prod limits for realistic testing!
 *
 * WHY?
 * - Find rate limit issues during development, not in production
 * - No surprises when deploying
 * - Test what you deploy, deploy what you test
 *
 * EMERGENCY OVERRIDE:
 * If you absolutely need higher limits in dev (e.g., load testing):
 * 1. Find the constant (e.g., API_LIMIT_DEV)
 * 2. Change ONLY the _DEV constant
 * 3. Add a comment explaining WHY
 * 4. Revert it before committing!
 *
 * CURRENT LIMITS (Dev = Prod):
 * - authLimiter: 5 attempts per 15 minutes (login/register)
 * - apiLimiter: 20000 requests per 20 seconds (dashboard/data)
 * - uploadLimiter: 100 uploads per 15 minutes
 * - searchLimiter: 500 searches per 20 seconds
 * - generalLimiter: 20000 requests per 20 seconds (all routes)
 *
 * TEST MODE:
 * - All limiters are disabled (100000 requests)
 * - Ensures automated tests run without rate limit issues
 */
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
// const csrfSecret = process.env['CSRF_SECRET']  ?? 'assixx-csrf-secret-change-in-production';

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
    // Bracket notation for index signature access
    res.locals['csrfToken'] = token;
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

  if (publicEndpoints.some((endpoint: string) => req.path.startsWith(endpoint))) {
    next();
    return;
  }

  // Use the CSRF protection middleware
  doubleCsrfProtection(req as AuthenticatedRequest, res, next);
};

// CSRF Token Response Helper
export const attachCSRFToken = (_req: Request, res: Response, next: NextFunction): void => {
  // Bracket notation for index signature access
  const csrfToken = res.locals['csrfToken'] as string | undefined;
  if (csrfToken !== undefined) {
    res.setHeader('X-CSRF-Token', csrfToken);
  }
  next();
};

// HTTPS Enforcement
export const enforceHTTPS = (req: Request, res: Response, next: NextFunction): void => {
  if (req.header('x-forwarded-proto') !== 'https' && process.env['NODE_ENV'] === 'production') {
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
  // Safe: Express CORS library requires callback pattern, not async/await
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (origin == null || origin === '') {
      // Safe: Express CORS library requires callback pattern, not async/await
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

    const isAllowed = allowedPatterns.some((pattern: RegExp) => pattern.test(origin));

    if (isAllowed) {
      // Safe: Express CORS library requires callback pattern, not async/await
      callback(null, true);
    } else {
      // Safe: Express CORS library requires callback pattern, not async/await
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['X-CSRF-Token'],
  maxAge: 86400, // 24 hours
};

// Rate limit page CSS styles
const rateLimitStyles = `
  :root {
    --primary-color: #2196f3;
    --primary-dark: #1976d2;
    --text-primary: #ffffff;
    --text-secondary: rgba(255, 255, 255, 0.7);
    --spacing-4: 16px;
    --spacing-6: 24px;
    --spacing-8: 32px;
    --radius-3xl: 12px;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
    padding: var(--spacing-8);
    border-radius: var(--radius-3xl);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    border: 1px solid hsla(0, 0%, 100%, 0.1);
    text-align: center;
    animation: fadeInUp 0.6s ease-out;
  }

  @keyframes fade-in-up {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .icon {
    font-size: 64px;
    margin-bottom: var(--spacing-6);
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
    margin-bottom: var(--spacing-4);
  }

  .message {
    color: var(--text-secondary);
    font-size: 16px;
    line-height: 1.6;
    margin-bottom: var(--spacing-8);
  }

  .retry-info {
    background: rgba(33, 150, 243, 0.1);
    border: 1px solid rgba(33, 150, 243, 0.2);
    border-radius: var(--radius-3xl);
    padding: var(--spacing-6);
    margin-bottom: var(--spacing-8);
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
`;

// Rate limit HTML response template

function getRateLimitHTML(retryAfterMinutes: number, isAuthLimit: boolean = false): string {
  // Convert to user-friendly display
  const displayMinutes = Math.max(1, Math.ceil(retryAfterMinutes));

  const title = isAuthLimit ? 'Zu viele Login-Versuche' : 'Zu viele Anfragen';
  const message =
    isAuthLimit ?
      'Sie haben die maximale Anzahl an Login-Versuchen überschritten. Aus Sicherheitsgründen wurde Ihr Zugang temporär gesperrt.'
    : 'Sie haben die maximale Anzahl an Anfragen überschritten. Bitte warten Sie einen Moment, bevor Sie es erneut versuchen.';

  return `
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Zu viele Anfragen - Assixx</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>${rateLimitStyles}</style>
    </head>
    <body>
      <div class="rate-limit-card">
        <div class="icon">⌛</div>
        <h1>${title}</h1>
        <p class="message">
          ${message}
        </p>
        <div class="retry-info">
          <div class="retry-label">Versuchen Sie es wieder in:</div>
          <div class="retry-time">${displayMinutes} ${displayMinutes === 1 ? 'Minute' : 'Minuten'}</div>
        </div>
        <a href="/" class="btn-primary">Zurück zur Startseite</a>
      </div>
    </body>
    </html>
  `;
}

// Enhanced Rate Limiting per Tenant
const createTenantRateLimiter = (windowMs: number, max: number): RateLimitRequestHandler =>
  rateLimit({
    windowMs,
    max,
    // Remove custom keyGenerator to use default IP handling (IPv4/IPv6 compatible)
    // Rate limiting will be based on IP address only
    handler: (_req: Request, res: Response) => {
      const retryAfter = Math.ceil(windowMs / 1000 / 60); // in minutes
      res.status(429).send(getRateLimitHTML(retryAfter));
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env['NODE_ENV'] === 'test', // Skip rate limiting in tests
  });

// API Rate Limiters - Enhanced with more granular controls
// PHILOSOPHY: Dev = Prod limits for realistic testing
// Only Test mode has unlimited requests for automated tests
// EMERGENCY: If you need to increase dev limits temporarily, change the constant below
const GENERAL_LIMIT_PROD = 20000; // Production limit: 20000 requests per 20 seconds
const GENERAL_LIMIT_DEV = GENERAL_LIMIT_PROD; // Dev = Prod (change only if absolutely necessary!)

export const generalLimiter = createTenantRateLimiter(
  20 * 1000, // 20 seconds window
  process.env['NODE_ENV'] === 'test' ? 100000 : GENERAL_LIMIT_DEV,
); // Test: unlimited, Dev/Prod: 20000 per 20 sec
// Special auth limiter with custom handler for login attempts
// IMPORTANT: Always 5 attempts in Dev and Prod (Brute-Force protection must be realistic!)
const AUTH_LIMIT_PROD = 5; // Production: 5 login attempts per 15 minutes
const AUTH_LIMIT_DEV = AUTH_LIMIT_PROD; // Dev = Prod (DO NOT change unless testing specific auth flow!)

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window (industry standard)
  max: process.env['NODE_ENV'] === 'test' ? 100000 : AUTH_LIMIT_DEV, // Test: unlimited, Dev/Prod: 5 per 15 min
  handler: (req: Request, res: Response) => {
    const retryAfterMinutes = 15; // Always 15 minutes for auth

    // Check if this is an API request (expects JSON)
    const contentType = req.headers['content-type'];
    const acceptHeader = req.headers.accept;
    const isJsonRequest =
      (typeof contentType === 'string' && contentType.includes('application/json')) ||
      (typeof acceptHeader === 'string' && acceptHeader.includes('application/json'));
    if (req.path.startsWith('/api/') || isJsonRequest) {
      // Return JSON for API/AJAX requests
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message:
            'Too many login attempts. Your account has been temporarily locked for security.',
          retryAfter: retryAfterMinutes * 60, // in seconds
          retryAfterMinutes: retryAfterMinutes, // in minutes for display
        },
        meta: {
          timestamp: new Date().toISOString(),
          remaining: 0,
          limit: 5,
        },
      });
    } else {
      // Return HTML for browser navigation
      res.status(429).send(getRateLimitHTML(retryAfterMinutes, true));
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env['NODE_ENV'] === 'test',
  skipSuccessfulRequests: false, // Count ALL attempts for security
}); // Prevents brute force while allowing typos

// Upload limiter
const UPLOAD_LIMIT_PROD = 100; // Production: 100 uploads per 15 minutes
const UPLOAD_LIMIT_DEV = UPLOAD_LIMIT_PROD; // Dev = Prod
export const uploadLimiter = createTenantRateLimiter(
  15 * 60 * 1000,
  process.env['NODE_ENV'] === 'test' ? 100000 : UPLOAD_LIMIT_DEV,
);

// Strict auth limiter (for additional auth endpoints)
const STRICT_AUTH_LIMIT_PROD = 20; // Production: 20 per 5 minutes
const STRICT_AUTH_LIMIT_DEV = STRICT_AUTH_LIMIT_PROD; // Dev = Prod
export const strictAuthLimiter = createTenantRateLimiter(
  5 * 60 * 1000,
  process.env['NODE_ENV'] === 'test' ? 100000 : STRICT_AUTH_LIMIT_DEV,
);

// API limiter (for normal dashboard/data requests)
const API_LIMIT_PROD = 500; // hier ändern!! und die 60 da unten (shiftfavbuttonbeispiel)Production: 20000 requests per 20 seconds
const API_LIMIT_DEV = API_LIMIT_PROD; // Dev = Prod (increase only for load testing!)
export const apiLimiter = createTenantRateLimiter(
  60 * 1000,
  process.env['NODE_ENV'] === 'test' ? 100000 : API_LIMIT_DEV,
);

// Search limiter
const SEARCH_LIMIT_PROD = 500; // Production: 500 searches per 20 seconds
const SEARCH_LIMIT_DEV = SEARCH_LIMIT_PROD; // Dev = Prod
export const searchLimiter = createTenantRateLimiter(
  20 * 1000,
  process.env['NODE_ENV'] === 'test' ? 100000 : SEARCH_LIMIT_DEV,
);
export const bulkOperationLimiter = createTenantRateLimiter(60 * 60 * 1000, 50); // 50 bulk operations per hour
export const reportLimiter = createTenantRateLimiter(60 * 60 * 1000, 100); // 100 reports per hour

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
    handler: (req: Request, res: Response) => {
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
  max: 100, // 100 requests per hour for suspicious IPs
  // Remove custom keyGenerator to use default IP handling (IPv4/IPv6 compatible)
  message: {
    error: 'Suspicious activity detected',
    message: 'Your IP has been temporarily restricted due to unusual activity patterns.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Skip for authenticated users with valid sessions
    return req.headers.authorization !== undefined || 'user' in req;
  },
});

// Enhanced progressive limiters
export const progressiveApiLimiter = createProgressiveRateLimiter(20 * 1000, 1000); // 1000 requests per 20 seconds
export const progressiveAuthLimiter = createProgressiveRateLimiter(
  15 * 60 * 1000,
  process.env['NODE_ENV'] === 'development' ? 200 : 50,
); // 200 auth attempts in dev, 50 in prod

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
      // Safe: Node.js response.end() requires callback pattern
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
        userId:
          'user' in authReq && typeof authReq.user.id === 'number' && authReq.user.id !== 0 ?
            authReq.user.id.toString()
          : 'anonymous',
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
