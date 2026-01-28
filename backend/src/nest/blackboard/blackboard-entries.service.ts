/**
 * Blackboard Entries Service
 *
 * Core CRUD operations for blackboard entries.
 * Handles listing, creation, updates, deletion, and dashboard queries.
 */
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { BlackboardAccessService } from './blackboard-access.service.js';
import {
  ERROR_ENTRY_NOT_FOUND,
  FETCH_ENTRIES_BASE_QUERY,
} from './blackboard.constants.js';
import {
  normalizeEntryFilters,
  processEntryContent,
  transformEntry,
} from './blackboard.helpers.js';
import type {
  BlackboardEntryResponse,
  CountResult,
  DbBlackboardEntry,
  EntryFilters,
  NormalizedFilters,
  PaginatedEntriesResult,
  UserAccessInfo,
} from './blackboard.types.js';
import type { CreateEntryDto } from './dto/create-entry.dto.js';
import type { UpdateEntryDto } from './dto/update-entry.dto.js';

@Injectable()
export class BlackboardEntriesService {
  private readonly logger = new Logger(BlackboardEntriesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly accessService: BlackboardAccessService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ==========================================================================
  // LIST OPERATIONS
  // ==========================================================================

  /**
   * List blackboard entries with filters and pagination.
   */
  async listEntries(
    tenantId: number,
    userId: number,
    filters: EntryFilters,
  ): Promise<PaginatedEntriesResult> {
    this.logger.debug(`Listing entries for tenant ${tenantId}, user ${userId}`);

    const userAccess = await this.accessService.getUserAccessInfo(userId);
    const normalized = normalizeEntryFilters(filters);

    const { query, params } = this.buildEntryListQuery(
      userId,
      tenantId,
      normalized,
      userAccess,
    );

    const total = await this.countEntries(query, params);
    const entries = await this.fetchPaginatedEntries(query, params, normalized);

    for (const entry of entries) {
      processEntryContent(entry);
    }

    return {
      entries: entries.map((e: DbBlackboardEntry) => transformEntry(e)),
      pagination: {
        page: normalized.page,
        limit: normalized.limit,
        total,
        totalPages: Math.ceil(total / normalized.limit),
      },
    };
  }

  /** Build the entry list query with all filters applied */
  private buildEntryListQuery(
    userId: number,
    tenantId: number,
    filters: NormalizedFilters,
    userAccess: UserAccessInfo,
  ): { query: string; params: unknown[] } {
    let query = FETCH_ENTRIES_BASE_QUERY;
    const params: unknown[] = [userId, tenantId, filters.isActive];

    if (filters.filter !== 'all') {
      query += ` AND e.org_level = $${params.length + 1}`;
      params.push(filters.filter);
    }

    const accessResult = this.accessService.applyAccessControl(
      query,
      params,
      userAccess.role,
      userAccess.departmentId,
      userAccess.teamId,
      userId,
      userAccess.hasFullAccess,
    );
    query = accessResult.query;

    if (filters.search !== '') {
      const idx = params.length + 1;
      query += ` AND (e.title LIKE $${idx} OR e.content LIKE $${idx + 1})`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    if (filters.priority !== undefined && filters.priority !== '') {
      query += ` AND e.priority = $${params.length + 1}`;
      params.push(filters.priority);
    }

    return { query, params };
  }

  /** Count total entries matching query */
  private async countEntries(
    query: string,
    params: unknown[],
  ): Promise<number> {
    const countQuery = query.replace(
      /SELECT e\.id.*FROM blackboard_entries e/,
      'SELECT COUNT(*) as total FROM blackboard_entries e',
    );
    const rows = await this.db.query<CountResult>(countQuery, params);
    return rows[0]?.total ?? 0;
  }

  /** Fetch paginated entries with sorting */
  private async fetchPaginatedEntries(
    baseQuery: string,
    params: unknown[],
    filters: NormalizedFilters,
  ): Promise<DbBlackboardEntry[]> {
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    const query = `${baseQuery} ORDER BY e.priority = 'urgent' DESC, e.priority = 'high' DESC, e.${filters.sortBy} ${filters.sortDir} LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
    const paginatedParams = [
      ...params,
      filters.limit,
      (filters.page - 1) * filters.limit,
    ];
    return await this.db.query<DbBlackboardEntry>(query, paginatedParams);
  }

  // ==========================================================================
  // GET OPERATIONS
  // ==========================================================================

  /**
   * Get entry by ID (numeric or UUID).
   */
  async getEntryById(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<BlackboardEntryResponse> {
    this.logger.debug(`Getting entry ${String(id)} for tenant ${tenantId}`);

    const userAccess = await this.accessService.getUserAccessInfo(userId);

    const idColumn = typeof id === 'string' ? 'uuid' : 'id';
    const query = `
      SELECT e.id, e.uuid, e.tenant_id, e.title, e.content, e.org_level, e.org_id, e.author_id,
             e.expires_at, e.priority, e.color, e.is_active,
             e.created_at, e.updated_at, e.uuid_created_at,
             u.username as author_name,
             u.first_name as author_first_name,
             u.last_name as author_last_name,
             CONCAT(u.first_name, ' ', u.last_name) as author_full_name,
             COALESCE(c.is_confirmed, false) as is_confirmed,
             c.confirmed_at as confirmed_at,
             c.first_seen_at as first_seen_at,
             (SELECT COUNT(*)::integer FROM documents WHERE blackboard_entry_id = e.id) as attachment_count,
             (SELECT COUNT(*)::integer FROM blackboard_comments WHERE entry_id = e.id) as comment_count
      FROM blackboard_entries e
      LEFT JOIN users u ON e.author_id = u.id AND u.tenant_id = e.tenant_id
      LEFT JOIN blackboard_confirmations c ON e.id = c.entry_id AND c.user_id = $1
      WHERE e.${idColumn} = $2 AND e.tenant_id = $3
    `;

    const entries = await this.db.query<DbBlackboardEntry>(query, [
      userId,
      id,
      tenantId,
    ]);
    const entry = entries[0];

    if (entry === undefined) {
      throw new NotFoundException(ERROR_ENTRY_NOT_FOUND);
    }

    // Check access
    const hasAccess = await this.accessService.checkEntryAccess(
      entry,
      userAccess.role,
      userAccess.hasFullAccess,
      userId,
      tenantId,
      userAccess.departmentId,
      userAccess.teamId,
    );
    if (!hasAccess) {
      throw new NotFoundException(ERROR_ENTRY_NOT_FOUND);
    }

    processEntryContent(entry);
    return transformEntry(entry);
  }

  // ==========================================================================
  // CREATE OPERATIONS
  // ==========================================================================

  /**
   * Create a new blackboard entry.
   */
  async createEntry(
    dto: CreateEntryDto,
    tenantId: number,
    userId: number,
  ): Promise<BlackboardEntryResponse> {
    this.logger.log(`Creating entry: ${dto.title}`);

    const hasMultiOrg = this.hasMultiOrgTargets(dto);

    if (hasMultiOrg) {
      await this.accessService.validateOrgPermissions(
        userId,
        tenantId,
        dto.areaIds,
        dto.departmentIds,
        dto.teamIds,
      );
    }

    const { orgLevel, orgId, areaId } = this.determineOrgTarget(dto);
    const insertedId = await this.insertEntry(
      dto,
      tenantId,
      userId,
      orgLevel,
      orgId,
      areaId,
    );

    if (hasMultiOrg) {
      await this.syncEntryOrganizations(
        insertedId,
        dto.departmentIds,
        dto.teamIds,
        dto.areaIds,
      );
    }

    const createdEntry = await this.getEntryById(insertedId, tenantId, userId);

    // Log activity
    await this.activityLogger.logCreate(
      tenantId,
      userId,
      'blackboard',
      insertedId,
      `Blackboard-Eintrag erstellt: ${dto.title}`,
      {
        title: dto.title,
        orgLevel,
        priority: dto.priority ?? 'medium',
        expiresAt: dto.expiresAt,
      },
    );

    return createdEntry;
  }

  /** Check if DTO targets multiple organizations */
  private hasMultiOrgTargets(dto: CreateEntryDto): boolean {
    return (
      dto.departmentIds.length > 0 ||
      dto.teamIds.length > 0 ||
      dto.areaIds.length > 0
    );
  }

  /** Determine org_level, org_id, and area_id from DTO */
  private determineOrgTarget(dto: CreateEntryDto): {
    orgLevel: string;
    orgId: number | null;
    areaId: number | null;
  } {
    if (dto.areaIds.length > 0) {
      return { orgLevel: 'area', orgId: null, areaId: dto.areaIds[0] ?? null };
    }
    if (dto.departmentIds.length > 0) {
      return {
        orgLevel: 'department',
        orgId: dto.departmentIds[0] ?? null,
        areaId: null,
      };
    }
    if (dto.teamIds.length > 0) {
      return { orgLevel: 'team', orgId: dto.teamIds[0] ?? null, areaId: null };
    }
    return {
      orgLevel: dto.orgLevel ?? 'company',
      orgId: dto.orgId ?? null,
      areaId: null,
    };
  }

  /** Insert entry into database and return ID */
  private async insertEntry(
    dto: CreateEntryDto,
    tenantId: number,
    userId: number,
    orgLevel: string,
    orgId: number | null,
    areaId: number | null,
  ): Promise<number> {
    const uuid = uuidv7();
    const expiresAt =
      dto.expiresAt !== undefined && dto.expiresAt !== null ?
        new Date(dto.expiresAt)
      : null;

    const rows = await this.db.query<{ id: number }>(
      `INSERT INTO blackboard_entries
       (uuid, tenant_id, title, content, org_level, org_id, area_id, author_id, expires_at, priority, color)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        uuid,
        tenantId,
        dto.title,
        dto.content,
        orgLevel,
        orgId,
        areaId,
        userId,
        expiresAt,
        dto.priority ?? 'medium',
        dto.color ?? 'blue',
      ],
    );

    if (rows.length === 0 || rows[0] === undefined) {
      throw new Error('Failed to create blackboard entry');
    }

    return rows[0].id;
  }

