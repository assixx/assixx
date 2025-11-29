/**
 * Blackboard API v2 Service Layer
 * Business logic for company announcements and bulletin board
 */
import blackboard, {
  DbBlackboardComment,
  DbBlackboardEntry,
  EntryCreateData,
  EntryQueryOptions,
  EntryUpdateData,
} from '../../../models/blackboard.js';
import { hierarchyPermissionService } from '../../../services/hierarchyPermission.service.js';
import { ServiceError } from '../../../utils/ServiceError.js';
import { query as executeQuery } from '../../../utils/db.js';
import { dbToApi } from '../../../utils/fieldMapping.js';

// Error message constants to avoid duplication (sonarjs/no-duplicate-string)
const ERROR_ENTRY_NOT_FOUND = 'Entry not found';

export interface BlackboardFilters {
  status?: 'active' | 'archived';
  filter?: 'all' | 'company' | 'department' | 'team';
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
  priority?: string;
}

export interface BlackboardEntry {
  id: number;
  uuid: string; // External UUIDv7 identifier for secure URLs
  title: string;
  content: string;
  status: string;
  priority: string;
  isConfirmed?: boolean;
  authorFullName?: string;
  authorFirstName?: string;
  authorLastName?: string;
  [key: string]: unknown;
}

export interface BlackboardListResult {
  entries: BlackboardEntry[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface BlackboardCreateData {
  title: string;
  content: string;
  // Multi-organization support
  departmentIds?: number[];
  teamIds?: number[];
  areaIds?: number[];
  // Legacy fields (backwards compatibility)
  orgLevel?: 'company' | 'department' | 'team' | 'area';
  orgId?: number | null;
  expiresAt?: Date | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  color?: string;
}

export interface BlackboardUpdateData {
  title?: string;
  content?: string;
  // Multi-organization support
  departmentIds?: number[];
  teamIds?: number[];
  areaIds?: number[];
  // Legacy fields (backwards compatibility)
  orgLevel?: 'company' | 'department' | 'team' | 'area';
  orgId?: number | null;
  expiresAt?: Date | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  color?: string;
  status?: 'active' | 'archived';
}

// DEPRECATED: AttachmentData removed - use documents API with blackboard_entry_id

export interface BlackboardComment {
  id: number;
  entryId: number;
  userId: number;
  comment: string;
  isInternal: boolean;
  createdAt: string;
  // Match KVP format for consistency
  firstName?: string;
  lastName?: string;
  role?: string;
  profilePicture?: string | null;
}

/**
 *
 */
class BlackboardService {
  /**
   * List all blackboard entries visible to the user
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param filters - The filter criteria
   */
  async listEntries(
    tenantId: number,
    userId: number,
    filters: BlackboardFilters = {},
  ): Promise<BlackboardListResult> {
    try {
      // Build options object conditionally to satisfy exactOptionalPropertyTypes
      const options: EntryQueryOptions = {};
      if (filters.status !== undefined) options.status = filters.status;
      if (filters.filter !== undefined) options.filter = filters.filter;
      if (filters.search !== undefined) options.search = filters.search;
      if (filters.page !== undefined) options.page = filters.page;
      if (filters.limit !== undefined) options.limit = filters.limit;
      if (filters.sortBy !== undefined) options.sortBy = filters.sortBy;
      if (filters.sortDir !== undefined) options.sortDir = filters.sortDir;
      if (filters.priority !== undefined) options.priority = filters.priority;

      const result = (await blackboard.getAllEntries(tenantId, userId, options)) as {
        entries: DbBlackboardEntry[];
        pagination: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        };
      };

      return {
        entries: result.entries.map((entry: DbBlackboardEntry) => this.transformEntry(entry)),
        pagination: result.pagination,
      };
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to list entries', error);
    }
  }

  /**
   * Get a specific blackboard entry by ID
   * @param id - The resource ID (numeric or UUID)
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   */
  async getEntryById(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<BlackboardEntry> {
    let entry;

    // Use UUID lookup for string IDs, numeric lookup for numbers
    if (typeof id === 'string') {
      entry = await blackboard.getEntryByUuid(id, tenantId, userId);
    } else {
      entry = await blackboard.getEntryById(id, tenantId, userId);
    }

    if (!entry) {
      throw new ServiceError('NOT_FOUND', ERROR_ENTRY_NOT_FOUND);
    }
    return this.transformEntry(entry);
  }

  /**
   * Get a specific blackboard entry by UUID
   * @param uuid - The entry UUID
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   */
  async getEntryByUuid(uuid: string, tenantId: number, userId: number): Promise<BlackboardEntry> {
    const entry = await blackboard.getEntryByUuid(uuid, tenantId, userId);
    if (!entry) {
      throw new ServiceError('NOT_FOUND', ERROR_ENTRY_NOT_FOUND);
    }
    return this.transformEntry(entry);
  }

  /**
   * Validate that user has permission to assign entry to specified organizations
   * SECURITY: Prevents users from creating/updating entries for orgs they can't access
   *
   * @param userId - The user ID
   * @param tenantId - The tenant ID
   * @param areaIds - Areas to assign
   * @param departmentIds - Departments to assign
   * @param teamIds - Teams to assign
   */
  private async validateOrgPermissions(
    userId: number,
    tenantId: number,
    areaIds: number[] = [],
    departmentIds: number[] = [],
    teamIds: number[] = [],
  ): Promise<void> {
    // Get user's accessible orgs
    const [accessibleAreas, accessibleDepts, accessibleTeams] = await Promise.all([
      hierarchyPermissionService.getAccessibleAreaIds(userId, tenantId),
      hierarchyPermissionService.getAccessibleDepartmentIds(userId, tenantId),
      hierarchyPermissionService.getAccessibleTeamIds(userId, tenantId),
    ]);

    const accessibleAreaSet = new Set(accessibleAreas);
    const accessibleDeptSet = new Set(accessibleDepts);
    const accessibleTeamSet = new Set(accessibleTeams);

    // Check areas
    for (const areaId of areaIds) {
      if (!accessibleAreaSet.has(areaId)) {
        throw new ServiceError('FORBIDDEN', `No permission to create entries for area ${areaId}`);
      }
    }

    // Check departments
    for (const deptId of departmentIds) {
      if (!accessibleDeptSet.has(deptId)) {
        throw new ServiceError(
          'FORBIDDEN',
          `No permission to create entries for department ${deptId}`,
        );
      }
    }

    // Check teams
    for (const teamId of teamIds) {
      if (!accessibleTeamSet.has(teamId)) {
        throw new ServiceError('FORBIDDEN', `No permission to create entries for team ${teamId}`);
      }
    }
  }

  /**
   * Sync entry organizations in mapping table
   * Deletes existing and inserts new mappings
   * @param entryId - The entry ID
   * @param departmentIds - Array of department IDs
   * @param teamIds - Array of team IDs
   * @param areaIds - Array of area IDs
   */
  private async syncEntryOrganizations(
    entryId: number,
    departmentIds: number[] = [],
    teamIds: number[] = [],
    areaIds: number[] = [],
  ): Promise<void> {
    // Delete existing mappings
    await executeQuery('DELETE FROM blackboard_entry_organizations WHERE entry_id = ?', [entryId]);

    // Prepare batch inserts
    const insertValues: [number, string, number][] = [];

    // Add departments
    departmentIds.forEach((orgId: number) => {
      insertValues.push([entryId, 'department', orgId]);
    });

    // Add teams
    teamIds.forEach((orgId: number) => {
      insertValues.push([entryId, 'team', orgId]);
    });

    // Add areas
    areaIds.forEach((orgId: number) => {
      insertValues.push([entryId, 'area', orgId]);
    });

    // Insert all mappings in single query (batch insert for performance)
    if (insertValues.length > 0) {
      await executeQuery(
        'INSERT INTO blackboard_entry_organizations (entry_id, org_type, org_id) VALUES ?',
        [insertValues],
      );
    }
  }

  /** Check if data uses multi-org assignment (N:M arrays) */
  private hasMultiOrgAssignment(data: BlackboardCreateData | BlackboardUpdateData): boolean {
    return (
      (data.departmentIds?.length ?? 0) > 0 ||
      (data.teamIds?.length ?? 0) > 0 ||
      (data.areaIds?.length ?? 0) > 0
    );
  }

  /** Build entry create data from BlackboardCreateData */
  private buildEntryCreateData(
    data: BlackboardCreateData,
    tenantId: number,
    authorId: number,
  ): EntryCreateData {
    const entryData: EntryCreateData = {
      tenant_id: tenantId,
      title: data.title,
      content: data.content,
      org_level: data.orgLevel ?? 'company',
      org_id: data.orgId ?? null,
      author_id: authorId,
    };

    // Map N:M arrays to main table columns for backwards compatibility
    if ((data.areaIds?.length ?? 0) > 0) {
      entryData.org_level = 'area';
      entryData.area_id = data.areaIds?.[0] ?? null;
    } else if ((data.departmentIds?.length ?? 0) > 0) {
      entryData.org_level = 'department';
      entryData.org_id = data.departmentIds?.[0] ?? null;
    } else if ((data.teamIds?.length ?? 0) > 0) {
      entryData.org_level = 'team';
      entryData.org_id = data.teamIds?.[0] ?? null;
    }

    if (data.expiresAt !== undefined) entryData.expires_at = data.expiresAt;
    if (data.priority !== undefined) entryData.priority = data.priority;
    if (data.color !== undefined) entryData.color = data.color;

    return entryData;
  }

  /**
   * Create a new blackboard entry
   * @param data - The data object
   * @param tenantId - The tenant ID
   * @param authorId - The authorId parameter
   */
  async createEntry(
    data: BlackboardCreateData,
    tenantId: number,
    authorId: number,
  ): Promise<BlackboardEntry> {
    const hasMultiOrg = this.hasMultiOrgAssignment(data);

    // SECURITY: Validate user has permission to assign to these orgs
    if (hasMultiOrg) {
      await this.validateOrgPermissions(
        authorId,
        tenantId,
        data.areaIds ?? [],
        data.departmentIds ?? [],
        data.teamIds ?? [],
      );
    }

    // Backwards compatibility: validate legacy org_level/org_id
    if (
      !hasMultiOrg &&
      data.orgLevel !== undefined &&
      data.orgLevel !== 'company' &&
      data.orgId === undefined
    ) {
      throw new ServiceError(
        'VALIDATION_ERROR',
        `Organization ID is required for ${data.orgLevel} level entries`,
      );
    }

    const entryData = this.buildEntryCreateData(data, tenantId, authorId);
    const entry = await blackboard.createEntry(entryData);
    if (!entry) {
      throw new ServiceError('SERVER_ERROR', 'Failed to create entry');
    }

    // Sync multi-organization mappings if provided (N:M table)
    if (hasMultiOrg) {
      await this.syncEntryOrganizations(
        entry.id,
        data.departmentIds ?? [],
        data.teamIds ?? [],
        data.areaIds ?? [],
      );
    }

    return this.transformEntry(entry);
  }

  /** Apply basic fields (title, content, etc.) to update data */
  private applyBasicFields(updateData: EntryUpdateData, data: BlackboardUpdateData): void {
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.expiresAt !== undefined) updateData.expires_at = data.expiresAt;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.orgLevel !== undefined) updateData.org_level = data.orgLevel;
    if (data.orgId !== undefined && data.orgId !== null) updateData.org_id = data.orgId;
  }

