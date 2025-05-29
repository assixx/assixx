/**
 * Authentication API Routes
 */

import express, { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';

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
 * @route GET /api/auth/user
 * @desc Get current user profile
 * @access Private
 */
router.get('/user', authenticateToken, async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await User.findById(authReq.user.id);

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Remove sensitive data
    delete user.password;

    res.json(user);
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
