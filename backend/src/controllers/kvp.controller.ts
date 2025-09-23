/**
 * KVP Controller
 * Handles KVP (Kontinuierlicher Verbesserungsprozess / Continuous Improvement Process) operations
 */
import { Request, Response } from 'express';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import pool from '../config/database.js';
import kvpPermissionService from '../services/kvpPermission.service.js';
import { query as executeQuery } from '../utils/db.js';

const UNKNOWN_ERROR_MESSAGE = 'Unknown error';
const INVALID_ID_ERROR = 'Invalid ID';
const NO_PERMISSION_ERROR = 'Keine Berechtigung';

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

interface DepartmentStat {
  department_id: number;
  department_name: string;
  [key: string]: unknown;
}

/**
 *
 */
class KvpController {
  /**
   * Get visible KVP suggestions based on user role and permissions
   * GET /api/kvp
   * @param req - The request object
   * @param res - The response object
   */
  async getAll(req: KvpQueryRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const queryData = await this.buildQueryData(req);
      const suggestions = await this.fetchSuggestions(queryData);
      const totalCount = await this.getTotalCount(queryData);

      res.json({
        suggestions,
        pagination: {
          total: totalCount,
          page: queryData.pageNum,
          limit: queryData.limitNum,
          pages: Math.ceil(totalCount / queryData.limitNum),
        },
      });
    } catch (error: unknown) {
      console.error('Error in KvpController.getAll:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Vorschläge',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE,
      });
    }
  }

  private async buildQueryData(req: KvpQueryRequest): Promise<{
    whereClause: string;
    queryParams: (string | number)[];
    additionalWhere: string;
    additionalParams: (string | number)[];
    pageNum: number;
    limitNum: number;
    offset: number;
  }> {
    if (!req.user) {
      throw new Error('User not authenticated');
    }
    const { id: userId, role, tenant_id: tenantId } = req.user;
    const {
      filter,
      status,
      include_archived: includeArchived,
      page = '1',
      limit = '20',
    } = req.query;

    const { whereClause, queryParams } = await kvpPermissionService.buildVisibilityQuery({
      userId,
      role,
      tenantId,
      includeArchived: includeArchived === 'true',
      statusFilter: status,
      departmentFilter:
        req.query.department_id != null && req.query.department_id !== '' ?
          Number.parseInt(req.query.department_id)
        : undefined,
    });

    const { additionalWhere, additionalParams } = await this.applyFilters(filter, userId, role);

    const pageNum = Number.parseInt(page);
    const limitNum = Number.parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    return {
      whereClause,
      queryParams,
      additionalWhere,
      additionalParams,
      pageNum,
      limitNum,
      offset,
    };
  }

  private async applyFilters(
    filter: string | undefined,
    userId: number,
    role: string,
  ): Promise<{ additionalWhere: string; additionalParams: (string | number)[] }> {
    let additionalWhere = '';
    const additionalParams: (string | number)[] = [];

    if (filter === 'mine') {
      additionalWhere = ' AND s.submitted_by = ?';
      additionalParams.push(userId);
    } else if (filter === 'department' && role !== 'root') {
      const userDepartmentId = await this.getUserDepartmentId(userId);
      if (typeof userDepartmentId === 'number') {
        additionalWhere = ' AND s.department_id = ?';
        additionalParams.push(userDepartmentId);
      }
    } else if (filter === 'company') {
      additionalWhere = ' AND s.org_level = ?';
      additionalParams.push('company');
    } else if (filter === 'archived') {
      additionalWhere = ' AND s.status = ?';
      additionalParams.push('archived');
    }

    return { additionalWhere, additionalParams };
  }

  private async getUserDepartmentId(
    userId: number,
    requestedDeptId?: number,
  ): Promise<number | undefined> {
    const [userInfo] = await executeQuery<RowDataPacket[]>(
      'SELECT department_id FROM users WHERE id = ?',
      [userId],
    );
    return requestedDeptId ?? (userInfo[0]?.department_id as number | undefined);
  }

  private async fetchSuggestions(queryData: {
    whereClause: string;
    queryParams: (string | number)[];
    additionalWhere: string;
    additionalParams: (string | number)[];
    limitNum: number;
    offset: number;
  }): Promise<unknown[]> {
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
      WHERE ${queryData.whereClause}${queryData.additionalWhere}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const allParams = [
      ...queryData.queryParams,
      ...queryData.additionalParams,
      queryData.limitNum,
      queryData.offset,
    ];

    const connection = await pool.getConnection();
    await connection.query('SET NAMES utf8mb4');
    const [suggestions] = (await connection.query(query, allParams)) as [RowDataPacket[], unknown];
    connection.release();

    return this.transformSuggestions(suggestions);
  }

  private transformSuggestions(suggestions: RowDataPacket[]): unknown[] {
    interface KvpSuggestionRow {
      description?: Buffer | string;
      expected_benefit?: Buffer | string;
      rejection_reason?: Buffer | string;
      shared_by_firstname?: string;
      shared_by_lastname?: string;
      [key: string]: unknown;
    }

    return (suggestions as KvpSuggestionRow[]).map((s) => ({
      ...s,
      description: Buffer.isBuffer(s.description) ? s.description.toString('utf8') : s.description,
      expected_benefit:
        Buffer.isBuffer(s.expected_benefit) ?
          s.expected_benefit.toString('utf8')
        : s.expected_benefit,
      rejection_reason:
        Buffer.isBuffer(s.rejection_reason) ?
          s.rejection_reason.toString('utf8')
        : s.rejection_reason,
      shared_by_name:
        (
          s.shared_by_firstname != null &&
          s.shared_by_firstname !== '' &&
          s.shared_by_lastname != null &&
          s.shared_by_lastname !== ''
        ) ?
          `${s.shared_by_firstname} ${s.shared_by_lastname}`
        : null,
    }));
  }

  private async getTotalCount(queryData: {
    whereClause: string;
    queryParams: (string | number)[];
    additionalWhere: string;
    additionalParams: (string | number)[];
  }): Promise<number> {
    const countQuery = `
      SELECT COUNT(DISTINCT s.id) as total
      FROM kvp_suggestions s
      WHERE ${queryData.whereClause}${queryData.additionalWhere}
    `;

    const [countResult] = await executeQuery<RowDataPacket[]>(countQuery, [
      ...queryData.queryParams,
      ...queryData.additionalParams,
    ]);

    return countResult[0].total as number;
  }

  /**
   * Get a single KVP suggestion if user has permission
   * GET /api/kvp/:id
   * @param req - The request object
   * @param res - The response object
   */
  async getById(req: KvpGetRequest, res: Response): Promise<void> {
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

      // Check permission
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

      // Get suggestion with details
      const [suggestions] = await executeQuery<RowDataPacket[]>(
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
        [id],
      );

      if (suggestions.length === 0) {
        res.status(404).json({ error: 'Nicht gefunden' });
        return;
      }

      res.json(suggestions[0]);
    } catch (error: unknown) {
      console.error('Error in KvpController.getById:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen des Vorschlags',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE,
      });
    }
  }

  /**
   * Insert new KVP suggestion
   */
  private async insertSuggestion(
    tenantId: number,
    userId: number,
    departmentId: number,
    body: KvpCreateRequest['body'],
  ): Promise<number> {
    const [result] = await executeQuery<ResultSetHeader>(
      `INSERT INTO kvp_suggestions
       (tenant_id, title, description, category_id, department_id,
        org_level, org_id, submitted_by, status, priority,
        expected_benefit, estimated_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        body.title,
        body.description,
        body.category_id ?? null,
        departmentId,
        'department',
        departmentId,
        userId,
        'new',
        body.priority ?? 'normal',
        body.expected_benefit ?? null,
        body.estimated_cost ?? null,
      ],
    );

    return result.insertId;
  }

  /**
   * Fetch created suggestion with joins
   */
  private async fetchCreatedSuggestion(suggestionId: number): Promise<RowDataPacket[]> {
    const [newSuggestion] = await executeQuery<RowDataPacket[]>(
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
      [suggestionId],
    );

    return newSuggestion;
  }

  /**
   * Log KVP creation activity
   */
  private async logKvpCreation(
    userId: number,
    suggestionId: number,
    title: string,
    departmentId: number,
    categoryId: number | null,
    req: KvpCreateRequest,
  ): Promise<void> {
    await executeQuery<ResultSetHeader>(
      `INSERT INTO activity_logs
       (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        'kvp_created',
        'kvp_suggestion',
        suggestionId,
        JSON.stringify({ title, department_id: departmentId, category_id: categoryId }),
        req.ip ?? req.socket.remoteAddress,
        req.headers['user-agent'] ?? null,
      ],
    );
  }

  /**
   * Create a new KVP suggestion
   * POST /api/kvp
   * @param req - The request object
   * @param res - The response object
   */
  async create(req: KvpCreateRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id: userId, tenant_id: tenantId } = req.user;
      const departmentId = await this.getUserDepartmentId(userId, req.body.department_id);

      if (departmentId === undefined) {
        res.status(400).json({ error: 'Department ID is required' });
        return;
      }

      const suggestionId = await this.insertSuggestion(tenantId, userId, departmentId, req.body);
      const newSuggestion = await this.fetchCreatedSuggestion(suggestionId);

      await this.logKvpCreation(
        userId,
        suggestionId,
        req.body.title,
        departmentId,
        req.body.category_id ?? null,
        req,
      );

      res.status(201).json({ success: true, suggestion: newSuggestion[0] });
    } catch (error: unknown) {
      console.error('Error in KvpController.create:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen des Vorschlags',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE,
      });
    }
  }

  /**
   * Update a KVP suggestion if user has permission
   * PUT /api/kvp/:id
   * @param req - The request object
   * @param res - The response object
   */
  async update(req: KvpUpdateRequest, res: Response): Promise<void> {
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

      const hasPermission = await this.validateUpdatePermission(req.user, id);
      if (!hasPermission) {
        res.status(403).json({ error: 'Keine Berechtigung zum Bearbeiten' });
        return;
      }

      const { updateFields, updateValues } = await this.buildUpdateQuery(req.body, req.user, id);
      if (updateFields.length === 0) {
        res.status(400).json({ error: 'Keine Felder zum Aktualisieren' });
        return;
      }

      await this.executeUpdate(updateFields, updateValues, id);
      const updated = await this.getUpdatedSuggestion(id);

      res.json({
        success: true,
        suggestion: updated,
      });
    } catch (error: unknown) {
      console.error('Error in KvpController.update:', error);
      res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE,
      });
    }
  }

  private async validateUpdatePermission(
    user: { id: number; role: string; tenant_id: number },
    suggestionId: number,
  ): Promise<boolean> {
    return await kvpPermissionService.canEditSuggestion(
      user.id,
      suggestionId,
      user.role as 'root' | 'admin' | 'employee',
      user.tenant_id,
    );
  }

  private async buildUpdateQuery(
    body: Record<string, unknown>,
    user: { id: number; tenant_id: number },
    suggestionId: number,
  ): Promise<{ updateFields: string[]; updateValues: (string | number | null | Date)[] }> {
    const updateFields: string[] = [];
    const updateValues: (string | number | null | Date)[] = [];

    const fieldMappings = [
      { key: 'title', field: 'title' },
      { key: 'description', field: 'description' },
      { key: 'category_id', field: 'category_id' },
      { key: 'priority', field: 'priority' },
      { key: 'expected_benefit', field: 'expected_benefit' },
      { key: 'estimated_cost', field: 'estimated_cost' },
      { key: 'actual_savings', field: 'actual_savings' },
      { key: 'implementation_date', field: 'implementation_date' },
      { key: 'assigned_to', field: 'assigned_to' },
      { key: 'rejection_reason', field: 'rejection_reason' },
    ];

    for (const { key, field } of fieldMappings) {
      // eslint-disable-next-line security/detect-object-injection -- Safe: key is from predefined fieldMappings, not user input
      if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined) {
        updateFields.push(`${field} = ?`);
        // eslint-disable-next-line security/detect-object-injection -- Safe: key is from predefined fieldMappings, not user input
        const value = body[key];
        updateValues.push(value as string | number | null | Date);
      }
    }

    if (body.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(body.status as string);

      await kvpPermissionService.logAdminAction(
        user.id,
        'status_change',
        suggestionId,
        'kvp_suggestion',
        user.tenant_id,
        null,
        { status: body.status },
      );
    }

    return { updateFields, updateValues };
  }

  private async executeUpdate(
    updateFields: string[],
    updateValues: (string | number | null | Date)[],
    id: number,
  ): Promise<void> {
    updateValues.push(id);
    await executeQuery<ResultSetHeader>(
      `UPDATE kvp_suggestions SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues,
    );
  }

  private async getUpdatedSuggestion(id: number): Promise<unknown> {
    const [updated] = await executeQuery<RowDataPacket[]>(
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
      [id],
    );

    return updated[0];
  }

  /**
   * Archive a KVP suggestion (soft delete)
   * DELETE /api/kvp/:id
   * @param req - The request object
   * @param res - The response object
   */
  async delete(req: KvpGetRequest, res: Response): Promise<void> {
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

      // Check permission
      const canEdit = await kvpPermissionService.canEditSuggestion(
        req.user.id,
        id,
        req.user.role,
        req.user.tenant_id,
      );

      if (!canEdit) {
        res.status(403).json({ error: 'Keine Berechtigung zum Archivieren' });
        return;
      }

      // Archive instead of delete
      await executeQuery<ResultSetHeader>('UPDATE kvp_suggestions SET status = ? WHERE id = ?', [
        'archived',
        id,
      ]);

      // Log action
      await kvpPermissionService.logAdminAction(
        req.user.id,
        'archive',
        id,
        'kvp_suggestion',
        req.user.tenant_id,
      );

      res.status(204).send();
    } catch (error: unknown) {
      console.error('Error in KvpController.delete:', error);
      res.status(500).json({
        error: 'Fehler beim Archivieren',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE,
      });
    }
  }

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
const kvpController = new KvpController();
export default kvpController;

// Named export for the class
export { KvpController };
