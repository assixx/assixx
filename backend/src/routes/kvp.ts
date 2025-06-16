/**
 * KVP API Routes (Kontinuierlicher Verbesserungsprozess)
 * Handles all operations related to the KVP system
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import { authenticateToken } from '../auth';

// Import models (now ES modules)
import kvpModel from '../models/kvp';

const router: Router = express.Router();

// Helper function to get tenant ID from user object
function getTenantId(user: any): number {
  return user.tenant_id || user.tenantId || 1;
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination(
    _req: Request,
    // eslint-disable-next-line no-undef
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ): void {
    const uploadPath = path.join(process.cwd(), 'backend', 'uploads', 'kvp');
    fs.mkdir(uploadPath, { recursive: true })
      .then(() => cb(null, uploadPath))
      .catch((error) => cb(error as Error, uploadPath));
  },
  filename(
    _req: Request,
    // eslint-disable-next-line no-undef
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ): void {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(
      null,
      `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`
    );
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter(
    _req: Request,
    // eslint-disable-next-line no-undef
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ): void {
    // Allow images and PDFs
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error('Nur Bilder (JPEG, PNG, GIF) und PDF-Dateien sind erlaubt'));
    }
  },
});

// Helper function to check admin permissions
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authReq = req as any;
  if (authReq.user.role !== 'admin' && authReq.user.role !== 'root') {
    res.status(403).json({
      success: false,
      message: 'Admin-Berechtigung erforderlich',
    });
    return;
  }
  next();
}

// GET /api/kvp/categories - Get all categories
router.get(
  '/categories',
  [
    authenticateToken,
  ] as any[] /* tenantMiddleware, checkFeature('kvp_system'), */, // Temporarily disabled
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const tenantId = getTenantId(authReq.user);
      const categories = await kvpModel.getCategories(tenantId);

      res.json({
        success: true,
        data: categories,
      });
    } catch (error: any) {
      console.error('Error fetching KVP categories:', error);
      res.status(500).json({
        success: false,
        message: 'Fehler beim Laden der Kategorien',
        error: error.message,
      });
    }
  }
);

// GET /api/kvp/suggestions - Get suggestions with filters
router.get(
  '/suggestions',
  [
    authenticateToken,
  ] as any[] /* tenantMiddleware, checkFeature('kvp_system'), */, // Temporarily disabled
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const tenantId = getTenantId(authReq.user);
      const { status, category_id, priority, org_level } = req.query;

      const filters: any = {};
      if (status) filters.status = String(status);
      if (category_id) filters.category_id = parseInt(String(category_id));
      if (priority) filters.priority = String(priority);
      if (org_level) filters.org_level = String(org_level);

      const suggestions = await kvpModel.getSuggestions(
        tenantId,
        authReq.user.id,
        authReq.user.role,
        filters
      );

      res.json({
        success: true,
        data: suggestions,
      });
    } catch (error: any) {
      console.error('Error fetching KVP suggestions:', error);
      res.status(500).json({
        success: false,
        message: 'Fehler beim Laden der Verbesserungsvorschläge',
        error: error.message,
      });
    }
  }
);

// GET /api/kvp/suggestions/:id - Get single suggestion
router.get(
  '/suggestions/:id',
  [
    authenticateToken,
  ] as any[] /* tenantMiddleware, checkFeature('kvp_system'), */, // Temporarily disabled
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const tenantId = getTenantId(authReq.user);
      const suggestion = await kvpModel.getSuggestionById(
        parseInt(req.params.id, 10),
        tenantId,
        authReq.user.id,
        authReq.user.role
      );

      if (!suggestion) {
        res.status(404).json({
          success: false,
          message: 'Verbesserungsvorschlag nicht gefunden',
        });
        return;
      }

      // Get attachments and comments
      const [attachments, comments] = await Promise.all([
        kvpModel.getAttachments(suggestion.id),
        kvpModel.getComments(suggestion.id, authReq.user.role),
      ]);

      suggestion.attachments = attachments;
      suggestion.comments = comments;

      res.json({
        success: true,
        data: suggestion,
      });
    } catch (error: any) {
      console.error('Error fetching KVP suggestion:', error);
      res.status(500).json({
        success: false,
        message: 'Fehler beim Laden des Verbesserungsvorschlags',
        error: error.message,
      });
    }
  }
);

