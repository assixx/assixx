/**
 * KVP Core Controller
 * Handles core CRUD operations for KVP (Kontinuierlicher Verbesserungsprozess)
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

// Export interfaces for use in extended controller
export type {
  TenantRequest,
  KvpCreateRequest,
  KvpUpdateRequest,
  KvpGetRequest,
  KvpQueryRequest,
  KvpShareRequest,
  DepartmentStat,
};

// Export constants
export { UNKNOWN_ERROR_MESSAGE, INVALID_ID_ERROR, NO_PERMISSION_ERROR };

/**
 * Core KVP Controller with basic CRUD operations
 */
export class KvpCoreController {
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

  protected async buildQueryData(req: KvpQueryRequest): Promise<{
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

  protected async applyFilters(
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

  protected async getUserDepartmentId(
    userId: number,
    requestedDeptId?: number,
  ): Promise<number | undefined> {
    const [userInfo] = await executeQuery<RowDataPacket[]>(
      'SELECT department_id FROM users WHERE id = ?',
      [userId],
    );
    return requestedDeptId ?? (userInfo[0]?.department_id as number | undefined);
  }

  protected async fetchSuggestions(queryData: {
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

  protected transformSuggestions(suggestions: RowDataPacket[]): unknown[] {
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

  protected async getTotalCount(queryData: {
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
  protected async insertSuggestion(
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
  protected async fetchCreatedSuggestion(suggestionId: number): Promise<RowDataPacket[]> {
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
  protected async logKvpCreation(
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

  protected async validateUpdatePermission(
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

  protected async buildUpdateQuery(
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

  protected async executeUpdate(
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

  protected async getUpdatedSuggestion(id: number): Promise<unknown> {
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
}

// Export singleton instance
const kvpCoreController = new KvpCoreController();
export default kvpCoreController;
