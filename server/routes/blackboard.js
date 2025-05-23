/**
 * Blackboard API Routes
 * Handles all operations related to the blackboard system
 */

const express = require('express');
const router = express.Router();
const blackboardModel = require('../models/blackboard');
const { authenticateToken } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const { checkFeature } = require('../middleware/features');

// Helper function to get tenant ID from user object
function getTenantId(user) {
  return user.tenant_id || user.tenantId || 1;
}

// Debug log zum Überwachen der Datenbankverbindungen
console.log("Blackboard API Routes geladen - Benutze Standard-DB:", process.env.DB_NAME);

// Helper function to check if user can manage the entry
async function canManageEntry(req, res, next) {
  try {
    const entryId = req.params.id;
    // Get tenant ID from user object
    const tenantId = getTenantId(req.user);
    
    const entry = await blackboardModel.getEntryById(entryId, tenantId, req.user.id);
    
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    
    // Check if user is admin or the author of the entry
    const isAdmin = req.user.role === 'admin' || req.user.role === 'root';
    const isAuthor = entry.author_id === req.user.id;
    
    // Debug-Info
    console.log(`User role: ${req.user.role}, isAdmin: ${isAdmin}, isAuthor: ${isAuthor}, entry author: ${entry.author_id}, user: ${req.user.id}`);
    
    // Admins haben immer die Berechtigung
    if (isAdmin) {
      console.log("Admin has permission to manage entry");
      req.entry = entry;
      return next();
    }
    
    // Autoren nur, wenn sie nicht Admins sind
    if (isAuthor) {
      console.log("Author has permission to manage entry");
      req.entry = entry;
      return next();
    }
    
    // Weder Admin noch Autor
    console.log("User has no permission to manage entry");
    return res.status(403).json({ message: 'You do not have permission to manage this entry' });
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
  // tenantMiddleware removed - we get tenant_id from JWT token
  // checkFeature('blackboard_system'),
  async (req, res) => {
    try {
      // Get tenant ID from user object
      const tenantId = getTenantId(req.user);
      
      const options = {
        status: req.query.status || 'active',
        filter: req.query.filter || 'all',
        search: req.query.search || '',
        page: parseInt(req.query.page || '1', 10),
        limit: parseInt(req.query.limit || '10', 10),
        sortBy: req.query.sortBy || 'created_at',
        sortDir: req.query.sortDir || 'DESC'
      };
      
      const result = await blackboardModel.getAllEntries(tenantId, req.user.id, options);
      
      // Debug-Logging für Ergebnisse
      console.log("Blackboard entries result:", JSON.stringify(result).substring(0, 200));
      if (result.entries && result.entries.length > 0) {
        console.log("First entry content type:", typeof result.entries[0].content);
        console.log("First entry sample:", JSON.stringify(result.entries[0]).substring(0, 200));
      }
      
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
  // tenantMiddleware removed - we get tenant_id from JWT token
  // checkFeature('blackboard_system'),
  async (req, res) => {
    try {
      // Get tenant ID from user object
      const tenantId = getTenantId(req.user);
      
      const limit = parseInt(req.query.limit || '3', 10);
      const entries = await blackboardModel.getDashboardEntries(tenantId, req.user.id, limit);
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
  // tenantMiddleware removed - we get tenant_id from JWT token
  // checkFeature('blackboard_system'),
  async (req, res) => {
    try {
      // Get tenant ID from user object
      const tenantId = getTenantId(req.user);
      
      const entry = await blackboardModel.getEntryById(req.params.id, tenantId, req.user.id);
      
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
  // tenantMiddleware removed - we get tenant_id from JWT token
  // checkFeature('blackboard_system'),
  canCreateForOrgLevel,
  async (req, res) => {
    try {
      // Get tenant ID from user object
      const tenantId = getTenantId(req.user);
      
      console.log(`Creating blackboard entry with tenant ID: ${tenantId} for user ${req.user.username}`);
      
      // Die org_id muss als Zahl vorliegen
      let org_id = req.body.org_id;
      if (typeof org_id === 'string') {
        org_id = parseInt(org_id, 10);
      }
      
      const entryData = {
        tenant_id: tenantId, // tenant_id from user object
        title: req.body.title,
        content: req.body.content,
        org_level: req.body.org_level,
        org_id: org_id,
        author_id: req.user.id,
        expires_at: req.body.expires_at || null,
        priority: req.body.priority || 'normal',
        color: req.body.color || 'blue',
        tags: req.body.tags || [],
        requires_confirmation: req.body.requires_confirmation || false
      };
      
      console.log("Blackboard entry data:", entryData);
      
      const entry = await blackboardModel.createEntry(entryData);
      res.status(201).json(entry);
    } catch (error) {
      console.error('Error in POST /api/blackboard:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      res.status(500).json({ 
        message: 'Error creating blackboard entry',
        error: error.message 
      });
    }
  });

/**
 * @route PUT /api/blackboard/:id
 * @desc Update a blackboard entry
 */
router.put('/api/blackboard/:id', 
  authenticateToken, 
  // tenantMiddleware removed - we get tenant_id from JWT token
  // checkFeature('blackboard_system'),
  canManageEntry,
  async (req, res) => {
    try {
      const entryData = {
        author_id: req.user.id,
        title: req.body.title,
        content: req.body.content,
        org_level: req.body.org_level,
        org_id: req.body.org_id,
        priority: req.body.priority,
        color: req.body.color,
        tags: req.body.tags,
        expires_at: req.body.expires_at,
        requires_confirmation: req.body.requires_confirmation,
        status: req.body.status
      };
      
      // Get tenant ID from user object
      const tenantId = getTenantId(req.user);
      
      const updatedEntry = await blackboardModel.updateEntry(
        req.params.id, 
        entryData, 
        tenantId
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
  // tenantMiddleware removed - we get tenant_id from JWT token
  // checkFeature('blackboard_system'),
  canManageEntry,
  async (req, res) => {
    try {
      // Get tenant ID from user object
      const tenantId = getTenantId(req.user);
      
      const success = await blackboardModel.deleteEntry(req.params.id, tenantId);
      
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
  // tenantMiddleware removed - we get tenant_id from JWT token
  // checkFeature('blackboard_system'),
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
  // tenantMiddleware removed - we get tenant_id from JWT token
  // checkFeature('blackboard_system'),
  async (req, res) => {
    try {
      // Only admins can view confirmation status
      if (req.user.role !== 'admin' && req.user.role !== 'root') {
        return res.status(403).json({ message: 'Only admins can view confirmation status' });
      }
      
      // Get tenant ID from user object
      const tenantId = getTenantId(req.user);
      
      const confirmations = await blackboardModel.getConfirmationStatus(
        req.params.id, 
        tenantId
      );
      
      res.json(confirmations);
    } catch (error) {
      console.error('Error in GET /api/blackboard/:id/confirmations:', error);
      res.status(500).json({ message: 'Error retrieving confirmation status' });
    }
  });

/**
 * @route GET /api/blackboard/:id/tags
 * @desc Get tags for a specific entry
 */
router.get('/api/blackboard/:id/tags', 
  authenticateToken, 
  // tenantMiddleware removed - we get tenant_id from JWT token
  // checkFeature('blackboard_system'),
  async (req, res) => {
    try {
      const tags = await blackboardModel.getEntryTags(req.params.id);
      res.json(tags);
    } catch (error) {
      console.error('Error in GET /api/blackboard/:id/tags:', error);
      res.status(500).json({ message: 'Error retrieving entry tags' });
    }
  });

module.exports = router;