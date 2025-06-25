/**
 * Authentication Routes
 * Uses controller pattern for cleaner code
 */

import express, { Router } from 'express';
import authController from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth';
import {
  generateCSRFTokenMiddleware,
  attachCSRFToken,
  strictAuthLimiter,
} from '../middleware/security-enhanced';
import { validateSignup } from '../middleware/validators';

const router: Router = express.Router();

// Debug logging
console.log('[DEBUG] Auth routes loading...');

// Public routes with enhanced rate limiting and validation
// TEMPORARILY DISABLE MIDDLEWARE FOR DEBUGGING
router.post('/login', (req, res) => {
  console.log('[DEBUG] /api/auth/login endpoint hit - NO MIDDLEWARE');
  return authController.login(req, res);
});
router.post(
  '/register',
  strictAuthLimiter,
  ...validateSignup,
  authController.register
);
router.get('/logout', authenticateToken as any, authController.logout as any);
router.post('/logout', authenticateToken as any, authController.logout as any); // Support both GET and POST

// CSRF Token endpoint
router.get(
  '/csrf-token',
  generateCSRFTokenMiddleware,
  attachCSRFToken,
  (_req, res) => {
    res.json({
      csrfToken: res.locals.csrfToken,
      message: 'CSRF token generated successfully',
    });
  }
);

// Protected routes
router.get('/check', authenticateToken, (req, res) =>
  authController.checkAuth(req as any, res)
);
router.get('/user', authenticateToken, (req, res) =>
  authController.getUserProfile(req as any, res)
);

// Session validation endpoints
router.get('/validate', authenticateToken, (req, res) =>
  authController.validateToken(req as any, res)
);
router.post('/validate-fingerprint', authenticateToken, (req, res) =>
  authController.validateFingerprint(req as any, res)
);

export default router;

// CommonJS compatibility
