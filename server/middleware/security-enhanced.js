// Enhanced Security Middleware für Assixx
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

// HTTPS Enforcement
const enforceHTTPS = (req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https' && process.env.NODE_ENV === 'production') {
        return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    next();
};

// Enhanced Security Headers
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
            scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
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
        preload: true
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'same-origin' },
    ieNoOpen: true,
    frameguard: { action: 'deny' }
});

// CORS with Subdomain Whitelist
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Check if origin matches allowed patterns
        const allowedPatterns = [
            /^https:\/\/[a-z0-9-]+\.assixx\.com$/,  // Production subdomains
            /^https:\/\/[a-z0-9-]+\.assixx\.de$/,   // German domain
            /^http:\/\/localhost:\d+$/,              // Local development
            /^http:\/\/127\.0\.0\.1:\d+$/            // Local development
        ];
        
        const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
        
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
    maxAge: 86400 // 24 hours
};

// Enhanced Rate Limiting per Tenant
const createTenantRateLimiter = (windowMs, max) => {
    return rateLimit({
        windowMs,
        max,
        keyGenerator: (req) => {
            // Rate limit per tenant + IP combination
            return `${req.tenant?.id || 'public'}_${req.ip}`;
        },
        message: 'Too many requests from this tenant/IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
    });
};

// API Rate Limiters
const generalLimiter = createTenantRateLimiter(15 * 60 * 1000, 100); // 100 requests per 15 minutes
const authLimiter = createTenantRateLimiter(15 * 60 * 1000, 5);      // 5 auth attempts per 15 minutes
const uploadLimiter = createTenantRateLimiter(15 * 60 * 1000, 10);   // 10 uploads per 15 minutes

// Tenant Context Validation
const validateTenantContext = (req, res, next) => {
    if (req.user && req.tenant) {
        const userTenant = req.user.tenantId;
        const requestTenant = req.tenant.id;
        
        if (userTenant && requestTenant && userTenant !== requestTenant) {
            console.error('Tenant access violation:', {
                user: req.user.userId,
                userTenant,
                requestTenant,
                ip: req.ip
            });
            return res.status(403).json({ 
                error: 'Access denied: Tenant context mismatch' 
            });
        }
    }
    next();
};

// Security Audit Logger
const auditLogger = (action, resource) => {
    return async (req, res, next) => {
        const startTime = Date.now();
        
        // Capture original end function
        const originalEnd = res.end;
        
        res.end = function(...args) {
            // Call original end function
            originalEnd.apply(res, args);
            
            // Log audit entry
            const duration = Date.now() - startTime;
            const auditEntry = {
                timestamp: new Date().toISOString(),
                tenantId: req.tenant?.id || 'public',
                userId: req.user?.userId || 'anonymous',
                action,
                resource,
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                duration,
                ip: req.ip,
                userAgent: req.get('user-agent'),
                success: res.statusCode < 400
            };
            
            // Log to console (in production, send to SIEM)
            console.log('AUDIT:', JSON.stringify(auditEntry));
            
            // TODO: Save to database or send to SIEM system
        };
        
        next();
    };
};

// Input Sanitization Middleware
const sanitizeInputs = [
    mongoSanitize(), // Prevent NoSQL injection
    xss(),          // Clean user input from malicious HTML
    hpp()           // Prevent HTTP Parameter Pollution
];

// Security Headers for API Responses
const apiSecurityHeaders = (req, res, next) => {
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
const validateContentType = (expectedType) => {
    return (req, res, next) => {
        if (req.is(expectedType) || !req.get('content-type')) {
            next();
        } else {
            res.status(400).json({ 
                error: `Invalid content type. Expected: ${expectedType}` 
            });
        }
    };
};

// File Upload Security
const fileUploadSecurity = (req, res, next) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return next();
    }
    
    const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    for (const file of Object.values(req.files)) {
        if (!allowedMimeTypes.includes(file.mimetype)) {
            return res.status(400).json({ 
                error: `File type not allowed: ${file.mimetype}` 
            });
        }
        
        // Additional file size check (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            return res.status(400).json({ 
                error: 'File size exceeds maximum allowed (10MB)' 
            });
        }
    }
    
    next();
};

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
    cors
};