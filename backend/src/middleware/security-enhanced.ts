// Enhanced Security Middleware für Assixx
import helmet from 'helmet';
import * as cors from 'cors';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
// import mongoSanitize from 'express-mongo-sanitize'; // Disabled - not compatible with Express 5.x
// import xss from 'xss-clean'; // Disabled - not compatible with Express 5.x
import hpp from 'hpp';
import { Request, Response, NextFunction, RequestHandler } from 'express';
// import { doubleCsrf } from 'csrf-csrf'; // Package not installed

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

// Type alias for requests with required properties
type ExtendedRequest = Request;

// CSRF Protection Configuration - Simplified implementation
// const csrfSecret = process.env.CSRF_SECRET || 'assixx-csrf-secret-change-in-production';

// Simple CSRF token generation
function generateToken(_req: ExtendedRequest, _res: Response): string {
  // Simple token generation - in production, use a proper CSRF library
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2);
  return `${timestamp}-${random}`;
}

// CSRF protection middleware stub
function doubleCsrfProtection(
  _req: ExtendedRequest,
  _res: Response,
  next: NextFunction
): void {
  // Skip CSRF for now - implement proper CSRF protection in production
  next();
}

// CSRF Token Generation Endpoint
export const generateCSRFTokenMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = generateToken(req as ExtendedRequest, res);
    res.locals.csrfToken = token;
    next();
  } catch (error) {
    console.error('Error generating CSRF token:', error);
    res.status(500).json({ error: 'Could not generate CSRF token' });
  }
};

// CSRF Token Validation Middleware using doubleCsrf protection
export const validateCSRFToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Skip CSRF validation for API endpoints that use Bearer token authentication
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    return next();
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
    return next();
  }

  // Use the CSRF protection middleware
  doubleCsrfProtection(req as ExtendedRequest, res, next);
};

// CSRF Token Response Helper
export const attachCSRFToken = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (res.locals.csrfToken) {
    res.setHeader('X-CSRF-Token', res.locals.csrfToken);
  }
  next();
};

