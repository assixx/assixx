/**
 * KVP Service - Native NestJS Implementation
 *
 * Business logic for Continuous Improvement Process (Kontinuierlicher Verbesserungsprozess).
 * Fully migrated to NestJS - no dependency on routes/v2/
 */
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { eventBus } from '../../utils/eventBus.js';
import { dbToApi } from '../../utils/fieldMapping.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CreateSuggestionDto } from './dto/create-suggestion.dto.js';
import type { ShareSuggestionDto } from './dto/share-suggestion.dto.js';
import type { UpdateSuggestionDto } from './dto/update-suggestion.dto.js';
import type {
  Category,
  DashboardStats,
  DbAttachment,
  DbCategory,
  DbComment,
  DbDashboardStats,
  DbSuggestion,
  ExtendedUserOrgInfo,
  KVPAttachment,
  KVPComment,
  KVPSuggestionResponse,
  PaginatedSuggestionsResult,
  SuggestionFilters,
} from './kvp.types.js';

// Re-export API types for controller
export type {
  Category,
  DashboardStats,
  KVPAttachment,
  KVPComment,
  KVPSuggestionResponse,
  PaginatedSuggestionsResult,
} from './kvp.types.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const ERROR_SUGGESTION_NOT_FOUND = 'Suggestion not found';

/** DB result interface for extended org info query */
interface DbExtendedOrgInfo {
  has_full_access: boolean;
  team_ids: number[];
  department_ids: number[];
  area_ids: number[];
  team_lead_of: number[];
  department_lead_of: number[];
  area_lead_of: number[];
  teams_department_ids: number[];
  departments_area_ids: number[];
}

/**
 * SQL query to get all user org info in one query
 * SECURITY: Only returns data for ACTIVE users (is_active = 1)
 */
