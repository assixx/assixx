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
import { validateLogin, validateSignup } from '../middleware/validators';

const router: Router = express.Router();

// Debug logging
console.log('[DEBUG] Auth routes loading...');

// Public routes with enhanced rate limiting and validation
router.post('/login', strictAuthLimiter, ...validateLogin, (req, res) => {
  console.log('[DEBUG] /api/auth/login endpoint hit');
  return authController.login(req, res);
});
router.post(
  '/register',
  strictAuthLimiter,
  ...validateSignup,
  authController.register
);
router.get('/logout', authController.logout);
router.post('/logout', authController.logout); // Support both GET and POST

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
router.get('/check', authenticateToken, authController.checkAuth);
router.get('/user', authenticateToken, authController.getUserProfile);

export default router;

// CommonJS compatibility
