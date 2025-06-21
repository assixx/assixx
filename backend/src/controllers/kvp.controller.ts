/**
 * KVP Controller
 * Handles KVP (Kontinuierlicher Verbesserungsprozess / Continuous Improvement Process) operations
 */

import { Request, Response } from 'express';
import { Pool } from 'mysql2/promise';
import kvpPermissionService from '../services/kvpPermission.service.js';
import pool from '../config/database.js';

// Extended Request interface with tenant database and user
interface TenantRequest extends Request {
  tenantDb?: Pool;
  user?: {
    id: number;
    tenant_id: number;
    role: 'root' | 'admin' | 'employee';
  };
}

// Interface for create/update request bodies
interface KvpCreateRequest extends TenantRequest {
  body: {
    title: string;
    description: string;
    category_id?: number;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    expected_benefit?: string;
    estimated_cost?: number;
    department_id?: number;
  };
}

interface KvpUpdateRequest extends TenantRequest {
  body: {
    title?: string;
    description?: string;
    category_id?: number;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    status?: 'new' | 'in_review' | 'approved' | 'implemented' | 'rejected' | 'archived';
    expected_benefit?: string;
    estimated_cost?: number;
    actual_savings?: number;
    implementation_date?: Date | string;
    assigned_to?: number;
    rejection_reason?: string;
  };
  params: {
    id: string;
  };
}

interface KvpGetRequest extends TenantRequest {
  params: {
    id: string;
  };
}

interface KvpQueryRequest extends TenantRequest {
  query: {
    search?: string;
    category_id?: string;
    priority?: string;
    status?: string;
    department_id?: string;
    filter?: 'mine' | 'department' | 'company' | 'manage' | 'archived';
    include_archived?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortDir?: 'ASC' | 'DESC';
  };
}

interface KvpShareRequest extends TenantRequest {
  params: {
    id: string;
  };
}

class KvpController {
  /**
   * Get visible KVP suggestions based on user role and permissions
   * GET /api/kvp
   */
  async getAll(req: KvpQueryRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id: userId, role, tenant_id: tenantId } = req.user;
      const { filter, status, include_archived, page = '1', limit = '20' } = req.query;

      // Build visibility query
      const { whereClause, queryParams } = await kvpPermissionService.buildVisibilityQuery({
        userId,
        role,
        tenantId,
        includeArchived: include_archived === 'true',
        statusFilter: status,
        departmentFilter: req.query.department_id ? parseInt(req.query.department_id) : undefined
      });

      // Apply filter logic
      let additionalWhere = '';
      const additionalParams: any[] = [];

      if (filter === 'mine') {
        additionalWhere = ' AND s.submitted_by = ?';
        additionalParams.push(userId);
      } else if (filter === 'department' && role !== 'root') {
        const [userInfo] = await (pool as any).query(
          'SELECT department_id FROM users WHERE id = ?',
          [userId]
        );
        if (userInfo[0]?.department_id) {
          additionalWhere = ' AND s.department_id = ?';
          additionalParams.push(userInfo[0].department_id);
        }
      } else if (filter === 'company') {
        additionalWhere = ' AND s.org_level = ?';
        additionalParams.push('company');
      } else if (filter === 'archived') {
        additionalWhere = ' AND s.status = ?';
        additionalParams.push('archived');
      }