// POST /api/kvp/suggestions - Create new suggestion
router.post(
  '/suggestions',
  [
    authenticateToken,
    upload.array('attachments', 5),
  ] as any[] /* tenantMiddleware, checkFeature('kvp_system'), */, // Temporarily disabled
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const tenantId = getTenantId(authReq.user);
      const {
        title,
        description,
        category_id,
        org_level,
        org_id,
        priority,
        expected_benefit,
        estimated_cost,
      } = req.body;

      // Validate required fields
      if (!title || !description || !org_level || !org_id) {
        res.status(400).json({
          success: false,
          message:
            'Titel, Beschreibung, Organisationsebene und Organisations-ID sind erforderlich',
        });
        return;
      }

      const suggestionData: any = {
        tenant_id: tenantId,
        title,
        description,
        category_id: category_id ? parseInt(category_id) : 13, // Default to Sicherheit if not provided
        org_level,
        org_id: parseInt(org_id),
        submitted_by: authReq.user.id,
        priority: priority || 'normal',
        expected_benefit: expected_benefit || null,
        estimated_cost: estimated_cost ? parseFloat(estimated_cost) : null,
      };

      const suggestion = await kvpModel.createSuggestion(suggestionData);

      // Handle file uploads
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        for (const file of req.files) {
          await kvpModel.addAttachment(suggestion.id, {
            file_name: file.originalname,
            file_path: file.path,
            file_type: file.mimetype,
            file_size: file.size,
            uploaded_by: authReq.user.id,
          });
        }
      }

      res.status(201).json({
        success: true,
        message: 'Verbesserungsvorschlag erfolgreich eingereicht',
        data: suggestion,
      });
    } catch (error: any) {
      console.error('Error creating KVP suggestion:', error);
      res.status(500).json({
        success: false,
        message: 'Fehler beim Erstellen des Verbesserungsvorschlags',
        error: error.message,
      });
    }
  }
);

// PUT /api/kvp/suggestions/:id/status - Update suggestion status (Admin only)
router.put(
  '/suggestions/:id/status',
  [
    authenticateToken,
    requireAdmin,
  ] as any[] /* tenantMiddleware, checkFeature('kvp_system'), */, // Temporarily disabled
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const tenantId = getTenantId(authReq.user);
      const { status, reason } = req.body;

      const validStatuses = [
        'new',
        'pending',
        'in_review',
        'approved',
        'implemented',
        'rejected',
        'archived',
      ];
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Ungültiger Status',
        });
        return;
      }

      const updated = await kvpModel.updateSuggestionStatus(
        parseInt(req.params.id, 10),
        tenantId,
        status,
        authReq.user.id,
        reason
      );

      if (!updated) {
        res.status(404).json({
          success: false,
          message: 'Verbesserungsvorschlag nicht gefunden',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Status erfolgreich aktualisiert',
      });
    } catch (error: any) {
      console.error('Error updating KVP suggestion status:', error);
      res.status(500).json({
        success: false,
        message: 'Fehler beim Aktualisieren des Status',
        error: error.message,
      });
    }
  }
);

// POST /api/kvp/suggestions/:id/comments - Add comment
router.post(
  '/suggestions/:id/comments',
  [
    authenticateToken,
  ] as any[] /* tenantMiddleware, checkFeature('kvp_system'), */, // Temporarily disabled
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const { comment, is_internal } = req.body;

      if (!comment || comment.trim() === '') {
        res.status(400).json({
          success: false,
          message: 'Kommentar darf nicht leer sein',
        });
        return;
      }

      // Only admins can add internal comments
      const isInternal =
        is_internal &&
        (authReq.user.role === 'admin' || authReq.user.role === 'root');

      const commentId = await kvpModel.addComment(
        parseInt(req.params.id, 10),
        authReq.user.id,
        comment.trim(),
        isInternal
      );

      res.status(201).json({
        success: true,
        message: 'Kommentar erfolgreich hinzugefügt',
        data: { id: commentId },
      });
    } catch (error: any) {
      console.error('Error adding KVP comment:', error);
      res.status(500).json({
        success: false,
        message: 'Fehler beim Hinzufügen des Kommentars',
        error: error.message,
      });
    }
  }
);

// GET /api/kvp/dashboard - Get dashboard statistics (Admin only)
router.get(
  '/dashboard',
  [
    authenticateToken,
    requireAdmin,
  ] as any[] /* tenantMiddleware, checkFeature('kvp_system'), */, // Temporarily disabled
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const tenantId = getTenantId(authReq.user);
      const stats = await kvpModel.getDashboardStats(tenantId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('Error fetching KVP dashboard stats:', error);
      res.status(500).json({
        success: false,
        message: 'Fehler beim Laden der Dashboard-Statistiken',
        error: error.message,
      });
    }
  }
);

