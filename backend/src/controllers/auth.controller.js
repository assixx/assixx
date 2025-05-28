/**
 * Authentication Controller
 * Handles all authentication-related business logic
 */

const authService = require('../services/auth.service');
const userService = require('../services/user.service');
const { logger } = require('../utils/logger');

class AuthController {
  /**
   * Check if user is authenticated
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async checkAuth(req, res) {
    try {
      // If middleware passes, user is authenticated
      res.json({
        authenticated: true,
        user: {
          id: req.user.id,
          username: req.user.username,
          role: req.user.role,
        },
      });
    } catch (error) {
      logger.error('Error in auth check:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * Get current user profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getUserProfile(req, res) {
    try {
      const user = await userService.getUserById(req.user.id);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      logger.error('Error in get user profile:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * Login user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async login(req, res) {
    console.log('[DEBUG] AuthController.login called');
    try {
      const { username, password } = req.body;
      console.log('[DEBUG] Login attempt for username:', username);
      
      // Validate input
      if (!username || !password) {
        console.log('[DEBUG] Missing username or password');
        return res.status(400).json({ 
          message: 'Username and password are required' 
        });
      }

      // Authenticate user
      console.log('[DEBUG] Calling authService.authenticateUser');
      const result = await authService.authenticateUser(username, password);
      console.log('[DEBUG] Auth result:', result ? 'Success' : 'Failed');
      
      if (!result.success) {
        return res.status(401).json({ 
          message: result.message || 'Invalid credentials' 
        });
      }

      // Set token as httpOnly cookie for HTML pages
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      // Return user data and token (compatible with legacy frontend)
      res.json({
        message: 'Login erfolgreich',
        token: result.token,
        role: result.user.role,
        user: result.user
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ message: 'Server error during login' });
    }
  }

  /**
   * Register new user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async register(req, res) {
    try {
      const userData = req.body;
      
      // Register user through service
      const result = await authService.registerUser(userData);
      
      if (!result.success) {
        return res.status(400).json({ 
          message: result.message || 'Registration failed' 
        });
      }

      res.status(201).json({
        message: 'Registration successful',
        user: result.user
      });
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({ message: 'Server error during registration' });
    }
  }

  /**
   * Logout user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async logout(req, res) {
    // Clear the httpOnly cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    res.json({ message: 'Logout successful' });
  }
}

module.exports = new AuthController();