  /**
   * Sync entry organizations in mapping table.
   */
  private async syncEntryOrganizations(
    entryId: number,
    departmentIds: number[],
    teamIds: number[],
    areaIds: number[],
  ): Promise<void> {
    await this.db.query(
      'DELETE FROM blackboard_entry_organizations WHERE entry_id = $1',
      [entryId],
    );

    for (const orgId of departmentIds) {
      await this.db.query(
        'INSERT INTO blackboard_entry_organizations (entry_id, org_type, org_id) VALUES ($1, $2, $3)',
        [entryId, 'department', orgId],
      );
    }

    for (const orgId of teamIds) {
      await this.db.query(
        'INSERT INTO blackboard_entry_organizations (entry_id, org_type, org_id) VALUES ($1, $2, $3)',
        [entryId, 'team', orgId],
      );
    }

    for (const orgId of areaIds) {
      await this.db.query(
        'INSERT INTO blackboard_entry_organizations (entry_id, org_type, org_id) VALUES ($1, $2, $3)',
        [entryId, 'area', orgId],
      );
    }
  }

  // ==========================================================================
  // UPDATE OPERATIONS
  // ==========================================================================

  /**
   * Update a blackboard entry.
   */
  async updateEntry(
    id: number | string,
    dto: UpdateEntryDto,
    tenantId: number,
    userId: number,
  ): Promise<BlackboardEntryResponse> {
    this.logger.log(`Updating entry ${String(id)}`);

    const existingEntry = (await this.getEntryById(
      id,
      tenantId,
      userId,
    )) as Record<string, unknown>;

    const hasMultiOrg =
      dto.departmentIds !== undefined ||
      dto.teamIds !== undefined ||
      dto.areaIds !== undefined;

    if (hasMultiOrg) {
      await this.accessService.validateOrgPermissions(
        userId,
        tenantId,
        dto.areaIds ?? [],
        dto.departmentIds ?? [],
        dto.teamIds ?? [],
      );
    }

    const { query, params } = this.buildUpdateQuery(
      id,
      tenantId,
      dto,
      hasMultiOrg,
    );
    await this.db.query(query, params);

    const numericId = await this.resolveNumericEntryId(id, tenantId);

    if (hasMultiOrg) {
      await this.syncEntryOrganizations(
        numericId,
        dto.departmentIds ?? [],
        dto.teamIds ?? [],
        dto.areaIds ?? [],
      );
    }

    const updatedEntry = await this.getEntryById(numericId, tenantId, userId);

    await this.logEntryUpdateActivity(
      tenantId,
      userId,
      numericId,
      dto,
      existingEntry,
    );

    return updatedEntry;
  }

