// Enhanced Security Middleware für Assixx
import helmet from 'helmet';
import * as cors from 'cors';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
import { Request, Response, NextFunction } from 'express';

// Type definitions
interface AuditEntry {
  timestamp: string;
  tenantId: number | string;
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

// HTTPS Enforcement
export const enforceHTTPS = (req: Request, res: Response, next: NextFunction): void => {
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
        'https://fonts.gstatic.com',
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com',
      ],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
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
const createTenantRateLimiter = (windowMs: number, max: number): RateLimitRequestHandler =>
  rateLimit({
    windowMs,
    max,
    keyGenerator: (req: Request) =>
      // Rate limit per tenant + IP combination
      `${req.tenant?.id || 'public'}_${req.ip}`,
    message: 'Too many requests from this tenant/IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

// API Rate Limiters
export const generalLimiter = createTenantRateLimiter(15 * 60 * 1000, 1000); // 1000 requests per 15 minutes
export const authLimiter = createTenantRateLimiter(15 * 60 * 1000, 5); // 5 auth attempts per 15 minutes
export const uploadLimiter = createTenantRateLimiter(15 * 60 * 1000, 10); // 10 uploads per 15 minutes

// Tenant Context Validation
export const validateTenantContext = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user && req.tenant) {
    const userTenant = req.user.tenantId;
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
export const auditLogger = (action: string, resource: string) => 
  (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    // Capture original end function
    const originalEnd = res.end;

    // Override end function with proper typing
    res.end = function(chunk?: any, encoding?: any): Response {
      // Call original end function
      originalEnd.call(res, chunk, encoding);

      // Log audit entry
      const duration = Date.now() - startTime;
      const auditEntry: AuditEntry = {
        timestamp: new Date().toISOString(),
        tenantId: req.tenant?.id || 'public',
        userId: req.user?.id || 'anonymous',
        action,
        resource,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        success: res.statusCode < 400,
      };

      // Log to console (in production, send to SIEM)
      console.log('AUDIT:', JSON.stringify(auditEntry));

      // TODO: Save to database or send to SIEM system
      
      return res;
    };

    next();
  };

// Input Sanitization Middleware
export const sanitizeInputs = [
  mongoSanitize(), // Prevent NoSQL injection
  xss(), // Clean user input from malicious HTML
  hpp(), // Prevent HTTP Parameter Pollution
];

// Security Headers for API Responses
export const apiSecurityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
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
export const validateContentType = (expectedType: string) => 
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
export const fileUploadSecurity = (req: Request, res: Response, next: NextFunction): void => {
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

// CommonJS compatibility
module.exports = {
  enforceHTTPS,
  securityHeaders,
  corsOptions,
  generalLimiter,
  authLimiter,
  uploadLimiter,
  validateTenantContext,
  auditLogger,
  sanitizeInputs,
  apiSecurityHeaders,
  validateContentType,
  fileUploadSecurity,
  cors,
};