      // Execute query
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      // Build the full query
      const query = `
        SELECT DISTINCT s.*,
               u.first_name as submitted_by_name,
               u.last_name as submitted_by_lastname,
               d.name as department_name,
               cat.name as category_name,
               cat.icon as category_icon,
               cat.color as category_color,
               su.first_name as shared_by_firstname,
               su.last_name as shared_by_lastname,
               (SELECT COUNT(*) FROM kvp_attachments WHERE suggestion_id = s.id) as attachment_count
        FROM kvp_suggestions s
        LEFT JOIN users u ON s.submitted_by = u.id
        LEFT JOIN users su ON s.shared_by = su.id
        LEFT JOIN departments d ON s.department_id = d.id
        LEFT JOIN kvp_categories cat ON s.category_id = cat.id
        WHERE ${whereClause}${additionalWhere}
        ORDER BY s.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const allParams = [...queryParams, ...additionalParams, limitNum, offset];

      // Use query method with proper encoding
      const connection = await pool.getConnection();
      await connection.query('SET NAMES utf8mb4');
      const [suggestions] = await connection.query(query, allParams);
      connection.release();

      // Transform the results to include shared_by_name and convert Buffers to strings
      const transformedSuggestions = suggestions.map((s: any) => ({
        ...s,
        description: Buffer.isBuffer(s.description) ? s.description.toString('utf8') : s.description,
        expected_benefit: Buffer.isBuffer(s.expected_benefit) ? s.expected_benefit.toString('utf8') : s.expected_benefit,
        rejection_reason: Buffer.isBuffer(s.rejection_reason) ? s.rejection_reason.toString('utf8') : s.rejection_reason,
        shared_by_name: s.shared_by_firstname && s.shared_by_lastname 
          ? `${s.shared_by_firstname} ${s.shared_by_lastname}` 
          : null,
        shared_by_firstname: undefined,
        shared_by_lastname: undefined
      }));

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT s.id) as total
        FROM kvp_suggestions s
        WHERE ${whereClause}${additionalWhere}
      `;

      const [countResult] = await (pool as any).query(
        countQuery,
        [...queryParams, ...additionalParams]
      );

