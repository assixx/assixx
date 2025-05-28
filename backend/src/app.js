/**
 * Express Application Setup
 * Separated from server.js for better testing
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Security middleware
const {
  securityHeaders,
  corsOptions,
  generalLimiter,
  authLimiter,
  uploadLimiter,
  apiSecurityHeaders,
} = require('./middleware/security-enhanced');

// Routes
const routes = require('./routes');

// Create Express app
const app = express();

// Basic middleware
app.use(morgan('combined'));
app.use(cors(corsOptions));
app.use(securityHeaders);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files - serve from frontend directory
const staticPath = path.join(__dirname, '../../frontend/src');

// Serve frontend files with correct MIME types
app.use(
  express.static(staticPath, {
    setHeaders: (res, filePath) => {
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

// Uploads directory (always served)
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// API security headers
app.use('/api', apiSecurityHeaders);

// Rate limiting with exemptions
app.use('/api', (req, res, next) => {
  // Exempt /api/auth/user from general rate limiting
  if (req.path === '/auth/user' || req.path === '/auth/check') {
    return next();
  }
  generalLimiter(req, res, next);
});

// Auth endpoints have stricter limits, but exempt /api/auth/user
app.use('/api/auth', (req, res, next) => {
  // Exempt /api/auth/user and /api/auth/check from auth rate limiting
  if (req.path === '/user' || req.path === '/check') {
    return next();
  }
  authLimiter(req, res, next);
});

app.use('/api/login', authLimiter);
app.use('/api/upload', uploadLimiter);

// Clean URLs middleware - Redirect .html to clean paths
app.use((req, res, next) => {
  if (req.path.endsWith('.html')) {
    const cleanPath = req.path.slice(0, -5);
    return res.redirect(
      301,
      cleanPath +
        (req.originalUrl.includes('?')
          ? req.originalUrl.substring(req.originalUrl.indexOf('?'))
          : '')
    );
  }
  next();
});

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(
    `[DEBUG] ${req.method} ${req.originalUrl} - Body:`,
    req.body ? Object.keys(req.body) : 'No body'
  );
  next();
});

// Import auth controller directly for legacy endpoint
const authController = require('./controllers/auth.controller');

// Legacy login endpoints (for backward compatibility) - MUST BE BEFORE OTHER ROUTES
app.get('/login', (req, res) => {
  console.log('[DEBUG] GET /login - serving login page');
  res.sendFile(path.join(__dirname, '../../frontend/src/pages', 'login.html'));
});

app.post('/login', async (req, res, next) => {
  console.log('[DEBUG] POST /login endpoint hit');
  console.log('[DEBUG] Original URL:', req.originalUrl);
  console.log('[DEBUG] Request body:', req.body);

  try {
    // Call auth controller directly
    await authController.login(req, res, next);
  } catch (error) {
    console.error('[DEBUG] Error in /login endpoint:', error);
    res
      .status(500)
      .json({ message: 'Internal server error', error: error.message });
  }
});

// Legacy routes for backward compatibility - MUST BE BEFORE main routes
const legacyRoutes = require('./routes/legacy.routes');
console.log('[DEBUG] Mounting legacy routes');
app.use(legacyRoutes);

// API Routes - Use centralized routing
console.log('[DEBUG] Mounting main routes at /');
app.use(routes);

// HTML Routes - Serve pages
const { authenticateToken, authorizeRole } = require('./middleware/auth');
const htmlRoutes = require('./routes/html.routes');
app.use(htmlRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`[DEBUG] 404 hit: ${req.method} ${req.originalUrl}`);
  console.log(
    '[DEBUG] Available routes:',
    app._router.stack
      .filter((r) => r.route)
      .map((r) => `${Object.keys(r.route.methods).join(',')} ${r.route.path}`)
  );
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
  });
});

module.exports = app;