const EXTENDED_ORG_INFO_QUERY = `
  WITH user_data AS (
    SELECT has_full_access FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = 1
  ),
  user_team_ids AS (
    SELECT DISTINCT team_id FROM user_teams WHERE user_id = $1 AND tenant_id = $2
  ),
  user_dept_ids AS (
    SELECT DISTINCT department_id FROM user_departments WHERE user_id = $1 AND tenant_id = $2
  ),
  team_lead_ids AS (
    SELECT DISTINCT id FROM teams WHERE team_lead_id = $1 AND tenant_id = $2
  ),
  dept_lead_ids AS (
    SELECT DISTINCT id FROM departments WHERE department_lead_id = $1 AND tenant_id = $2
  ),
  area_lead_ids AS (
    SELECT DISTINCT id FROM areas WHERE area_lead_id = $1 AND tenant_id = $2
  ),
  teams_dept_ids AS (
    SELECT DISTINCT t.department_id FROM teams t
    JOIN user_team_ids ut ON t.id = ut.team_id WHERE t.department_id IS NOT NULL
  ),
  depts_area_ids AS (
    SELECT DISTINCT d.area_id FROM departments d
    WHERE d.id IN (SELECT department_id FROM user_dept_ids) AND d.area_id IS NOT NULL
    UNION
    SELECT DISTINCT d.area_id FROM departments d
    WHERE d.id IN (SELECT department_id FROM teams_dept_ids) AND d.area_id IS NOT NULL
  )
  SELECT
    (SELECT COALESCE(has_full_access, false) FROM user_data) as has_full_access,
    COALESCE(ARRAY(SELECT team_id FROM user_team_ids), '{}') as team_ids,
    COALESCE(ARRAY(SELECT department_id FROM user_dept_ids), '{}') as department_ids,
    COALESCE(ARRAY(SELECT area_id FROM depts_area_ids), '{}') as area_ids,
    COALESCE(ARRAY(SELECT id FROM team_lead_ids), '{}') as team_lead_of,
    COALESCE(ARRAY(SELECT id FROM dept_lead_ids), '{}') as department_lead_of,
    COALESCE(ARRAY(SELECT id FROM area_lead_ids), '{}') as area_lead_of,
    COALESCE(ARRAY(SELECT department_id FROM teams_dept_ids), '{}') as teams_department_ids,
    COALESCE(ARRAY(SELECT area_id FROM depts_area_ids), '{}') as departments_area_ids
`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isUuid(value: string | number): boolean {
  if (typeof value === 'number') return false;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /** DB result type for extended org info query */
  private static readonly EMPTY_ORG_INFO: ExtendedUserOrgInfo = {
    teamIds: [],
    departmentIds: [],
    areaIds: [],
    teamLeadOf: [],
    departmentLeadOf: [],
    areaLeadOf: [],
    teamsDepartmentIds: [],
    departmentsAreaIds: [],
    hasFullAccess: false,
  };

  /**
   * Get extended user organization info for KVP visibility checks.
   * Collects memberships, lead positions, and inheritance chains.
   * @see /docs/kvp-share-doc.md
   */
  private async getExtendedUserOrgInfo(
    userId: number,
    tenantId: number,
  ): Promise<ExtendedUserOrgInfo> {
    const rows = await this.db.query<DbExtendedOrgInfo>(
      EXTENDED_ORG_INFO_QUERY,
      [userId, tenantId],
    );
    const row = rows[0];
    if (row === undefined) return KvpService.EMPTY_ORG_INFO;

    return {
      teamIds: row.team_ids,
      departmentIds: row.department_ids,
      areaIds: row.area_ids,
      teamLeadOf: row.team_lead_of,
      departmentLeadOf: row.department_lead_of,
      areaLeadOf: row.area_lead_of,
      teamsDepartmentIds: row.teams_department_ids,
      departmentsAreaIds: row.departments_area_ids,
      hasFullAccess: row.has_full_access,
    };
  }

  /**
   * Build visibility clause for KVP queries
   *
   * Implements the 4-tier visibility model:
   * - Stufe 1: Team (creator, team members, team lead)
   * - Stufe 2: Department (+ dept members via teams, dept lead)
   * - Stufe 3: Area (+ area members via depts, area lead)
   * - Stufe 4: Company (all users in tenant)
   *
   * @param orgInfo - Extended user org info
   * @param userId - User ID for submitted_by check
   * @param startIdx - Starting parameter index
   * @returns SQL clause and parameters
   */
  private buildVisibilityClause(
    orgInfo: ExtendedUserOrgInfo,
    userId: number,
    startIdx: number,
  ): { clause: string; params: unknown[] } {
    // If user has full access, no visibility restrictions
    if (orgInfo.hasFullAccess) {
      return { clause: '', params: [] };
    }

    const params: unknown[] = [];
    let idx = startIdx;

    // Build arrays for ANY() comparisons
    const teamIdsParam = `$${idx++}`;
    params.push(orgInfo.teamIds.length > 0 ? orgInfo.teamIds : [0]); // [0] = no match

    const teamLeadOfParam = `$${idx++}`;
    params.push(orgInfo.teamLeadOf.length > 0 ? orgInfo.teamLeadOf : [0]);

    const deptIdsParam = `$${idx++}`;
    params.push(orgInfo.departmentIds.length > 0 ? orgInfo.departmentIds : [0]);

    const teamsDeptIdsParam = `$${idx++}`;
    params.push(
      orgInfo.teamsDepartmentIds.length > 0 ? orgInfo.teamsDepartmentIds : [0],
    );

    const deptLeadOfParam = `$${idx++}`;
    params.push(
      orgInfo.departmentLeadOf.length > 0 ? orgInfo.departmentLeadOf : [0],
    );

    const areaIdsParam = `$${idx++}`;
    params.push(orgInfo.areaIds.length > 0 ? orgInfo.areaIds : [0]);

    const deptsAreaIdsParam = `$${idx++}`;
    params.push(
      orgInfo.departmentsAreaIds.length > 0 ? orgInfo.departmentsAreaIds : [0],
    );

    const areaLeadOfParam = `$${idx++}`;
    params.push(orgInfo.areaLeadOf.length > 0 ? orgInfo.areaLeadOf : [0]);

    const userIdParam = `$${idx++}`;
    params.push(userId);

    const clause = ` AND (
      -- Own suggestions (always visible)
      s.submitted_by = ${userIdParam}

      -- Implemented = public within tenant
      OR s.status = 'implemented'

      -- STUFE 1: Team-weit
      OR (s.org_level = 'team' AND (
        s.org_id = ANY(${teamIdsParam})
        OR s.org_id = ANY(${teamLeadOfParam})
      ))

      -- STUFE 2: Department-weit (mit Vererbung)
      OR (s.org_level = 'department' AND (
        s.org_id = ANY(${deptIdsParam})
        OR s.org_id = ANY(${teamsDeptIdsParam})
        OR s.org_id = ANY(${deptLeadOfParam})
      ))

      -- STUFE 3: Area-weit (mit Vererbung)
      OR (s.org_level = 'area' AND (
        s.org_id = ANY(${areaIdsParam})
        OR s.org_id = ANY(${deptsAreaIdsParam})
        OR s.org_id = ANY(${areaLeadOfParam})
      ))

      -- STUFE 4: Firmenweit
      OR s.org_level = 'company'
    )`;

    return { clause, params };
  }

  /**
   * Transform database suggestion to API format
   */
  private transformSuggestion(suggestion: DbSuggestion): KVPSuggestionResponse {
    const base = dbToApi(
      suggestion as unknown as Record<string, unknown>,
    ) as unknown as KVPSuggestionResponse;

    // Add category object if present
    this.attachCategoryIfPresent(base, suggestion);
    // Add submitter object if present
    this.attachSubmitterIfPresent(base, suggestion);
    // Add read confirmation status (Pattern 2: Individual tracking)
    this.attachConfirmationStatus(base, suggestion);

    return base;
  }

  /** Helper: Attach category object to response */
  private attachCategoryIfPresent(
    base: KVPSuggestionResponse,
    suggestion: DbSuggestion,
  ): void {
    if (suggestion.category_name === undefined) return;
    const category: {
      id: number;
      name: string;
      color?: string;
      icon?: string;
    } = {
      id: suggestion.category_id,
      name: suggestion.category_name,
    };
    if (suggestion.category_color !== undefined)
      category.color = suggestion.category_color;
    if (suggestion.category_icon !== undefined)
      category.icon = suggestion.category_icon;
    base.category = category;
  }

  /** Helper: Attach submitter object to response */
  private attachSubmitterIfPresent(
    base: KVPSuggestionResponse,
    suggestion: DbSuggestion,
  ): void {
    if (suggestion.submitted_by_name === undefined) return;
    base.submitter = {
      firstName: suggestion.submitted_by_name,
      lastName: suggestion.submitted_by_lastname ?? '',
    };
  }

  /** Helper: Attach read confirmation status to response */
  private attachConfirmationStatus(
    base: KVPSuggestionResponse,
    suggestion: DbSuggestion,
  ): void {
    // COALESCE(is_confirmed, false) ensures boolean, never null
    if (suggestion.is_confirmed !== undefined) {
      base.isConfirmed = suggestion.is_confirmed;
    }
    // Timestamps can be null from LEFT JOIN
    if (
      suggestion.confirmed_at !== undefined &&
      suggestion.confirmed_at !== null
    ) {
      base.confirmedAt = new Date(suggestion.confirmed_at).toISOString();
    }
    // firstSeenAt: only set if user has seen it (undefined = "Neu" badge)
    if (
      suggestion.first_seen_at !== undefined &&
      suggestion.first_seen_at !== null
    ) {
      base.firstSeenAt = new Date(suggestion.first_seen_at).toISOString();
    }
  }

  // ==========================================================================
  // CATEGORIES
  // ==========================================================================

  /**
   * Get KVP categories
   */
  async getCategories(_tenantId: number): Promise<Category[]> {
    this.logger.debug('Getting categories');

    const rows = await this.db.query<DbCategory>(
      'SELECT * FROM kvp_categories ORDER BY name ASC',
    );

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
    this.logger.debug(`Getting dashboard stats for tenant ${tenantId}`);

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

    const rows = await this.db.query<DbDashboardStats & { approved: number }>(
      query,
      [tenantId],
    );
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

  /**
   * Build base query for suggestion listing with confirmation status
   * @param userIdPlaceholder - PostgreSQL placeholder for userId (e.g., '$2')
   */
  private buildListBaseQuery(userIdPlaceholder: string): string {
    return `
    SELECT
      s.*,
      c.name as category_name,
      c.color as category_color,
      c.icon as category_icon,
      COALESCE(d.name, td.name) as department_name,
      t.name as team_name,
      a.name as area_name,
      u.first_name as submitted_by_name,
      u.last_name as submitted_by_lastname,
      admin.first_name as assigned_to_name,
      admin.last_name as assigned_to_lastname,
      (SELECT COUNT(*)::integer FROM kvp_attachments WHERE suggestion_id = s.id) as attachment_count,
      (SELECT COUNT(*)::integer FROM kvp_comments WHERE suggestion_id = s.id) as comment_count,
      COALESCE(kc.is_confirmed, false) as is_confirmed,
      kc.confirmed_at,
      kc.first_seen_at
    FROM kvp_suggestions s
    LEFT JOIN kvp_categories c ON s.category_id = c.id
    LEFT JOIN departments d ON s.department_id = d.id
    LEFT JOIN teams t ON s.team_id = t.id
    LEFT JOIN departments td ON t.department_id = td.id
    LEFT JOIN areas a ON s.org_level = 'area' AND s.org_id = a.id
    LEFT JOIN users u ON s.submitted_by = u.id
    LEFT JOIN users admin ON s.assigned_to = admin.id
    LEFT JOIN kvp_confirmations kc ON s.id = kc.suggestion_id AND kc.user_id = ${userIdPlaceholder} AND kc.tenant_id = s.tenant_id
    WHERE s.tenant_id = $1
  `;
  }

  /** Build status filter clause (archived excluded by default) */
  private buildStatusFilter(
    status: string | undefined,
    idx: number,
  ): { clause: string; param: string | null; nextIdx: number } {
    if (status === 'archived') {
      return {
        clause: ` AND s.status = 'archived'`,
        param: null,
        nextIdx: idx,
      };
    }
    if (status !== undefined && status !== '') {
      return {
        clause: ` AND s.status = $${idx}`,
        param: status,
        nextIdx: idx + 1,
      };
    }
    return { clause: ` AND s.status != 'archived'`, param: null, nextIdx: idx };
  }

  /** Build filter conditions */
  private buildFilterConditions(
    filters: SuggestionFilters,
    startIdx: number,
  ): { clause: string; params: unknown[] } {
    let clause = '';
    const params: unknown[] = [];
    let idx = startIdx;

    // Status filter: if 'archived' show only archived, otherwise EXCLUDE archived
    const statusResult = this.buildStatusFilter(filters.status, idx);
    clause += statusResult.clause;
    if (statusResult.param !== null) params.push(statusResult.param);
    idx = statusResult.nextIdx;

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
    this.logger.debug(
      `Listing suggestions for tenant ${tenantId}, user ${userId}`,
    );

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    // Build query with confirmation JOIN ($1=tenantId, $2=userId for confirmation)
    let query = this.buildListBaseQuery('$2');
    const params: unknown[] = [tenantId, userId];

    // Apply visibility restrictions for ALL users (not just employees!)
    // Only users with has_full_access=TRUE bypass this
    // See /docs/kvp-share-doc.md for full visibility logic
    const orgInfo = await this.getExtendedUserOrgInfo(userId, tenantId);
    const visibility = this.buildVisibilityClause(
      orgInfo,
      userId,
      params.length + 1,
    );
    query += visibility.clause;
    params.push(...visibility.params);

    // Log for debugging (remove in production)
    this.logger.debug(
      `User ${userId} (role: ${userRole}) visibility: hasFullAccess=${orgInfo.hasFullAccess}`,
    );
    void userRole; // Suppress unused variable warning - kept for logging

    // Apply filters
    const filterResult = this.buildFilterConditions(filters, params.length + 1);
    query += filterResult.clause;
    params.push(...filterResult.params);

    // Apply "mine only" filter
    if (filters.mineOnly === true) {
      query += ` AND s.submitted_by = $${params.length + 1}`;
      params.push(userId);
    }

    // Get total count (strip the confirmation join for count query)
    // Remove userId ($2) from params since confirmation JOIN is stripped
    const countParams = [params[0], ...params.slice(2)];
    const countQuery = query
      .replace(
        /SELECT\s+s\.\*[\s\S]*?FROM kvp_suggestions s/i,
        'SELECT COUNT(*) as total FROM kvp_suggestions s',
      )
      .replace(/LEFT JOIN kvp_confirmations kc[^\n]*/i, '')
      .replace(/,\s*CASE WHEN kc\.id[^\n]*/i, '')
      .replace(/\$(\d+)/g, (_match: string, num: string) => {
        const n = Number.parseInt(num, 10);
        if (n <= 1) return `$${n}`; // $1 (tenantId) stays
        return `$${n - 1}`; // $2→$1, $3→$2, etc. (shift down by 1)
      });
    const countRows = await this.db.query<{ total: number }>(
      countQuery,
      countParams,
    );
    const total = countRows[0]?.total ?? 0;

    // Add sorting and pagination
    query += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const suggestions = await this.db.query<DbSuggestion>(query, params);

    return {
      suggestions: suggestions.map((s: DbSuggestion) =>
        this.transformSuggestion(s),
      ),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        pageSize: limit,
        totalItems: total,
      },
    };
  }

  /**
   * Build base query for single suggestion with confirmation status
   * @param userIdPlaceholder - PostgreSQL placeholder for userId (e.g., '$3')
   */
  private buildDetailBaseQuery(userIdPlaceholder: string): string {
    return `
    SELECT
      s.*,
      c.name as category_name,
      c.color as category_color,
      c.icon as category_icon,
      COALESCE(d.name, td.name) as department_name,
      t.name as team_name,
      a.name as area_name,
      u.first_name as submitted_by_name,
      u.last_name as submitted_by_lastname,
      admin.first_name as assigned_to_name,
      admin.last_name as assigned_to_lastname,
      COALESCE(kc.is_confirmed, false) as is_confirmed,
      kc.confirmed_at,
      kc.first_seen_at
    FROM kvp_suggestions s
    LEFT JOIN kvp_categories c ON s.category_id = c.id
    LEFT JOIN departments d ON s.department_id = d.id
    LEFT JOIN teams t ON s.team_id = t.id
    LEFT JOIN departments td ON t.department_id = td.id
    LEFT JOIN areas a ON s.org_level = 'area' AND s.org_id = a.id
    LEFT JOIN users u ON s.submitted_by = u.id
    LEFT JOIN users admin ON s.assigned_to = admin.id
    LEFT JOIN kvp_confirmations kc ON s.id = kc.suggestion_id AND kc.user_id = ${userIdPlaceholder} AND kc.tenant_id = s.tenant_id
  `;
  }

  /**
   * Get suggestion by ID (numeric or UUID)
   */
  async getSuggestionById(
    id: number | string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<KVPSuggestionResponse> {
    this.logger.debug(
      `Getting suggestion ${String(id)} for tenant ${tenantId}`,
    );

    const idColumn = isUuid(id) ? 'uuid' : 'id';
    // $1=id, $2=tenantId, $3=userId for confirmation
    let query = `${this.buildDetailBaseQuery('$3')} WHERE s.${idColumn} = $1 AND s.tenant_id = $2`;
    const params: unknown[] = [id, tenantId, userId];

    // Apply visibility restrictions for ALL users (not just employees!)
    // Only users with has_full_access=TRUE bypass this
    const orgInfo = await this.getExtendedUserOrgInfo(userId, tenantId);
    const visibility = this.buildVisibilityClause(
      orgInfo,
      userId,
      params.length + 1,
    );
    query += visibility.clause;
    params.push(...visibility.params);

    void userRole; // Suppress unused variable warning - kept for API compatibility

    const rows = await this.db.query<DbSuggestion>(query, params);
    const suggestion = rows[0];

    if (suggestion === undefined) {
      throw new NotFoundException(ERROR_SUGGESTION_NOT_FOUND);
    }

    return this.transformSuggestion(suggestion);
  }

  /**
   * Create a new suggestion
   * Rate limit: 1 suggestion per user per day (employees only, admins/root unlimited)
   */
  async createSuggestion(
    dto: CreateSuggestionDto,
    tenantId: number,
    userId: number,
    userRole: string = 'employee',
  ): Promise<KVPSuggestionResponse> {
    this.logger.log(`Creating suggestion: ${dto.title}`);

    // Rate limit: Employees can only create 1 KVP suggestion per day
    // Admins and root are unlimited
    if (userRole === 'employee') {
      const todayCount = await this.db.query<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM kvp_suggestions
         WHERE tenant_id = $1
           AND submitted_by = $2
           AND created_at >= CURRENT_DATE
           AND created_at < CURRENT_DATE + INTERVAL '1 day'`,
        [tenantId, userId],
      );

      const count = Number.parseInt(todayCount[0]?.count ?? '0', 10);
      if (count >= 1) {
        throw new ForbiddenException(
          'Tageslimit erreicht: Sie können nur 1 KVP-Vorschlag pro Tag einreichen. Versuchen Sie es morgen erneut.',
        );
      }
    }

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

    const createdSuggestion = await this.getSuggestionById(
      rows[0].id,
      tenantId,
      userId,
      'admin',
    );

    // Log and notify (fire-and-forget)
    void this.logAndNotifyKvpCreated(rows[0].id, dto, tenantId, userId);

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

  /** Log activity and emit notifications for newly created KVP suggestion */
  private async logAndNotifyKvpCreated(
    suggestionId: number,
    dto: CreateSuggestionDto,
    tenantId: number,
    userId: number,
  ): Promise<void> {
    // Log activity
    await this.activityLogger.logCreate(
      tenantId,
      userId,
      'kvp',
      suggestionId,
      `KVP-Vorschlag erstellt: ${dto.title}`,
      {
        title: dto.title,
        categoryId: dto.categoryId,
        orgLevel: dto.orgLevel,
        orgId: dto.orgId,
        priority: dto.priority ?? 'normal',
      },
    );

    // Emit SSE event for real-time notifications
    eventBus.emitKvpSubmitted(tenantId, {
      id: suggestionId,
      title: dto.title,
      submitted_by: String(userId),
    });

    // Create persistent notification for ADR-004
    const recipient = this.mapOrgLevelToRecipient(dto);
    const description =
      dto.description.substring(0, 100) +
      (dto.description.length > 100 ? '...' : '');
    void this.notificationsService.createFeatureNotification(
      'kvp',
      suggestionId,
      `Neuer Verbesserungsvorschlag: ${dto.title}`,
      description,
      recipient.type,
      recipient.id,
      tenantId,
      userId,
    );
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

    // Handle status-specific fields
    if (dto.status !== undefined) {
      addField(dto.status, 'status');
      addField(assignedTo, 'assigned_to');

      if (dto.status === 'rejected') {
        // When rejecting: set rejection reason, clear implementation date
        addField(dto.rejectionReason, 'rejection_reason');
        params.push(null);
        updates.push(`implementation_date = $${params.length}`);
      } else if (dto.status === 'implemented') {
        // When implementing: set implementation date to today, clear rejection reason
        updates.push('implementation_date = CURRENT_DATE');
        params.push(null);
        updates.push(`rejection_reason = $${params.length}`);
      } else {
        // Other status changes: clear both rejection reason and implementation date
        params.push(null);
        updates.push(`rejection_reason = $${params.length}`);
        params.push(null);
        updates.push(`implementation_date = $${params.length}`);
      }
    } else {
      // No status change - only update rejection reason if explicitly provided
      addField(dto.rejectionReason, 'rejection_reason');
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

    const existing = await this.getSuggestionById(
      id,
      tenantId,
      userId,
      userRole,
    );

    if (userRole === 'employee' && existing.submittedBy !== userId) {
      throw new ForbiddenException('You can only update your own suggestions');
    }
    if (
      dto.status !== undefined &&
      userRole !== 'admin' &&
      userRole !== 'root'
    ) {
      throw new ForbiddenException('Only admins can update status');
    }

    // Capture oldValues for logging
    const oldValues = {
      title: existing.title,
      description: existing.description,
      categoryId: existing.categoryId,
      status: existing.status,
      priority: existing.priority,
    };

    const idColumn = isUuid(id) ? 'uuid' : 'id';
    const { updates, params } = this.buildSuggestionUpdateClause(dto, userId);

    params.push(id, tenantId);
    const query = `UPDATE kvp_suggestions SET ${updates.join(', ')} WHERE ${idColumn} = $${params.length - 1} AND tenant_id = $${params.length}`;
    await this.db.query(query, params);

    const updated = await this.getSuggestionById(
      id,
      tenantId,
      userId,
      userRole,
    );

    // Log activity
    const newValues = {
      title: dto.title ?? existing.title,
      description: dto.description ?? existing.description,
      categoryId: dto.categoryId ?? existing.categoryId,
      status: dto.status ?? existing.status,
      priority: dto.priority ?? existing.priority,
    };
    await this.activityLogger.logUpdate(
      tenantId,
      userId,
      'kvp',
      existing.id,
      `KVP-Vorschlag aktualisiert: ${existing.title}`,
      oldValues,
      newValues,
    );

    return updated;
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

    const suggestion = await this.getSuggestionById(
      id,
      tenantId,
      userId,
      userRole,
    );

    if (suggestion.submittedBy !== userId && userRole !== 'root') {
      throw new ForbiddenException('You can only delete your own suggestions');
    }

    const idColumn = isUuid(id) ? 'uuid' : 'id';
    await this.db.query(
      `DELETE FROM kvp_suggestions WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    // Log activity
    await this.activityLogger.logDelete(
      tenantId,
      userId,
      'kvp',
      suggestion.id,
      `KVP-Vorschlag gelöscht: ${suggestion.title}`,
      {
        title: suggestion.title,
        description: suggestion.description,
        categoryId: suggestion.categoryId,
        status: suggestion.status,
        priority: suggestion.priority,
      },
    );

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
    this.logger.log(
      `Sharing suggestion ${String(id)} at ${dto.orgLevel} level`,
    );

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

    // Get user's team for resetting (use first team from extended info)
    const orgInfo = await this.getExtendedUserOrgInfo(userId, tenantId);
    const teamId = orgInfo.teamIds[0] ?? 0;

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
    this.logger.debug(`Getting comments for suggestion ${String(id)}`);

    // Get numeric ID
    const suggestion = await this.getSuggestionById(
      id,
      tenantId,
      _userId,
      userRole,
    );
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
      if (row.last_name !== undefined)
        comment.createdByLastname = row.last_name;
      if (row.profile_picture !== undefined)
        comment.profilePicture = row.profile_picture;
      return comment;
    });
  }

  /**
   * Add a comment
   * Only admin and root users can add comments (Defense in Depth)
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

    // Security: Only admin/root can add comments (Defense in Depth - also enforced at controller level)
    if (userRole !== 'admin' && userRole !== 'root') {
      throw new ForbiddenException(
        'Only admins can add comments to KVP suggestions',
      );
    }

    // Get numeric ID
    const suggestion = await this.getSuggestionById(
      id,
      tenantId,
      userId,
      userRole,
    );
    const numericId = suggestion.id;

    // isInternal is allowed since we already verified user is admin/root above
    const actualIsInternal = isInternal;

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
    this.logger.debug(`Getting attachments for suggestion ${String(id)}`);

    // Get numeric ID
    const suggestion = await this.getSuggestionById(
      id,
      tenantId,
      userId,
      userRole,
    );
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
        row.uploaded_at !== null ?
          row.uploaded_at.toISOString()
        : new Date().toISOString(),
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
    const suggestion = await this.getSuggestionById(
      suggestionId,
      tenantId,
      userId,
      userRole,
    );
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

  /**
   * Check if user has org-level access to a suggestion
   * Uses extended org info with proper inheritance
   */
  private hasExtendedOrgAccess(
    orgLevel: string,
    orgId: number,
    orgInfo: ExtendedUserOrgInfo,
  ): boolean {
    // Full access bypasses all checks
    if (orgInfo.hasFullAccess) return true;

    // Company level = everyone in tenant
    if (orgLevel === 'company') return true;

    // Team level: member or lead
    if (orgLevel === 'team') {
      return (
        orgInfo.teamIds.includes(orgId) || orgInfo.teamLeadOf.includes(orgId)
      );
    }

    // Department level: member, team in dept, or lead
    if (orgLevel === 'department') {
      return (
        orgInfo.departmentIds.includes(orgId) ||
        orgInfo.teamsDepartmentIds.includes(orgId) ||
        orgInfo.departmentLeadOf.includes(orgId)
      );
    }

    // Area level: dept in area, or lead
    if (orgLevel === 'area') {
      return (
        orgInfo.areaIds.includes(orgId) ||
        orgInfo.departmentsAreaIds.includes(orgId) ||
        orgInfo.areaLeadOf.includes(orgId)
      );
    }

    return false;
  }

  /**
   * Get attachment by file UUID for download
   * Uses same visibility rules as KVP suggestions
   */
  async getAttachment(
    fileUuid: string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<{ filePath: string; fileName: string }> {
    this.logger.debug(`Getting attachment by UUID ${fileUuid}`);

    const rows = await this.db.query<
      DbAttachment & {
        submitted_by: number;
        status: string;
        org_level: string;
        org_id: number;
      }
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

    // Check visibility using same rules as KVP suggestions
    // NO special treatment for admin/root - only has_full_access bypasses
    const isOwner = attachment.submitted_by === userId;
    const isPublic = attachment.status === 'implemented';

    if (!isOwner && !isPublic) {
      const orgInfo = await this.getExtendedUserOrgInfo(userId, tenantId);
      if (
        !this.hasExtendedOrgAccess(
          attachment.org_level,
          attachment.org_id,
          orgInfo,
        )
      ) {
        throw new ForbiddenException('No access to this attachment');
      }
    }

    void userRole; // Suppress unused variable warning - kept for API compatibility

    return { filePath: attachment.file_path, fileName: attachment.file_name };
  }

  // ==========================================================================
  // READ CONFIRMATION (Pattern 2: Individual Decrement/Increment)
  // ==========================================================================

  /**
   * Get count of unconfirmed KVP suggestions for notification badge
   * Counts suggestions visible to user that haven't been marked as read
   */
  async getUnconfirmedCount(
    userId: number,
    tenantId: number,
  ): Promise<{ count: number }> {
    this.logger.debug(
      `Getting unconfirmed count for user ${userId}, tenant ${tenantId}`,
    );

    // Base query: count suggestions without confirmation (or is_confirmed = false)
    let query = `
      SELECT COUNT(*)::integer as count
      FROM kvp_suggestions s
      LEFT JOIN kvp_confirmations kc ON s.id = kc.suggestion_id AND kc.user_id = $1 AND kc.tenant_id = s.tenant_id
      WHERE s.tenant_id = $2
        AND (kc.id IS NULL OR kc.is_confirmed = false)
    `;
    const params: unknown[] = [userId, tenantId];

    // Apply visibility restrictions for ALL users (not just employees!)
    // Only users with has_full_access=TRUE bypass this
    const orgInfo = await this.getExtendedUserOrgInfo(userId, tenantId);
    const visibility = this.buildVisibilityClause(
      orgInfo,
      userId,
      params.length + 1,
    );
    query += visibility.clause;
    params.push(...visibility.params);

    const rows = await this.db.query<{ count: number }>(query, params);
    return { count: rows[0]?.count ?? 0 };
  }

  /**
   * Mark a suggestion as read (confirmed) by the user
   * Uses UPSERT: first_seen_at is set only on first confirmation (never reset)
   */
  async confirmSuggestion(
    uuid: string,
    userId: number,
    tenantId: number,
  ): Promise<{ success: boolean }> {
    this.logger.log(`User ${userId} confirming suggestion ${uuid}`);

    // Get suggestion ID
    const suggestionRows = await this.db.query<{ id: number }>(
      'SELECT id FROM kvp_suggestions WHERE uuid = $1 AND tenant_id = $2',
      [uuid, tenantId],
    );
    const suggestion = suggestionRows[0];

    if (suggestion === undefined) {
      throw new NotFoundException(ERROR_SUGGESTION_NOT_FOUND);
    }

    // UPSERT: Insert if not exists, otherwise update is_confirmed
    // first_seen_at is only set on INSERT (never reset on re-confirm)
    await this.db.query(
      `INSERT INTO kvp_confirmations
         (tenant_id, suggestion_id, user_id, confirmed_at, first_seen_at, is_confirmed)
       VALUES ($1, $2, $3, NOW(), NOW(), true)
       ON CONFLICT (tenant_id, suggestion_id, user_id)
       DO UPDATE SET is_confirmed = true, confirmed_at = NOW()`,
      [tenantId, suggestion.id, userId],
    );

    return { success: true };
  }

  /**
   * Mark a suggestion as unread (remove confirmation) by the user
   * Sets is_confirmed = false instead of deleting to preserve first_seen_at
   */
  async unconfirmSuggestion(
    uuid: string,
    userId: number,
    tenantId: number,
  ): Promise<{ success: boolean }> {
    this.logger.log(`User ${userId} unconfirming suggestion ${uuid}`);

    // Get suggestion ID
    const suggestionRows = await this.db.query<{ id: number }>(
      'SELECT id FROM kvp_suggestions WHERE uuid = $1 AND tenant_id = $2',
      [uuid, tenantId],
    );
    const suggestion = suggestionRows[0];

    if (suggestion === undefined) {
      throw new NotFoundException(ERROR_SUGGESTION_NOT_FOUND);
    }

    // Set is_confirmed = false (preserve first_seen_at for "Neu" badge logic)
    await this.db.query(
      `UPDATE kvp_confirmations
       SET is_confirmed = false, confirmed_at = NULL
       WHERE tenant_id = $1 AND suggestion_id = $2 AND user_id = $3`,
      [tenantId, suggestion.id, userId],
    );

    return { success: true };
  }

  // ==========================================================================
  // ARCHIVE/UNARCHIVE
  // ==========================================================================

  /**
   * Archive a suggestion (set status to 'archived')
   */
  async archiveSuggestion(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Archiving suggestion ${String(id)}`);

    const idColumn = isUuid(id) ? 'uuid' : 'id';

    // Get suggestion for logging
    const rows = await this.db.query<{
      id: number;
      title: string;
      status: string;
    }>(
      `SELECT id, title, status FROM kvp_suggestions WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    const suggestion = rows[0];

    if (suggestion === undefined) {
      throw new NotFoundException(ERROR_SUGGESTION_NOT_FOUND);
    }

    // Update status to archived
    await this.db.query(
      `UPDATE kvp_suggestions SET status = 'archived', updated_at = NOW() WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    // Log activity
    await this.activityLogger.logUpdate(
      tenantId,
      userId,
      'kvp',
      suggestion.id,
      `KVP-Vorschlag archiviert: ${suggestion.title}`,
      { status: suggestion.status },
      { status: 'archived' },
    );

    return { message: 'Suggestion archived successfully' };
  }

  /**
   * Unarchive a suggestion (set status to 'restored')
   */
  async unarchiveSuggestion(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Unarchiving suggestion ${String(id)}`);

    const idColumn = isUuid(id) ? 'uuid' : 'id';

    // Get suggestion for logging
    const rows = await this.db.query<{
      id: number;
      title: string;
      status: string;
    }>(
      `SELECT id, title, status FROM kvp_suggestions WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    const suggestion = rows[0];

    if (suggestion === undefined) {
      throw new NotFoundException(ERROR_SUGGESTION_NOT_FOUND);
    }

    // Update status to restored
    await this.db.query(
      `UPDATE kvp_suggestions SET status = 'restored', updated_at = NOW() WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    // Log activity
    await this.activityLogger.logUpdate(
      tenantId,
      userId,
      'kvp',
      suggestion.id,
      `KVP-Vorschlag wiederhergestellt: ${suggestion.title}`,
      { status: suggestion.status },
      { status: 'restored' },
    );

    return { message: 'Suggestion restored successfully' };
  }
}
