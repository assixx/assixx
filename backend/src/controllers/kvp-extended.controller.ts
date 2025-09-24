/**
 * KVP Extended Controller
 * Handles extended features: sharing, statistics, comments, and attachments
 */
import { Response } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import kvpPermissionService from '../services/kvpPermission.service.js';
import { query as executeQuery } from '../utils/db.js';
import {
  INVALID_ID_ERROR,
  KvpCoreController,
  NO_PERMISSION_ERROR,
  UNKNOWN_ERROR_MESSAGE,
} from './kvp-core.controller.js';
import type {
  DepartmentStat,
  KvpGetRequest,
  KvpShareRequest,
  TenantRequest,
} from './kvp-core.controller.js';

/**
 * Extended KVP Controller with additional features
 */
class KvpExtendedController extends KvpCoreController {
  /**
   * Share a suggestion company-wide
   * POST /api/kvp/:id/share
   * @param req - The request object
   * @param res - The response object
   */
  async shareSuggestion(req: KvpShareRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role === 'employee') {
        res.status(403).json({ error: 'Nur Admins können Vorschläge teilen' });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: INVALID_ID_ERROR });
        return;
      }

      // Check permission
      const canShare = await kvpPermissionService.canShareSuggestion(
        req.user.id,
        id,
        req.user.tenant_id,
      );

      if (!canShare) {
        res.status(403).json({ error: 'Keine Berechtigung zum Teilen dieses Vorschlags' });
        return;
      }

      // Get suggestion details for logging
      const [suggestions] = await executeQuery<RowDataPacket[]>(
        'SELECT title, department_id FROM kvp_suggestions WHERE id = ?',
        [id],
      );

      // Update to company-wide visibility
      await executeQuery<ResultSetHeader>(
        `UPDATE kvp_suggestions
         SET org_level = 'company',
             org_id = ?,
             shared_by = ?,
             shared_at = NOW()
         WHERE id = ?`,
        [req.user.tenant_id, req.user.id, id],
      );

      // Log action
      await kvpPermissionService.logAdminAction(
        req.user.id,
        'share_company_wide',
        id,
        'kvp_suggestion',
        req.user.tenant_id,
      );

      // Log the sharing action
      await executeQuery<ResultSetHeader>(
        `INSERT INTO activity_logs
         (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          'kvp_shared',
          'kvp_suggestion',
          id,
          JSON.stringify({
            title: suggestions[0].title as string,
            shared_to: 'company',
            from_department_id: suggestions[0].department_id as number,
          }),
          req.ip ?? req.socket.remoteAddress,
          req.headers['user-agent'] ?? null,
        ],
      );

      res.json({
        success: true,
        message: 'Vorschlag wurde firmenweit geteilt',
      });
    } catch (error: unknown) {
      console.error('Error in KvpController.shareSuggestion:', error);
      res.status(500).json({
        error: 'Fehler beim Teilen',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE,
      });
    }
  }

  /**
   * Unshare a suggestion (back to department level)
   * POST /api/kvp/:id/unshare
   * @param req - The request object
   * @param res - The response object
   */
  async unshareSuggestion(req: KvpShareRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role === 'employee') {
        res.status(403).json({ error: 'Nur Admins können Teilen rückgängig machen' });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: INVALID_ID_ERROR });
        return;
      }

      // Get suggestion details
      const [suggestions] = await executeQuery<RowDataPacket[]>(
        'SELECT department_id, shared_by, org_level FROM kvp_suggestions WHERE id = ?',
        [id],
      );

      if (suggestions.length === 0) {
        res.status(404).json({ error: 'Vorschlag nicht gefunden' });
        return;
      }

      const suggestion = suggestions[0];

      // Check if suggestion is shared (not at team level)
      if (suggestion.org_level === 'team') {
        res.status(400).json({ error: 'Vorschlag ist bereits auf Team-Ebene' });
        return;
      }

      // Only the original sharer or root can unshare
      if (req.user.role !== 'root' && suggestion.shared_by !== req.user.id) {
        res.status(403).json({
          error: 'Nur der ursprüngliche Teiler kann dies rückgängig machen',
        });
        return;
      }

      // Revert to team level (using the original team_id)
      await executeQuery<ResultSetHeader>(
        `UPDATE kvp_suggestions
         SET org_level = 'team',
             org_id = team_id,
             shared_by = NULL,
             shared_at = NULL
         WHERE id = ?`,
        [id],
      );

      // Log action
      await kvpPermissionService.logAdminAction(
        req.user.id,
        'unshare_company_wide',
        id,
        'kvp_suggestion',
        req.user.tenant_id,
      );

      res.json({
        success: true,
        message: 'Teilen wurde rückgängig gemacht',
      });
    } catch (error: unknown) {
      console.error('Error in KvpController.unshareSuggestion:', error);
      res.status(500).json({
        error: 'Fehler beim Rückgängigmachen',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE,
      });
    }
  }

  /**
   * Get department statistics for root user
   */
  private async getRootDepartmentStats(tenantId: number): Promise<DepartmentStat[]> {
    const [departments] = await executeQuery<RowDataPacket[]>(
      'SELECT id, name FROM departments WHERE tenant_id = ?',
      [tenantId],
    );

    const departmentStats: DepartmentStat[] = [];
    for (const dept of departments) {
      const stats = await kvpPermissionService.getSuggestionStats(
        'department',
        dept.id as number,
        tenantId,
      );
      departmentStats.push({
        department_id: dept.id as number,
        department_name: dept.name as string,
        ...stats,
      });
    }
    return departmentStats;
  }

  /**
   * Get department statistics for admin user
   */
  private async getAdminDepartmentStats(
    departmentIds: number[],
    tenantId: number,
  ): Promise<DepartmentStat[]> {
    const departmentStats: DepartmentStat[] = [];

    for (const deptId of departmentIds) {
      const [deptInfo] = await executeQuery<RowDataPacket[]>(
        'SELECT name FROM departments WHERE id = ?',
        [deptId],
      );

      if (deptInfo.length === 0) continue;

      const stats = await kvpPermissionService.getSuggestionStats('department', deptId, tenantId);
      departmentStats.push({
        department_id: deptId,
        department_name: deptInfo[0].name as string,
        ...stats,
      });
    }
    return departmentStats;
  }

  /**
   * Get department statistics
   * GET /api/kvp/stats
   * @param req - The request object
   * @param res - The response object
   */
  async getStatistics(req: TenantRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { role, tenant_id: tenantId, id: userId } = req.user;

      if (role === 'employee') {
        res.status(403).json({ error: 'Keine Berechtigung für Statistiken' });
        return;
      }

      // Get company-wide stats
      const companyStats = await kvpPermissionService.getSuggestionStats(
        'company',
        tenantId,
        tenantId,
      );

      // Get department stats based on role
      let departmentStats: DepartmentStat[];
      if (role === 'root') {
        departmentStats = await this.getRootDepartmentStats(tenantId);
      } else {
        const departmentIds = await kvpPermissionService.getAdminDepartments(userId, tenantId);
        departmentStats = await this.getAdminDepartmentStats(departmentIds, tenantId);
      }

      res.json({
        company: companyStats,
        departments: departmentStats,
      });
    } catch (error: unknown) {
      console.error('Error in KvpController.getStatistics:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Statistiken',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE,
      });
    }
  }

  /**
   * Get KVP categories
   * GET /api/kvp/categories
   * @param req - The request object
   * @param res - The response object
   */
  async getCategories(req: TenantRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const [categories] = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM kvp_categories ORDER BY name',
      );

      res.json({
        success: true,
        categories,
      });
    } catch (error: unknown) {
      console.error('Error in KvpController.getCategories:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Kategorien',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE,
      });
    }
  }

  /**
   * Get comments for a suggestion
   * GET /api/kvp/:id/comments
   * @param req - The request object
   * @param res - The response object
   */
  async getComments(req: KvpGetRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: INVALID_ID_ERROR });
        return;
      }

      // Check view permission
      const canView = await kvpPermissionService.canViewSuggestion(
        req.user.id,
        id,
        req.user.role,
        req.user.tenant_id,
      );

      if (!canView) {
        res.status(403).json({ error: NO_PERMISSION_ERROR });
        return;
      }

      // Get comments with user info
      let query = `
        SELECT c.*,
               u.first_name,
               u.last_name,
               u.profile_picture_url
        FROM kvp_comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.suggestion_id = ?
      `;

      // Non-admins cannot see internal comments
      if (req.user.role === 'employee') {
        query += ' AND c.is_internal = 0';
      }

      query += ' ORDER BY c.created_at DESC';

      const [comments] = await executeQuery<RowDataPacket[]>(query, [id]);

      res.json({
        success: true,
        comments,
      });
    } catch (error: unknown) {
      console.error('Error in KvpController.getComments:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Kommentare',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE,
      });
    }
  }

  /**
   * Add comment to a suggestion
   * POST /api/kvp/:id/comments
   * @param req - The request object
   * @param res - The response object
   */
  async addComment(
    req: TenantRequest & {
      params: { id: string };
      body: { comment: string; is_internal?: boolean };
    },
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: INVALID_ID_ERROR });
        return;
      }

      const { comment, is_internal: isInternal } = req.body as {
        comment: unknown;
        is_internal?: boolean;
      };

      if (typeof comment !== 'string' || comment.trim() === '') {
        res.status(400).json({ error: 'Kommentar darf nicht leer sein' });
        return;
      }

      // Check view permission
      const canView = await kvpPermissionService.canViewSuggestion(
        req.user.id,
        id,
        req.user.role,
        req.user.tenant_id,
      );

      if (!canView) {
        res.status(403).json({ error: NO_PERMISSION_ERROR });
        return;
      }

      // Only admins can add internal comments
      const isInternalComment =
        Boolean(isInternal) && (req.user.role === 'admin' || req.user.role === 'root');

      const [result] = await executeQuery<ResultSetHeader>(
        'INSERT INTO kvp_comments (suggestion_id, user_id, comment, is_internal) VALUES (?, ?, ?, ?)',
        [id, req.user.id, comment.trim(), isInternalComment ? 1 : 0],
      );

      res.status(201).json({
        success: true,
        commentId: result.insertId,
        message: 'Kommentar hinzugefügt',
      });
    } catch (error: unknown) {
      console.error('Error in KvpController.addComment:', error);
      res.status(500).json({
        error: 'Fehler beim Hinzufügen des Kommentars',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE,
      });
    }
  }

  /**
   * Get attachments for a suggestion
   * GET /api/kvp/:id/attachments
   * @param req - The request object
   * @param res - The response object
   */
  async getAttachments(req: KvpGetRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: INVALID_ID_ERROR });
        return;
      }

      // Check view permission
      const canView = await kvpPermissionService.canViewSuggestion(
        req.user.id,
        id,
        req.user.role,
        req.user.tenant_id,
      );

      if (!canView) {
        res.status(403).json({ error: NO_PERMISSION_ERROR });
        return;
      }

      const [attachments] = await executeQuery<RowDataPacket[]>(
        `SELECT a.*,
                u.first_name as uploaded_by_name,
                u.last_name as uploaded_by_lastname
         FROM kvp_attachments a
         LEFT JOIN users u ON a.uploaded_by = u.id
         WHERE a.suggestion_id = ?
         ORDER BY a.uploaded_at DESC`,
        [id],
      );

      res.json({
        success: true,
        attachments,
      });
    } catch (error: unknown) {
      console.error('Error in KvpController.getAttachments:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Anhänge',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE,
      });
    }
  }

  /**
   * Upload photo attachments for a KVP suggestion
   * POST /api/kvp/:id/attachments
   * @param req - The request object
   * @param res - The response object
   */
  async uploadAttachment(
    req: TenantRequest & {
      params: { id: string };
      files?: Express.Multer.File[];
    },
    res: Response,
  ): Promise<void> {
    try {
      console.info('=== KVP Upload Attachment Start ===');
      console.info('User:', req.user);
      console.info('Suggestion ID:', req.params.id);
      console.info('Files received:', Array.isArray(req.files) ? req.files.length : 0);

      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const suggestionId = Number.parseInt(req.params.id);

      // Ensure req.files is an array to prevent type confusion
      if (!Array.isArray(req.files)) {
        res.status(400).json({ error: 'Invalid file upload format' });
        return;
      }

      const files = req.files as Express.Multer.File[];

      console.info('Parsed suggestion ID:', suggestionId);
      console.info('Files array:', files);

      if (files.length === 0) {
        console.info('No files in request');
        res.status(400).json({ error: 'Keine Dateien hochgeladen' });
        return;
      }

      // Check if user has permission to add attachments to this suggestion
      // Fixed parameter order: userId, suggestionId, role, tenantId
      const hasPermission = await kvpPermissionService.canViewSuggestion(
        req.user.id,
        suggestionId,
        req.user.role,
        req.user.tenant_id,
      );

      console.info('Has permission:', hasPermission);

      if (!hasPermission) {
        res.status(403).json({ error: NO_PERMISSION_ERROR });
        return;
      }

      const attachments = [];

      // Save each file reference in database
      for (const file of files) {
        console.info('Processing file:', {
          filename: file.filename,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path,
        });

        const [result] = await executeQuery<ResultSetHeader>(
          `INSERT INTO kvp_attachments
           (suggestion_id, file_name, file_path, file_type, file_size, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [suggestionId, file.originalname, file.path, file.mimetype, file.size, req.user.id],
        );

        attachments.push({
          id: result.insertId,
          file_name: file.originalname,
          file_type: file.mimetype,
          file_size: file.size,
          uploaded_at: new Date(),
        });
      }

      res.json({
        success: true,
        message: `${attachments.length} Foto(s) erfolgreich hochgeladen`,
        attachments,
      });
    } catch (error: unknown) {
      console.error('Error in KvpController.uploadAttachment:', error);
      res.status(500).json({
        error: 'Fehler beim Hochladen der Fotos',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE,
      });
    }
  }

  /**
   * Download a KVP attachment
   * GET /api/kvp/attachments/:attachmentId/download
   * @param req - The request object
   * @param res - The response object
   */
  async downloadAttachment(
    req: TenantRequest & { params: { attachmentId: string } },
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const attachmentId = Number.parseInt(req.params.attachmentId, 10);

      // Get attachment details
      const [attachments] = await executeQuery<RowDataPacket[]>(
        `SELECT ka.*, ks.tenant_id
         FROM kvp_attachments ka
         JOIN kvp_suggestions ks ON ka.suggestion_id = ks.id
         WHERE ka.id = ?`,
        [attachmentId],
      );

      if (attachments.length === 0) {
        res.status(404).json({ error: 'Anhang nicht gefunden' });
        return;
      }

      const attachment = attachments[0];

      // Check if user has permission to view this attachment
      // Fixed parameter order: userId, suggestionId, role, tenantId
      const hasPermission = await kvpPermissionService.canViewSuggestion(
        req.user.id,
        attachment.suggestion_id as number,
        req.user.role,
        req.user.tenant_id,
      );

      if (!hasPermission) {
        res.status(403).json({ error: NO_PERMISSION_ERROR });
        return;
      }

      // Send file
      res.download(attachment.file_path as string, attachment.file_name as string);
    } catch (error: unknown) {
      console.error('Error in KvpController.downloadAttachment:', error);
      res.status(500).json({
        error: 'Fehler beim Herunterladen der Datei',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE,
      });
    }
  }
}

// Export singleton instance
const kvpExtendedController = new KvpExtendedController();
export default kvpExtendedController;

// Named export for the class
export { KvpExtendedController };
