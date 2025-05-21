/**
 * User Profile API Routes
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/user');

/**
 * @route GET /api/user/profile
 * @desc Get user profile
 * @access Private
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get department information if available
    let departmentInfo = null;
    if (user.department_id) {
      const [departments] = await req.tenantDb.query(
        'SELECT * FROM departments WHERE id = ?',
        [user.department_id]
      );
      
      if (departments && departments.length > 0) {
        departmentInfo = departments[0];
      }
    }
    
    // Get team information if available
    let teamInfo = null;
    if (user.team_id) {
      const [teams] = await req.tenantDb.query(
        'SELECT * FROM teams WHERE id = ?',
        [user.team_id]
      );
      
      if (teams && teams.length > 0) {
        teamInfo = teams[0];
      }
    }
    
    // Remove sensitive information
    delete user.password;
    
    res.json({
      ...user,
      department: departmentInfo ? departmentInfo.name : null,
      departmentId: user.department_id,
      team: teamInfo ? teamInfo.name : null,
      teamId: user.team_id
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route PUT /api/user/profile
 * @desc Update user profile
 * @access Private
 */
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { id } = req.user;
    const updates = req.body;
    
    // Don't allow updating critical fields
    delete updates.id;
    delete updates.username;
    delete updates.role;
    delete updates.password;
    delete updates.created_at;
    
    const result = await User.update(id, updates);
    
    if (result) {
      const updatedUser = await User.findById(id);
      delete updatedUser.password;
      
      res.json({
        message: 'Profile updated successfully',
        user: updatedUser
      });
    } else {
      res.status(400).json({ message: 'Failed to update profile' });
    }
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;