  /** Apply org assignments from N:M arrays to main table columns */
  private applyOrgAssignments(updateData: EntryUpdateData, data: BlackboardUpdateData): void {
    const firstAreaId = data.areaIds?.[0];
    const firstDeptId = data.departmentIds?.[0];
    const firstTeamId = data.teamIds?.[0];

    // Priority: area > department > team
    if (firstAreaId !== undefined) {
      updateData.area_id = firstAreaId;
      updateData.org_level = 'area';
    } else if (data.areaIds !== undefined) {
      updateData.area_id = null;
    }

    if (firstDeptId !== undefined) {
      updateData.org_level = 'department';
      updateData.org_id = firstDeptId;
    }

    if (firstTeamId !== undefined) {
      updateData.org_level = 'team';
      updateData.org_id = firstTeamId;
    }

    // If no assignments but arrays were provided, set to company level
    const hasNoAssignments =
      firstAreaId === undefined && firstDeptId === undefined && firstTeamId === undefined;
    const arraysProvided =
      data.areaIds !== undefined || data.departmentIds !== undefined || data.teamIds !== undefined;
    if (hasNoAssignments && arraysProvided) {
      updateData.org_level = 'company';
      updateData.org_id = null;
      updateData.area_id = null;
    }
  }

  /** Build update data object from BlackboardUpdateData */
  private buildEntryUpdateData(data: BlackboardUpdateData, userId: number): EntryUpdateData {
    const updateData: EntryUpdateData = { author_id: userId };
    this.applyBasicFields(updateData, data);
    this.applyOrgAssignments(updateData, data);
    return updateData;
  }

