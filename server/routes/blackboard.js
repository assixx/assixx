/**
 * Blackboard API Routes
 * Handles all operations related to the blackboard system
 */

const express = require('express');
const router = express.Router();
const blackboardModel = require('../models/blackboard');
const { authenticateToken } = require('../middleware/auth');
// Temporarily disable tenant middleware due to database issues
// const tenantMiddleware = require('../middleware/tenant');
const { checkFeature } = require('../middleware/features');

// Set default tenant ID for testing
const DEFAULT_TENANT_ID = 1;

// Helper function to check if user can manage the entry
async function canManageEntry(req, res, next) {
  try {
    const entryId = req.params.id;
    // Use default tenant ID temporarily
    req.tenantId = DEFAULT_TENANT_ID;
    
    const entry = await blackboardModel.getEntryById(entryId, req.tenantId, req.user.id);
    
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    
    // Check if user is admin or the author of the entry
    const isAdmin = req.user.role === 'admin' || req.user.role === 'root';
    const isAuthor = entry.author_id === req.user.id;
    
    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ message: 'You do not have permission to manage this entry' });
    }
    
    req.entry = entry;
    next();
  } catch (error) {
    console.error('Error in canManageEntry middleware:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Helper function to check if user can create entry for specified org level
async function canCreateForOrgLevel(req, res, next) {
  try {
    const { org_level, org_id } = req.body;
    const { role, departmentId, teamId } = req.user;
    
    // Admins can create entries for any org level
    if (role === 'admin' || role === 'root') {
      return next();
    }
    
    // Check permissions based on org level
    if (org_level === 'company') {
      return res.status(403).json({ message: 'Only admins can create company-wide entries' });
    }
    
    if (org_level === 'department') {
      // Check if user is department head
      if (role !== 'department_head' || departmentId !== org_id) {
        return res.status(403).json({ 
          message: 'You can only create department entries for your own department' 
        });
      }
    }
    
    if (org_level === 'team') {
      // Check if user is team leader
      if (role !== 'team_leader' || teamId !== org_id) {
        return res.status(403).json({ 
          message: 'You can only create team entries for your own team' 
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('Error in canCreateForOrgLevel middleware:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * @route GET /api/blackboard
 * @desc Get all blackboard entries visible to the user
 */
router.get('/api/blackboard', 
  authenticateToken, 
  // tenantMiddleware, // Temporarily disabled
  // checkFeature('blackboard_system'), // Temporarily disabled
  async (req, res) => {
    try {
      // Use default tenant ID for testing
      req.tenantId = DEFAULT_TENANT_ID;
      
      const options = {
        status: req.query.status || 'active',
        filter: req.query.filter || 'all',
        search: req.query.search || '',
        page: parseInt(req.query.page || '1', 10),
        limit: parseInt(req.query.limit || '10', 10),
        sortBy: req.query.sortBy || 'created_at',
        sortDir: req.query.sortDir || 'DESC'
      };
      
      const result = await blackboardModel.getAllEntries(req.tenantId, req.user.id, options);
      res.json(result);
    } catch (error) {
      console.error('Error in GET /api/blackboard:', error);
      res.status(500).json({ message: 'Error retrieving blackboard entries' });
    }
  });

/**
 * @route GET /api/blackboard/dashboard
 * @desc Get blackboard entries for dashboard widget
 */
router.get('/api/blackboard/dashboard', 
  authenticateToken, 
  // tenantMiddleware, // Temporarily disabled
  // checkFeature('blackboard_system'), // Temporarily disabled
  async (req, res) => {
    try {
      // Use default tenant ID for testing
      req.tenantId = DEFAULT_TENANT_ID;
      
      const limit = parseInt(req.query.limit || '3', 10);
      const entries = await blackboardModel.getDashboardEntries(req.tenantId, req.user.id, limit);
      res.json(entries);
    } catch (error) {
      console.error('Error in GET /api/blackboard/dashboard:', error);
      res.status(500).json({ message: 'Error retrieving dashboard entries' });
    }
  });

/**
 * @route GET /api/blackboard/:id
 * @desc Get a specific blackboard entry
 */
router.get('/api/blackboard/:id', 
  authenticateToken, 
  // tenantMiddleware, // Temporarily disabled
  // checkFeature('blackboard_system'), // Temporarily disabled
  async (req, res) => {
    try {
      // Use default tenant ID for testing
      req.tenantId = DEFAULT_TENANT_ID;
      
      const entry = await blackboardModel.getEntryById(req.params.id, req.tenantId, req.user.id);
      
      if (!entry) {
        return res.status(404).json({ message: 'Entry not found' });
      }
      
      res.json(entry);
    } catch (error) {
      console.error('Error in GET /api/blackboard/:id:', error);
      res.status(500).json({ message: 'Error retrieving blackboard entry' });
    }
});

/**
 * @route POST /api/blackboard
 * @desc Create a new blackboard entry
 */
router.post('/api/blackboard', 
  authenticateToken, 
  // tenantMiddleware, // Temporarily disabled
  // checkFeature('blackboard_system'), // Temporarily disabled
  canCreateForOrgLevel,
  async (req, res) => {
    try {
      // Use default tenant ID for testing
      req.tenantId = DEFAULT_TENANT_ID;
      
      const entryData = {
        tenant_id: req.tenantId,
        title: req.body.title,
        content: req.body.content,
        org_level: req.body.org_level,
        org_id: req.body.org_id,
        author_id: req.user.id,
        expires_at: req.body.expires_at || null,
        priority: req.body.priority || 'normal',
        requires_confirmation: req.body.requires_confirmation || false
      };
      
      const entry = await blackboardModel.createEntry(entryData);
      res.status(201).json(entry);
    } catch (error) {
      console.error('Error in POST /api/blackboard:', error);
      res.status(500).json({ message: 'Error creating blackboard entry' });
    }
  });

/**
 * @route PUT /api/blackboard/:id
 * @desc Update a blackboard entry
 */
router.put('/api/blackboard/:id', 
  authenticateToken, 
  // tenantMiddleware, // Temporarily disabled
  // checkFeature('blackboard_system'), // Temporarily disabled
  canManageEntry,
  async (req, res) => {
    try {
      const entryData = {
        author_id: req.user.id,
        ...req.body
      };
      
      const updatedEntry = await blackboardModel.updateEntry(
        req.params.id, 
        entryData, 
        req.tenantId
      );
      
      res.json(updatedEntry);
    } catch (error) {
      console.error('Error in PUT /api/blackboard/:id:', error);
      res.status(500).json({ message: 'Error updating blackboard entry' });
    }
  });

/**
 * @route DELETE /api/blackboard/:id
 * @desc Delete a blackboard entry
 */
router.delete('/api/blackboard/:id', 
  authenticateToken, 
  // tenantMiddleware, // Temporarily disabled
  // checkFeature('blackboard_system'), // Temporarily disabled
  canManageEntry,
  async (req, res) => {
    try {
      const success = await blackboardModel.deleteEntry(req.params.id, req.tenantId);
      
      if (!success) {
        return res.status(404).json({ message: 'Entry not found' });
      }
      
      res.json({ message: 'Entry deleted successfully' });
    } catch (error) {
      console.error('Error in DELETE /api/blackboard/:id:', error);
      res.status(500).json({ message: 'Error deleting blackboard entry' });
    }
  });

/**
 * @route POST /api/blackboard/:id/confirm
 * @desc Mark a blackboard entry as read
 */
router.post('/api/blackboard/:id/confirm', 
  authenticateToken, 
  // tenantMiddleware, // Temporarily disabled
  // checkFeature('blackboard_system'), // Temporarily disabled
  async (req, res) => {
    try {
      const success = await blackboardModel.confirmEntry(req.params.id, req.user.id);
      
      if (!success) {
        return res.status(400).json({ 
          message: 'Entry does not exist or does not require confirmation' 
        });
      }
      
      res.json({ message: 'Entry confirmed successfully' });
    } catch (error) {
      console.error('Error in POST /api/blackboard/:id/confirm:', error);
      res.status(500).json({ message: 'Error confirming blackboard entry' });
    }
  });

/**
 * @route GET /api/blackboard/:id/confirmations
 * @desc Get confirmation status for an entry
 */
router.get('/api/blackboard/:id/confirmations', 
  authenticateToken, 
  // tenantMiddleware, // Temporarily disabled
  // checkFeature('blackboard_system'), // Temporarily disabled
  async (req, res) => {
    try {
      // Only admins can view confirmation status
      if (req.user.role !== 'admin' && req.user.role !== 'root') {
        return res.status(403).json({ message: 'Only admins can view confirmation status' });
      }
      
      const confirmations = await blackboardModel.getConfirmationStatus(
        req.params.id, 
        req.tenantId
      );
      
      res.json(confirmations);
    } catch (error) {
      console.error('Error in GET /api/blackboard/:id/confirmations:', error);
      res.status(500).json({ message: 'Error retrieving confirmation status' });
    }
  });

module.exports = router;