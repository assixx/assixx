/**
 * Authentication API Routes
 */

import express, { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

// Import models (now ES modules)
import User from '../models/user';

const router: Router = express.Router();

// Extended Request interfaces
interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
    tenant_id: number;
  };
}

/**
 * @route GET /api/auth/validate
 * @desc Validate current token
 * @access Private
 */
router.get('/validate', authenticateToken, async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    // Token is valid if we reach this point (authenticateToken middleware passed)
    res.json({
      success: true,
      valid: true,
      user: {
        id: authReq.user.id,
        username: authReq.user.username,
        role: authReq.user.role,
        tenant_id: authReq.user.tenant_id,
      },
    });
  } catch (error: any) {
    logger.error('Token validation error:', error);
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Fehler bei der Token-Validierung',
    });
  }
});

/**
 * @route GET /api/auth/user
 * @desc Get current user profile
 * @access Private
 */
router.get('/user', authenticateToken, async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await User.findById(authReq.user.id, authReq.user.tenant_id);

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Remove sensitive data
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;

    res.json(userWithoutPassword);
  } catch (error: any) {
    console.error('Error in get user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/auth/logout
 * @desc Logout user (client-side only)
 * @access Public
 */
router.get('/logout', (_req: Request, res: Response): void => {
  res.json({ message: 'Logout successful' });
});

export default router;

// CommonJS compatibility
