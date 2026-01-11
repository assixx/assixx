/* eslint-disable max-lines */
/**
 * Blackboard Service - Native NestJS Implementation
 *
 * Business logic for blackboard entry management.
 * Fully migrated to NestJS - no dependency on routes/v2/
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import crypto from 'node:crypto';
import path from 'node:path';
import { v7 as uuidv7 } from 'uuid';

import { hierarchyPermissionService } from '../../services/hierarchyPermission.service.js';
import { dbToApi } from '../../utils/fieldMapping.js';
import type { MulterFile } from '../common/interfaces/multer.interface.js';
import { DatabaseService } from '../database/database.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import type { CreateEntryDto } from './dto/create-entry.dto.js';
import type { UpdateEntryDto } from './dto/update-entry.dto.js';

// ============================================================================
// DATABASE TYPES
// ============================================================================

interface DbBlackboardEntry {
  id: number;
  uuid: string;
  tenant_id: number;
  title: string;
  content: string | Buffer | { type: 'Buffer'; data: number[] };
  org_level: 'company' | 'department' | 'team' | 'area';
  org_id: number;
  author_id: number;
  expires_at: Date | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  color: string;
  status: 'active' | 'archived';
  created_at: Date;
  updated_at: Date;
  uuid_created_at?: Date;
  author_name?: string;
  is_confirmed?: number;
  confirmed_at?: Date;
  author_first_name?: string;
  author_last_name?: string;
  author_full_name?: string;
  attachment_count?: number;
  comment_count?: number;
}

interface DbBlackboardComment {
  id: number;
  tenant_id: number;
  entry_id: number;
  user_id: number;
  comment: string;
  is_internal: number;
  created_at: Date;
  user_name?: string;
  user_first_name?: string;
  user_last_name?: string;
  user_full_name?: string;
  user_role?: string;
  user_profile_picture?: string | null;
}

interface DbConfirmationUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  confirmed: number;
  confirmed_at?: Date;
}

interface UserDepartmentTeam {
  role: string | null;
  has_full_access: boolean;
  primary_department_id: number | null;
  team_id: number | null;
  department_name: string | null;
  team_name: string | null;
}

interface CountResult {
  total: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export type BlackboardEntryResponse = Record<string, unknown>;

export interface PaginatedEntriesResult {
  entries: BlackboardEntryResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface EntryFilters {
  status: 'active' | 'archived' | undefined;
  filter: 'all' | 'company' | 'department' | 'team' | 'area' | undefined;
  search: string | undefined;
  page: number | undefined;
  limit: number | undefined;
  sortBy: string | undefined;
  sortDir: 'ASC' | 'DESC' | undefined;
  priority: string | undefined;
}

/** Normalized filter values with defaults applied */
interface NormalizedFilters {
  status: 'active' | 'archived';
  filter: 'all' | 'company' | 'department' | 'team';
  search: string;
  page: number;
  limit: number;
  sortBy: string;
  sortDir: 'ASC' | 'DESC';
  priority: string | undefined;
}