  /** Log activity for entry update (regular update, archive, or unarchive) */
  private async logEntryUpdateActivity(
    tenantId: number,
    userId: number,
    entryId: number,
    dto: UpdateEntryDto,
    existingEntry: Record<string, unknown>,
  ): Promise<void> {
    // is_active: 0=inactive, 1=active, 3=archive, 4=deleted
    const action =
      dto.isActive === 3 ? 'archiviert'
      : dto.isActive === 1 ? 'reaktiviert'
      : 'aktualisiert';

    await this.activityLogger.logUpdate(
      tenantId,
      userId,
      'blackboard',
      entryId,
      `Blackboard-Eintrag ${action}: ${existingEntry['title'] as string}`,
      {
        title: existingEntry['title'],
        isActive: existingEntry['isActive'],
        priority: existingEntry['priority'],
      },
      {
        title: dto.title ?? existingEntry['title'],
        isActive: dto.isActive ?? existingEntry['isActive'],
        priority: dto.priority ?? existingEntry['priority'],
      },
    );
  }

  /** Build UPDATE query with field and org updates */
  private buildUpdateQuery(
    id: number | string,
    tenantId: number,
    dto: UpdateEntryDto,
    hasMultiOrg: boolean,
  ): { query: string; params: unknown[] } {
    let query = 'UPDATE blackboard_entries SET updated_at = NOW()';
    const params: unknown[] = [];

    this.appendFieldUpdates(dto, params, (addition: string) => {
      query += addition;
    });

    if (hasMultiOrg) {
      this.appendOrgUpdates(dto, params, (addition: string) => {
        query += addition;
      });
    }

    const idColumn = typeof id === 'string' ? 'uuid' : 'id';
    params.push(id, tenantId);
    query += ` WHERE ${idColumn} = $${params.length - 1} AND tenant_id = $${params.length}`;

    return { query, params };
  }

