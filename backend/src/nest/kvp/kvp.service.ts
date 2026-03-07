/**
 * KVP Service — Facade
 *
 * Orchestrates sub-services for Continuous Improvement Process (KVP).
 * Delegates comments, attachments, and confirmations to dedicated sub-services.
 * All pure logic (transforms, query builders, visibility) lives in kvp.helpers.ts.
 *
 * @see kvp-comments.service.ts — Comment CRUD
 * @see kvp-attachments.service.ts — Attachment CRUD
 * @see kvp-confirmations.service.ts — Read confirmation tracking
 * @see kvp-lifecycle.service.ts — Share/unshare + archive/unarchive
 * @see kvp.helpers.ts — Pure functions (transforms, query builders, visibility)
 * @see kvp.constants.ts — SQL queries, error messages, defaults
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { eventBus } from '../../utils/event-bus.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CreateSuggestionDto } from './dto/create-suggestion.dto.js';
import type { ShareSuggestionDto } from './dto/share-suggestion.dto.js';
import type { UpdateSuggestionDto } from './dto/update-suggestion.dto.js';
import { KvpAttachmentsService } from './kvp-attachments.service.js';
import { KvpCommentsService } from './kvp-comments.service.js';
import { KvpConfirmationsService } from './kvp-confirmations.service.js';
import { KvpLifecycleService } from './kvp-lifecycle.service.js';
import {
  EMPTY_ORG_INFO,
  ERROR_SUGGESTION_NOT_FOUND,
  EXTENDED_ORG_INFO_QUERY,
} from './kvp.constants.js';
import {
  buildCountQuery,
  buildDetailBaseQuery,
  buildFilterConditions,
  buildListBaseQuery,
  buildSuggestionUpdateClause,
  buildVisibilityClause,
  deriveOrgFields,
  hasExtendedOrgAccess,
  isUuid,
  mapOrgLevelToRecipient,
  transformSuggestion,
} from './kvp.helpers.js';
import type {
  CategoryOption,
  DashboardStats,
  DbDashboardStats,
  DbExtendedOrgInfo,
  DbSuggestion,
  ExtendedUserOrgInfo,
  KVPAttachment,
  KVPComment,
  KVPSuggestionResponse,
  KvpOrgAssignment,
  PaginatedKVPComments,
  PaginatedSuggestionsResult,
  SuggestionFilters,
  UserTeamWithAssets,
} from './kvp.types.js';

// Re-export API types for controller
export type {
  Category,
  CategoryOption,
  DashboardStats,
  KVPAttachment,
  KVPComment,
  KVPSuggestionResponse,
  KvpOrgAssignment,
  PaginatedKVPComments,
  PaginatedSuggestionsResult,
  UserTeamWithAssets,
} from './kvp.types.js';

@Injectable()
export class KvpService {
  private readonly logger = new Logger(KvpService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogger: ActivityLoggerService,
    private readonly commentsService: KvpCommentsService,
    private readonly attachmentsService: KvpAttachmentsService,
    private readonly confirmationsService: KvpConfirmationsService,
    private readonly lifecycleService: KvpLifecycleService,
  ) {}

  // ==========================================================================
  // ORG INFO (shared across facade operations)
  // ==========================================================================

  /**
   * Get extended user organization info for KVP visibility checks.
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
    if (row === undefined) return EMPTY_ORG_INFO;

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

  // ==========================================================================
  // MY ORGANIZATIONS (for KVP create modal)
  // ==========================================================================

  /** Get user's assigned teams with their assets — for KVP create modal */
  async getMyOrganizations(
    userId: number,
    tenantId: number,
  ): Promise<UserTeamWithAssets[]> {
    const rows = await this.db.query<{
      team_id: number;
      team_name: string;
      assets: { id: number; name: string }[] | null;
    }>(
      `SELECT
         t.id AS team_id,
         t.name AS team_name,
         COALESCE(
           (SELECT json_agg(json_build_object('id', m.id, 'name', m.name) ORDER BY m.name)
            FROM asset_teams mt
            JOIN assets m ON mt.asset_id = m.id AND m.is_active = ${IS_ACTIVE.ACTIVE}
            WHERE mt.team_id = t.id AND mt.tenant_id = $2),
           '[]'
         ) AS assets
       FROM user_teams ut
       JOIN teams t ON ut.team_id = t.id AND t.is_active = ${IS_ACTIVE.ACTIVE}
       WHERE ut.user_id = $1 AND ut.tenant_id = $2
       ORDER BY t.name`,
      [userId, tenantId],
    );

    return rows.map(
      (row: {
        team_id: number;
        team_name: string;
        assets: { id: number; name: string }[] | null;
      }) => ({
        teamId: row.team_id,
        teamName: row.team_name,
        assets:
          typeof row.assets === 'string' ?
            (JSON.parse(row.assets) as { id: number; name: string }[])
          : (row.assets ?? []),
      }),
    );
  }

  /** Get organization assignments for a suggestion from junction table */
  async getOrgAssignments(
    suggestionId: number,
    tenantId: number,
  ): Promise<KvpOrgAssignment[]> {
    const rows = await this.db.query<{
      org_type: 'team' | 'asset';
      org_id: number;
      org_name: string | null;
    }>(
      `SELECT
         kso.org_type,
         kso.org_id,
         CASE
           WHEN kso.org_type = 'team' THEN t.name
           WHEN kso.org_type = 'asset' THEN m.name
         END AS org_name
       FROM kvp_suggestion_organizations kso
       LEFT JOIN teams t ON kso.org_type = 'team' AND kso.org_id = t.id
       LEFT JOIN assets m ON kso.org_type = 'asset' AND kso.org_id = m.id
       WHERE kso.suggestion_id = $1 AND kso.tenant_id = $2
       ORDER BY kso.org_type, kso.org_id`,
      [suggestionId, tenantId],
    );

    const assignments: KvpOrgAssignment[] = rows.map(
      (row: {
        org_type: 'team' | 'asset';
        org_id: number;
        org_name: string | null;
      }) => ({
        orgType: row.org_type,
        orgId: row.org_id,
        orgName: row.org_name ?? undefined,
      }),
    );

    // Reuse batch enrichment for single suggestion
    const tempMap = new Map<number, KvpOrgAssignment[]>([
      [suggestionId, assignments],
    ]);
    await this.enrichAssetTeamIds(tempMap, tenantId);

    return assignments;
  }

  // ==========================================================================
  // CATEGORIES & DASHBOARD
  // ==========================================================================

  /** Get KVP categories with tenant-specific overrides and custom categories */
  async getCategories(tenantId: number): Promise<CategoryOption[]> {
    this.logger.debug(`Getting categories for tenant ${tenantId}`);

    const query = `
      SELECT
        kc.id,
        'global' AS source,
        COALESCE(kcc.custom_name, kc.name) AS name,
        kc.description,
        kc.color,
        kc.icon
      FROM kvp_categories kc
      LEFT JOIN kvp_categories_custom kcc
        ON kcc.category_id = kc.id
        AND kcc.tenant_id = $1

      UNION ALL

      SELECT
        kcc.id,
        'custom' AS source,
        kcc.custom_name AS name,
        kcc.description,
        kcc.color,
        kcc.icon
      FROM kvp_categories_custom kcc
      WHERE kcc.tenant_id = $1
        AND kcc.category_id IS NULL
        AND kcc.is_active = ${IS_ACTIVE.ACTIVE}

      ORDER BY name ASC
    `;

    return await this.db.query<CategoryOption>(query, [tenantId]);
  }

  /** Get dashboard statistics */
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
        AND status != 'archived'
    `;

    const rows = await this.db.query<DbDashboardStats>(query, [tenantId]);
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

    // pg returns COUNT(*) bigint as string — coerce to number
    return {
      totalSuggestions: Number(stats.total_suggestions),
      newSuggestions: Number(stats.new_suggestions),
      inReviewSuggestions: Number(stats.in_progress_count),
      approvedSuggestions: Number(stats.approved),
      implementedSuggestions: Number(stats.implemented),
      rejectedSuggestions: Number(stats.rejected),
    };
  }

  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================

  /** List suggestions with filters and pagination */
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

    let query = buildListBaseQuery('$2');
    const params: unknown[] = [tenantId, userId];

    // Apply visibility restrictions — only has_full_access bypasses
    const orgInfo = await this.getExtendedUserOrgInfo(userId, tenantId);
    const visibility = buildVisibilityClause(
      orgInfo,
      userId,
      params.length + 1,
    );
    query += visibility.clause;
    params.push(...visibility.params);

    this.logger.debug(
      `User ${userId} (role: ${userRole}) visibility: hasFullAccess=${orgInfo.hasFullAccess}`,
    );
    void userRole; // Suppress unused variable warning - kept for logging

    // Apply filters
    const filterResult = buildFilterConditions(filters, params.length + 1);
    query += filterResult.clause;
    params.push(...filterResult.params);

    if (filters.mineOnly === true) {
      query += ` AND s.submitted_by = $${params.length + 1}`;
      params.push(userId);
    }

    // Get total count
    const total = await this.executeCountQuery(query, params);

    // Add sorting and pagination
    query += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const suggestions = await this.db.query<DbSuggestion>(query, params);
    const transformed = suggestions.map((s: DbSuggestion) =>
      transformSuggestion(s),
    );

    // Batch-load organization assignments for all suggestions
    if (transformed.length > 0) {
      await this.attachOrgAssignmentsBatch(transformed, tenantId);
    }

    return {
      suggestions: transformed,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        pageSize: limit,
        totalItems: total,
      },
    };
  }

  /** Batch-load organization assignments for multiple suggestions */
  private async attachOrgAssignmentsBatch(
    suggestions: KVPSuggestionResponse[],
    tenantId: number,
  ): Promise<void> {
    const ids = suggestions.map((s: KVPSuggestionResponse) => s.id);
    if (ids.length === 0) return;

    const rows = await this.db.query<{
      suggestion_id: number;
      org_type: 'team' | 'asset';
      org_id: number;
      org_name: string | null;
    }>(
      `SELECT
         kso.suggestion_id,
         kso.org_type,
         kso.org_id,
         CASE
           WHEN kso.org_type = 'team' THEN t.name
           WHEN kso.org_type = 'asset' THEN m.name
         END AS org_name
       FROM kvp_suggestion_organizations kso
       LEFT JOIN teams t ON kso.org_type = 'team' AND kso.org_id = t.id
       LEFT JOIN assets m ON kso.org_type = 'asset' AND kso.org_id = m.id
       WHERE kso.suggestion_id = ANY($1) AND kso.tenant_id = $2
       ORDER BY kso.org_type, kso.org_id`,
      [ids, tenantId],
    );

    // Group by suggestion_id
    const orgMap = new Map<number, KvpOrgAssignment[]>();
    for (const row of rows) {
      const list = orgMap.get(row.suggestion_id) ?? [];
      list.push({
        orgType: row.org_type,
        orgId: row.org_id,
        orgName: row.org_name ?? undefined,
      });
      orgMap.set(row.suggestion_id, list);
    }

    // Enrich asset assignments with related team IDs from asset_teams
    await this.enrichAssetTeamIds(orgMap, tenantId);

    // Attach to suggestions
    for (const suggestion of suggestions) {
      suggestion.organizations = orgMap.get(suggestion.id) ?? [];
    }
  }

  /** For asset assignments, load which teams own each asset */
  private async enrichAssetTeamIds(
    orgMap: Map<number, KvpOrgAssignment[]>,
    tenantId: number,
  ): Promise<void> {
    // Flatten all orgs and pick only asset assignments
    const allOrgs = Array.from(orgMap.values()).flat();
    const assetOrgs = allOrgs.filter(
      (o: KvpOrgAssignment) => o.orgType === 'asset',
    );
    if (assetOrgs.length === 0) return;

    const assetIds = [
      ...new Set(assetOrgs.map((o: KvpOrgAssignment) => o.orgId)),
    ];

    const mtRows = await this.db.query<{
      asset_id: number;
      team_id: number;
    }>(
      `SELECT asset_id, team_id FROM asset_teams
       WHERE asset_id = ANY($1) AND tenant_id = $2`,
      [assetIds, tenantId],
    );

    // Group team IDs by asset ID
    const assetTeamMap = new Map<number, number[]>();
    for (const row of mtRows) {
      const list = assetTeamMap.get(row.asset_id) ?? [];
      list.push(row.team_id);
      assetTeamMap.set(row.asset_id, list);
    }

    // Attach to asset org assignments
    for (const org of assetOrgs) {
      org.relatedTeamIds = assetTeamMap.get(org.orgId) ?? [];
    }
  }

  /** Execute count query by stripping confirmation JOIN and adjusting placeholders */
  private async executeCountQuery(
    query: string,
    params: unknown[],
  ): Promise<number> {
    const { countQuery, countParams } = buildCountQuery(query, params);
    const countRows = await this.db.query<{ total: number }>(
      countQuery,
      countParams,
    );
    return countRows[0]?.total ?? 0;
  }

  /** Get suggestion by ID (numeric or UUID) */
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
    let query = `${buildDetailBaseQuery('$3')} WHERE s.${idColumn} = $1 AND s.tenant_id = $2`;
    const params: unknown[] = [id, tenantId, userId];

    // Apply visibility restrictions — only has_full_access bypasses
    const orgInfo = await this.getExtendedUserOrgInfo(userId, tenantId);
    const visibility = buildVisibilityClause(
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

    const result = transformSuggestion(suggestion);

    // Attach organization assignments from junction table
    result.organizations = await this.getOrgAssignments(result.id, tenantId);

    return result;
  }

  /**
   * Create a new suggestion
   * Permission: employees, or admin/root who are team leads
   * Rate limit: 1 suggestion per user per day (employees only)
   */
  async createSuggestion(
    dto: CreateSuggestionDto,
    tenantId: number,
    userId: number,
    userRole: string = 'employee',
  ): Promise<KVPSuggestionResponse> {
    this.logger.log(`Creating suggestion: ${dto.title}`);

    // Permission: admin/root must be team leads to create KVP suggestions
    if (userRole !== 'employee') {
      const orgInfo = await this.getExtendedUserOrgInfo(userId, tenantId);
      if (orgInfo.teamLeadOf.length === 0) {
        throw new ForbiddenException(
          'Nur Mitarbeiter und Teamleiter dürfen KVP-Vorschläge erstellen.',
        );
      }
    }

    // Rate limit: Employees can only create 1 KVP suggestion per day
    if (userRole === 'employee') {
      await this.assertDailyLimitNotReached(tenantId, userId);
    }

    const { orgLevel, orgId, teamId } = deriveOrgFields(dto);
    const uuid = uuidv7();

    const query = `
      INSERT INTO kvp_suggestions
      (uuid, tenant_id, title, description, category_id, custom_category_id, department_id, org_level, org_id, is_shared, submitted_by, team_id, priority, expected_benefit, estimated_cost)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, $10, $11, $12, $13, $14)
      RETURNING id
    `;

    const rows = await this.db.query<{ id: number }>(query, [
      uuid,
      tenantId,
      dto.title,
      dto.description,
      dto.categoryId ?? null,
      dto.customCategoryId ?? null,
      dto.departmentId ?? null,
      orgLevel,
      orgId,
      userId,
      teamId,
      dto.priority ?? 'normal',
      dto.expectedBenefit ?? null,
      dto.estimatedCost ?? null,
    ]);

    if (rows[0] === undefined) {
      throw new Error('Failed to create suggestion');
    }

    const suggestionId = rows[0].id;

    // Insert organization assignments into junction table
    await this.insertOrgAssignments(suggestionId, tenantId, dto);

    const createdSuggestion = await this.getSuggestionById(
      suggestionId,
      tenantId,
      userId,
      'admin',
    );

    // Log and notify (fire-and-forget)
    void this.logAndNotifyKvpCreated(suggestionId, dto, tenantId, userId);

    return createdSuggestion;
  }

  /** Insert organization assignments (teams/assets) into junction table */
  private async insertOrgAssignments(
    suggestionId: number,
    tenantId: number,
    dto: CreateSuggestionDto,
  ): Promise<void> {
    const entries: { orgType: 'team' | 'asset'; orgId: number }[] = [];

    for (const teamId of dto.teamIds) {
      entries.push({ orgType: 'team', orgId: teamId });
    }

    for (const assetId of dto.assetIds) {
      entries.push({ orgType: 'asset', orgId: assetId });
    }

    if (entries.length === 0) return;

    const valuePlaceholders: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const entry of entries) {
      valuePlaceholders.push(
        `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3})`,
      );
      params.push(suggestionId, entry.orgType, entry.orgId, tenantId);
      idx += 4;
    }

    await this.db.query(
      `INSERT INTO kvp_suggestion_organizations (suggestion_id, org_type, org_id, tenant_id)
       VALUES ${valuePlaceholders.join(', ')}`,
      params,
    );
  }

  /** Assert that the employee has not exceeded the daily KVP submission limit */
  private async assertDailyLimitNotReached(
    tenantId: number,
    userId: number,
  ): Promise<void> {
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

  /**
   * Assert that the user has permission to change KVP suggestion status.
   *
   * Allowed: root | admin with has_full_access | admin who is team_lead of this KVP's team
   */
  private async assertCanUpdateStatus(
    suggestion: KVPSuggestionResponse,
    userId: number,
    tenantId: number,
    userRole: string,
  ): Promise<void> {
    if (userRole === 'root') return;

    if (userRole !== 'admin') {
      throw new ForbiddenException(
        'Nur Administratoren dürfen den Status ändern.',
      );
    }

    const orgInfo = await this.getExtendedUserOrgInfo(userId, tenantId);
    if (orgInfo.hasFullAccess) return;

    const kvpTeamId = suggestion.teamId;
    if (kvpTeamId !== null && orgInfo.teamLeadOf.includes(kvpTeamId)) {
      return;
    }

    throw new ForbiddenException(
      'Nur Root, Admins mit Vollzugriff oder der Teamleiter dieses KVP-Teams dürfen den Status ändern.',
    );
  }

  /** Log activity and emit notifications for newly created KVP suggestion */
  private async logAndNotifyKvpCreated(
    suggestionId: number,
    dto: CreateSuggestionDto,
    tenantId: number,
    userId: number,
  ): Promise<void> {
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

    eventBus.emitKvpSubmitted(tenantId, {
      id: suggestionId,
      title: dto.title,
      submitted_by: String(userId),
    });

    // Create persistent notification for ADR-004
    const recipient = mapOrgLevelToRecipient(dto);
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

  /** Update a suggestion */
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
    if (dto.status !== undefined) {
      await this.assertCanUpdateStatus(existing, userId, tenantId, userRole);
    }

    const oldValues = {
      title: existing.title,
      description: existing.description,
      categoryId: existing.categoryId,
      status: existing.status,
      priority: existing.priority,
    };

    const idColumn = isUuid(id) ? 'uuid' : 'id';
    const { updates, params } = buildSuggestionUpdateClause(dto, userId);

    params.push(id, tenantId);
    const query = `UPDATE kvp_suggestions SET ${updates.join(', ')} WHERE ${idColumn} = $${params.length - 1} AND tenant_id = $${params.length}`;
    await this.db.query(query, params);

    const updated = await this.getSuggestionById(
      id,
      tenantId,
      userId,
      userRole,
    );

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

  /** Delete a suggestion */
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

  // ==========================================================================
  // DELEGATION: LIFECYCLE (share, unshare, archive, unarchive)
  // ==========================================================================

  /** Share a suggestion at org level (delegates to KvpLifecycleService) */
  async shareSuggestion(
    id: number | string,
    dto: ShareSuggestionDto,
    tenantId: number,
    userId: number,
    _userRole: string,
  ): Promise<{ message: string }> {
    return await this.lifecycleService.shareSuggestion(
      id,
      dto,
      tenantId,
      userId,
    );
  }

  /** Unshare a suggestion (delegates to KvpLifecycleService) */
  async unshareSuggestion(
    id: number | string,
    tenantId: number,
    userId: number,
    _userRole: string,
  ): Promise<{ message: string }> {
    const orgInfo = await this.getExtendedUserOrgInfo(userId, tenantId);
    const fallbackTeamId = orgInfo.teamIds[0] ?? 0;
    return await this.lifecycleService.unshareSuggestion(
      id,
      tenantId,
      fallbackTeamId,
    );
  }

  /** Archive a suggestion (delegates to KvpLifecycleService) */
  async archiveSuggestion(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    return await this.lifecycleService.archiveSuggestion(id, tenantId, userId);
  }

  /** Unarchive a suggestion (delegates to KvpLifecycleService) */
  async unarchiveSuggestion(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    return await this.lifecycleService.unarchiveSuggestion(
      id,
      tenantId,
      userId,
    );
  }

  // ==========================================================================
  // DELEGATION: COMMENTS
  // ==========================================================================

  /** Get top-level comments for a suggestion with pagination */
  async getComments(
    id: number | string,
    tenantId: number,
    userId: number,
    userRole: string,
    limit?: number,
    offset?: number,
  ): Promise<PaginatedKVPComments> {
    const suggestion = await this.getSuggestionById(
      id,
      tenantId,
      userId,
      userRole,
    );
    return await this.commentsService.getComments(
      suggestion.id,
      tenantId,
      userRole,
      limit,
      offset,
    );
  }

  /** Get replies for a specific comment */
  async getReplies(
    commentId: number,
    tenantId: number,
    userRole: string,
  ): Promise<KVPComment[]> {
    return await this.commentsService.getReplies(commentId, tenantId, userRole);
  }

  /** Add a comment or reply (delegates to KvpCommentsService) */
  async addComment(
    id: number | string,
    userId: number,
    tenantId: number,
    comment: string,
    isInternal: boolean,
    userRole: string,
    parentId?: number,
  ): Promise<KVPComment> {
    const suggestion = await this.getSuggestionById(
      id,
      tenantId,
      userId,
      userRole,
    );
    return await this.commentsService.addComment(
      suggestion.id,
      userId,
      tenantId,
      comment,
      isInternal,
      userRole,
      parentId,
    );
  }

  // ==========================================================================
  // DELEGATION: ATTACHMENTS
  // ==========================================================================

  /** Get attachments for a suggestion (delegates to KvpAttachmentsService) */
  async getAttachments(
    id: number | string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<KVPAttachment[]> {
    const suggestion = await this.getSuggestionById(
      id,
      tenantId,
      userId,
      userRole,
    );
    return await this.attachmentsService.getAttachments(
      suggestion.id,
      tenantId,
    );
  }

  /** Add attachment (delegates to KvpAttachmentsService) */
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
    const suggestion = await this.getSuggestionById(
      suggestionId,
      tenantId,
      userId,
      userRole,
    );
    return await this.attachmentsService.addAttachment(
      suggestion.id,
      attachmentData,
    );
  }

  /**
   * Get attachment by file UUID for download.
   * Facade orchestrates visibility check using org info + helper.
   */
  async getAttachment(
    fileUuid: string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<{ filePath: string; fileName: string }> {
    const attachment = await this.attachmentsService.findAttachmentByUuid(
      fileUuid,
      tenantId,
    );

    // Check visibility using same rules as KVP suggestions
    const isOwner = attachment.submitted_by === userId;
    const isPublic = attachment.status === 'implemented';

    if (!isOwner && !isPublic) {
      const orgInfo = await this.getExtendedUserOrgInfo(userId, tenantId);
      if (
        !hasExtendedOrgAccess(attachment.org_level, attachment.org_id, orgInfo)
      ) {
        throw new ForbiddenException('No access to this attachment');
      }
    }

    void userRole; // Suppress unused variable warning - kept for API compatibility

    return { filePath: attachment.file_path, fileName: attachment.file_name };
  }

  // ==========================================================================
  // DELEGATION: CONFIRMATIONS
  // ==========================================================================

  /** Get unconfirmed count (delegates to KvpConfirmationsService) */
  async getUnconfirmedCount(
    userId: number,
    tenantId: number,
  ): Promise<{ count: number }> {
    const orgInfo = await this.getExtendedUserOrgInfo(userId, tenantId);
    return await this.confirmationsService.getUnconfirmedCount(
      userId,
      tenantId,
      orgInfo,
    );
  }

  /** Confirm a suggestion (delegates to KvpConfirmationsService) */
  async confirmSuggestion(
    uuid: string,
    userId: number,
    tenantId: number,
  ): Promise<{ success: boolean }> {
    return await this.confirmationsService.confirmSuggestion(
      uuid,
      userId,
      tenantId,
    );
  }

  /** Unconfirm a suggestion (delegates to KvpConfirmationsService) */
  async unconfirmSuggestion(
    uuid: string,
    userId: number,
    tenantId: number,
  ): Promise<{ success: boolean }> {
    return await this.confirmationsService.unconfirmSuggestion(
      uuid,
      userId,
      tenantId,
    );
  }
}
