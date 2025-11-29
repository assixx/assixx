/**
 * KVP API v2 Service Layer
 * Business logic for Continuous Improvement Process (Kontinuierlicher Verbesserungsprozess)
 */
import { ServiceError } from '../../../utils/ServiceError.js';
import { dbToApi } from '../../../utils/fieldMapping.js';
import kvpModel from './kvp.model.js';

/**
 * Helper: Check if string is UUIDv7 format
 * UUIDv7 format: 8-4-4-4-12 hex characters (lowercase or uppercase)
 * Example: 018c5f8e-7a1b-7c3d-9e4f-0a1b2c3d4e5f
 */
function isUuid(value: string | number): boolean {
  if (typeof value === 'number') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

export interface KVPFilters {
  filter?: string; // 'mine' | 'all' | 'archived' | etc.
  status?: string;
  categoryId?: number;
  priority?: string;
  orgLevel?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface KVPCreateData {
  title: string;
  description: string;
  categoryId: number;
  departmentId?: number | null;
  orgLevel: 'company' | 'department' | 'area' | 'team';
  orgId: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  expectedBenefit?: string;
  estimatedCost?: string;
}

// API Response types
export interface KVPSuggestion {
  id: number;
  uuid: string; // NEW: External UUIDv7 identifier for secure URLs
  title: string;
  description: string;
  categoryId: number;
  orgLevel: string;
  orgId: number;
  isShared: number; // 0 = private (only creator + team leader), 1 = shared
  departmentId?: number;
  teamId?: number;
  submittedBy: number;
  status: string;
  priority: string;
  expectedBenefit?: string;
  estimatedCost?: string;
  actualSavings?: number;
  implementedDate?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  category?: {
    id: number;
    name: string;
    color: string;
    icon: string;
  };
  submitter?: {
    id: number;
    firstName: string;
    lastName: string;
  };
  _count?: {
    comments: number;
    attachments: number;
  };
}

export interface KVPUpdateData {
  title?: string;
  description?: string;
  categoryId?: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  expectedBenefit?: string;
  estimatedCost?: string;
  actualSavings?: number;
  status?: 'new' | 'in_review' | 'approved' | 'implemented' | 'rejected' | 'archived';
  assignedTo?: number;
  rejectionReason?: string;
}

export interface CommentData {
  comment: string;
  isInternal?: boolean;
}

export interface PointsData {
  userId: number;
  suggestionId: number;
  points: number;
  reason: string;
}

export interface AttachmentData {
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  uploadedBy: number;
  fileUuid?: string; // NEW: UUID for secure downloads (generated in controller)
  fileChecksum?: string; // NEW: SHA-256 checksum for integrity verification
}

// Response types for service methods
export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  tenantId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Comment {
  id: number;
  suggestionId: number;
  comment: string;
  isInternal: boolean;
  createdBy: number;
  createdByName?: string;
  createdByLastname?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Attachment {
  id: number;
  suggestionId: number;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  uploadedBy: number;
  fileUuid: string;
  fileChecksum?: string;
  createdAt: string;
}

export interface PointsAward {
  id: number;
  userId: number;
  suggestionId: number;
  points: number;
  reason: string;
  awardedBy: number;
  createdAt: Date | string;
}

export interface UserPoints {
  totalPoints: number;
  userId: number;
  tenantId: number;
}

export interface DashboardStats {
  totalSuggestions: number;
  newSuggestions: number;
  inReviewSuggestions: number;
  approvedSuggestions: number;
  implementedSuggestions: number;
  rejectedSuggestions: number;
}

/**
 *
 */
class KVPService {
  /**
   * Get all categories (categories are global, not tenant-specific)
   * @param _tenantId - The tenant ID (unused, but kept for API compatibility)
   */
  async getCategories(_tenantId: number): Promise<Category[]> {
    try {
      const categories = await kvpModel.getCategories();
      return categories.map((category: Record<string, unknown>) =>
        dbToApi(category),
      ) as unknown as Category[];
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to get categories', error);
    }
  }

  /**
   * Apply search and type filters to suggestions
   */
  private applyFilters(
    suggestions: Record<string, unknown>[],
    filters: KVPFilters,
    userId: number,
  ): Record<string, unknown>[] {
    let result = suggestions;

    // Apply search filter
    if (filters.search !== undefined && filters.search !== '') {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (s: Record<string, unknown>) =>
          String(s['title']).toLowerCase().includes(searchLower) ||
          String(s['description']).toLowerCase().includes(searchLower),
      );
    }

    // Apply type filter
    if (filters.filter === 'mine') {
      result = result.filter((s: Record<string, unknown>) => s['submitted_by'] === userId);
    } else if (filters.filter === 'team') {
      result = result.filter((s: Record<string, unknown>) => s['org_level'] === 'team');
    } else if (filters.filter === 'department') {
      result = result.filter((s: Record<string, unknown>) => s['org_level'] === 'department');
    }

    return result;
  }

  /**
   * List KVP suggestions with filters
   */
  async listSuggestions(
    tenantId: number,
    userId: number,
    userRole: string,
    filters: KVPFilters = {},
  ): Promise<{
    suggestions: KVPSuggestion[];
    pagination: { currentPage: number; totalPages: number; pageSize: number; totalItems: number };
  }> {
    try {
      const page = filters.page ?? 1;
      const limit = filters.limit ?? 20;
      const offset = (page - 1) * limit;

      // Build filter object without undefined values
      const suggestionFilters: Record<string, unknown> = {};
      if (filters.status !== undefined) suggestionFilters['status'] = filters.status;
      if (filters.categoryId !== undefined) suggestionFilters['category_id'] = filters.categoryId;
      if (filters.priority !== undefined) suggestionFilters['priority'] = filters.priority;
      if (filters.orgLevel !== undefined) suggestionFilters['org_level'] = filters.orgLevel;

      const suggestions = await kvpModel.getSuggestions(
        tenantId,
        userId,
        userRole,
        suggestionFilters,
      );
      const filtered = this.applyFilters(suggestions, filters, userId);
      const paginated = filtered.slice(offset, offset + limit);

      return {
        suggestions: paginated.map((s: Record<string, unknown>) =>
          dbToApi(s),
        ) as unknown as KVPSuggestion[],
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(filtered.length / limit),
          pageSize: limit,
          totalItems: filtered.length,
        },
      };
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to list suggestions', error);
    }
  }

  /**
   * Get a specific suggestion by ID
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   */
  /**
   * Get suggestion by ID or UUID (Dual-ID lookup for transition period)
   * Accepts both numeric ID and UUIDv7 string
   * @param idOrUuid - Numeric ID or UUIDv7 string
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The user role
   */
  async getSuggestionById(
    idOrUuid: number | string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<KVPSuggestion> {
    let suggestion;

    // Determine if lookup is by UUID or numeric ID
    if (isUuid(idOrUuid)) {
      // UUID lookup (NEW - secure external identifier)
      suggestion = await kvpModel.getSuggestionByUuid(
        idOrUuid as string,
        tenantId,
        userId,
        userRole,
      );
    } else {
      // Numeric ID lookup (LEGACY - for backwards compatibility)
      const numericId = typeof idOrUuid === 'string' ? Number.parseInt(idOrUuid, 10) : idOrUuid;
      if (Number.isNaN(numericId)) {
        throw new ServiceError('VALIDATION_ERROR', 'Invalid ID format');
      }
      suggestion = await kvpModel.getSuggestionById(numericId, tenantId, userId, userRole);
    }

    if (!suggestion) {
      throw new ServiceError('NOT_FOUND', 'Suggestion not found');
    }

    return dbToApi(suggestion) as unknown as KVPSuggestion;
  }

  /**
   * Create a new KVP suggestion
   * @param data - The data object
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   */
  async createSuggestion(
    data: KVPCreateData,
    tenantId: number,
    userId: number,
  ): Promise<KVPSuggestion> {
    try {
      // Debug logging
      console.info('[KVP Service] Incoming data:', JSON.stringify(data));
      console.info('[KVP Service] departmentId from data:', data.departmentId);
      // When orgLevel is 'team', orgId is the team_id
      const teamId = data.orgLevel === 'team' ? data.orgId : null;

      // Build suggestion data object without undefined values (exactOptionalPropertyTypes requirement)
      const suggestionData: {
        tenant_id: number;
        title: string;
        description: string;
        category_id: number;
        department_id?: number | null;
        org_level: 'company' | 'department' | 'area' | 'team';
        org_id: number;
        submitted_by: number;
        team_id?: number | null;
        priority?: 'low' | 'normal' | 'high' | 'urgent';
        expected_benefit?: string;
        estimated_cost?: string;
      } = {
        tenant_id: tenantId,
        title: data.title,
        description: data.description,
        category_id: data.categoryId,
        org_level: data.orgLevel,
        org_id: data.orgId,
        submitted_by: userId,
      };

      // Add optional fields only if they are defined
      if (data.departmentId !== undefined) suggestionData.department_id = data.departmentId;
      if (teamId !== null) suggestionData.team_id = teamId;
      if (data.priority !== undefined) suggestionData.priority = data.priority;
      if (data.expectedBenefit !== undefined)
        suggestionData.expected_benefit = data.expectedBenefit;
      if (data.estimatedCost !== undefined) suggestionData.estimated_cost = data.estimatedCost;

      console.info(
        '[KVP Service] suggestionData being sent to model:',
        JSON.stringify(suggestionData),
      );

      const result = await kvpModel.createSuggestion(suggestionData);

      // Fetch the created suggestion with all details
      const suggestion = await kvpModel.getSuggestionById(
        result.id,
        tenantId,
        userId,
        'admin', // Use admin role to ensure we can see the suggestion
      );

      if (!suggestion) {
        throw new ServiceError('SERVER_ERROR', 'Failed to retrieve created suggestion');
      }

      return dbToApi(suggestion) as unknown as KVPSuggestion;
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to create suggestion', error);
    }
  }

  private validateUpdatePermissions(
    existing: KVPSuggestion,
    data: KVPUpdateData,
    userId: number,
    userRole: string,
  ): void {
    // Check permissions
    if (userRole === 'employee' && existing.submittedBy !== userId) {
      throw new ServiceError('FORBIDDEN', 'You can only update your own suggestions');
    }

    // Update status is admin-only operation
    if (data.status !== undefined && userRole !== 'admin' && userRole !== 'root') {
      throw new ServiceError('FORBIDDEN', 'Only admins can update status');
    }
  }

  private buildUpdateFields(data: KVPUpdateData): Record<string, unknown> {
    const updateFields: Record<string, unknown> = {};
    if (data.title !== undefined) updateFields['title'] = data.title;
    if (data.description !== undefined) updateFields['description'] = data.description;
    if (data.categoryId !== undefined) updateFields['category_id'] = data.categoryId;
    if (data.priority !== undefined) updateFields['priority'] = data.priority;
    if (data.expectedBenefit !== undefined) updateFields['expected_benefit'] = data.expectedBenefit;
    if (data.estimatedCost !== undefined) updateFields['estimated_cost'] = data.estimatedCost;
    if (data.actualSavings !== undefined) updateFields['actual_savings'] = data.actualSavings;
    if (data.rejectionReason !== undefined) updateFields['rejection_reason'] = data.rejectionReason;
    return updateFields;
  }

  /**
   * Update a KVP suggestion
   * @param id - The resource ID
   * @param data - The data object
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   */
  async updateSuggestion(
    id: number | string,
    data: KVPUpdateData,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<KVPSuggestion> {
    // First, check if the suggestion exists and user has access
    const existing = await this.getSuggestionById(id, tenantId, userId, userRole);

    // Validate permissions
    this.validateUpdatePermissions(existing, data, userId, userRole);

    try {
      // If status is being updated, use the special method
      if (data.status !== undefined) {
        await kvpModel.updateSuggestionStatus(
          id,
          tenantId,
          data.status,
          userId,
          data.rejectionReason ?? null,
        );
      }

      // Update other fields
      const updateFields = this.buildUpdateFields(data);
      if (Object.keys(updateFields).length > 0) {
        await kvpModel.updateSuggestion(id, tenantId, updateFields);
      }

      // Return the updated suggestion
      return await this.getSuggestionById(id, tenantId, userId, userRole);
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to update suggestion', error);
    }
  }

  /**
   * Delete a KVP suggestion
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   */
  async deleteSuggestion(
    id: number | string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<{ message: string }> {
    // Check if suggestion exists and user has access
    const suggestion = await this.getSuggestionById(id, tenantId, userId, userRole);

    // Only the owner can delete their suggestion
    if (suggestion.submittedBy !== userId && userRole !== 'root') {
      throw new ServiceError('FORBIDDEN', 'You can only delete your own suggestions');
    }

    try {
      const result = await kvpModel.deleteSuggestion(id, tenantId, userId);
      if (!result) {
        throw new ServiceError('SERVER_ERROR', 'Failed to delete suggestion');
      }
      return { message: 'Suggestion deleted successfully' };
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to delete suggestion', error);
    }
  }

  /**
   * Get comments for a suggestion
   * @param suggestionId - Numeric ID or UUID string
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   */
  async getComments(
    suggestionId: number | string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<Comment[]> {
    // Verify access and resolve UUID to numeric ID
    const suggestion = await this.getSuggestionById(suggestionId, tenantId, userId, userRole);
    const numericId = suggestion.id; // Resolved numeric ID

    try {
      const comments = await kvpModel.getComments(numericId, tenantId, userRole);
      return comments.map((comment: Record<string, unknown>) =>
        dbToApi(comment),
      ) as unknown as Comment[];
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to get comments', error);
    }
  }

  /**
   * Add a comment to a suggestion
   * @param suggestionId - Numeric ID or UUIDv7 string of the suggestion
   * @param data - The data object
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   */
  async addComment(
    suggestionId: number | string,
    data: CommentData,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<Partial<Comment>> {
    // Verify access AND resolve UUID to numeric ID
    const suggestion = await this.getSuggestionById(suggestionId, tenantId, userId, userRole);
    const numericId = suggestion.id;

    try {
      const commentId = await kvpModel.addComment(
        numericId,
        tenantId,
        userId,
        data.comment,
        data.isInternal ?? false,
      );

      return {
        id: commentId,
        suggestionId: numericId,
        comment: data.comment,
        isInternal: data.isInternal ?? false,
        createdBy: userId,
        createdAt: new Date().toISOString(),
      };
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to add comment', error);
    }
  }

  /**
   * Get attachments for a suggestion
   * @param suggestionId - Numeric ID or UUID string
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   */
  async getAttachments(
    suggestionId: number | string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<Attachment[]> {
    // Verify access and resolve UUID to numeric ID
    const suggestion = await this.getSuggestionById(suggestionId, tenantId, userId, userRole);
    const numericId = suggestion.id; // Resolved numeric ID

    try {
      const attachments = await kvpModel.getAttachments(numericId, tenantId);
      return attachments.map((attachment: Record<string, unknown>) =>
        dbToApi(attachment),
      ) as unknown as Attachment[];
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to get attachments', error);
    }
  }

  /**
   * Add an attachment to a suggestion
   * NEW: Accepts fileUuid generated in controller for secure downloads
   * @param suggestionId - The suggestionId parameter
   * @param attachmentData - The attachmentData parameter (includes fileUuid and fileChecksum)
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   */
  async addAttachment(
    suggestionId: number | string,
    attachmentData: AttachmentData,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<Attachment> {
    // Verify access to the suggestion first
    await this.getSuggestionById(suggestionId, tenantId, userId, userRole);

    try {
      // Validate that fileUuid is provided (required for secure downloads)
      if (attachmentData.fileUuid === undefined || attachmentData.fileUuid === '') {
        throw new ServiceError('VALIDATION_ERROR', 'File UUID is required');
      }

      const result = await kvpModel.addAttachment(
        suggestionId,
        tenantId,
        {
          file_name: attachmentData.fileName,
          file_path: attachmentData.filePath,
          file_type: attachmentData.fileType,
          file_size: attachmentData.fileSize,
          uploaded_by: userId,
        },
        attachmentData.fileUuid, // NEW: Pass UUID to model
      );

      return dbToApi(result as unknown as Record<string, unknown>) as unknown as Attachment;
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to add attachment', error);
    }
  }

  /**
   * Get attachment details for download using UUID (secure downloads)
   * @param fileUuid - The file UUID (not ID for security)
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   */
  async getAttachment(
    fileUuid: string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<Attachment> {
    const attachment = await kvpModel.getAttachment(fileUuid, tenantId, userId, userRole);

    if (!attachment) {
      throw new ServiceError('NOT_FOUND', 'Attachment not found');
    }

    return dbToApi(attachment) as unknown as Attachment;
  }

  /**
   * Award points to a user
   * @param data - The data object
   * @param tenantId - The tenant ID
   * @param awardedBy - The awardedBy parameter
   * @param userRole - The userRole parameter
   */
  async awardPoints(
    data: PointsData,
    tenantId: number,
    awardedBy: number,
    userRole: string,
  ): Promise<PointsAward> {
    // Only admins can award points
    if (userRole !== 'admin' && userRole !== 'root') {
      throw new ServiceError('FORBIDDEN', 'Only admins can award points');
    }

    try {
      const pointId = await kvpModel.awardPoints(
        tenantId,
        data.userId,
        data.suggestionId,
        data.points,
        data.reason,
        awardedBy,
      );

      return {
        id: pointId,
        userId: data.userId,
        suggestionId: data.suggestionId,
        points: data.points,
        reason: data.reason,
        awardedBy,
        createdAt: new Date(),
      };
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to award points', error);
    }
  }

  /**
   * Get user points summary
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   */
  async getUserPoints(tenantId: number, userId: number): Promise<UserPoints> {
    try {
      const points = await kvpModel.getUserPoints(tenantId, userId);
      return dbToApi(points) as unknown as UserPoints;
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to get user points', error);
    }
  }

  /**
   * Get dashboard statistics
   * @param tenantId - The tenant ID
   */
  async getDashboardStats(tenantId: number): Promise<DashboardStats> {
    try {
      const stats = await kvpModel.getDashboardStats(tenantId);
      return dbToApi(stats) as unknown as DashboardStats;
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to get dashboard stats', error);
    }
  }

  /**
   * Share a suggestion at specified organization level
   * @param suggestionId - The suggestion ID
   * @param tenantId - The tenant ID
   * @param userId - The user ID performing the share
   * @param orgLevel - The organization level (company, department, team)
   * @param orgId - The organization ID
   */
  async shareSuggestion(
    suggestionId: number | string,
    tenantId: number,
    userId: number,
    orgLevel: 'company' | 'department' | 'area' | 'team',
    orgId: number,
  ): Promise<void> {
    try {
      await kvpModel.updateSuggestionOrgLevel(suggestionId, tenantId, orgLevel, orgId, userId);
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to share suggestion', error);
    }
  }

  /**
   * Unshare a suggestion (reset to private)
   * @param suggestionId - The suggestion ID
   * @param tenantId - The tenant ID
   * @param teamId - The team ID to reset to
   */
  async unshareSuggestion(
    suggestionId: number | string,
    tenantId: number,
    teamId: number,
  ): Promise<void> {
    try {
      await kvpModel.unshareSuggestion(suggestionId, tenantId, teamId);
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to unshare suggestion', error);
    }
  }
}

export const kvpService = new KVPService();
