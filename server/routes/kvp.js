/**
 * KVP API Routes (Kontinuierlicher Verbesserungsprozess)
 * Handles all operations related to the KVP system
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const kvpModel = require('../models/kvp');
const { authenticateToken } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const { checkFeature } = require('../middleware/features');

// Fallback tenant ID
const DEFAULT_TENANT_ID = 1;

console.log("KVP API Routes geladen - Benutze Standard-DB:", process.env.DB_NAME);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/kvp');
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow images and PDFs
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Nur Bilder (JPEG, PNG, GIF) und PDF-Dateien sind erlaubt'));
    }
  }
});

// Helper function to check admin permissions
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'root') {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin-Berechtigung erforderlich' 
    });
  }
  next();
}

// Helper function to get tenant ID
async function getTenantId(req) {
  if (!req.tenantId) {
    return DEFAULT_TENANT_ID;
  }
  
  // req.tenantId contains subdomain, we need numeric ID
  const db = require('../database');
  const [tenantRows] = await db.query('SELECT id FROM tenants WHERE subdomain = ?', [req.tenantId]);
  
  if (tenantRows.length === 0) {
    return DEFAULT_TENANT_ID;
  }
  
  return tenantRows[0].id;
}

// GET /api/kvp/categories - Get all categories
router.get('/categories', authenticateToken, tenantMiddleware, checkFeature('kvp_system'), async (req, res) => {
  try {
    const tenantId = await getTenantId(req);
    const categories = await kvpModel.getCategories(tenantId);
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching KVP categories:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Kategorien',
      error: error.message
    });
  }
});

// GET /api/kvp/suggestions - Get suggestions with filters
router.get('/suggestions', authenticateToken, tenantMiddleware, checkFeature('kvp_system'), async (req, res) => {
  try {
    const tenantId = await getTenantId(req);
    const { status, category_id, priority, org_level } = req.query;
    
    const filters = {};
    if (status) filters.status = status;
    if (category_id) filters.category_id = parseInt(category_id);
    if (priority) filters.priority = priority;
    if (org_level) filters.org_level = org_level;
    
    const suggestions = await kvpModel.getSuggestions(
      tenantId, 
      req.user.id, 
      req.user.role, 
      filters
    );
    
    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    console.error('Error fetching KVP suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Verbesserungsvorschläge',
      error: error.message
    });
  }
});

// GET /api/kvp/suggestions/:id - Get single suggestion
router.get('/suggestions/:id', authenticateToken, tenantMiddleware, checkFeature('kvp_system'), async (req, res) => {
  try {
    const tenantId = await getTenantId(req);
    const suggestion = await kvpModel.getSuggestionById(
      req.params.id, 
      tenantId, 
      req.user.id, 
      req.user.role
    );
    
    if (!suggestion) {
      return res.status(404).json({
        success: false,
        message: 'Verbesserungsvorschlag nicht gefunden'
      });
    }
    
    // Get attachments and comments
    const [attachments, comments] = await Promise.all([
      kvpModel.getAttachments(suggestion.id),
      kvpModel.getComments(suggestion.id, req.user.role)
    ]);
    
    suggestion.attachments = attachments;
    suggestion.comments = comments;
    
    res.json({
      success: true,
      data: suggestion
    });
  } catch (error) {
    console.error('Error fetching KVP suggestion:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden des Verbesserungsvorschlags',
      error: error.message
    });
  }
});

// POST /api/kvp/suggestions - Create new suggestion
router.post('/suggestions', authenticateToken, tenantMiddleware, checkFeature('kvp_system'), upload.array('attachments', 5), async (req, res) => {
  try {
    const tenantId = await getTenantId(req);
    const {
      title,
      description,
      category_id,
      org_level,
      org_id,
      priority,
      expected_benefit,
      estimated_cost
    } = req.body;
    
    // Validate required fields
    if (!title || !description || !org_level || !org_id) {
      return res.status(400).json({
        success: false,
        message: 'Titel, Beschreibung, Organisationsebene und Organisations-ID sind erforderlich'
      });
    }
    
    const suggestionData = {
      tenant_id: tenantId,
      title,
      description,
      category_id: category_id ? parseInt(category_id) : null,
      org_level,
      org_id: parseInt(org_id),
      submitted_by: req.user.id,
      priority: priority || 'normal',
      expected_benefit,
      estimated_cost: estimated_cost ? parseFloat(estimated_cost) : null
    };
    
    const suggestion = await kvpModel.createSuggestion(suggestionData);
    
    // Handle file uploads
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await kvpModel.addAttachment(suggestion.id, {
          file_name: file.originalname,
          file_path: file.path,
          file_type: file.mimetype,
          file_size: file.size,
          uploaded_by: req.user.id
        });
      }
    }
    
    res.status(201).json({
      success: true,
      message: 'Verbesserungsvorschlag erfolgreich eingereicht',
      data: suggestion
    });
  } catch (error) {
    console.error('Error creating KVP suggestion:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Erstellen des Verbesserungsvorschlags',
      error: error.message
    });
  }
});

// PUT /api/kvp/suggestions/:id/status - Update suggestion status (Admin only)
router.put('/suggestions/:id/status', authenticateToken, tenantMiddleware, checkFeature('kvp_system'), requireAdmin, async (req, res) => {
  try {
    const tenantId = await getTenantId(req);
    const { status, reason } = req.body;
    
    const validStatuses = ['new', 'pending', 'in_review', 'approved', 'implemented', 'rejected', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Ungültiger Status'
      });
    }
    
    const updated = await kvpModel.updateSuggestionStatus(
      req.params.id,
      tenantId,
      status,
      req.user.id,
      reason
    );
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Verbesserungsvorschlag nicht gefunden'
      });
    }
    
    res.json({
      success: true,
      message: 'Status erfolgreich aktualisiert'
    });
  } catch (error) {
    console.error('Error updating KVP suggestion status:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Aktualisieren des Status',
      error: error.message
    });
  }
});

// POST /api/kvp/suggestions/:id/comments - Add comment
router.post('/suggestions/:id/comments', authenticateToken, tenantMiddleware, checkFeature('kvp_system'), async (req, res) => {
  try {
    const { comment, is_internal } = req.body;
    
    if (!comment || comment.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Kommentar darf nicht leer sein'
      });
    }
    
    // Only admins can add internal comments
    const isInternal = is_internal && (req.user.role === 'admin' || req.user.role === 'root');
    
    const commentId = await kvpModel.addComment(
      req.params.id,
      req.user.id,
      comment.trim(),
      isInternal
    );
    
    res.status(201).json({
      success: true,
      message: 'Kommentar erfolgreich hinzugefügt',
      data: { id: commentId }
    });
  } catch (error) {
    console.error('Error adding KVP comment:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Hinzufügen des Kommentars',
      error: error.message
    });
  }
});

// GET /api/kvp/dashboard - Get dashboard statistics (Admin only)
router.get('/dashboard', authenticateToken, tenantMiddleware, checkFeature('kvp_system'), requireAdmin, async (req, res) => {
  try {
    const tenantId = await getTenantId(req);
    const stats = await kvpModel.getDashboardStats(tenantId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching KVP dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Dashboard-Statistiken',
      error: error.message
    });
  }
});

// GET /api/kvp/my-points - Get user's points
router.get('/my-points', authenticateToken, tenantMiddleware, checkFeature('kvp_system'), async (req, res) => {
  try {
    const tenantId = await getTenantId(req);
    const points = await kvpModel.getUserPoints(tenantId, req.user.id);
    
    res.json({
      success: true,
      data: points
    });
  } catch (error) {
    console.error('Error fetching user points:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Punkte',
      error: error.message
    });
  }
});

// POST /api/kvp/award-points - Award points to user (Admin only)
router.post('/award-points', authenticateToken, tenantMiddleware, checkFeature('kvp_system'), requireAdmin, async (req, res) => {
  try {
    const tenantId = await getTenantId(req);
    const { user_id, suggestion_id, points, reason } = req.body;
    
    if (!user_id || !suggestion_id || !points || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Alle Felder sind erforderlich'
      });
    }
    
    const pointsId = await kvpModel.awardPoints(
      tenantId,
      user_id,
      suggestion_id,
      parseInt(points),
      reason,
      req.user.id
    );
    
    res.status(201).json({
      success: true,
      message: 'Punkte erfolgreich vergeben',
      data: { id: pointsId }
    });
  } catch (error) {
    console.error('Error awarding points:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Vergeben der Punkte',
      error: error.message
    });
  }
});

// GET /api/kvp/attachments/:id/download - Download attachment
router.get('/attachments/:id/download', authenticateToken, tenantMiddleware, checkFeature('kvp_system'), async (req, res) => {
  try {
    const tenantId = await getTenantId(req);
    const attachmentId = parseInt(req.params.id);
    
    // Get attachment details and verify access
    const attachment = await kvpModel.getAttachment(attachmentId, tenantId, req.user.id, req.user.role);
    
    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Anhang nicht gefunden oder kein Zugriff'
      });
    }
    
    const path = require('path');
    const fs = require('fs');
    
    // Use the absolute file path directly
    const filePath = attachment.file_path;
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Datei nicht gefunden'
      });
    }
    
    // Set appropriate headers
    res.setHeader('Content-Type', attachment.file_type);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.file_name}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Download',
      error: error.message
    });
  }
});

// DELETE /api/kvp/suggestions/:id - Delete suggestion (only by owner)
router.delete('/suggestions/:id', authenticateToken, tenantMiddleware, checkFeature('kvp_system'), async (req, res) => {
  try {
    const tenantId = await getTenantId(req);
    const suggestionId = parseInt(req.params.id);
    
    // Get suggestion to verify ownership
    const suggestion = await kvpModel.getSuggestionById(
      suggestionId, 
      tenantId, 
      req.user.id, 
      req.user.role
    );
    
    if (!suggestion) {
      return res.status(404).json({
        success: false,
        message: 'Verbesserungsvorschlag nicht gefunden'
      });
    }
    
    // Only allow deletion by the original submitter
    if (suggestion.submitted_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Sie können nur Ihre eigenen Vorschläge löschen'
      });
    }
    
    // Delete the suggestion (this should cascade to attachments, comments, etc.)
    await kvpModel.deleteSuggestion(suggestionId, tenantId, req.user.id);
    
    res.json({
      success: true,
      message: 'Verbesserungsvorschlag wurde erfolgreich gelöscht'
    });
    
  } catch (error) {
    console.error('Error deleting KVP suggestion:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Löschen des Verbesserungsvorschlags',
      error: error.message
    });
  }
});

module.exports = router;