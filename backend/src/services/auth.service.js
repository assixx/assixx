/**
 * Authentication Service
 * Handles authentication business logic
 */

const User = require('../models/user');
const { authenticateUser: authUser, generateToken } = require('../auth');
const { logger } = require('../utils/logger');

class AuthService {
  /**
   * Authenticate user with username and password
   * @param {string} username - Username
   * @param {string} password - Plain text password
   * @returns {Object} Result with success status, token, and user data
   */
  async authenticateUser(username, password) {
    try {
      // Use existing auth function
      const user = await authUser(username, password);
      
      if (!user) {
        return {
          success: false,
          message: 'Invalid username or password'
        };
      }

      // Generate JWT token - pass the whole user object
      const token = generateToken(user);
      
      // Remove sensitive data
      delete user.password;
      
      return {
        success: true,
        token,
        user
      };
    } catch (error) {
      logger.error('Authentication error:', error);
      throw error;
    }
  }

  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Object} Result with success status and user data
   */
  async registerUser(userData) {
    try {
      const { username, password, email, vorname, nachname, role = 'employee' } = userData;
      
      // Check if user already exists
      const existingUser = await User.findByUsername(username);
      if (existingUser) {
        return {
          success: false,
          message: 'Username already exists'
        };
      }

      // Check if email already exists
      const existingEmail = await User.findByEmail(email);
      if (existingEmail) {
        return {
          success: false,
          message: 'Email already exists'
        };
      }

      // Hash password
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user
      const userId = await User.create({
        username,
        password: hashedPassword,
        email,
        vorname,
        nachname,
        role
      });

      // Get created user (without password)
      const user = await User.findById(userId);
      delete user.password;
      
      return {
        success: true,
        user
      };
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Object} Decoded token data
   */
  async verifyToken(token) {
    try {
      const jwt = require('jsonwebtoken');
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      logger.error('Token verification error:', error);
      throw error;
    }
  }
}

module.exports = new AuthService();