// HTTPS Enforcement
export const enforceHTTPS = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (
    req.header('x-forwarded-proto') !== 'https' &&
    process.env.NODE_ENV === 'production'
  ) {
    res.redirect(`https://${req.header('host')}${req.url}`);
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
    if (!origin) return callback(null, true);

    // Check if origin matches allowed patterns
    const allowedPatterns = [
      /^https:\/\/[a-z0-9-]+\.assixx\.com$/, // Production subdomains
      /^https:\/\/[a-z0-9-]+\.assixx\.de$/, // German domain
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
const createTenantRateLimiter = (
  windowMs: number,
  max: number
): RateLimitRequestHandler =>
  rateLimit({
    windowMs,
    max,
    keyGenerator: (req: ExtendedRequest) =>
      // Rate limit per tenant + IP combination
      `${req.tenant?.id || 'public'}_${req.ip}`,
    message: 'Too many requests from this tenant/IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

// API Rate Limiters - Enhanced with more granular controls
export const generalLimiter = createTenantRateLimiter(
  15 * 60 * 1000,
  process.env.NODE_ENV === 'development' ? 50000 : 1000
); // 50000 requests per 15 minutes in dev (erhöht für Testing), 1000 in prod
export const authLimiter = createTenantRateLimiter(
  15 * 60 * 1000,
  process.env.NODE_ENV === 'development' ? 100 : 5
); // 100 auth attempts in dev, 5 in prod
export const uploadLimiter = createTenantRateLimiter(
  15 * 60 * 1000,
  process.env.NODE_ENV === 'development' ? 100 : 10
); // 100 uploads per 15 minutes in dev, 10 in prod

// Specific API endpoint rate limiters
export const strictAuthLimiter = createTenantRateLimiter(
  5 * 60 * 1000,
  process.env.NODE_ENV === 'development' ? 50 : 3
); // 50 login attempts in dev, 3 in prod
export const apiLimiter = createTenantRateLimiter(
  60 * 1000,
  process.env.NODE_ENV === 'development' ? 1000 : 100
); // 1000 API requests per minute in dev, 100 in prod
export const searchLimiter = createTenantRateLimiter(
  60 * 1000,
  process.env.NODE_ENV === 'development' ? 300 : 30
); // 300 search requests per minute in dev, 30 in prod
export const bulkOperationLimiter = createTenantRateLimiter(60 * 60 * 1000, 5); // 5 bulk operations per hour
export const reportLimiter = createTenantRateLimiter(60 * 60 * 1000, 20); // 20 reports per hour

// Progressive Rate Limiting - increases delay based on violations
const createProgressiveRateLimiter = (
  windowMs: number,
  max: number
): RateLimitRequestHandler =>
  rateLimit({
    windowMs,
    max,
    keyGenerator: (req: ExtendedRequest) =>
      `${req.tenant?.id || 'public'}_${req.ip}`,
    message: {
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil(windowMs / 1000),
      message: 'Too many requests. Please slow down and try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Log rate limit violations using a handler function
    handler: (req: ExtendedRequest, res: Response) => {
      console.warn('Rate limit exceeded:', {
        ip: req.ip,
        tenant: req.tenant?.id,
        path: req.path,
        userAgent: req.get('User-Agent'),
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
  keyGenerator: (req: ExtendedRequest) => req.ip || 'unknown',
  message: {
    error: 'Suspicious activity detected',
    message:
      'Your IP has been temporarily restricted due to unusual activity patterns.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: ExtendedRequest) => {
    // Skip for authenticated users with valid sessions
    return !!(req.headers.authorization || req.user);
  },
});

// Enhanced progressive limiters
export const progressiveApiLimiter = createProgressiveRateLimiter(
  60 * 1000,
  200
); // 200 requests per minute
export const progressiveAuthLimiter = createProgressiveRateLimiter(
  15 * 60 * 1000,
  process.env.NODE_ENV === 'development' ? 100 : 10
); // 100 auth attempts in dev, 10 in prod

// Tenant Context Validation
export const validateTenantContext = (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.user && req.tenant) {
    const userTenant = req.user.tenant_id;
    const requestTenant = req.tenant.id;

    if (userTenant && requestTenant && userTenant !== requestTenant) {
      console.error('Tenant access violation:', {
        user: req.user.id,
        userTenant,
        requestTenant,
        ip: req.ip,
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
  (req: ExtendedRequest, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    // Capture original end function
    const originalEnd = res.end;

    // Override end function - simplified type assertion for complex overload
    const endFunction = function (
      chunk?: string | Buffer | (() => void),
      encoding?: globalThis.BufferEncoding | (() => void),
      cb?: () => void
    ): Response {
      // Handle different argument patterns
      if (typeof chunk === 'function') {
        // end(cb)
        (originalEnd as (cb: () => void) => Response).call(res, chunk);
      } else if (typeof encoding === 'function') {
        // end(chunk, cb)
        (
          originalEnd as (chunk: string | Buffer, cb: () => void) => Response
        ).call(res, chunk as string | Buffer, encoding);
      } else if (typeof cb === 'function') {
        // end(chunk, encoding, cb)
        (
          originalEnd as (
            chunk: string | Buffer,
            encoding: globalThis.BufferEncoding,
            cb: () => void
          ) => Response
        ).call(
          res,
          chunk as string | Buffer,
          encoding as globalThis.BufferEncoding,
          cb
        );
      } else if (encoding !== undefined) {
        // end(chunk, encoding)
        (
          originalEnd as (
            chunk: string | Buffer,
            encoding: globalThis.BufferEncoding
          ) => Response
        ).call(
          res,
          chunk as string | Buffer,
          encoding as globalThis.BufferEncoding
        );
      } else if (chunk !== undefined) {
        // end(chunk)
        (originalEnd as (chunk: string | Buffer) => Response).call(
          res,
          chunk as string | Buffer
        );
      } else {
        // end()
        (originalEnd as () => Response).call(res);
      }

      // Log audit entry
      const duration = Date.now() - startTime;
      const auditEntry: AuditEntry = {
        timestamp: new Date().toISOString(),
        tenant_id: req.tenant?.id || 'public',
        userId: req.user?.id ? req.user.id.toString() : 'anonymous',
        action,
        resource,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        ip: req.ip || 'unknown',
        userAgent: req.get('user-agent'),
        success: res.statusCode < 400,
      };

      // Log to console (in production, send to SIEM)
      console.log('AUDIT:', JSON.stringify(auditEntry));

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
export const apiSecurityHeaders = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, private'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

// Content-Type Validation
export const validateContentType =
  (expectedType: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (req.is(expectedType) || !req.get('content-type')) {
      next();
    } else {
      res.status(400).json({
        error: `Invalid content type. Expected: ${expectedType}`,
      });
    }
  };

// File Upload Security
export const fileUploadSecurity = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return next();
  }

  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  const files = Array.isArray(req.files) ? req.files : Object.values(req.files);

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
