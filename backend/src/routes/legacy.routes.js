/**
 * Legacy Routes
 * Handles old API endpoints for backward compatibility
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Auth check endpoint (legacy location)
router.get('/api/auth/check', authenticateToken, (req, res) => {
  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      role: req.user.role,
      email: req.user.email,
    },
  });
});

// User profile endpoint
router.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const User = require('../models/user');
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    delete user.password;
    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Test DB endpoints (for admin dashboard)
router.get('/test/db/employees', authenticateToken, async (req, res) => {
  try {
    const User = require('../models/user');
    const employees = await User.findAll({ role: 'employee' });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/test/db/counts', authenticateToken, async (req, res) => {
  try {
    const User = require('../models/user');
    const Document = require('../models/document');

    const employees = await User.count({ role: 'employee' });
    const documents = await Document.count();

    res.json({
      employees: employees || 0,
      documents: documents || 0,
      departments: 0,
      teams: 0,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/test/db/documents', authenticateToken, async (req, res) => {
  try {
    const Document = require('../models/document');
    const documents = await Document.findAll();
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/test/db/departments', authenticateToken, async (req, res) => {
  try {
    const Department = require('../models/department');
    const departments = await Department.findAll();
    res.json(departments || []);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Teams endpoint
router.get('/teams', authenticateToken, async (req, res) => {
  try {
    const Team = require('../models/team');
    const teams = await Team.findAll();
    res.json(teams || []);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin employees endpoint
router.get('/admin/employees', authenticateToken, async (req, res) => {
  try {
    const User = require('../models/user');
    const employees = await User.findAll();
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Root admins endpoint - legacy location
router.get('/root/admins', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'root') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const User = require('../models/user');
    const admins = await User.findAll({ role: 'admin' });
    res.json(admins || []);
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Root dashboard data endpoint
router.get('/api/root-dashboard-data', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'root') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        iat: req.user.iat,
        exp: req.user.exp,
      },
    });
  } catch (error) {
    console.error('Error fetching root dashboard data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Root create admin endpoint
router.post('/root/create-admin', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'root') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const User = require('../models/user');
    const { username, password, email, company } = req.body;

    // Create admin user
    const newAdmin = await User.create({
      username,
      password,
      email,
      company,
      role: 'admin',
      tenant_id: req.user.tenant_id,
    });

    res.json({
      message: 'Admin created successfully',
      admin: {
        id: newAdmin.id,
        username: newAdmin.username,
        email: newAdmin.email,
        company: newAdmin.company,
      },
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Root delete admin endpoint
router.delete('/root/delete-admin/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'root') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const User = require('../models/user');
    const adminId = req.params.id;

    await User.delete(adminId);

    res.json({ message: 'Admin deleted successfully' });
  } catch (error) {
    console.error('Error deleting admin:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Documents endpoint
router.get('/documents', authenticateToken, async (req, res) => {
  try {
    const Document = require('../models/document');
    const documents = await Document.findByUser(req.user.id);
    res.json(documents || []);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