  /** Lookup entry by ID or UUID */
  private async lookupEntry(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<DbBlackboardEntry> {
    const entry =
      typeof id === 'string' ?
        await blackboard.getEntryByUuid(id, tenantId, userId)
      : await blackboard.getEntryById(id, tenantId, userId);
    if (!entry) {
      throw new ServiceError('NOT_FOUND', ERROR_ENTRY_NOT_FOUND);
    }
    return entry;
  }

  /**
   * Update a blackboard entry
   * @param id - The resource ID (numeric or UUID)
   * @param data - The data object
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   */
  async updateEntry(
    id: number | string,
    data: BlackboardUpdateData,
    tenantId: number,
    userId: number,
  ): Promise<BlackboardEntry> {
    await this.lookupEntry(id, tenantId, userId); // Verify access

    // SECURITY: Validate user has permission to assign to these orgs
    const hasMultiOrg =
      data.departmentIds !== undefined || data.teamIds !== undefined || data.areaIds !== undefined;
    if (hasMultiOrg) {
      await this.validateOrgPermissions(
        userId,
        tenantId,
        data.areaIds ?? [],
        data.departmentIds ?? [],
        data.teamIds ?? [],
      );
    }

    const updateData = this.buildEntryUpdateData(data, userId);
    const entry = await blackboard.updateEntry(id, updateData, tenantId);
    if (!entry) {
      throw new ServiceError('SERVER_ERROR', 'Failed to update entry');
    }

    // Sync multi-organization mappings if provided
    if (hasMultiOrg) {
      await this.syncEntryOrganizations(
        entry.id,
        data.departmentIds ?? [],
        data.teamIds ?? [],
        data.areaIds ?? [],
      );
    }

    return this.transformEntry(entry);
  }

  /**
   * Delete a blackboard entry
   * Only allowed for: root users OR the entry author
   * @param id - The resource ID (numeric or UUID)
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The user's role (root/admin/employee)
   */
  async deleteEntry(
    id: number | string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<{ message: string }> {
    // Check if entry exists and user has access (use dual-ID lookup)
    const entry =
      typeof id === 'string' ?
        await blackboard.getEntryByUuid(id, tenantId, userId)
      : await blackboard.getEntryById(id, tenantId, userId);

    if (!entry) {
      throw new ServiceError('NOT_FOUND', ERROR_ENTRY_NOT_FOUND);
    }

    // SECURITY: Only root or author can delete
    const isRoot = userRole === 'root';
    const isAuthor = entry.author_id === userId;
    if (!isRoot && !isAuthor) {
      throw new ServiceError('FORBIDDEN', 'Only the author or root can delete this entry');
    }

    const success = await blackboard.deleteEntry(id, tenantId);
    if (!success) {
      throw new ServiceError('SERVER_ERROR', 'Failed to delete entry');
    }

    return { message: 'Entry deleted successfully' };
  }

  /**
   * Archive a blackboard entry
   * @param id - The resource ID (numeric or UUID)
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   */
  async archiveEntry(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<BlackboardEntry> {
    return await this.updateEntry(id, { status: 'archived' }, tenantId, userId);
  }

  /**
   * Unarchive a blackboard entry
   * @param id - The resource ID (numeric or UUID)
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   */
  async unarchiveEntry(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<BlackboardEntry> {
    return await this.updateEntry(id, { status: 'active' }, tenantId, userId);
  }

  /**
   * Confirm reading a blackboard entry
   * @param entryId - The entry ID (numeric or UUID)
   * @param userId - The user ID
   */
  async confirmEntry(entryId: number | string, userId: number): Promise<{ message: string }> {
    const success = await blackboard.confirmEntry(entryId, userId);
    if (!success) {
      throw new ServiceError(
        'BAD_REQUEST',
        'Entry does not require confirmation or already confirmed',
      );
    }
    return { message: 'Entry confirmed successfully' };
  }

  /**
   * Remove confirmation (mark as unread)
   * @param entryId - The entry ID (numeric or UUID)
   * @param userId - The user ID
   */
  async unconfirmEntry(entryId: number | string, userId: number): Promise<{ message: string }> {
    const success = await blackboard.unconfirmEntry(entryId, userId);
    if (!success) {
      throw new ServiceError('BAD_REQUEST', 'Entry was not confirmed or does not exist');
    }
    return { message: 'Entry marked as unread successfully' };
  }

  /**
   * Get confirmation status for an entry
   * @param entryId - The entry ID (numeric or UUID)
   * @param tenantId - The tenant ID
   */
  async getConfirmationStatus(
    entryId: number | string,
    tenantId: number,
  ): Promise<Record<string, unknown>[]> {
    const users = await blackboard.getConfirmationStatus(entryId, tenantId);
    return users.map((user: Record<string, unknown>) => dbToApi(user));
  }

  /**
   * Get dashboard entries for a user
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param limit - The result limit
   */
  async getDashboardEntries(
    tenantId: number,
    userId: number,
    // eslint-disable-next-line @typescript-eslint/typedef -- Default parameter with literal value
    limit = 3,
  ): Promise<BlackboardEntry[]> {
    const entries = await blackboard.getDashboardEntries(tenantId, userId, limit);
    return entries.map((entry: DbBlackboardEntry) => this.transformEntry(entry));
  }

  // DEPRECATED: Attachment methods removed - use documents API with blackboard_entry_id
  // See: documentsService.getDocumentsByBlackboardEntry() and /api/v2/documents/

  // ============================================================================
  // Comment Methods (NEW 2025-11-24)
  // ============================================================================

  /**
   * Get comments for a blackboard entry
   * @param entryId - The entry ID (numeric or UUID)
   * @param tenantId - The tenant ID
   */
  async getComments(entryId: number | string, tenantId: number): Promise<BlackboardComment[]> {
    const comments = await blackboard.getComments(entryId, tenantId);
    return comments.map((comment: DbBlackboardComment) => this.transformComment(comment));
  }

  /**
   * Add a comment to a blackboard entry
   * @param entryId - The entry ID (numeric or UUID)
   * @param userId - The user ID
   * @param tenantId - The tenant ID
   * @param comment - The comment text
   * @param isInternal - Whether the comment is internal (admin only)
   */
  async addComment(
    entryId: number | string,
    userId: number,
    tenantId: number,
    comment: string,
    isInternal: boolean = false,
  ): Promise<{ id: number; message: string }> {
    try {
      const result = await blackboard.addComment(entryId, userId, tenantId, comment, isInternal);
      return { id: result.id, message: 'Comment added successfully' };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === ERROR_ENTRY_NOT_FOUND) {
        throw new ServiceError('NOT_FOUND', ERROR_ENTRY_NOT_FOUND);
      }
      throw new ServiceError('SERVER_ERROR', 'Failed to add comment', error);
    }
  }

  /**
   * Delete a comment from a blackboard entry
   * @param commentId - The comment ID
   * @param tenantId - The tenant ID
   */
  async deleteComment(commentId: number, tenantId: number): Promise<{ message: string }> {
    const success = await blackboard.deleteComment(commentId, tenantId);
    if (!success) {
      throw new ServiceError('NOT_FOUND', 'Comment not found');
    }
    return { message: 'Comment deleted successfully' };
  }

  /**
   * Get a single comment by ID
   * @param commentId - The comment ID
   * @param tenantId - The tenant ID
   */
  async getCommentById(commentId: number, tenantId: number): Promise<BlackboardComment> {
    const comment = await blackboard.getCommentById(commentId, tenantId);
    if (!comment) {
      throw new ServiceError('NOT_FOUND', 'Comment not found');
    }
    return this.transformComment(comment);
  }

  /**
   * Transform database comment to API format
   * Matches KVP format for consistency: firstName, lastName, role
   * @param comment - The comment from database
   */
  private transformComment(comment: DbBlackboardComment): BlackboardComment {
    // Build result conditionally to satisfy exactOptionalPropertyTypes
    const result: BlackboardComment = {
      id: comment.id,
      entryId: comment.entry_id,
      userId: comment.user_id,
      comment: comment.comment,
      isInternal: Boolean(comment.is_internal),
      createdAt: comment.created_at.toISOString(),
    };

    // Match KVP format - conditionally add optional fields
    if (comment.user_first_name !== undefined) result.firstName = comment.user_first_name;
    if (comment.user_last_name !== undefined) result.lastName = comment.user_last_name;
    if (comment.user_role !== undefined) result.role = comment.user_role;
    if (comment.user_profile_picture !== undefined)
      result.profilePicture = comment.user_profile_picture;

    return result;
  }

  /**
   * Transform database entry to API format
   * @param entry - The entry parameter
   */
  private transformEntry(entry: DbBlackboardEntry): BlackboardEntry {
    const transformed = dbToApi(entry);

    // Confirmation status
    transformed['isConfirmed'] = Boolean(entry.is_confirmed);
    transformed['confirmedAt'] = entry.confirmed_at?.toISOString() ?? null;

    // Author info - use helper to reduce complexity
    this.addOptionalField(transformed, 'authorFullName', entry.author_full_name);
    this.addOptionalField(transformed, 'authorFirstName', entry.author_first_name);
    this.addOptionalField(transformed, 'authorLastName', entry.author_last_name);

    // Remove raw database fields
    delete transformed['is_confirmed'];
    delete transformed['confirmed_at'];

    return transformed as BlackboardEntry;
  }

  /**
   * Add optional field if value is non-empty string
   */
  private addOptionalField(
    target: Record<string, unknown>,
    key: string,
    value: string | undefined,
  ): void {
    if (value !== undefined && value !== '') {
      // eslint-disable-next-line security/detect-object-injection -- key is hardcoded string literal from internal calls only
      target[key] = value;
    }
  }
}

export const blackboardService = new BlackboardService();
