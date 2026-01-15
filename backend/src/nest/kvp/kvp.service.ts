/**
 * KVP Service - Native NestJS Implementation
 *
 * Business logic for Continuous Improvement Process (Kontinuierlicher Verbesserungsprozess).
 * Fully migrated to NestJS - no dependency on routes/v2/
 */
import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { eventBus } from '../../utils/eventBus.js';
import { dbToApi } from '../../utils/fieldMapping.js';
import { DatabaseService } from '../database/database.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CreateSuggestionDto } from './dto/create-suggestion.dto.js';
import type { ShareSuggestionDto } from './dto/share-suggestion.dto.js';
import type { UpdateSuggestionDto } from './dto/update-suggestion.dto.js';

// ============================================================================
// DATABASE TYPES
// ============================================================================

interface DbCategory {
  id: number;
  tenant_id: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

interface DbSuggestion {
  id: number;
  uuid: string;
  tenant_id: number;
  title: string;
  description: string;
  category_id: number;
  org_level: 'company' | 'department' | 'area' | 'team';
  org_id: number;
  is_shared: boolean;
  submitted_by: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  expected_benefit?: string;
  estimated_cost?: string;
  status: string;
  assigned_to?: number;
  actual_savings?: number;
  rejection_reason?: string;
  created_at: Date;
  updated_at: Date;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  department_name?: string;
  team_name?: string;
  submitted_by_name?: string;
  submitted_by_lastname?: string;
  assigned_to_name?: string;
  assigned_to_lastname?: string;
  attachment_count?: number;
  comment_count?: number;
}

interface DbComment {
  id: number;
  suggestion_id: number;
  user_id: number;
  comment: string;
  is_internal: boolean;
  created_at: Date;
  first_name?: string;
  last_name?: string;
  role?: string;
  profile_picture?: string | null;
}

interface DbAttachment {
  id: number;
  file_uuid: string;
  suggestion_id: number;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: number;
  uploaded_at: Date | null; // Can be NULL in database
}

interface DbDashboardStats {
  total_suggestions: number;
  new_suggestions: number;
  in_progress_count: number;
  implemented: number;
  rejected: number;
  avg_savings: number | null;
}

interface UserOrgInfo {
  team_id: number | null;
  department_id: number | null;
  area_id: number | null;
}

// ============================================================================
// API TYPES
// ============================================================================

export interface Category {
  id: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface KVPSuggestionResponse {
  id: number;
  uuid: string;
  title: string;
  description: string;
  categoryId: number;
  orgLevel: string;
  orgId: number;
  isShared: boolean;
  submittedBy: number;
  status: string;
  priority: string;
  expectedBenefit?: string;
  estimatedCost?: string;
  actualSavings?: number;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  category?: {
    id: number;
    name: string;
    color?: string;
    icon?: string;
  };
  submitter?: {
    firstName: string;
    lastName: string;
  };
}

export interface KVPComment {
  id: number;
  suggestionId: number;
  comment: string;
  isInternal: boolean;
  createdBy: number;
  createdByName?: string;
  createdByLastname?: string;
  profilePicture?: string | null;
  createdAt: string;
}

export interface KVPAttachment {
  id: number;
  suggestionId: number;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  uploadedBy: number;
  fileUuid: string;
  createdAt: string;
}

export interface DashboardStats {
  totalSuggestions: number;
  newSuggestions: number;
  inReviewSuggestions: number;
  approvedSuggestions: number;
  implementedSuggestions: number;
  rejectedSuggestions: number;
}

export interface PaginatedSuggestionsResult {
  suggestions: KVPSuggestionResponse[];
  pagination: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
  };
}

export interface SuggestionFilters {
  status: string | undefined;
  categoryId: number | undefined;
  priority: string | undefined;
  orgLevel: string | undefined;
  search: string | undefined;
  page: number | undefined;
  limit: number | undefined;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isUuid(value: string | number): boolean {
  if (typeof value === 'number') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class KvpService {
  private readonly logger = new Logger(KvpService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Get user's organization info for visibility checks
   */
  private async getUserOrgInfo(userId: number, tenantId: number): Promise<UserOrgInfo> {
    const query = `
      SELECT ut.team_id, ud.department_id, d.area_id
      FROM users u
      LEFT JOIN user_teams ut ON u.id = ut.user_id AND ut.tenant_id = u.tenant_id
      LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
      LEFT JOIN departments d ON ud.department_id = d.id AND d.tenant_id = u.tenant_id
      WHERE u.id = $1 AND u.tenant_id = $2
    `;

    const rows = await this.db.query<UserOrgInfo>(query, [userId, tenantId]);
    return rows[0] ?? { team_id: null, department_id: null, area_id: null };
  }

  /**
   * Transform database suggestion to API format
   */
  private transformSuggestion(suggestion: DbSuggestion): KVPSuggestionResponse {
    const base = dbToApi(
      suggestion as unknown as Record<string, unknown>,
    ) as unknown as KVPSuggestionResponse;

    // Add nested objects
    if (suggestion.category_name !== undefined) {
      const category: { id: number; name: string; color?: string; icon?: string } = {
        id: suggestion.category_id,
        name: suggestion.category_name,
      };
      if (suggestion.category_color !== undefined) category.color = suggestion.category_color;
      if (suggestion.category_icon !== undefined) category.icon = suggestion.category_icon;
      base.category = category;
    }

    if (suggestion.submitted_by_name !== undefined) {
      base.submitter = {
        firstName: suggestion.submitted_by_name,
        lastName: suggestion.submitted_by_lastname ?? '',
      };
    }

    return base;
  }

  // ==========================================================================
  // CATEGORIES
  // ==========================================================================

  /**
   * Get KVP categories
   */
  async getCategories(_tenantId: number): Promise<Category[]> {
    this.logger.log('Getting categories');

    const rows = await this.db.query<DbCategory>('SELECT * FROM kvp_categories ORDER BY name ASC');

    return rows.map((row: DbCategory) =>
      dbToApi(row as unknown as Record<string, unknown>),
    ) as unknown as Category[];
  }

  // ==========================================================================
  // DASHBOARD
  // ==========================================================================

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(tenantId: number): Promise<DashboardStats> {
    this.logger.log(`Getting dashboard stats for tenant ${tenantId}`);

    const query = `
      SELECT
        COUNT(*) as total_suggestions,
        COUNT(CASE WHEN status = 'new' THEN 1 END) as new_suggestions,
        COUNT(CASE WHEN status = 'in_review' THEN 1 END) as in_progress_count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'implemented' THEN 1 END) as implemented,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
      FROM kvp_suggestions
      WHERE tenant_id = $1
    `;

    const rows = await this.db.query<DbDashboardStats & { approved: number }>(query, [tenantId]);
    const stats = rows[0];

    if (stats === undefined) {
      return {
        totalSuggestions: 0,
        newSuggestions: 0,
        inReviewSuggestions: 0,
        approvedSuggestions: 0,
        implementedSuggestions: 0,
        rejectedSuggestions: 0,
      };
    }

    return {
      totalSuggestions: stats.total_suggestions,
      newSuggestions: stats.new_suggestions,
      inReviewSuggestions: stats.in_progress_count,
      approvedSuggestions: stats.approved,
      implementedSuggestions: stats.implemented,
      rejectedSuggestions: stats.rejected,
    };
  }

  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================

  /** Base query for suggestion listing */
  private readonly SUGGESTION_LIST_BASE_QUERY = `
    SELECT
      s.*,
      c.name as category_name,
      c.color as category_color,
      c.icon as category_icon,
      COALESCE(d.name, td.name) as department_name,
      t.name as team_name,
      u.first_name as submitted_by_name,
      u.last_name as submitted_by_lastname,
      admin.first_name as assigned_to_name,
      admin.last_name as assigned_to_lastname,
      (SELECT COUNT(*)::integer FROM kvp_attachments WHERE suggestion_id = s.id) as attachment_count,
      (SELECT COUNT(*)::integer FROM kvp_comments WHERE suggestion_id = s.id) as comment_count
    FROM kvp_suggestions s
    LEFT JOIN kvp_categories c ON s.category_id = c.id
    LEFT JOIN departments d ON s.department_id = d.id
    LEFT JOIN teams t ON s.team_id = t.id
    LEFT JOIN departments td ON t.department_id = td.id
    LEFT JOIN users u ON s.submitted_by = u.id
    LEFT JOIN users admin ON s.assigned_to = admin.id
    WHERE s.tenant_id = $1
  `;

  /** Build employee visibility clause */
  private buildEmployeeVisibility(
    orgInfo: UserOrgInfo,
    startIdx: number,
  ): { clause: string; params: unknown[] } {
    const params: unknown[] = [];
    let idx = startIdx;

    let clause = ` AND (
      s.submitted_by = $${idx++}
      OR s.status = 'implemented'
      OR (s.is_shared = TRUE AND (
        s.org_level = 'company'
        ${orgInfo.team_id !== null ? ` OR (s.org_level = 'team' AND s.org_id = $${idx++})` : ''}
        ${orgInfo.department_id !== null ? ` OR (s.org_level = 'department' AND s.org_id = $${idx++})` : ''}
        ${orgInfo.area_id !== null ? ` OR (s.org_level = 'area' AND s.org_id = $${idx++})` : ''}
      ))
    )`;

    if (orgInfo.team_id !== null) params.push(orgInfo.team_id);
    if (orgInfo.department_id !== null) params.push(orgInfo.department_id);
    if (orgInfo.area_id !== null) params.push(orgInfo.area_id);

    return { clause, params };
  }

  /** Build filter conditions */
  private buildFilterConditions(
    filters: SuggestionFilters,
    startIdx: number,
  ): { clause: string; params: unknown[] } {
    let clause = '';
    const params: unknown[] = [];
    let idx = startIdx;

    if (filters.status !== undefined && filters.status !== '') {
      clause += ` AND s.status = $${idx++}`;
      params.push(filters.status);
    }
    if (filters.categoryId !== undefined) {
      clause += ` AND s.category_id = $${idx++}`;
      params.push(filters.categoryId);
    }
    if (filters.priority !== undefined && filters.priority !== '') {
      clause += ` AND s.priority = $${idx++}`;
      params.push(filters.priority);
    }
    if (filters.orgLevel !== undefined && filters.orgLevel !== '') {
      clause += ` AND s.org_level = $${idx++}`;
      params.push(filters.orgLevel);
    }
    if (filters.search !== undefined && filters.search !== '') {
      clause += ` AND (s.title ILIKE $${idx} OR s.description ILIKE $${idx})`;
      idx++;
      params.push(`%${filters.search}%`);
    }

    return { clause, params };
  }

  /**
   * List suggestions with filters and pagination
   */
  async listSuggestions(
    tenantId: number,
    userId: number,
    userRole: string,
    filters: SuggestionFilters,
  ): Promise<PaginatedSuggestionsResult> {
    this.logger.log(`Listing suggestions for tenant ${tenantId}, user ${userId}`);

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    let query = this.SUGGESTION_LIST_BASE_QUERY;
    const params: unknown[] = [tenantId];

    // Apply visibility restrictions for employees
    if (userRole === 'employee') {
      const orgInfo = await this.getUserOrgInfo(userId, tenantId);
      params.push(userId);
      const visibility = this.buildEmployeeVisibility(orgInfo, params.length + 1);
      query += visibility.clause;
      params.push(...visibility.params);
    }

    // Apply filters
    const filterResult = this.buildFilterConditions(filters, params.length + 1);
    query += filterResult.clause;
    params.push(...filterResult.params);

    // Get total count
    const countQuery = query.replace(
      /SELECT\s+s\.\*[\s\S]*?FROM kvp_suggestions s/i,
      'SELECT COUNT(*) as total FROM kvp_suggestions s',
    );
    const countRows = await this.db.query<{ total: number }>(countQuery, params);
    const total = countRows[0]?.total ?? 0;

    // Add sorting and pagination
    query += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const suggestions = await this.db.query<DbSuggestion>(query, params);

    return {
      suggestions: suggestions.map((s: DbSuggestion) => this.transformSuggestion(s)),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        pageSize: limit,
        totalItems: total,
      },
    };
  }

  /** Base query for single suggestion */
  private readonly SUGGESTION_DETAIL_BASE_QUERY = `
    SELECT
      s.*,
      c.name as category_name,
      c.color as category_color,
      c.icon as category_icon,
      COALESCE(d.name, td.name) as department_name,
      t.name as team_name,
      u.first_name as submitted_by_name,
      u.last_name as submitted_by_lastname,
      admin.first_name as assigned_to_name,
      admin.last_name as assigned_to_lastname
    FROM kvp_suggestions s
    LEFT JOIN kvp_categories c ON s.category_id = c.id
    LEFT JOIN departments d ON s.department_id = d.id
    LEFT JOIN teams t ON s.team_id = t.id
    LEFT JOIN departments td ON t.department_id = td.id
    LEFT JOIN users u ON s.submitted_by = u.id
    LEFT JOIN users admin ON s.assigned_to = admin.id
  `;

  /**
   * Get suggestion by ID (numeric or UUID)
   */
  async getSuggestionById(
    id: number | string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<KVPSuggestionResponse> {
    this.logger.log(`Getting suggestion ${String(id)} for tenant ${tenantId}`);

    const idColumn = isUuid(id) ? 'uuid' : 'id';
    let query = `${this.SUGGESTION_DETAIL_BASE_QUERY} WHERE s.${idColumn} = $1 AND s.tenant_id = $2`;
    const params: unknown[] = [id, tenantId];

    // Apply visibility restrictions for employees
    if (userRole === 'employee') {
      const orgInfo = await this.getUserOrgInfo(userId, tenantId);
      params.push(userId);
      const visibility = this.buildEmployeeVisibility(orgInfo, params.length + 1);
      query += visibility.clause;
      params.push(...visibility.params);
    }

    const rows = await this.db.query<DbSuggestion>(query, params);
    const suggestion = rows[0];

    if (suggestion === undefined) {
      throw new NotFoundException('Suggestion not found');
    }

    return this.transformSuggestion(suggestion);
  }

  /**
   * Create a new suggestion
   */
  async createSuggestion(
    dto: CreateSuggestionDto,
    tenantId: number,
    userId: number,
  ): Promise<KVPSuggestionResponse> {
    this.logger.log(`Creating suggestion: ${dto.title}`);

    const uuid = uuidv7();
    const teamId = dto.orgLevel === 'team' ? dto.orgId : null;

    const query = `
      INSERT INTO kvp_suggestions
      (uuid, tenant_id, title, description, category_id, department_id, org_level, org_id, is_shared, submitted_by, team_id, priority, expected_benefit, estimated_cost)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, $9, $10, $11, $12, $13)
      RETURNING id
    `;

    const rows = await this.db.query<{ id: number }>(query, [
      uuid,
      tenantId,
      dto.title,
      dto.description,
      dto.categoryId,
      dto.departmentId ?? null,
      dto.orgLevel,
      dto.orgId,
      userId,
      teamId,
      dto.priority ?? 'normal',
      dto.expectedBenefit ?? null,
      dto.estimatedCost ?? null,
    ]);

    if (rows[0] === undefined) {
      throw new Error('Failed to create suggestion');
    }

    const createdSuggestion = await this.getSuggestionById(rows[0].id, tenantId, userId, 'admin');

    // Emit SSE event for real-time notifications
    eventBus.emitKvpSubmitted(tenantId, {
      id: rows[0].id,
      title: dto.title,
      submitted_by: String(userId),
    });

    // Create persistent notification for ADR-004
    const recipientMapping = this.mapOrgLevelToRecipient(dto);
    void this.notificationsService.createFeatureNotification(
      'kvp',
      rows[0].id,
      `Neuer Verbesserungsvorschlag: ${dto.title}`,
      dto.description.substring(0, 100) + (dto.description.length > 100 ? '...' : ''),
      recipientMapping.type,
      recipientMapping.id,
      tenantId,
      userId,
    );

    return createdSuggestion;
  }

  /**
   * Map organization level to notification recipient
   */
  private mapOrgLevelToRecipient(dto: CreateSuggestionDto): {
    type: 'user' | 'department' | 'team' | 'all';
    id: number | null;
  } {
    switch (dto.orgLevel) {
      case 'team':
        return { type: 'team', id: dto.orgId };
      case 'department':
        return { type: 'department', id: dto.departmentId ?? dto.orgId };
      case 'area':
        // Area-level suggestions go to department if specified, otherwise company-wide
        return dto.departmentId !== undefined && dto.departmentId !== null ?
            { type: 'department', id: dto.departmentId }
          : { type: 'all', id: null };
      case 'company':
      default:
        return { type: 'all', id: null };
    }
  }

  /** Build suggestion update clause from DTO */
  private buildSuggestionUpdateClause(
    dto: UpdateSuggestionDto,
    assignedTo?: number,
  ): { updates: string[]; params: unknown[] } {
    const updates: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    const addField = (value: unknown, column: string): void => {
      if (value !== undefined) {
        params.push(value);
        updates.push(`${column} = $${params.length}`);
      }
    };

    addField(dto.title, 'title');
    addField(dto.description, 'description');
    addField(dto.categoryId, 'category_id');
    addField(dto.priority, 'priority');
    addField(dto.expectedBenefit, 'expected_benefit');
    addField(dto.estimatedCost, 'estimated_cost');
    addField(dto.actualSavings, 'actual_savings');
    addField(dto.rejectionReason, 'rejection_reason');

    if (dto.status !== undefined) {
      addField(dto.status, 'status');
      addField(assignedTo, 'assigned_to');
    }

    return { updates, params };
  }

  /**
   * Update a suggestion
   */
  async updateSuggestion(
    id: number | string,
    dto: UpdateSuggestionDto,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<KVPSuggestionResponse> {
    this.logger.log(`Updating suggestion ${String(id)}`);

    const existing = await this.getSuggestionById(id, tenantId, userId, userRole);

    if (userRole === 'employee' && existing.submittedBy !== userId) {
      throw new ForbiddenException('You can only update your own suggestions');
    }
    if (dto.status !== undefined && userRole !== 'admin' && userRole !== 'root') {
      throw new ForbiddenException('Only admins can update status');
    }

    const idColumn = isUuid(id) ? 'uuid' : 'id';
    const { updates, params } = this.buildSuggestionUpdateClause(dto, userId);

    params.push(id, tenantId);
    const query = `UPDATE kvp_suggestions SET ${updates.join(', ')} WHERE ${idColumn} = $${params.length - 1} AND tenant_id = $${params.length}`;
    await this.db.query(query, params);

    return await this.getSuggestionById(id, tenantId, userId, userRole);
  }

  /**
   * Delete a suggestion
   */
  async deleteSuggestion(
    id: number | string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<{ message: string }> {
    this.logger.log(`Deleting suggestion ${String(id)}`);

    const suggestion = await this.getSuggestionById(id, tenantId, userId, userRole);

    if (suggestion.submittedBy !== userId && userRole !== 'root') {
      throw new ForbiddenException('You can only delete your own suggestions');
    }

    const idColumn = isUuid(id) ? 'uuid' : 'id';
    await this.db.query(`DELETE FROM kvp_suggestions WHERE ${idColumn} = $1 AND tenant_id = $2`, [
      id,
      tenantId,
    ]);

    return { message: 'Suggestion deleted successfully' };
  }

  /**
   * Share a suggestion
   */
  async shareSuggestion(
    id: number | string,
    dto: ShareSuggestionDto,
    tenantId: number,
    userId: number,
    _userRole: string,
  ): Promise<{ message: string }> {
    this.logger.log(`Sharing suggestion ${String(id)} at ${dto.orgLevel} level`);

    const idColumn = isUuid(id) ? 'uuid' : 'id';
    await this.db.query(
      `UPDATE kvp_suggestions
       SET org_level = $1, org_id = $2, is_shared = TRUE, shared_by = $3, shared_at = NOW(), updated_at = NOW()
       WHERE ${idColumn} = $4 AND tenant_id = $5`,
      [dto.orgLevel, dto.orgId, userId, id, tenantId],
    );

    return { message: 'Suggestion shared successfully' };
  }

  /**
   * Unshare a suggestion
   */
  async unshareSuggestion(
    id: number | string,
    tenantId: number,
    userId: number,
    _userRole: string,
  ): Promise<{ message: string }> {
    this.logger.log(`Unsharing suggestion ${String(id)}`);

    const idColumn = isUuid(id) ? 'uuid' : 'id';

    // Get user's team for resetting
    const orgInfo = await this.getUserOrgInfo(userId, tenantId);
    const teamId = orgInfo.team_id ?? 0;

    await this.db.query(
      `UPDATE kvp_suggestions
       SET org_level = 'team', org_id = $1, is_shared = FALSE, shared_by = NULL, shared_at = NULL, updated_at = NOW()
       WHERE ${idColumn} = $2 AND tenant_id = $3`,
      [teamId, id, tenantId],
    );

    return { message: 'Suggestion unshared successfully' };
  }

  // ==========================================================================
  // COMMENTS
  // ==========================================================================

  /**
   * Get comments for a suggestion
   */
  async getComments(
    id: number | string,
    tenantId: number,
    _userId: number,
    userRole: string,
  ): Promise<KVPComment[]> {
    this.logger.log(`Getting comments for suggestion ${String(id)}`);

    // Get numeric ID
    const suggestion = await this.getSuggestionById(id, tenantId, _userId, userRole);
    const numericId = suggestion.id;

    let query = `
      SELECT c.*, u.first_name, u.last_name, u.role, u.profile_picture
      FROM kvp_comments c
      JOIN kvp_suggestions s ON c.suggestion_id = s.id
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.suggestion_id = $1 AND s.tenant_id = $2
    `;

    if (userRole === 'employee') {
      query += ' AND c.is_internal = FALSE';
    }

    query += ' ORDER BY c.created_at ASC';

    const rows = await this.db.query<DbComment>(query, [numericId, tenantId]);

    return rows.map((row: DbComment) => {
      const comment: KVPComment = {
        id: row.id,
        suggestionId: row.suggestion_id,
        comment: row.comment,
        isInternal: row.is_internal,
        createdBy: row.user_id,
        createdAt: row.created_at.toISOString(),
      };
      if (row.first_name !== undefined) comment.createdByName = row.first_name;
      if (row.last_name !== undefined) comment.createdByLastname = row.last_name;
      if (row.profile_picture !== undefined) comment.profilePicture = row.profile_picture;
      return comment;
    });
  }

  /**
   * Add a comment
   */
  async addComment(
    id: number | string,
    userId: number,
    tenantId: number,
    comment: string,
    isInternal: boolean,
    userRole: string,
  ): Promise<KVPComment> {
    this.logger.log(`Adding comment to suggestion ${String(id)}`);

    // Get numeric ID
    const suggestion = await this.getSuggestionById(id, tenantId, userId, userRole);
    const numericId = suggestion.id;

    // Only admins can add internal comments
    const actualIsInternal = isInternal && (userRole === 'admin' || userRole === 'root');

    const rows = await this.db.query<{ id: number }>(
      `INSERT INTO kvp_comments (tenant_id, suggestion_id, user_id, comment, is_internal)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [tenantId, numericId, userId, comment, actualIsInternal],
    );

    if (rows[0] === undefined) {
      throw new Error('Failed to add comment');
    }

    return {
      id: rows[0].id,
      suggestionId: numericId,
      comment,
      isInternal: actualIsInternal,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // ATTACHMENTS
  // ==========================================================================

  /**
   * Get attachments for a suggestion
   */
  async getAttachments(
    id: number | string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<KVPAttachment[]> {
    this.logger.log(`Getting attachments for suggestion ${String(id)}`);

    // Get numeric ID
    const suggestion = await this.getSuggestionById(id, tenantId, userId, userRole);
    const numericId = suggestion.id;

    const rows = await this.db.query<DbAttachment>(
      `SELECT a.*, u.first_name, u.last_name
       FROM kvp_attachments a
       JOIN kvp_suggestions s ON a.suggestion_id = s.id
       LEFT JOIN users u ON a.uploaded_by = u.id
       WHERE a.suggestion_id = $1 AND s.tenant_id = $2
       ORDER BY a.uploaded_at DESC`,
      [numericId, tenantId],
    );

    return rows.map((row: DbAttachment) => ({
      id: row.id,
      suggestionId: row.suggestion_id,
      fileName: row.file_name,
      filePath: row.file_path,
      fileType: row.file_type,
      fileSize: row.file_size,
      uploadedBy: row.uploaded_by,
      fileUuid: row.file_uuid,
      createdAt:
        row.uploaded_at !== null ? row.uploaded_at.toISOString() : new Date().toISOString(),
    }));
  }

  /**
   * Add attachment to a suggestion
   */
  async addAttachment(
    suggestionId: number | string,
    attachmentData: {
      fileName: string;
      filePath: string;
      fileType: string;
      fileSize: number;
      uploadedBy: number;
      fileUuid: string;
      fileChecksum?: string;
    },
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<KVPAttachment> {
    this.logger.log(`Adding attachment to suggestion ${String(suggestionId)}`);

    // Get numeric ID
    const suggestion = await this.getSuggestionById(suggestionId, tenantId, userId, userRole);
    const numericId = suggestion.id;

    const rows = await this.db.query<{ id: number }>(
      `INSERT INTO kvp_attachments
       (file_uuid, suggestion_id, file_name, file_path, file_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        attachmentData.fileUuid,
        numericId,
        attachmentData.fileName,
        attachmentData.filePath,
        attachmentData.fileType,
        attachmentData.fileSize,
        attachmentData.uploadedBy,
      ],
    );

    if (rows[0] === undefined) {
      throw new Error('Failed to add attachment');
    }

    return {
      id: rows[0].id,
      suggestionId: numericId,
      fileName: attachmentData.fileName,
      filePath: attachmentData.filePath,
      fileType: attachmentData.fileType,
      fileSize: attachmentData.fileSize,
      uploadedBy: attachmentData.uploadedBy,
      fileUuid: attachmentData.fileUuid,
      createdAt: new Date().toISOString(),
    };
  }

  /** Check if user has org-level access to a suggestion */
  private hasOrgAccess(orgLevel: string, orgId: number, orgInfo: UserOrgInfo): boolean {
    if (orgLevel === 'company') return true;
    if (orgLevel === 'team') return orgInfo.team_id === orgId;
    if (orgLevel === 'department') return orgInfo.department_id === orgId;
    if (orgLevel === 'area') return orgInfo.area_id === orgId;
    return false;
  }

  /**
   * Get attachment by file UUID for download
   */
  async getAttachment(
    fileUuid: string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<{ filePath: string; fileName: string }> {
    this.logger.log(`Getting attachment by UUID ${fileUuid}`);

    const rows = await this.db.query<
      DbAttachment & { submitted_by: number; status: string; org_level: string; org_id: number }
    >(
      `SELECT a.*, s.submitted_by, s.tenant_id, s.org_level, s.org_id, s.status
       FROM kvp_attachments a
       JOIN kvp_suggestions s ON a.suggestion_id = s.id
       WHERE a.file_uuid = $1 AND s.tenant_id = $2`,
      [fileUuid, tenantId],
    );

    const attachment = rows[0];
    if (attachment === undefined) {
      throw new NotFoundException('Attachment not found');
    }

    // Admins/root always have access
    const isAdmin = userRole === 'admin' || userRole === 'root';
    const isOwner = attachment.submitted_by === userId;
    const isPublic = attachment.status === 'implemented';

    if (!isAdmin && !isOwner && !isPublic) {
      const orgInfo = await this.getUserOrgInfo(userId, tenantId);
      if (!this.hasOrgAccess(attachment.org_level, attachment.org_id, orgInfo)) {
        throw new ForbiddenException('No access to this attachment');
      }
    }

    return { filePath: attachment.file_path, fileName: attachment.file_name };
  }
}
