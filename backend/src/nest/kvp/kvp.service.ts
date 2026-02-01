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
 * @see kvp.helpers.ts — Pure functions (transforms, query builders, visibility)
 * @see kvp.constants.ts — SQL queries, error messages, defaults
 */
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { eventBus } from '../../utils/eventBus.js';
import { dbToApi } from '../../utils/fieldMapper.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CreateSuggestionDto } from './dto/create-suggestion.dto.js';
import type { ShareSuggestionDto } from './dto/share-suggestion.dto.js';
import type { UpdateSuggestionDto } from './dto/update-suggestion.dto.js';
import { KvpAttachmentsService } from './kvp-attachments.service.js';
import { KvpCommentsService } from './kvp-comments.service.js';
import { KvpConfirmationsService } from './kvp-confirmations.service.js';
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
  hasExtendedOrgAccess,
  isUuid,
  mapOrgLevelToRecipient,
  transformSuggestion,
} from './kvp.helpers.js';
import type {
  Category,
  DashboardStats,
  DbCategory,
  DbDashboardStats,
  DbExtendedOrgInfo,
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
  ) {}

  // ==========================================================================
  // ORG INFO (shared across facade operations)
  // ==========================================================================

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
  // CATEGORIES & DASHBOARD
  // ==========================================================================

  /** Get KVP categories */
  async getCategories(_tenantId: number): Promise<Category[]> {
    this.logger.debug('Getting categories');

    const rows = await this.db.query<DbCategory>(
      'SELECT * FROM kvp_categories ORDER BY name ASC',
    );

    return rows.map((row: DbCategory) =>
      dbToApi(row as unknown as Record<string, unknown>),
    ) as unknown as Category[];
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

    return {
      suggestions: suggestions.map((s: DbSuggestion) => transformSuggestion(s)),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        pageSize: limit,
        totalItems: total,
      },
    };
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

    return transformSuggestion(suggestion);
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
  // SHARE / UNSHARE
  // ==========================================================================

  /** Share a suggestion at org level */
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

  /** Unshare a suggestion (reset to team level) */
  async unshareSuggestion(
    id: number | string,
    tenantId: number,
    userId: number,
    _userRole: string,
  ): Promise<{ message: string }> {
    this.logger.log(`Unsharing suggestion ${String(id)}`);

    const idColumn = isUuid(id) ? 'uuid' : 'id';
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
  // ARCHIVE / UNARCHIVE
  // ==========================================================================

  /** Archive a suggestion (set status to 'archived') */
  async archiveSuggestion(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Archiving suggestion ${String(id)}`);

    const idColumn = isUuid(id) ? 'uuid' : 'id';

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

    await this.db.query(
      `UPDATE kvp_suggestions SET status = 'archived', updated_at = NOW() WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

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

  /** Unarchive a suggestion (set status to 'restored') */
  async unarchiveSuggestion(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Unarchiving suggestion ${String(id)}`);

    const idColumn = isUuid(id) ? 'uuid' : 'id';

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

    await this.db.query(
      `UPDATE kvp_suggestions SET status = 'restored', updated_at = NOW() WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

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

  // ==========================================================================
  // DELEGATION: COMMENTS
  // ==========================================================================

  /** Get comments for a suggestion (delegates to KvpCommentsService) */
  async getComments(
    id: number | string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<KVPComment[]> {
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
    );
  }

  /** Add a comment (delegates to KvpCommentsService) */
  async addComment(
    id: number | string,
    userId: number,
    tenantId: number,
    comment: string,
    isInternal: boolean,
    userRole: string,
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
