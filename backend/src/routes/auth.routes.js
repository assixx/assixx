/**
 * Authentication Routes
 * Uses controller pattern for cleaner code
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth');

// Debug logging
console.log('[DEBUG] Auth routes loading...');

// Public routes
router.post('/login', (req, res, next) => {
  console.log('[DEBUG] /api/auth/login endpoint hit');
  return authController.login(req, res, next);
});
router.post('/register', authController.register);
router.get('/logout', authController.logout);
router.post('/logout', authController.logout); // Support both GET and POST

// Protected routes
router.get('/check', authenticateToken, authController.checkAuth);
router.get('/user', authenticateToken, authController.getUserProfile);

module.exports = router;