  /** Append field updates to query */
  private appendFieldUpdates(
    dto: UpdateEntryDto,
    params: unknown[],
    append: (s: string) => void,
  ): void {
    const fields: {
      key: keyof UpdateEntryDto;
      column: string;
      transform?: (v: unknown) => unknown;
    }[] = [
      { key: 'title', column: 'title' },
      { key: 'content', column: 'content' },
      { key: 'priority', column: 'priority' },
      { key: 'color', column: 'color' },
      { key: 'isActive', column: 'is_active' },
      {
        key: 'expiresAt',
        column: 'expires_at',
        transform: (v: unknown) => (v === null ? null : new Date(v as string)),
      },
    ];

    for (const { key, column, transform } of fields) {
      // Safe: key is from hardcoded array with keyof UpdateEntryDto, not user input

      const fieldValue = (dto as Record<string, unknown>)[key];
      if (fieldValue !== undefined) {
        const value =
          transform !== undefined ? transform(fieldValue) : fieldValue;
        params.push(value);
        append(`, ${column} = $${params.length}`);
      }
    }
  }

  /** Append org-level updates to query */
  private appendOrgUpdates(
    dto: UpdateEntryDto,
    params: unknown[],
    append: (s: string) => void,
  ): void {
    const firstAreaId = dto.areaIds?.[0];
    const firstDeptId = dto.departmentIds?.[0];
    const firstTeamId = dto.teamIds?.[0];

    if (firstAreaId !== undefined) {
      params.push(firstAreaId, 'area');
      append(
        `, area_id = $${params.length - 1}, org_level = $${params.length}`,
      );
    } else if (firstDeptId !== undefined) {
      params.push(firstDeptId, 'department');
      append(`, org_id = $${params.length - 1}, org_level = $${params.length}`);
    } else if (firstTeamId !== undefined) {
      params.push(firstTeamId, 'team');
      append(`, org_id = $${params.length - 1}, org_level = $${params.length}`);
    } else {
      params.push(null, null, 'company');
      append(
        `, org_id = $${params.length - 2}, area_id = $${params.length - 1}, org_level = $${params.length}`,
      );
    }
  }

  /** Resolve UUID to numeric ID if needed */
  private async resolveNumericEntryId(
    id: number | string,
    tenantId: number,
  ): Promise<number> {
    if (typeof id === 'number') {
      return id;
    }
    const entries = await this.db.query<{ id: number }>(
      'SELECT id FROM blackboard_entries WHERE uuid = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    if (entries[0] === undefined) {
      throw new NotFoundException(ERROR_ENTRY_NOT_FOUND);
    }
    return entries[0].id;
  }

  // ==========================================================================
  // DELETE OPERATIONS
  // ==========================================================================

