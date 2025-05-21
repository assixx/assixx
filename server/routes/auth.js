/**
 * Authentication API Routes
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/user');

/**
 * @route GET /api/auth/check
 * @desc Check if user is authenticated
 * @access Public
 */
router.get('/check', authenticateToken, async (req, res) => {
  try {
    // If middleware passes, user is authenticated
    res.json({
      authenticated: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role
      }
    });
  } catch (error) {
    console.error('Error in auth check:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/auth/user
 * @desc Get current user profile
 * @access Private
 */
router.get('/user', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Remove sensitive data
    delete user.password;
    
    res.json(user);
  } catch (error) {
    console.error('Error in get user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/auth/logout
 * @desc Logout user (client-side only)
 * @access Public
 */
router.get('/logout', (req, res) => {
  res.json({ message: 'Logout successful' });
});

module.exports = router;