// GET /api/kvp/my-points - Get user's points
router.get(
  '/my-points',
  [
    authenticateToken,
  ] as any[] /* tenantMiddleware, checkFeature('kvp_system'), */, // Temporarily disabled
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const tenantId = getTenantId(authReq.user);
      const points = await kvpModel.getUserPoints(tenantId, authReq.user.id);

      res.json({
        success: true,
        data: points,
      });
    } catch (error: any) {
      console.error('Error fetching user points:', error);
      res.status(500).json({
        success: false,
        message: 'Fehler beim Laden der Punkte',
        error: error.message,
      });
    }
  }
);

// POST /api/kvp/award-points - Award points to user (Admin only)
router.post(
  '/award-points',
  [
    authenticateToken,
    requireAdmin,
  ] as any[] /* tenantMiddleware, checkFeature('kvp_system'), */, // Temporarily disabled
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const tenantId = getTenantId(authReq.user);
      const { user_id, suggestion_id, points, reason } = req.body;

      if (!user_id || !suggestion_id || !points || !reason) {
        res.status(400).json({
          success: false,
          message: 'Alle Felder sind erforderlich',
        });
        return;
      }

      const pointsId = await kvpModel.awardPoints(
        tenantId,
        user_id,
        suggestion_id,
        parseInt(points.toString()),
        reason,
        authReq.user.id
      );

      res.status(201).json({
        success: true,
        message: 'Punkte erfolgreich vergeben',
        data: { id: pointsId },
      });
    } catch (error: any) {
      console.error('Error awarding points:', error);
      res.status(500).json({
        success: false,
        message: 'Fehler beim Vergeben der Punkte',
        error: error.message,
      });
    }
  }
);

// GET /api/kvp/attachments/:id/download - Download attachment
router.get(
  '/attachments/:id/download',
  [
    authenticateToken,
  ] as any[] /* tenantMiddleware, checkFeature('kvp_system'), */, // Temporarily disabled
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const tenantId = getTenantId(authReq.user);
      const attachmentId = parseInt(req.params.id);

      // Get attachment details and verify access
      const attachment = await kvpModel.getAttachment(
        attachmentId,
        tenantId,
        authReq.user.id,
        authReq.user.role
      );

      if (!attachment) {
        res.status(404).json({
          success: false,
          message: 'Anhang nicht gefunden oder kein Zugriff',
        });
        return;
      }

      // Use the absolute file path directly
      const filePath = attachment.file_path;

      // Check if file exists
      if (!fsSync.existsSync(filePath)) {
        res.status(404).json({
          success: false,
          message: 'Datei nicht gefunden',
        });
        return;
      }

      // Set appropriate headers
      res.setHeader('Content-Type', attachment.file_type);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${attachment.file_name}"`
      );

      // Stream the file
      const fileStream = fsSync.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error: any) {
      console.error('Error downloading attachment:', error);
      res.status(500).json({
        success: false,
        message: 'Fehler beim Download',
        error: error.message,
      });
    }
  }
);

// DELETE /api/kvp/suggestions/:id - Delete suggestion (only by owner)
router.delete(
  '/suggestions/:id',
  [
    authenticateToken,
  ] as any[] /* tenantMiddleware, checkFeature('kvp_system'), */, // Temporarily disabled
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const tenantId = getTenantId(authReq.user);
      const suggestionId = parseInt(req.params.id);

      // Get suggestion to verify ownership
      const suggestion = await kvpModel.getSuggestionById(
        suggestionId,
        tenantId,
        authReq.user.id,
        authReq.user.role
      );

      if (!suggestion) {
        res.status(404).json({
          success: false,
          message: 'Verbesserungsvorschlag nicht gefunden',
        });
        return;
      }

      // Only allow deletion by the original submitter
      if (suggestion.submitted_by !== authReq.user.id) {
        res.status(403).json({
          success: false,
          message: 'Sie können nur Ihre eigenen Vorschläge löschen',
        });
        return;
      }

      // Delete the suggestion (this should cascade to attachments, comments, etc.)
      await kvpModel.deleteSuggestion(suggestionId, tenantId, authReq.user.id);

      res.json({
        success: true,
        message: 'Verbesserungsvorschlag wurde erfolgreich gelöscht',
      });
    } catch (error: any) {
      console.error('Error deleting KVP suggestion:', error);
      res.status(500).json({
        success: false,
        message: 'Fehler beim Löschen des Verbesserungsvorschlags',
        error: error.message,
      });
    }
  }
);

export default router;

// CommonJS compatibility
