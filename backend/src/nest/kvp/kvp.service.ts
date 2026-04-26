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
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { eventBus } from '../../utils/event-bus.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ScopeService } from '../hierarchy-permission/scope.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CreateSuggestionDto } from './dto/create-suggestion.dto.js';
import type { ShareSuggestionDto } from './dto/share-suggestion.dto.js';
import type { UpdateSuggestionDto } from './dto/update-suggestion.dto.js';
import { KvpApprovalService } from './kvp-approval.service.js';
import { KvpAttachmentsService } from './kvp-attachments.service.js';
import { KvpCommentsService } from './kvp-comments.service.js';
import { KvpConfirmationsService } from './kvp-confirmations.service.js';
import { KvpLifecycleService } from './kvp-lifecycle.service.js';
import { KvpParticipantsService } from './kvp-participants.service.js';
import { EMPLOYEE_MEMBERSHIP_QUERY, ERROR_SUGGESTION_NOT_FOUND } from './kvp.constants.js';
import {
  buildCountQuery,
  buildDetailBaseQuery,
  buildFilterConditions,
  buildListBaseQuery,
  buildSuggestionUpdateClause,
  buildVisibilityClause,
  hasExtendedOrgAccess,
  isUuid,
  mapScopeToOrgInfo,
  mapTeamToRecipient,
  transformSuggestion,
  validateApprovalStatusTransition,
} from './kvp.helpers.js';
import type {
  CategoryOption,
  DashboardStats,
  DbDashboardStats,
  DbSuggestion,
  ExtendedUserOrgInfo,
  KVPAttachment,
  KVPComment,
  KVPSuggestionResponse,
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
    private readonly kvpApprovalService: KvpApprovalService,
    private readonly lifecycleService: KvpLifecycleService,
    // Co-originator tagging — masterplan FEAT_KVP_PARTICIPANTS §2.3.
    // Wired here so `createSuggestion()` can hand its tx client through to
    // `replaceParticipants()`, keeping suggestion-INSERT and participants-INSERT
    // atomic (closes risk R7: orphan suggestion when participant insert fails).
    private readonly participantsService: KvpParticipantsService,
    private readonly scopeService: ScopeService,
    private readonly cls: ClsService,
  ) {}

  /**
   * Get extended user organization info for KVP visibility checks.
   * Leads/admins: uses ScopeService (management scope).
   * Regular employees: loads team/department MEMBERSHIP from user_teams/user_departments.
   */
  private async getExtendedUserOrgInfo(): Promise<ExtendedUserOrgInfo> {
    const scope = await this.scopeService.getScope();
    if (scope.type !== 'none') return mapScopeToOrgInfo(scope);

    const userId = this.cls.get<number | undefined>('userId');
    const tenantId = this.cls.get<number | undefined>('tenantId');
    const rows = await this.db.tenantQuery<{
      team_ids: number[];
      dept_ids: number[];
      dept_area_ids: number[];
      teams_dept_ids: number[];
    }>(EMPLOYEE_MEMBERSHIP_QUERY, [userId, tenantId]);

    const m = rows[0];
    return {
      teamIds: m?.team_ids ?? [],
      departmentIds: m?.dept_ids ?? [],
      areaIds: m?.dept_area_ids ?? [],
      teamLeadOf: [],
      departmentLeadOf: [],
      areaLeadOf: [],
      teamsDepartmentIds: m?.teams_dept_ids ?? [],
      departmentsAreaIds: [],
      hasFullAccess: false,
    };
  }

  /** Get user's assigned teams with their assets — for KVP create modal */
  async getMyOrganizations(userId: number, tenantId: number): Promise<UserTeamWithAssets[]> {
    const rows = await this.db.tenantQuery<{
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

    return await this.db.tenantQuery<CategoryOption>(query, [tenantId]);
  }

  /** Get dashboard statistics (tenant-wide + team-scoped for current user) */
  async getDashboardStats(tenantId: number, userId: number): Promise<DashboardStats> {
    this.logger.debug(`Getting dashboard stats for tenant ${tenantId}`);

    const query = `
      SELECT
        COUNT(*) as total_suggestions,
        COUNT(CASE WHEN s.status = 'new' THEN 1 END) as new_suggestions,
        COUNT(CASE WHEN s.status = 'in_review' THEN 1 END) as in_progress_count,
        COUNT(CASE WHEN s.status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN s.status = 'implemented' THEN 1 END) as implemented,
        COUNT(CASE WHEN s.status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN s.team_id IN (SELECT ut.team_id FROM user_teams ut WHERE ut.user_id = $2 AND ut.tenant_id = $1) THEN 1 END) as team_total,
        COUNT(CASE WHEN s.status = 'implemented' AND s.team_id IN (SELECT ut.team_id FROM user_teams ut WHERE ut.user_id = $2 AND ut.tenant_id = $1) THEN 1 END) as team_implemented
      FROM kvp_suggestions s
      WHERE s.tenant_id = $1
        AND s.status != 'archived'
    `;

    const rows = await this.db.tenantQuery<DbDashboardStats>(query, [tenantId, userId]);
    const stats = rows[0];

    if (stats === undefined) {
      return {
        totalSuggestions: 0,
        newSuggestions: 0,
        inReviewSuggestions: 0,
        approvedSuggestions: 0,
        implementedSuggestions: 0,
        rejectedSuggestions: 0,
        teamTotalSuggestions: 0,
        teamImplementedSuggestions: 0,
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
      teamTotalSuggestions: Number(stats.team_total),
      teamImplementedSuggestions: Number(stats.team_implemented),
    };
  }

  /** List suggestions with filters and pagination */
  async listSuggestions(
    tenantId: number,
    userId: number,
    userRole: string,
    filters: SuggestionFilters,
  ): Promise<PaginatedSuggestionsResult> {
    this.logger.debug(`Listing suggestions for tenant ${tenantId}, user ${userId}`);

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    let query = buildListBaseQuery('$2');
    const params: unknown[] = [tenantId, userId];

    // Apply visibility restrictions — only has_full_access bypasses
    const orgInfo = await this.getExtendedUserOrgInfo();
    const visibility = buildVisibilityClause(orgInfo, userId, params.length + 1);
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

    const suggestions = await this.db.tenantQuery<DbSuggestion>(query, params);
    const transformed = suggestions.map((s: DbSuggestion) => transformSuggestion(s));

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

  /** Execute count query by stripping confirmation JOIN and adjusting placeholders */
  private async executeCountQuery(query: string, params: unknown[]): Promise<number> {
    const { countQuery, countParams } = buildCountQuery(query, params);
    const countRows = await this.db.tenantQuery<{ total: number }>(countQuery, countParams);
    return countRows[0]?.total ?? 0;
  }

  /** Get suggestion by ID (numeric or UUID) */
  async getSuggestionById(
    id: number | string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<KVPSuggestionResponse> {
    this.logger.debug(`Getting suggestion ${String(id)} for tenant ${tenantId}`);

    const idColumn = isUuid(id) ? 'uuid' : 'id';
    let query = `${buildDetailBaseQuery('$3')} WHERE s.${idColumn} = $1 AND s.tenant_id = $2`;
    const params: unknown[] = [id, tenantId, userId];

    // Apply visibility restrictions — only has_full_access bypasses
    const orgInfo = await this.getExtendedUserOrgInfo();
    const visibility = buildVisibilityClause(orgInfo, userId, params.length + 1);
    query += visibility.clause;
    params.push(...visibility.params);

    void userRole; // Suppress unused variable warning - kept for API compatibility

    const rows = await this.db.tenantQuery<DbSuggestion>(query, params);
    const suggestion = rows[0];

    if (suggestion === undefined) {
      throw new NotFoundException(ERROR_SUGGESTION_NOT_FOUND);
    }

    // Detail enrichment (FEAT_KVP_PARTICIPANTS_MASTERPLAN §2.4): merge the
    // co-originator list onto the response. `transformSuggestion` already
    // seeded `participants: []`; we override with the enriched join here so
    // GET /:id and POST / (which round-trips through this method) both
    // surface the full list. The list path (`listSuggestions`) does NOT
    // call this method per row — that is intentional for payload size.
    const transformed = transformSuggestion(suggestion);
    transformed.participants = await this.participantsService.getParticipants(suggestion.id);
    return transformed;
  }

  /**
   * Submission gate for `createSuggestion()`.
   *
   * Combines two independent checks:
   *   1. Role gate (legacy): admin/root needs `has_full_access` OR a team-lead
   *      position. Pure employees pass implicitly.
   *   2. Hard-Gate (ADR-037 Amendment 2026-04-26 + Masterplan §3.4 v0.6.0):
   *      a KVP master must be configured for the requester's org scope.
   *      Bypass for system users — root or admin-with-`hasFullAccess` —
   *      so a fresh tenant can bootstrap. Lead-only admins, employees and
   *      employee-leads must wait until an approval config covers their
   *      area/department/team. Scope resolution is delegated to
   *      `ApprovalsConfigService.resolveApprovers` (single source of truth,
   *      ADR-037 Org-Scope Amendment 2026-03-23).
   */
  private async assertCanSubmit(userId: number, userRole: string): Promise<void> {
    const orgInfo = userRole !== 'employee' ? await this.getExtendedUserOrgInfo() : null;

    if (orgInfo !== null && !orgInfo.hasFullAccess && orgInfo.teamLeadOf.length === 0) {
      throw new ForbiddenException(
        'Nur Mitarbeiter und Teamleiter dürfen KVP-Vorschläge erstellen.',
      );
    }

    const isSystemUser = userRole === 'root' || orgInfo?.hasFullAccess === true;
    if (isSystemUser) return;

    const hasMaster = await this.kvpApprovalService.canRequesterFindApprovalMaster(userId);
    if (!hasMaster) {
      throw new BadRequestException({
        code: 'KVP_NO_APPROVAL_MASTER',
        message:
          'Für deinen Bereich ist kein KVP-Master konfiguriert. Bitte wende dich an deinen Administrator.',
      });
    }
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

    await this.assertCanSubmit(userId, userRole);

    // Rate limit: all users except root and admin+has_full_access
    await this.assertDailyLimitNotReached(tenantId, userId, userRole);

    // Auto-assign team from creator's membership
    const teamId = await this.getUserTeamId(userId, tenantId);
    const uuid = uuidv7();

    const query = `
      INSERT INTO kvp_suggestions
      (uuid, tenant_id, title, description, category_id, custom_category_id, department_id, org_level, org_id, is_shared, submitted_by, team_id, priority, expected_benefit, estimated_cost)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'team', $8, FALSE, $9, $8, $10, $11, $12)
      RETURNING id
    `;

    // Single tx for INSERT + participants tagging so a participants failure
    // rolls back the suggestion (closes risk R7 — orphan suggestion impossible).
    // The same `client` is threaded into `replaceParticipants` so RLS context
    // and rollback boundary match. Masterplan FEAT_KVP_PARTICIPANTS §2.3.
    const suggestionId = await this.db.tenantTransaction(
      async (client: PoolClient): Promise<number> => {
        const result = await client.query<{ id: number }>(query, [
          uuid,
          tenantId,
          dto.title,
          dto.description,
          dto.categoryId ?? null,
          dto.customCategoryId ?? null,
          dto.departmentId ?? null,
          teamId,
          userId,
          dto.priority ?? 'normal',
          dto.expectedBenefit ?? null,
          dto.estimatedCost ?? null,
        ]);

        if (result.rows[0] === undefined) {
          throw new Error('Failed to create suggestion');
        }
        const newId = result.rows[0].id;

        // `dto.participants` is `Participant[]` (never undefined): the Zod
        // schema in dto/create-suggestion.dto.ts uses `.optional().default([])`,
        // so the parsed DTO contract guarantees an array. The masterplan's
        // speculative `?? []` (§2.3 pseudo-code) predates that schema choice
        // and would fail `@typescript-eslint/no-unnecessary-condition`. Logged
        // as Spec Deviation #5.
        await this.participantsService.replaceParticipants(newId, dto.participants, userId, client);

        return newId;
      },
    );

    const createdSuggestion = await this.getSuggestionById(suggestionId, tenantId, userId, 'admin');

    // Log and notify (fire-and-forget)
    void this.logAndNotifyKvpCreated(suggestionId, teamId, dto, tenantId, userId);

    return createdSuggestion;
  }

  /** Resolve the user's team ID from user_teams */
  private async getUserTeamId(userId: number, tenantId: number): Promise<number> {
    const rows = await this.db.tenantQuery<{ team_id: number }>(
      `SELECT team_id FROM user_teams WHERE user_id = $1 AND tenant_id = $2 LIMIT 1`,
      [userId, tenantId],
    );

    if (rows[0] === undefined) {
      throw new ForbiddenException(
        'Sie müssen einem Team zugewiesen sein, um KVP-Vorschläge zu erstellen.',
      );
    }

    return rows[0].team_id;
  }

  /** Assert that the user has not exceeded the configurable daily KVP limit */
  private async assertDailyLimitNotReached(
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<void> {
    // Root is always unlimited
    if (userRole === 'root') return;

    // Admin with has_full_access is unlimited
    if (userRole === 'admin') {
      const accessRows = await this.db.tenantQuery<{ has_full_access: boolean }>(
        `SELECT has_full_access FROM users WHERE id = $1 AND tenant_id = $2`,
        [userId, tenantId],
      );
      if (accessRows[0]?.has_full_access === true) return;
    }

    // Read configured limit from tenant_addons
    const configuredLimit = await this.getKvpDailyLimit(tenantId);

    // 0 = unlimited
    if (configuredLimit === 0) return;

    const todayCount = await this.db.tenantQuery<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM kvp_suggestions
       WHERE tenant_id = $1
         AND submitted_by = $2
         AND created_at >= CURRENT_DATE
         AND created_at < CURRENT_DATE + INTERVAL '1 day'`,
      [tenantId, userId],
    );

    const count = Number.parseInt(todayCount[0]?.count ?? '0', 10);
    if (count >= configuredLimit) {
      const label = configuredLimit === 1 ? 'Vorschlag' : 'Vorschläge';
      throw new ForbiddenException(
        `Tageslimit erreicht: Sie können nur ${String(configuredLimit)} KVP-${label} pro Tag einreichen. Versuchen Sie es morgen erneut.`,
      );
    }
  }

  /** Read the KVP daily limit from tenant_addons.settings (default: 1) */
  private async getKvpDailyLimit(tenantId: number): Promise<number> {
    const rows = await this.db.tenantQuery<{ daily_limit: number | null }>(
      `SELECT (ta.settings->>'daily_limit')::integer AS daily_limit
       FROM tenant_addons ta
       JOIN addons a ON ta.addon_id = a.id
       WHERE ta.tenant_id = $1
         AND a.code = 'kvp'
         AND ta.is_active = ${IS_ACTIVE.ACTIVE}`,
      [tenantId],
    );
    return rows[0]?.daily_limit ?? 1;
  }

  /** Get KVP addon settings for the tenant */
  async getKvpSettings(tenantId: number): Promise<{ dailyLimit: number }> {
    const dailyLimit = await this.getKvpDailyLimit(tenantId);
    return { dailyLimit };
  }

  /** Update KVP addon settings for the tenant */
  async updateKvpSettings(tenantId: number, dailyLimit: number): Promise<{ dailyLimit: number }> {
    await this.db.tenantQuery(
      `UPDATE tenant_addons ta
       SET settings = jsonb_set(
         COALESCE(ta.settings, '{}'::jsonb),
         '{daily_limit}',
         to_jsonb($1::integer)
       ),
       updated_at = NOW()
       FROM addons a
       WHERE ta.addon_id = a.id
         AND ta.tenant_id = $2
         AND a.code = 'kvp'`,
      [dailyLimit, tenantId],
    );
    return { dailyLimit };
  }

  /**
   * Assert that the user has permission to change KVP suggestion status.
   *
   * Allowed: root | admin with has_full_access | team_lead/deputy of this KVP's team (any role)
   */
  private async assertCanUpdateStatus(
    suggestion: KVPSuggestionResponse,
    _userId: number,
    _tenantId: number,
    userRole: string,
  ): Promise<void> {
    if (userRole === 'root') return;

    const orgInfo = await this.getExtendedUserOrgInfo();
    if (orgInfo.hasFullAccess) return;

    const kvpTeamId = suggestion.teamId;
    if (kvpTeamId !== null && orgInfo.teamLeadOf.includes(kvpTeamId)) {
      return;
    }

    throw new ForbiddenException(
      'Nur Root, Admins mit Vollzugriff oder der Teamleiter/Stellvertreter dieses KVP-Teams dürfen den Status ändern.',
    );
  }

  /** Enforce approval workflow transition rules (delegates to pure helper) */
  private async enforceApprovalTransition(
    currentStatus: string,
    newStatus: string,
    tenantId: number,
  ): Promise<void> {
    const hasConfig = await this.kvpApprovalService.hasApprovalConfig(tenantId);
    const result = validateApprovalStatusTransition(currentStatus, newStatus, hasConfig);
    if (!result.allowed) {
      throw new ForbiddenException(result.reason ?? 'Statusübergang nicht erlaubt');
    }
  }

  /** Log activity and emit notifications for newly created KVP suggestion */
  private async logAndNotifyKvpCreated(
    suggestionId: number,
    teamId: number,
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
        priority: dto.priority ?? 'normal',
      },
    );

    eventBus.emitKvpSubmitted(tenantId, {
      id: suggestionId,
      title: dto.title,
      submitted_by: String(userId),
    });

    // Create persistent notification for ADR-004
    const recipient = mapTeamToRecipient(teamId);
    const description =
      dto.description.substring(0, 100) + (dto.description.length > 100 ? '...' : '');
    void this.notificationsService.createAddonNotification(
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

    const existing = await this.getSuggestionById(id, tenantId, userId, userRole);

    if (userRole === 'employee' && existing.submittedBy !== userId) {
      // Team Lead / Deputy Lead may update suggestions from their team
      const orgInfo = await this.getExtendedUserOrgInfo();
      const kvpTeamId = existing.teamId;
      const isLeadOfKvpTeam = kvpTeamId !== null && orgInfo.teamLeadOf.includes(kvpTeamId);
      if (!isLeadOfKvpTeam) {
        throw new ForbiddenException('You can only update your own suggestions');
      }
    }
    if (dto.status !== undefined) {
      await this.assertCanUpdateStatus(existing, userId, tenantId, userRole);
      await this.enforceApprovalTransition(existing.status, dto.status, tenantId);
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
    await this.db.tenantQuery(query, params);

    const updated = await this.getSuggestionById(id, tenantId, userId, userRole);

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

    const suggestion = await this.getSuggestionById(id, tenantId, userId, userRole);

    if (suggestion.submittedBy !== userId && userRole !== 'root') {
      throw new ForbiddenException('You can only delete your own suggestions');
    }

    const idColumn = isUuid(id) ? 'uuid' : 'id';
    await this.db.tenantQuery(
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

  async shareSuggestion(
    id: number | string,
    dto: ShareSuggestionDto,
    tenantId: number,
    userId: number,
    _userRole: string,
  ): Promise<{ message: string }> {
    return await this.lifecycleService.shareSuggestion(id, dto, tenantId, userId);
  }

  async unshareSuggestion(
    id: number | string,
    tenantId: number,
    _userId: number,
    _userRole: string,
  ): Promise<{ message: string }> {
    return await this.lifecycleService.unshareSuggestion(id, tenantId);
  }

  async archiveSuggestion(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    return await this.lifecycleService.archiveSuggestion(id, tenantId, userId);
  }

  async unarchiveSuggestion(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    return await this.lifecycleService.unarchiveSuggestion(id, tenantId, userId);
  }

  /** Get top-level comments for a suggestion with pagination */
  async getComments(
    id: number | string,
    tenantId: number,
    userId: number,
    userRole: string,
    limit?: number,
    offset?: number,
  ): Promise<PaginatedKVPComments> {
    const suggestion = await this.getSuggestionById(id, tenantId, userId, userRole);
    return await this.commentsService.getComments(suggestion.id, tenantId, userRole, limit, offset);
  }

  /** Get replies for a specific comment */
  async getReplies(commentId: number, tenantId: number, userRole: string): Promise<KVPComment[]> {
    return await this.commentsService.getReplies(commentId, tenantId, userRole);
  }

  async addComment(
    id: number | string,
    userId: number,
    tenantId: number,
    comment: string,
    isInternal: boolean,
    userRole: string,
    parentId?: number,
  ): Promise<KVPComment> {
    const suggestion = await this.getSuggestionById(id, tenantId, userId, userRole);
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

  async getAttachments(
    id: number | string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<KVPAttachment[]> {
    const suggestion = await this.getSuggestionById(id, tenantId, userId, userRole);
    return await this.attachmentsService.getAttachments(suggestion.id, tenantId);
  }

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
    const suggestion = await this.getSuggestionById(suggestionId, tenantId, userId, userRole);
    return await this.attachmentsService.addAttachment(suggestion.id, attachmentData);
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
    const attachment = await this.attachmentsService.findAttachmentByUuid(fileUuid, tenantId);

    // Check visibility using same rules as KVP suggestions
    const isOwner = attachment.submitted_by === userId;
    const isPublic = attachment.status === 'implemented';

    if (!isOwner && !isPublic) {
      const orgInfo = await this.getExtendedUserOrgInfo();
      if (!hasExtendedOrgAccess(attachment.org_level, attachment.org_id, orgInfo)) {
        throw new ForbiddenException('No access to this attachment');
      }
    }

    void userRole; // Suppress unused variable warning - kept for API compatibility

    return { filePath: attachment.file_path, fileName: attachment.file_name };
  }

  async getUnconfirmedCount(userId: number, tenantId: number): Promise<{ count: number }> {
    const orgInfo = await this.getExtendedUserOrgInfo();
    return await this.confirmationsService.getUnconfirmedCount(userId, tenantId, orgInfo);
  }

  async confirmSuggestion(
    uuid: string,
    userId: number,
    tenantId: number,
  ): Promise<{ success: boolean }> {
    return await this.confirmationsService.confirmSuggestion(uuid, userId, tenantId);
  }

  async unconfirmSuggestion(
    uuid: string,
    userId: number,
    tenantId: number,
  ): Promise<{ success: boolean }> {
    return await this.confirmationsService.unconfirmSuggestion(uuid, userId, tenantId);
  }
}