  /**
   * Delete a blackboard entry.
   *
   * Allowed to delete:
   * - Root users (any entry)
   * - Users with has_full_access = true (any entry in their tenant)
   * - Author of the entry
   */
  async deleteEntry(
    id: number | string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<{ message: string }> {
    this.logger.log(`Deleting entry ${String(id)}`);

    const entry = await this.getEntryById(id, tenantId, userId);

    // Check delete permissions: root, has_full_access, or author
    const isRoot = userRole === 'root';
    const isAuthor = (entry as Record<string, unknown>)['authorId'] === userId;
    const { hasFullAccess } =
      await this.accessService.getUserAccessInfo(userId);

    if (!isRoot && !hasFullAccess && !isAuthor) {
      throw new ForbiddenException(
        'Only the author, root, or users with full access can delete this entry',
      );
    }

    const idColumn = typeof id === 'string' ? 'uuid' : 'id';
    const numericId = (entry as Record<string, unknown>)['id'] as number;

    await this.db.query(
      `DELETE FROM blackboard_entries WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    // Log activity
    await this.activityLogger.logDelete(
      tenantId,
      userId,
      'blackboard',
      numericId,
      `Blackboard-Eintrag gelöscht: ${(entry as Record<string, unknown>)['title'] as string}`,
      {
        title: (entry as Record<string, unknown>)['title'],
        isActive: (entry as Record<string, unknown>)['isActive'],
        priority: (entry as Record<string, unknown>)['priority'],
        orgLevel: (entry as Record<string, unknown>)['orgLevel'],
      },
    );

    return { message: 'Entry deleted successfully' };
  }

  /**
   * Archive a blackboard entry (set is_active = 3).
   */
  async archiveEntry(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<BlackboardEntryResponse> {
    this.logger.log(`Archiving entry ${String(id)}`);
    return await this.updateEntry(id, { isActive: 3 }, tenantId, userId);
  }

  /**
   * Unarchive a blackboard entry (set is_active = 1).
   */
  async unarchiveEntry(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<BlackboardEntryResponse> {
    this.logger.log(`Unarchiving entry ${String(id)}`);
    return await this.updateEntry(id, { isActive: 1 }, tenantId, userId);
  }

  // ==========================================================================
  // DASHBOARD
  // ==========================================================================

  /**
   * Get dashboard entries.
   */
  async getDashboardEntries(
    tenantId: number,
    userId: number,
    limit: number = 3,
  ): Promise<BlackboardEntryResponse[]> {
    this.logger.debug(`Getting dashboard entries for tenant ${tenantId}`);

    const userAccess = await this.accessService.getUserAccessInfo(userId);

    let query = `
      SELECT e.id, e.uuid, e.tenant_id, e.title, e.content, e.org_level, e.org_id, e.author_id,
             e.expires_at, e.priority, e.color, e.is_active,
             e.created_at, e.updated_at, e.uuid_created_at,
             u.username as author_name,
             u.first_name as author_first_name,
             u.last_name as author_last_name,
             CONCAT(u.first_name, ' ', u.last_name) as author_full_name,
             COALESCE(c.is_confirmed, false) as is_confirmed,
             c.confirmed_at as confirmed_at,
             c.first_seen_at as first_seen_at,
             (SELECT COUNT(*)::integer FROM documents WHERE blackboard_entry_id = e.id) as attachment_count,
             (SELECT COUNT(*)::integer FROM blackboard_comments WHERE entry_id = e.id) as comment_count
      FROM blackboard_entries e
      LEFT JOIN users u ON e.author_id = u.id AND u.tenant_id = e.tenant_id
      LEFT JOIN blackboard_confirmations c ON e.id = c.entry_id AND c.user_id = $1
      WHERE e.tenant_id = $2 AND e.is_active = 1
    `;
    const params: unknown[] = [userId, tenantId];

    // Apply visibility filter
    if (userAccess.role !== 'root' && !userAccess.hasFullAccess) {
      if (userAccess.role === 'admin') {
        query += this.accessService.buildAdminAccessSQL(params.length + 1);
        params.push(userId, userId, userId, userId, userId);
      } else {
        const deptIdx = params.length + 1;
        const teamIdx = params.length + 2;
        query += ` AND (
          e.org_level = 'company' OR
          (e.org_level = 'department' AND e.org_id = $${deptIdx}) OR
          (e.org_level = 'team' AND e.org_id = $${teamIdx})
        )`;
        params.push(userAccess.departmentId ?? 0, userAccess.teamId ?? 0);
      }
    }

    params.push(limit);
    query += ` ORDER BY e.priority = 'urgent' DESC, e.priority = 'high' DESC, e.created_at DESC LIMIT $${params.length}`;

    const entries = await this.db.query<DbBlackboardEntry>(query, params);

    for (const entry of entries) {
      processEntryContent(entry);
    }

    return entries.map((e: DbBlackboardEntry) => transformEntry(e));
  }
}