      res.json({
        suggestions: transformedSuggestions,
        pagination: {
          total: countResult[0].total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(countResult[0].total / limitNum)
        }
      });
    } catch (error) {
      console.error('Error in KvpController.getAll:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Vorschläge',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get a single KVP suggestion if user has permission
   * GET /api/kvp/:id
   */
  async getById(req: KvpGetRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      // Check permission
      const canView = await kvpPermissionService.canViewSuggestion(
        req.user.id,
        id,
        req.user.role,
        req.user.tenant_id
      );

      if (!canView) {
        res.status(403).json({ error: 'Keine Berechtigung' });
        return;
      }

      // Get suggestion with details
      const [suggestions] = await (pool as any).query(
        `SELECT s.*,
                u.first_name as submitted_by_name,
                u.last_name as submitted_by_lastname,
                d.name as department_name,
                cat.name as category_name,
                cat.icon as category_icon,
                cat.color as category_color,
                CASE 
                  WHEN s.shared_by IS NOT NULL THEN CONCAT(su.first_name, ' ', su.last_name)
                  ELSE NULL
                END as shared_by_name
         FROM kvp_suggestions s
         LEFT JOIN users u ON s.submitted_by = u.id
         LEFT JOIN users su ON s.shared_by = su.id
         LEFT JOIN departments d ON s.department_id = d.id
         LEFT JOIN kvp_categories cat ON s.category_id = cat.id
         WHERE s.id = ?`,
        [id]
      );

      if (suggestions.length === 0) {
        res.status(404).json({ error: 'Nicht gefunden' });
        return;
      }

      res.json(suggestions[0]);
    } catch (error) {
      console.error('Error in KvpController.getById:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen des Vorschlags',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Create a new KVP suggestion
   * POST /api/kvp
   */
  async create(req: KvpCreateRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id: userId, tenant_id: tenantId } = req.user;

      // Get user's department
      const [userInfo] = await (pool as any).query(
        'SELECT department_id FROM users WHERE id = ?',
        [userId]
      );

      const departmentId = req.body.department_id || userInfo[0]?.department_id;

      // Create suggestion
      const [result] = await (pool as any).query(
        `INSERT INTO kvp_suggestions 
         (tenant_id, title, description, category_id, department_id, 
          org_level, org_id, submitted_by, status, priority, 
          expected_benefit, estimated_cost) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          req.body.title,
          req.body.description,
          req.body.category_id || null,
          departmentId,
          'department', // Default to department level
          departmentId, // org_id same as department_id initially
          userId,
          'new',
          req.body.priority || 'normal',
          req.body.expected_benefit || null,
          req.body.estimated_cost || null
        ]
      );

      // Get created suggestion
      const [newSuggestion] = await (pool as any).query(
        `SELECT s.*,
                u.first_name as submitted_by_name,
                u.last_name as submitted_by_lastname,
                d.name as department_name,
                cat.name as category_name,
                cat.icon as category_icon,
                cat.color as category_color
         FROM kvp_suggestions s
         LEFT JOIN users u ON s.submitted_by = u.id
         LEFT JOIN departments d ON s.department_id = d.id
         LEFT JOIN kvp_categories cat ON s.category_id = cat.id
         WHERE s.id = ?`,
        [result.insertId]
      );

      // Log the creation
      await (pool as any).query(
        `INSERT INTO activity_logs 
         (user_id, action, entity_type, entity_id, details, ip_address, user_agent) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          'kvp_created',
          'kvp_suggestion',
          result.insertId,
          JSON.stringify({
            title: req.body.title,
            department_id: departmentId,
            category_id: req.body.category_id || null
          }),
          req.ip || req.socket.remoteAddress,
          req.headers['user-agent'] || null
        ]
      );

      res.status(201).json({
        success: true,
        suggestion: newSuggestion[0]
      });
    } catch (error) {
      console.error('Error in KvpController.create:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen des Vorschlags',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Update a KVP suggestion if user has permission
   * PUT /api/kvp/:id
   */
  async update(req: KvpUpdateRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      // Check permission
      const canEdit = await kvpPermissionService.canEditSuggestion(
        req.user.id,
        id,
        req.user.role,
        req.user.tenant_id
      );

      if (!canEdit) {
        res.status(403).json({ error: 'Keine Berechtigung zum Bearbeiten' });
        return;
      }

      // Build update query dynamically
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      if (req.body.title !== undefined) {
        updateFields.push('title = ?');
        updateValues.push(req.body.title);
      }
      if (req.body.description !== undefined) {
        updateFields.push('description = ?');
        updateValues.push(req.body.description);
      }
      if (req.body.category_id !== undefined) {
        updateFields.push('category_id = ?');
        updateValues.push(req.body.category_id);
      }
      if (req.body.priority !== undefined) {
        updateFields.push('priority = ?');
        updateValues.push(req.body.priority);
      }
      if (req.body.status !== undefined) {
        updateFields.push('status = ?');
        updateValues.push(req.body.status);
        
        // Log status change
        await kvpPermissionService.logAdminAction(
          req.user.id,
          'status_change',
          id,
          'kvp_suggestion',
          req.user.tenant_id,
          null,
          { status: req.body.status }
        );
      }
      if (req.body.expected_benefit !== undefined) {
        updateFields.push('expected_benefit = ?');
        updateValues.push(req.body.expected_benefit);
      }
      if (req.body.estimated_cost !== undefined) {
        updateFields.push('estimated_cost = ?');
        updateValues.push(req.body.estimated_cost);
      }
      if (req.body.actual_savings !== undefined) {
        updateFields.push('actual_savings = ?');
        updateValues.push(req.body.actual_savings);
      }
      if (req.body.implementation_date !== undefined) {
        updateFields.push('implementation_date = ?');
        updateValues.push(req.body.implementation_date);
      }
      if (req.body.assigned_to !== undefined) {
        updateFields.push('assigned_to = ?');
        updateValues.push(req.body.assigned_to);
      }
      if (req.body.rejection_reason !== undefined) {
        updateFields.push('rejection_reason = ?');
        updateValues.push(req.body.rejection_reason);
      }

      if (updateFields.length === 0) {
        res.status(400).json({ error: 'Keine Felder zum Aktualisieren' });
        return;
      }

      updateValues.push(id);

      await (pool as any).query(
        `UPDATE kvp_suggestions SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      // Get updated suggestion
      const [updated] = await (pool as any).query(
        `SELECT s.*,
                u.first_name as submitted_by_name,
                u.last_name as submitted_by_lastname,
                d.name as department_name,
                cat.name as category_name,
                cat.icon as category_icon,
                cat.color as category_color
         FROM kvp_suggestions s
         LEFT JOIN users u ON s.submitted_by = u.id
         LEFT JOIN departments d ON s.department_id = d.id
         LEFT JOIN kvp_categories cat ON s.category_id = cat.id
         WHERE s.id = ?`,
        [id]
      );

      res.json({
        success: true,
        suggestion: updated[0]
      });
    } catch (error) {
      console.error('Error in KvpController.update:', error);
      res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Archive a KVP suggestion (soft delete)
   * DELETE /api/kvp/:id
   */
  async delete(req: KvpGetRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      // Check permission
      const canEdit = await kvpPermissionService.canEditSuggestion(
        req.user.id,
        id,
        req.user.role,
        req.user.tenant_id
      );

      if (!canEdit) {
        res.status(403).json({ error: 'Keine Berechtigung zum Archivieren' });
        return;
      }

      // Archive instead of delete
      await (pool as any).query(
        'UPDATE kvp_suggestions SET status = ? WHERE id = ?',
        ['archived', id]
      );

      // Log action
      await kvpPermissionService.logAdminAction(
        req.user.id,
        'archive',
        id,
        'kvp_suggestion',
        req.user.tenant_id
      );

      res.status(204).send();
    } catch (error) {
      console.error('Error in KvpController.delete:', error);
      res.status(500).json({
        error: 'Fehler beim Archivieren',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Share a suggestion company-wide
   * POST /api/kvp/:id/share
   */
  async shareSuggestion(req: KvpShareRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role === 'employee') {
        res.status(403).json({ error: 'Nur Admins können Vorschläge teilen' });
        return;
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      // Check permission
      const canShare = await kvpPermissionService.canShareSuggestion(
        req.user.id,
        id,
        req.user.tenant_id
      );

      if (!canShare) {
        res.status(403).json({ error: 'Keine Berechtigung zum Teilen dieses Vorschlags' });
        return;
      }

      // Get suggestion details for logging
      const [suggestions] = await (pool as any).query(
        'SELECT title, department_id FROM kvp_suggestions WHERE id = ?',
        [id]
      );

      // Update to company-wide visibility
      await (pool as any).query(
        `UPDATE kvp_suggestions 
         SET org_level = 'company',
             org_id = ?,
             shared_by = ?,
             shared_at = NOW()
         WHERE id = ?`,
        [req.user.tenant_id, req.user.id, id]
      );

      // Log action
      await kvpPermissionService.logAdminAction(
        req.user.id,
        'share_company_wide',
        id,
        'kvp_suggestion',
        req.user.tenant_id
      );

      // Log the sharing action
      await (pool as any).query(
        `INSERT INTO activity_logs 
         (user_id, action, entity_type, entity_id, details, ip_address, user_agent) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          'kvp_shared',
          'kvp_suggestion',
          id,
          JSON.stringify({
            title: suggestions[0].title,
            shared_to: 'company',
            from_department_id: suggestions[0].department_id
          }),
          req.ip || req.socket.remoteAddress,
          req.headers['user-agent'] || null
        ]
      );

      res.json({ 
        success: true, 
        message: 'Vorschlag wurde firmenweit geteilt' 
      });
    } catch (error) {
      console.error('Error in KvpController.shareSuggestion:', error);
      res.status(500).json({
        error: 'Fehler beim Teilen',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Unshare a suggestion (back to department level)
   * POST /api/kvp/:id/unshare
   */
  async unshareSuggestion(req: KvpShareRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role === 'employee') {
        res.status(403).json({ error: 'Nur Admins können Teilen rückgängig machen' });
        return;
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      // Get suggestion details
      const [suggestions] = await (pool as any).query(
        'SELECT department_id, shared_by, org_level FROM kvp_suggestions WHERE id = ?',
        [id]
      );

      if (suggestions.length === 0) {
        res.status(404).json({ error: 'Vorschlag nicht gefunden' });
        return;
      }

      const suggestion = suggestions[0];

      // Check if already department level
      if (suggestion.org_level !== 'company') {
        res.status(400).json({ error: 'Vorschlag ist nicht firmenweit geteilt' });
        return;
      }

      // Only the original sharer or root can unshare
      if (req.user.role !== 'root' && suggestion.shared_by !== req.user.id) {
        res.status(403).json({ error: 'Nur der ursprüngliche Teiler kann dies rückgängig machen' });
        return;
      }

      // Revert to department level
      await (pool as any).query(
        `UPDATE kvp_suggestions 
         SET org_level = 'department',
             org_id = department_id,
             shared_by = NULL,
             shared_at = NULL
         WHERE id = ?`,
        [id]
      );

      // Log action
      await kvpPermissionService.logAdminAction(
        req.user.id,
        'unshare_company_wide',
        id,
        'kvp_suggestion',
        req.user.tenant_id
      );

      res.json({ 
        success: true, 
        message: 'Teilen wurde rückgängig gemacht' 
      });
    } catch (error) {
      console.error('Error in KvpController.unshareSuggestion:', error);
      res.status(500).json({
        error: 'Fehler beim Rückgängigmachen',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get department statistics
   * GET /api/kvp/stats
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

      // Get admin departments if not root
      let departmentIds: number[] = [];
      if (role === 'admin') {
        departmentIds = await kvpPermissionService.getAdminDepartments(userId, tenantId);
      }

      // Get company-wide stats
      const companyStats = await kvpPermissionService.getSuggestionStats(
        'company',
        tenantId,
        tenantId
      );

      // Get department stats
      const departmentStats: any[] = [];
      if (role === 'root') {
        // Get all departments
        const [departments] = await (pool as any).query(
          'SELECT id, name FROM departments WHERE tenant_id = ?',
          [tenantId]
        );
        
        for (const dept of departments) {
          const stats = await kvpPermissionService.getSuggestionStats(
            'department',
            dept.id,
            tenantId
          );
          departmentStats.push({
            department_id: dept.id,
            department_name: dept.name,
            ...stats
          });
        }
      } else {
        // Get only admin's departments
        for (const deptId of departmentIds) {
          const [deptInfo] = await (pool as any).query(
            'SELECT name FROM departments WHERE id = ?',
            [deptId]
          );
          
          if (deptInfo.length > 0) {
            const stats = await kvpPermissionService.getSuggestionStats(
              'department',
              deptId,
              tenantId
            );
            departmentStats.push({
              department_id: deptId,
              department_name: deptInfo[0].name,
              ...stats
            });
          }
        }
      }

      res.json({
        company: companyStats,
        departments: departmentStats
      });
    } catch (error) {
      console.error('Error in KvpController.getStatistics:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Statistiken',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get KVP categories
   * GET /api/kvp/categories
   */
  async getCategories(req: TenantRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const [categories] = await (pool as any).query(
        'SELECT * FROM kvp_categories ORDER BY name'
      );

      res.json({
        success: true,
        categories
      });
    } catch (error) {
      console.error('Error in KvpController.getCategories:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Kategorien',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get comments for a suggestion
   * GET /api/kvp/:id/comments
   */
  async getComments(req: KvpGetRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      // Check view permission
      const canView = await kvpPermissionService.canViewSuggestion(
        req.user.id,
        id,
        req.user.role,
        req.user.tenant_id
      );

      if (!canView) {
        res.status(403).json({ error: 'Keine Berechtigung' });
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

      const [comments] = await (pool as any).query(query, [id]);

      res.json({
        success: true,
        comments
      });
    } catch (error) {
      console.error('Error in KvpController.getComments:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Kommentare',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Add comment to a suggestion
   * POST /api/kvp/:id/comments
   */
  async addComment(req: TenantRequest & { params: { id: string }; body: { comment: string; is_internal?: boolean } }, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const { comment, is_internal } = req.body;

      if (!comment || comment.trim() === '') {
        res.status(400).json({ error: 'Kommentar darf nicht leer sein' });
        return;
      }

      // Check view permission
      const canView = await kvpPermissionService.canViewSuggestion(
        req.user.id,
        id,
        req.user.role,
        req.user.tenant_id
      );

      if (!canView) {
        res.status(403).json({ error: 'Keine Berechtigung' });
        return;
      }

      // Only admins can add internal comments
      const isInternal = is_internal && (req.user.role === 'admin' || req.user.role === 'root');

      const [result] = await (pool as any).query(
        'INSERT INTO kvp_comments (suggestion_id, user_id, comment, is_internal) VALUES (?, ?, ?, ?)',
        [id, req.user.id, comment.trim(), isInternal ? 1 : 0]
      );

      res.status(201).json({
        success: true,
        commentId: result.insertId,
        message: 'Kommentar hinzugefügt'
      });
    } catch (error) {
      console.error('Error in KvpController.addComment:', error);
      res.status(500).json({
        error: 'Fehler beim Hinzufügen des Kommentars',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get attachments for a suggestion
   * GET /api/kvp/:id/attachments
   */
  async getAttachments(req: KvpGetRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      // Check view permission
      const canView = await kvpPermissionService.canViewSuggestion(
        req.user.id,
        id,
        req.user.role,
        req.user.tenant_id
      );

      if (!canView) {
        res.status(403).json({ error: 'Keine Berechtigung' });
        return;
      }

      const [attachments] = await (pool as any).query(
        `SELECT a.*,
                u.first_name as uploaded_by_name,
                u.last_name as uploaded_by_lastname
         FROM kvp_attachments a
         LEFT JOIN users u ON a.uploaded_by = u.id
         WHERE a.suggestion_id = ?
         ORDER BY a.uploaded_at DESC`,
        [id]
      );

      res.json({
        success: true,
        attachments
      });
    } catch (error) {
      console.error('Error in KvpController.getAttachments:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Anhänge',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Upload photo attachments for a KVP suggestion
   * POST /api/kvp/:id/attachments
   */
  async uploadAttachment(req: any, res: Response): Promise<void> {
    try {
      console.log('=== KVP Upload Attachment Start ===');
      console.log('User:', req.user);
      console.log('Suggestion ID:', req.params.id);
      console.log('Files received:', req.files?.length || 0);
      
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const suggestionId = parseInt(req.params.id);
      const files = req.files as Express.Multer.File[];

      console.log('Parsed suggestion ID:', suggestionId);
      console.log('Files array:', files);

      if (!files || files.length === 0) {
        console.log('No files in request');
        res.status(400).json({ error: 'Keine Dateien hochgeladen' });
        return;
      }

      // Check if user has permission to add attachments to this suggestion
      // Fixed parameter order: userId, suggestionId, role, tenantId
      const hasPermission = await kvpPermissionService.canViewSuggestion(
        req.user.id,
        suggestionId,
        req.user.role,
        req.user.tenant_id
      );

      console.log('Has permission:', hasPermission);

      if (!hasPermission) {
        res.status(403).json({ error: 'Keine Berechtigung' });
        return;
      }

      const attachments = [];

      // Save each file reference in database
      for (const file of files) {
        console.log('Processing file:', {
          filename: file.filename,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path
        });

        const [result] = await (pool as any).query(
          `INSERT INTO kvp_attachments 
           (suggestion_id, file_name, file_path, file_type, file_size, uploaded_by) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            suggestionId,
            file.originalname,
            file.path,
            file.mimetype,
            file.size,
            req.user.id
          ]
        );

        attachments.push({
          id: result.insertId,
          file_name: file.originalname,
          file_type: file.mimetype,
          file_size: file.size,
          uploaded_at: new Date()
        });
      }

      res.json({
        success: true,
        message: `${attachments.length} Foto(s) erfolgreich hochgeladen`,
        attachments
      });
    } catch (error) {
      console.error('Error in KvpController.uploadAttachment:', error);
      res.status(500).json({
        error: 'Fehler beim Hochladen der Fotos',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Download a KVP attachment
   * GET /api/kvp/attachments/:attachmentId/download
   */
  async downloadAttachment(req: any, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const attachmentId = parseInt(req.params.attachmentId);

      // Get attachment details
      const [attachments] = await (pool as any).query(
        `SELECT ka.*, ks.tenant_id 
         FROM kvp_attachments ka
         JOIN kvp_suggestions ks ON ka.suggestion_id = ks.id
         WHERE ka.id = ?`,
        [attachmentId]
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
        attachment.suggestion_id,
        req.user.role,
        req.user.tenant_id
      );

      if (!hasPermission) {
        res.status(403).json({ error: 'Keine Berechtigung' });
        return;
      }

      // Send file
      res.download(attachment.file_path, attachment.file_name);
    } catch (error) {
      console.error('Error in KvpController.downloadAttachment:', error);
      res.status(500).json({
        error: 'Fehler beim Herunterladen der Datei',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// Export singleton instance
const kvpController = new KvpController();
export default kvpController;

// Named export for the class
export { KvpController };