export interface BlackboardComment {
  id: number;
  entryId: number;
  userId: number;
  comment: string;
  isInternal: boolean;
  createdAt: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  profilePicture?: string | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ALLOWED_SORT_COLUMNS = new Set([
  'created_at',
  'updated_at',
  'title',
  'priority',
  'expires_at',
  'status',
]);

const ERROR_ENTRY_NOT_FOUND = 'Entry not found';

const FETCH_ENTRIES_BASE_QUERY = `
  SELECT e.id, e.uuid, e.tenant_id, e.title, e.content, e.org_level, e.org_id, e.author_id,
         e.expires_at, e.priority, e.color, e.status,
         e.created_at, e.updated_at, e.uuid_created_at,
         u.username as author_name,
         u.first_name as author_first_name,
         u.last_name as author_last_name,
         CONCAT(u.first_name, ' ', u.last_name) as author_full_name,
         CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END as is_confirmed,
         c.confirmed_at as confirmed_at,
         (SELECT COUNT(*) FROM documents WHERE blackboard_entry_id = e.id) as attachment_count,
         (SELECT COUNT(*) FROM blackboard_comments WHERE entry_id = e.id) as comment_count
  FROM blackboard_entries e
  LEFT JOIN users u ON e.author_id = u.id AND u.tenant_id = e.tenant_id
  LEFT JOIN blackboard_confirmations c ON e.id = c.entry_id AND c.user_id = $1
  WHERE e.tenant_id = $2 AND e.status = $3
`;

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class BlackboardService {
  private readonly logger = new Logger(BlackboardService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly documentsService: DocumentsService,
  ) {}

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Get user's department and team information for access control
   */
  private async getUserDepartmentAndTeam(userId: number): Promise<{
    role: string | null;
    departmentId: number | null;
    teamId: number | null;
    hasFullAccess: boolean;
  }> {
    const query = `
      SELECT
        u.role,
        u.has_full_access,
        ud.department_id as primary_department_id,
        ut.team_id
      FROM users u
      LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
      LEFT JOIN user_teams ut ON u.id = ut.user_id AND ut.tenant_id = u.tenant_id
      WHERE u.id = $1
    `;

    const rows = await this.db.query<UserDepartmentTeam>(query, [userId]);
    const user = rows[0];

    if (user === undefined) {
      return { role: null, departmentId: null, teamId: null, hasFullAccess: false };
    }

    return {
      role: user.role,
      departmentId: user.primary_department_id,
      teamId: user.team_id,
      hasFullAccess: user.has_full_access,
    };
  }

  /**
   * Validate sort column to prevent SQL injection
   */
  private validateSortColumn(sortBy: string): string {
    if (ALLOWED_SORT_COLUMNS.has(sortBy)) {
      return sortBy;
    }
    this.logger.warn(`Invalid sortBy column rejected: ${sortBy}`);
    return 'created_at';
  }

  /**
   * Validate sort direction to prevent SQL injection
   */
  private validateSortDirection(sortDir: string): 'ASC' | 'DESC' {
    const upper = sortDir.toUpperCase();
    if (upper === 'ASC' || upper === 'DESC') {
      return upper;
    }
    return 'DESC';
  }

  /**
   * Process entry content - convert Buffer to string
   */
  private processEntryContent(entry: DbBlackboardEntry): void {
    if (Buffer.isBuffer(entry.content)) {
      entry.content = entry.content.toString('utf8');
      return;
    }

    const content = entry.content;
    if (typeof content === 'object' && 'type' in content && Array.isArray(content.data)) {
      entry.content = Buffer.from(content.data).toString('utf8');
    }
  }

  /**
   * Transform database entry to API format
   */
  private transformEntry(entry: DbBlackboardEntry): BlackboardEntryResponse {
    const transformed = dbToApi(entry as unknown as Record<string, unknown>);

    transformed['isConfirmed'] = Boolean(entry.is_confirmed);
    transformed['confirmedAt'] = entry.confirmed_at?.toISOString() ?? null;

    if (entry.author_full_name !== undefined && entry.author_full_name !== '') {
      transformed['authorFullName'] = entry.author_full_name;
    }
    if (entry.author_first_name !== undefined && entry.author_first_name !== '') {
      transformed['authorFirstName'] = entry.author_first_name;
    }
    if (entry.author_last_name !== undefined && entry.author_last_name !== '') {
      transformed['authorLastName'] = entry.author_last_name;
    }

    delete transformed['is_confirmed'];
    delete transformed['confirmed_at'];

    return transformed as BlackboardEntryResponse;
  }

  /**
   * Transform database comment to API format
   */
  private transformComment(comment: DbBlackboardComment): BlackboardComment {
    const result: BlackboardComment = {
      id: comment.id,
      entryId: comment.entry_id,
      userId: comment.user_id,
      comment: comment.comment,
      isInternal: Boolean(comment.is_internal),
      createdAt: comment.created_at.toISOString(),
    };

    if (comment.user_first_name !== undefined) result.firstName = comment.user_first_name;
    if (comment.user_last_name !== undefined) result.lastName = comment.user_last_name;
    if (comment.user_role !== undefined) result.role = comment.user_role;
    if (comment.user_profile_picture !== undefined)
      result.profilePicture = comment.user_profile_picture;

    return result;
  }

  /**
   * Build admin access control SQL fragment
   */
  private buildAdminAccessSQL(baseIndex: number): string {
    const p1 = baseIndex;
    const p2 = baseIndex + 1;
    const p3 = baseIndex + 2;
    const p4 = baseIndex + 3;
    const p5 = baseIndex + 4;
    return ` AND (
      (e.org_level = 'company' AND NOT EXISTS (
        SELECT 1 FROM blackboard_entry_organizations beo WHERE beo.entry_id = e.id
      ))
      OR EXISTS (
        SELECT 1 FROM blackboard_entry_organizations beo
        JOIN admin_area_permissions aap ON beo.org_type = 'area' AND beo.org_id = aap.area_id
        WHERE beo.entry_id = e.id AND aap.admin_user_id = $${p1}
      )
      OR EXISTS (
        SELECT 1 FROM blackboard_entry_organizations beo
        JOIN departments d ON beo.org_type = 'department' AND beo.org_id = d.id
        LEFT JOIN admin_area_permissions aap ON d.area_id = aap.area_id AND aap.admin_user_id = $${p2}
        LEFT JOIN admin_department_permissions adp ON d.id = adp.department_id AND adp.admin_user_id = $${p3}
        WHERE beo.entry_id = e.id AND (aap.id IS NOT NULL OR adp.id IS NOT NULL)
      )
      OR EXISTS (
        SELECT 1 FROM blackboard_entry_organizations beo
        JOIN teams t ON beo.org_type = 'team' AND beo.org_id = t.id
        JOIN departments d ON t.department_id = d.id
        LEFT JOIN admin_area_permissions aap ON d.area_id = aap.area_id AND aap.admin_user_id = $${p4}
        LEFT JOIN admin_department_permissions adp ON d.id = adp.department_id AND adp.admin_user_id = $${p5}
        WHERE beo.entry_id = e.id AND (aap.id IS NOT NULL OR adp.id IS NOT NULL)
      )
    )`;
  }

  /**
   * Apply access control filters based on user role
   */
  private applyAccessControl(
    query: string,
    params: unknown[],
    role: string | null | undefined,
    departmentId: number | null | undefined,
    teamId: number | null | undefined,
    userId?: number,
    hasFullAccess?: boolean,
  ): { query: string; params: unknown[] } {
    if (role === 'root' || hasFullAccess === true) {
      return { query, params };
    }

    if (role === 'admin' && userId !== undefined) {
      const adminSQL = this.buildAdminAccessSQL(params.length + 1);
      params.push(userId, userId, userId, userId, userId);
      return { query: query + adminSQL, params };
    }

    const deptIdx = params.length + 1;
    const teamIdx = params.length + 2;
    const employeeSQL = ` AND (
      e.org_level = 'company' OR
      (e.org_level = 'department' AND e.org_id = $${deptIdx}) OR
      (e.org_level = 'team' AND e.org_id = $${teamIdx})
    )`;
    params.push(departmentId ?? 0, teamId ?? 0);

    return { query: query + employeeSQL, params };
  }

  /**
   * Validate user has permission to assign entry to specified organizations
   */
  private async validateOrgPermissions(
    userId: number,
    tenantId: number,
    areaIds: number[] = [],
    departmentIds: number[] = [],
    teamIds: number[] = [],
  ): Promise<void> {
    const [accessibleAreas, accessibleDepts, accessibleTeams] = await Promise.all([
      hierarchyPermissionService.getAccessibleAreaIds(userId, tenantId),
      hierarchyPermissionService.getAccessibleDepartmentIds(userId, tenantId),
      hierarchyPermissionService.getAccessibleTeamIds(userId, tenantId),
    ]);

    const accessibleAreaSet = new Set(accessibleAreas);
    const accessibleDeptSet = new Set(accessibleDepts);
    const accessibleTeamSet = new Set(accessibleTeams);

    for (const areaId of areaIds) {
      if (!accessibleAreaSet.has(areaId)) {
        throw new ForbiddenException(`No permission to create entries for area ${areaId}`);
      }
    }

    for (const deptId of departmentIds) {
      if (!accessibleDeptSet.has(deptId)) {
        throw new ForbiddenException(`No permission to create entries for department ${deptId}`);
      }
    }

    for (const teamId of teamIds) {
      if (!accessibleTeamSet.has(teamId)) {
        throw new ForbiddenException(`No permission to create entries for team ${teamId}`);
      }
    }
  }

  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================

  /**
   * List blackboard entries with filters and pagination
   */
  async listEntries(
    tenantId: number,
    userId: number,
    filters: EntryFilters,
  ): Promise<PaginatedEntriesResult> {
    this.logger.log(`Listing entries for tenant ${tenantId}, user ${userId}`);

    const userAccess = await this.getUserDepartmentAndTeam(userId);
    const normalized = this.normalizeEntryFilters(filters);

    const { query, params } = this.buildEntryListQuery(userId, tenantId, normalized, userAccess);

    const total = await this.countEntries(query, params);
    const entries = await this.fetchPaginatedEntries(query, params, normalized);

    for (const entry of entries) {
      this.processEntryContent(entry);
    }

    return {
      entries: entries.map((e: DbBlackboardEntry) => this.transformEntry(e)),
      pagination: {
        page: normalized.page,
        limit: normalized.limit,
        total,
        totalPages: Math.ceil(total / normalized.limit),
      },
    };
  }

  /** Normalize filter values with defaults */
  private normalizeEntryFilters(filters: EntryFilters): NormalizedFilters {
    return {
      status: filters.status ?? 'active',
      filter: filters.filter === 'area' ? 'all' : (filters.filter ?? 'all'),
      search: filters.search ?? '',
      page: filters.page ?? 1,
      limit: filters.limit ?? 10,
      sortBy: this.validateSortColumn(filters.sortBy ?? 'created_at'),
      sortDir: this.validateSortDirection(filters.sortDir ?? 'DESC'),
      priority: filters.priority,
    };
  }

  /** Build the entry list query with all filters applied */
  private buildEntryListQuery(
    userId: number,
    tenantId: number,
    filters: NormalizedFilters,
    userAccess: {
      role: string | null;
      departmentId: number | null;
      teamId: number | null;
      hasFullAccess: boolean;
    },
  ): { query: string; params: unknown[] } {
    let query = FETCH_ENTRIES_BASE_QUERY;
    const params: unknown[] = [userId, tenantId, filters.status];

    if (filters.filter !== 'all') {
      query += ` AND e.org_level = $${params.length + 1}`;
      params.push(filters.filter);
    }

    const accessResult = this.applyAccessControl(
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
  private async countEntries(query: string, params: unknown[]): Promise<number> {
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
    const paginatedParams = [...params, filters.limit, (filters.page - 1) * filters.limit];
    return await this.db.query<DbBlackboardEntry>(query, paginatedParams);
  }

  /**
   * Get entry by ID (numeric or UUID)
   */
  async getEntryById(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<BlackboardEntryResponse> {
    this.logger.log(`Getting entry ${String(id)} for tenant ${tenantId}`);

    const { role, departmentId, teamId, hasFullAccess } =
      await this.getUserDepartmentAndTeam(userId);

    const idColumn = typeof id === 'string' ? 'uuid' : 'id';
    const query = `
      SELECT e.id, e.uuid, e.tenant_id, e.title, e.content, e.org_level, e.org_id, e.author_id,
             e.expires_at, e.priority, e.color, e.status,
             e.created_at, e.updated_at, e.uuid_created_at,
             u.username as author_name,
             u.first_name as author_first_name,
             u.last_name as author_last_name,
             CONCAT(u.first_name, ' ', u.last_name) as author_full_name,
             CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END as is_confirmed,
             c.confirmed_at as confirmed_at,
             (SELECT COUNT(*) FROM documents WHERE blackboard_entry_id = e.id) as attachment_count,
             (SELECT COUNT(*) FROM blackboard_comments WHERE entry_id = e.id) as comment_count
      FROM blackboard_entries e
      LEFT JOIN users u ON e.author_id = u.id AND u.tenant_id = e.tenant_id
      LEFT JOIN blackboard_confirmations c ON e.id = c.entry_id AND c.user_id = $1
      WHERE e.${idColumn} = $2 AND e.tenant_id = $3
    `;

    const entries = await this.db.query<DbBlackboardEntry>(query, [userId, id, tenantId]);
    const entry = entries[0];

    if (entry === undefined) {
      throw new NotFoundException(ERROR_ENTRY_NOT_FOUND);
    }

    // Check access
    const hasAccess = await this.checkEntryAccess(
      entry,
      role,
      hasFullAccess,
      userId,
      tenantId,
      departmentId,
      teamId,
    );
    if (!hasAccess) {
      throw new NotFoundException(ERROR_ENTRY_NOT_FOUND);
    }

    this.processEntryContent(entry);
    return this.transformEntry(entry);
  }

  /**
   * Check if user has access to entry
   */
  private async checkEntryAccess(
    entry: DbBlackboardEntry,
    role: string | null,
    hasFullAccess: boolean,
    userId: number,
    tenantId: number,
    departmentId: number | null,
    teamId: number | null,
  ): Promise<boolean> {
    if (role === 'root' || hasFullAccess) {
      return true;
    }

    if (role === 'admin') {
      return await this.checkAdminEntryAccess(entry.id, userId, tenantId);
    }

    // Employee access
    return (
      entry.org_level === 'company' ||
      (entry.org_level === 'department' && entry.org_id === departmentId) ||
      (entry.org_level === 'team' && entry.org_id === teamId)
    );
  }

  /**
   * Check if admin has access to entry
   */
  private async checkAdminEntryAccess(
    entryId: number,
    userId: number,
    tenantId: number,
  ): Promise<boolean> {
    // Check company-wide entries
    const noAssignments = await this.db.query<{ count: number }>(
      `SELECT 1 FROM blackboard_entries e
       WHERE e.id = $1 AND e.tenant_id = $2
       AND NOT EXISTS (SELECT 1 FROM blackboard_entry_organizations WHERE entry_id = e.id)`,
      [entryId, tenantId],
    );
    if (noAssignments.length > 0) return true;

    // Check area access
    const areaAccess = await this.db.query<{ count: number }>(
      `SELECT 1 FROM blackboard_entry_organizations beo
       JOIN admin_area_permissions aap ON beo.org_type = 'area' AND beo.org_id = aap.area_id
       WHERE beo.entry_id = $1 AND aap.admin_user_id = $2`,
      [entryId, userId],
    );
    if (areaAccess.length > 0) return true;

    // Check department access
    const deptAccess = await this.db.query<{ count: number }>(
      `SELECT 1 FROM blackboard_entry_organizations beo
       JOIN departments d ON beo.org_type = 'department' AND beo.org_id = d.id
       LEFT JOIN admin_area_permissions aap ON d.area_id = aap.area_id AND aap.admin_user_id = $1
       LEFT JOIN admin_department_permissions adp ON d.id = adp.department_id AND adp.admin_user_id = $2
       WHERE beo.entry_id = $3 AND (aap.id IS NOT NULL OR adp.id IS NOT NULL)`,
      [userId, userId, entryId],
    );
    if (deptAccess.length > 0) return true;

    // Check team access
    const teamAccess = await this.db.query<{ count: number }>(
      `SELECT 1 FROM blackboard_entry_organizations beo
       JOIN teams t ON beo.org_type = 'team' AND beo.org_id = t.id
       JOIN departments d ON t.department_id = d.id
       LEFT JOIN admin_area_permissions aap ON d.area_id = aap.area_id AND aap.admin_user_id = $1
       LEFT JOIN admin_department_permissions adp ON d.id = adp.department_id AND adp.admin_user_id = $2
       WHERE beo.entry_id = $3 AND (aap.id IS NOT NULL OR adp.id IS NOT NULL)`,
      [userId, userId, entryId],
    );
    if (teamAccess.length > 0) return true;

    return false;
  }

  /**
   * Get full entry details with comments and attachments
   */
  async getEntryFull(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<{
    entry: BlackboardEntryResponse;
    comments: BlackboardComment[];
    attachments: Record<string, unknown>[];
  }> {
    this.logger.log(`Getting full entry ${String(id)} for tenant ${tenantId}`);

    const entry = await this.getEntryById(id, tenantId, userId);
    const comments = await this.getComments(id, tenantId);
    const attachments = await this.getAttachments(id, tenantId, userId);

    return { entry, comments, attachments };
  }

  /**
   * Create a new blackboard entry
   */
  async createEntry(
    dto: CreateEntryDto,
    tenantId: number,
    userId: number,
  ): Promise<BlackboardEntryResponse> {
    this.logger.log(`Creating entry: ${dto.title}`);

    const hasMultiOrg = this.hasMultiOrgTargets(dto);

    if (hasMultiOrg) {
      await this.validateOrgPermissions(
        userId,
        tenantId,
        dto.areaIds,
        dto.departmentIds,
        dto.teamIds,
      );
    }

    const { orgLevel, orgId, areaId } = this.determineOrgTarget(dto);
    const insertedId = await this.insertEntry(dto, tenantId, userId, orgLevel, orgId, areaId);

    if (hasMultiOrg) {
      await this.syncEntryOrganizations(insertedId, dto.departmentIds, dto.teamIds, dto.areaIds);
    }

    return await this.getEntryById(insertedId, tenantId, userId);
  }

  /** Check if DTO targets multiple organizations */
  private hasMultiOrgTargets(dto: CreateEntryDto): boolean {
    return dto.departmentIds.length > 0 || dto.teamIds.length > 0 || dto.areaIds.length > 0;
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
      return { orgLevel: 'department', orgId: dto.departmentIds[0] ?? null, areaId: null };
    }
    if (dto.teamIds.length > 0) {
      return { orgLevel: 'team', orgId: dto.teamIds[0] ?? null, areaId: null };
    }
    return { orgLevel: dto.orgLevel ?? 'company', orgId: dto.orgId ?? null, areaId: null };
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
      dto.expiresAt !== undefined && dto.expiresAt !== null ? new Date(dto.expiresAt) : null;

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
   * Sync entry organizations in mapping table
   */
  private async syncEntryOrganizations(
    entryId: number,
    departmentIds: number[],
    teamIds: number[],
    areaIds: number[],
  ): Promise<void> {
    await this.db.query('DELETE FROM blackboard_entry_organizations WHERE entry_id = $1', [
      entryId,
    ]);

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

  /**
   * Update a blackboard entry
   */
  async updateEntry(
    id: number | string,
    dto: UpdateEntryDto,
    tenantId: number,
    userId: number,
  ): Promise<BlackboardEntryResponse> {
    this.logger.log(`Updating entry ${String(id)}`);

    await this.getEntryById(id, tenantId, userId);

    const hasMultiOrg =
      dto.departmentIds !== undefined || dto.teamIds !== undefined || dto.areaIds !== undefined;

    if (hasMultiOrg) {
      await this.validateOrgPermissions(
        userId,
        tenantId,
        dto.areaIds ?? [],
        dto.departmentIds ?? [],
        dto.teamIds ?? [],
      );
    }

    const { query, params } = this.buildUpdateQuery(id, tenantId, dto, hasMultiOrg);
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

    return await this.getEntryById(numericId, tenantId, userId);
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
      { key: 'status', column: 'status' },
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
        const value = transform !== undefined ? transform(fieldValue) : fieldValue;
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
      append(`, area_id = $${params.length - 1}, org_level = $${params.length}`);
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
  private async resolveNumericEntryId(id: number | string, tenantId: number): Promise<number> {
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

  /**
   * Delete a blackboard entry
   */
  async deleteEntry(
    id: number | string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<{ message: string }> {
    this.logger.log(`Deleting entry ${String(id)}`);

    const entry = await this.getEntryById(id, tenantId, userId);

    // Only root or author can delete
    const isRoot = userRole === 'root';
    const isAuthor = (entry as Record<string, unknown>)['authorId'] === userId;
    if (!isRoot && !isAuthor) {
      throw new ForbiddenException('Only the author or root can delete this entry');
    }

    const idColumn = typeof id === 'string' ? 'uuid' : 'id';
    await this.db.query(
      `DELETE FROM blackboard_entries WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    return { message: 'Entry deleted successfully' };
  }

  /**
   * Archive a blackboard entry
   */
  async archiveEntry(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<BlackboardEntryResponse> {
    this.logger.log(`Archiving entry ${String(id)}`);
    return await this.updateEntry(id, { status: 'archived' }, tenantId, userId);
  }

  /**
   * Unarchive a blackboard entry
   */
  async unarchiveEntry(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<BlackboardEntryResponse> {
    this.logger.log(`Unarchiving entry ${String(id)}`);
    return await this.updateEntry(id, { status: 'active' }, tenantId, userId);
  }

  // ==========================================================================
  // CONFIRMATION METHODS
  // ==========================================================================

  /**
   * Confirm reading a blackboard entry
   */
  async confirmEntry(id: number | string, userId: number): Promise<{ message: string }> {
    this.logger.log(`Confirming entry ${String(id)} for user ${userId}`);

    // Get user's tenant
    const users = await this.db.query<{ tenant_id: number }>(
      'SELECT tenant_id FROM users WHERE id = $1',
      [userId],
    );
    if (users[0] === undefined) {
      throw new BadRequestException('User not found');
    }
    const tenantId = users[0].tenant_id;

    // Get numeric entry ID
    const idColumn = typeof id === 'string' ? 'uuid' : 'id';
    const entries = await this.db.query<{ id: number }>(
      `SELECT id FROM blackboard_entries WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (entries[0] === undefined) {
      throw new NotFoundException(ERROR_ENTRY_NOT_FOUND);
    }
    const numericId = entries[0].id;

    // Check if already confirmed
    const confirmations = await this.db.query(
      'SELECT * FROM blackboard_confirmations WHERE entry_id = $1 AND user_id = $2',
      [numericId, userId],
    );
    if (confirmations.length > 0) {
      return { message: 'Entry already confirmed' };
    }

    // Add confirmation
    await this.db.query(
      'INSERT INTO blackboard_confirmations (tenant_id, entry_id, user_id) VALUES ($1, $2, $3)',
      [tenantId, numericId, userId],
    );

    return { message: 'Entry confirmed successfully' };
  }

  /**
   * Remove confirmation (mark as unread)
   */
  async unconfirmEntry(id: number | string, userId: number): Promise<{ message: string }> {
    this.logger.log(`Unconfirming entry ${String(id)} for user ${userId}`);

    // Get user's tenant
    const users = await this.db.query<{ tenant_id: number }>(
      'SELECT tenant_id FROM users WHERE id = $1',
      [userId],
    );
    if (users[0] === undefined) {
      throw new BadRequestException('User not found');
    }
    const tenantId = users[0].tenant_id;

    // Get numeric entry ID
    const idColumn = typeof id === 'string' ? 'uuid' : 'id';
    const entries = await this.db.query<{ id: number }>(
      `SELECT id FROM blackboard_entries WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (entries[0] === undefined) {
      throw new NotFoundException(ERROR_ENTRY_NOT_FOUND);
    }
    const numericId = entries[0].id;

    await this.db.query(
      'DELETE FROM blackboard_confirmations WHERE entry_id = $1 AND user_id = $2',
      [numericId, userId],
    );

    return { message: 'Entry marked as unread successfully' };
  }

  /**
   * Get confirmation status for an entry
   */
  async getConfirmationStatus(
    id: number | string,
    tenantId: number,
  ): Promise<Record<string, unknown>[]> {
    this.logger.log(`Getting confirmation status for entry ${String(id)}`);

    // Get entry info
    const idColumn = typeof id === 'string' ? 'uuid' : 'id';
    const entries = await this.db.query<{ id: number; org_level: string; org_id: number }>(
      `SELECT id, org_level, org_id FROM blackboard_entries WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (entries[0] === undefined) {
      return [];
    }
    const entry = entries[0];
    const numericId = entry.id;

    let usersQuery = `
      SELECT u.id, u.username, u.email, u.first_name, u.last_name,
             CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END as confirmed,
             c.confirmed_at
      FROM users u
      LEFT JOIN blackboard_confirmations c ON u.id = c.user_id AND c.entry_id = $1
      WHERE u.tenant_id = $2
    `;
    const queryParams: unknown[] = [numericId, tenantId];

    if (entry.org_level === 'department') {
      usersQuery += ` AND u.id IN (SELECT ud.user_id FROM user_departments ud WHERE ud.department_id = $3 AND ud.tenant_id = u.tenant_id)`;
      queryParams.push(entry.org_id);
    } else if (entry.org_level === 'team') {
      usersQuery += ` AND u.id IN (SELECT ut.user_id FROM user_teams ut WHERE ut.team_id = $3 AND ut.tenant_id = u.tenant_id)`;
      queryParams.push(entry.org_id);
    }

    const users = await this.db.query<DbConfirmationUser>(usersQuery, queryParams);
    return users.map((user: DbConfirmationUser) =>
      dbToApi(user as unknown as Record<string, unknown>),
    );
  }

  // ==========================================================================
  // DASHBOARD
  // ==========================================================================

  /**
   * Get dashboard entries
   */
  async getDashboardEntries(
    tenantId: number,
    userId: number,
    limit: number = 3,
  ): Promise<BlackboardEntryResponse[]> {
    this.logger.log(`Getting dashboard entries for tenant ${tenantId}`);

    const { role, departmentId, teamId, hasFullAccess } =
      await this.getUserDepartmentAndTeam(userId);

    let query = `
      SELECT e.id, e.uuid, e.tenant_id, e.title, e.content, e.org_level, e.org_id, e.author_id,
             e.expires_at, e.priority, e.color, e.status,
             e.created_at, e.updated_at, e.uuid_created_at,
             u.username as author_name,
             u.first_name as author_first_name,
             u.last_name as author_last_name,
             CONCAT(u.first_name, ' ', u.last_name) as author_full_name,
             CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END as is_confirmed,
             c.confirmed_at as confirmed_at,
             (SELECT COUNT(*) FROM documents WHERE blackboard_entry_id = e.id) as attachment_count,
             (SELECT COUNT(*) FROM blackboard_comments WHERE entry_id = e.id) as comment_count
      FROM blackboard_entries e
      LEFT JOIN users u ON e.author_id = u.id AND u.tenant_id = e.tenant_id
      LEFT JOIN blackboard_confirmations c ON e.id = c.entry_id AND c.user_id = $1
      WHERE e.tenant_id = $2 AND e.status = 'active'
    `;
    const params: unknown[] = [userId, tenantId];

    // Apply visibility filter
    if (role !== 'root' && !hasFullAccess) {
      if (role === 'admin') {
        query += this.buildAdminAccessSQL(params.length + 1);
        params.push(userId, userId, userId, userId, userId);
      } else {
        const deptIdx = params.length + 1;
        const teamIdx = params.length + 2;
        query += ` AND (
          e.org_level = 'company' OR
          (e.org_level = 'department' AND e.org_id = $${deptIdx}) OR
          (e.org_level = 'team' AND e.org_id = $${teamIdx})
        )`;
        params.push(departmentId ?? 0, teamId ?? 0);
      }
    }

    params.push(limit);
    query += ` ORDER BY e.priority = 'urgent' DESC, e.priority = 'high' DESC, e.created_at DESC LIMIT $${params.length}`;

    const entries = await this.db.query<DbBlackboardEntry>(query, params);

    for (const entry of entries) {
      this.processEntryContent(entry);
    }

    return entries.map((e: DbBlackboardEntry) => this.transformEntry(e));
  }

  // ==========================================================================
  // COMMENT METHODS
  // ==========================================================================

  /**
   * Get comments for an entry
   */
  async getComments(id: number | string, tenantId: number): Promise<BlackboardComment[]> {
    this.logger.log(`Getting comments for entry ${String(id)}`);

    // Get numeric ID
    let numericId: number;
    if (typeof id === 'string') {
      const entries = await this.db.query<{ id: number }>(
        'SELECT id FROM blackboard_entries WHERE uuid = $1 AND tenant_id = $2',
        [id, tenantId],
      );
      if (entries[0] === undefined) return [];
      numericId = entries[0].id;
    } else {
      numericId = id;
    }

    const comments = await this.db.query<DbBlackboardComment>(
      `SELECT c.id, c.tenant_id, c.entry_id, c.user_id, c.comment, c.is_internal, c.created_at,
              u.username as user_name,
              u.first_name as user_first_name,
              u.last_name as user_last_name,
              CONCAT(u.first_name, ' ', u.last_name) as user_full_name,
              u.role as user_role,
              u.profile_picture as user_profile_picture
       FROM blackboard_comments c
       LEFT JOIN users u ON c.user_id = u.id AND u.tenant_id = c.tenant_id
       WHERE c.entry_id = $1 AND c.tenant_id = $2
       ORDER BY c.created_at ASC`,
      [numericId, tenantId],
    );

    return comments.map((c: DbBlackboardComment) => this.transformComment(c));
  }

  /**
   * Add a comment to an entry
   */
  async addComment(
    id: number | string,
    userId: number,
    tenantId: number,
    comment: string,
    isInternal: boolean,
  ): Promise<{ id: number; message: string }> {
    this.logger.log(`Adding comment to entry ${String(id)}`);

    // Get numeric ID
    let numericId: number;
    if (typeof id === 'string') {
      const entries = await this.db.query<{ id: number }>(
        'SELECT id FROM blackboard_entries WHERE uuid = $1 AND tenant_id = $2',
        [id, tenantId],
      );
      if (entries[0] === undefined) {
        throw new NotFoundException(ERROR_ENTRY_NOT_FOUND);
      }
      numericId = entries[0].id;
    } else {
      numericId = id;
    }

    const rows = await this.db.query<{ id: number }>(
      `INSERT INTO blackboard_comments (tenant_id, entry_id, user_id, comment, is_internal)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [tenantId, numericId, userId, comment, isInternal ? 1 : 0],
    );

    if (rows[0] === undefined) {
      throw new Error('Failed to add comment');
    }

    return { id: rows[0].id, message: 'Comment added successfully' };
  }

  /**
   * Delete a comment
   */
  async deleteComment(commentId: number, tenantId: number): Promise<{ message: string }> {
    this.logger.log(`Deleting comment ${commentId}`);

    await this.db.query('DELETE FROM blackboard_comments WHERE id = $1 AND tenant_id = $2', [
      commentId,
      tenantId,
    ]);

    return { message: 'Comment deleted successfully' };
  }

  // ==========================================================================
  // ATTACHMENT METHODS (via DocumentsService)
  // ==========================================================================

  /**
   * Upload attachment to entry
   */
  async uploadAttachment(
    entryId: number | string,
    file: MulterFile,
    tenantId: number,
    userId: number,
  ): Promise<Record<string, unknown>> {
    this.logger.log(`Uploading attachment to entry ${String(entryId)}`);

    const entry = await this.getEntryById(entryId, tenantId, userId);
    const numericId = (entry as Record<string, unknown>)['id'] as number;

    const fileUuid = uuidv7();
    const extension = path.extname(file.originalname).toLowerCase();
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const storagePath = path.join(
      'uploads',
      'documents',
      tenantId.toString(),
      'blackboard',
      year.toString(),
      month,
      `${fileUuid}${extension}`,
    );

    return await this.documentsService.createDocument(
      {
        filename: file.originalname, // Display name = original filename
        originalName: file.originalname,
        fileSize: file.size,
        fileContent: file.buffer,
        mimeType: file.mimetype,
        category: 'blackboard',
        accessScope: 'blackboard',
        blackboardEntryId: numericId,
        fileUuid,
        fileChecksum: checksum,
        filePath: storagePath,
        storageType: 'filesystem',
      },
      userId,
      tenantId,
    );
  }

  /**
   * Get attachments for entry
   */
  async getAttachments(
    entryId: number | string,
    tenantId: number,
    userId: number,
  ): Promise<Record<string, unknown>[]> {
    this.logger.log(`Getting attachments for entry ${String(entryId)}`);

    const entry = await this.getEntryById(entryId, tenantId, userId);
    const numericId = (entry as Record<string, unknown>)['id'] as number;

    const result = await this.documentsService.listDocuments(tenantId, userId, {
      blackboardEntryId: numericId,
      isActive: 1,
      page: 1,
      limit: 100,
    });

    return result.documents;
  }

  /**
   * Download attachment by ID
   */
  async downloadAttachment(
    attachmentId: number,
    userId: number,
    tenantId: number,
  ): Promise<{ content: Buffer; originalName: string; mimeType: string; fileSize: number }> {
    this.logger.log(`Downloading attachment ${attachmentId}`);
    return await this.documentsService.getDocumentContent(attachmentId, userId, tenantId);
  }

  /**
   * Preview attachment
   */
  async previewAttachment(
    attachmentId: number,
    userId: number,
    tenantId: number,
  ): Promise<{ content: Buffer; originalName: string; mimeType: string; fileSize: number }> {
    this.logger.log(`Previewing attachment ${attachmentId}`);
    return await this.documentsService.getDocumentContent(attachmentId, userId, tenantId);
  }

  /**
   * Download attachment by file UUID
   */
  async downloadByFileUuid(
    fileUuid: string,
    userId: number,
    tenantId: number,
  ): Promise<{ content: Buffer; originalName: string; mimeType: string; fileSize: number }> {
    this.logger.log(`Downloading attachment by UUID ${fileUuid}`);

    // Get document ID by file_uuid
    const docs = await this.db.query<{ id: number }>(
      'SELECT id FROM documents WHERE file_uuid = $1 AND tenant_id = $2',
      [fileUuid, tenantId],
    );

    if (docs[0] === undefined) {
      throw new NotFoundException('Attachment not found');
    }

    return await this.documentsService.getDocumentContent(docs[0].id, userId, tenantId);
  }

  /**
   * Delete attachment
   */
  async deleteAttachment(
    attachmentId: number,
    userId: number,
    tenantId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Deleting attachment ${attachmentId}`);
    await this.documentsService.deleteDocument(attachmentId, userId, tenantId);
    return { message: 'Attachment deleted successfully' };
  }
}
