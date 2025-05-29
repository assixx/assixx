/**
 * Authentication Controller
 * Handles all authentication-related business logic
 */

import { Request, Response } from 'express';
import authService from '../services/auth.service';
import userService from '../services/user.service';
import { logger } from '../utils/logger';

// Extended Request interface from express.d.ts
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    email: string;
    role: string;
    tenantId: number;
  };
}

// Interfaces for request bodies
interface LoginRequest extends Request {
  body: {
    username?: string;
    password?: string;
  };
}

interface RegisterRequest extends Request {
  body: {
    username: string;
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    role?: string;
    tenant_id?: number;
    [key: string]: any; // For additional fields
  };
}

class AuthController {
  /**
   * Check if user is authenticated
   */
  async checkAuth(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // If middleware passes, user is authenticated
      res.json({
        authenticated: true,
        user: {
          id: req.user!.id,
          username: req.user!.username,
          role: req.user!.role,
        },
      });
    } catch (error) {
      logger.error('Error in auth check:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * Get current user profile
   */
  async getUserProfile(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const user = await userService.getUserById(req.user!.id);

      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      res.json(user);
    } catch (error) {
      logger.error('Error in get user profile:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * Login user
   */
  async login(req: LoginRequest, res: Response): Promise<void> {
    console.log('[DEBUG] AuthController.login called');
    try {
      const { username, password } = req.body;
      console.log('[DEBUG] Login attempt for username:', username);

      // Validate input
      if (!username || !password) {
        console.log('[DEBUG] Missing username or password');
        res.status(400).json({
          message: 'Username and password are required',
        });
        return;
      }

      // Authenticate user
      console.log('[DEBUG] Calling authService.authenticateUser');
      const result = await authService.authenticateUser(username, password);
      console.log('[DEBUG] Auth result:', result ? 'Success' : 'Failed');

      if (!result.success) {
        res.status(401).json({
          message: result.message || 'Invalid credentials',
        });
        return;
      }

      // Set token as httpOnly cookie for HTML pages
      res.cookie('token', result.token!, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      // Return user data and token (compatible with legacy frontend)
      res.json({
        message: 'Login erfolgreich',
        token: result.token,
        role: result.user!.role,
        user: result.user,
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ message: 'Server error during login' });
    }
  }

  /**
   * Register new user
   */
  async register(req: RegisterRequest, res: Response): Promise<void> {
    try {
      // Map English field names to German field names expected by service
      const userData = {
        username: req.body.username,
        password: req.body.password,
        email: req.body.email,
        vorname: req.body.first_name || '',
        nachname: req.body.last_name || '',
        role: req.body.role as 'admin' | 'employee' | undefined,
        tenantId: req.body.tenant_id,
      };

      // Register user through service
      const result = await authService.registerUser(userData);

      if (!result.success) {
        res.status(400).json({
          message: result.message || 'Registration failed',
        });
        return;
      }

      res.status(201).json({
        message: 'Registration successful',
        user: result.user,
      });
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({ message: 'Server error during registration' });
    }
  }

  /**
   * Logout user
   */
  async logout(_req: Request, res: Response): Promise<void> {
    // Clear the httpOnly cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    res.json({ message: 'Logout successful' });
  }
}

// Export singleton instance
const authController = new AuthController();
export default authController;

// Named export for the class
export { AuthController };

// CommonJS compatibility
