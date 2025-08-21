/**
 * KVP API v2 Service Layer
 * Business logic for Continuous Improvement Process (Kontinuierlicher Verbesserungsprozess)
 */
import KVPModel from '../../../models/kvp.js';
import { ServiceError } from '../../../utils/ServiceError.js';
import { dbToApi } from '../../../utils/fieldMapping.js';

export interface KVPFilters {
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
  orgLevel: 'company' | 'department' | 'team';
  orgId: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  expectedBenefit?: string;
  estimatedCost?: number;
}

// API Response types
export interface KVPSuggestion {
  id: number;
  title: string;
  description: string;
  categoryId: number;
  orgLevel: string;
  orgId: number;
  submittedBy: number;
  status: string;
  priority: string;
  expectedBenefit?: string;
  estimatedCost?: number;
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

export interface KVPComment {
  id: number;
  comment: string;
  isInternal: boolean;
  createdBy: number;
  createdAt: string;
  user?: {
    firstName: string;
    lastName: string;
  };
}

export interface KVPAttachment {
  id: number;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface KVPUpdateData {
  title?: string;
  description?: string;
  categoryId?: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  expectedBenefit?: string;
  estimatedCost?: number;
  actualSavings?: number;
  status?: 'new' | 'in_review' | 'approved' | 'implemented' | 'rejected' | 'archived';
  assignedTo?: number;
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
}

/**
 *
 */
export class KVPService {
  /**
   * Get all categories for a tenant
   * @param _tenantId - The _tenantId parameter
   */
  async getCategories(_tenantId: number): Promise<unknown[]> {
    try {
      const categories = await KVPModel.getCategories();
      return categories.map((category) => dbToApi(category));
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to get categories', error);
    }
  }

  /**
   * List KVP suggestions with filters
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   * @param filters - The filter criteria
   */
  async listSuggestions(
    tenantId: number,
    userId: number,
    userRole: string,
    filters: KVPFilters = {},
  ): Promise<{
    suggestions: unknown[];
    pagination: {
      currentPage: number;
      totalPages: number;
      pageSize: number;
      totalItems: number;
    };
  }> {
    try {
      const offset = ((filters.page ?? 1) - 1) * (filters.limit ?? 20);

      const suggestions = await KVPModel.getSuggestions(tenantId, userId, userRole, {
        status: filters.status,
        category_id: filters.categoryId,
        priority: filters.priority,
        org_level: filters.orgLevel,
      });

      // Apply search filter if provided
      let filteredSuggestions = suggestions;
      if (filters.search !== undefined && filters.search !== '') {
        const searchLower = filters.search.toLowerCase();
        filteredSuggestions = suggestions.filter(
          (s) =>
            s.title.toLowerCase().includes(searchLower) ||
            s.description.toLowerCase().includes(searchLower),
        );
      }

      // Apply pagination
      const paginatedSuggestions = filteredSuggestions.slice(
        offset,
        offset + (filters.limit ?? 20),
      );

      return {
        suggestions: paginatedSuggestions.map((suggestion) => dbToApi(suggestion)),
        pagination: {
          currentPage: filters.page ?? 1,
          totalPages: Math.ceil(filteredSuggestions.length / (filters.limit ?? 20)),
          pageSize: filters.limit ?? 20,
          totalItems: filteredSuggestions.length,
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
  async getSuggestionById(
    id: number,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<KVPSuggestion> {
    const suggestion = await KVPModel.getSuggestionById(id, tenantId, userId, userRole);

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
      const suggestionData = {
        tenant_id: tenantId,
        title: data.title,
        description: data.description,
        category_id: data.categoryId,
        org_level: data.orgLevel,
        org_id: data.orgId,
        submitted_by: userId,
        priority: data.priority,
        expected_benefit: data.expectedBenefit,
        estimated_cost: data.estimatedCost,
      };

      const result = await KVPModel.createSuggestion(suggestionData);

      // Fetch the created suggestion with all details
      const suggestion = await KVPModel.getSuggestionById(
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

  /**
   * Update a KVP suggestion
   * @param id - The resource ID
   * @param data - The data object
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   */
  async updateSuggestion(
    id: number,
    data: KVPUpdateData,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<KVPSuggestion> {
    // First, check if the suggestion exists and user has access
    const existing = await this.getSuggestionById(id, tenantId, userId, userRole);

    // Check permissions
    if (userRole === 'employee' && existing.submittedBy !== userId) {
      throw new ServiceError('FORBIDDEN', 'You can only update your own suggestions');
    }

    // Update status is admin-only operation
    if (data.status && userRole !== 'admin' && userRole !== 'root') {
      throw new ServiceError('FORBIDDEN', 'Only admins can update status');
    }

    try {
      // If status is being updated, use the special method
      if (data.status) {
        await KVPModel.updateSuggestionStatus(
          id,
          tenantId,
          data.status,
          userId,
          null, // No change reason required for now
        );
      }

      // Update other fields
      const updateFields: Record<string, unknown> = {};
      if (data.title !== undefined) updateFields.title = data.title;
      if (data.description !== undefined) updateFields.description = data.description;
      if (data.categoryId !== undefined) updateFields.category_id = data.categoryId;
      if (data.priority !== undefined) updateFields.priority = data.priority;
      if (data.expectedBenefit !== undefined) updateFields.expected_benefit = data.expectedBenefit;
      if (data.estimatedCost !== undefined) updateFields.estimated_cost = data.estimatedCost;
      if (data.actualSavings !== undefined) updateFields.actual_savings = data.actualSavings;

      if (Object.keys(updateFields).length > 0) {
        await KVPModel.updateSuggestion(id, tenantId, updateFields);
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
    id: number,
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
      const result = await KVPModel.deleteSuggestion(id, tenantId, userId);
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
   * @param suggestionId - The suggestionId parameter
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   */
  async getComments(
    suggestionId: number,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<unknown[]> {
    // Verify access to the suggestion first
    await this.getSuggestionById(suggestionId, tenantId, userId, userRole);

    try {
      const comments = await KVPModel.getComments(suggestionId, userRole);
      return comments.map((comment) => dbToApi(comment));
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to get comments', error);
    }
  }

  /**
   * Add a comment to a suggestion
   * @param suggestionId - The suggestionId parameter
   * @param data - The data object
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   */
  async addComment(
    suggestionId: number,
    data: CommentData,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<unknown> {
    // Verify access to the suggestion first
    await this.getSuggestionById(suggestionId, tenantId, userId, userRole);

    try {
      const commentId = await KVPModel.addComment(
        suggestionId,
        tenantId,
        userId,
        data.comment,
        data.isInternal ?? false,
      );

      return {
        id: commentId,
        comment: data.comment,
        isInternal: data.isInternal ?? false,
        createdAt: new Date(),
      };
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to add comment', error);
    }
  }

  /**
   * Get attachments for a suggestion
   * @param suggestionId - The suggestionId parameter
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   */
  async getAttachments(
    suggestionId: number,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<unknown[]> {
    // Verify access to the suggestion first
    await this.getSuggestionById(suggestionId, tenantId, userId, userRole);

    try {
      const attachments = await KVPModel.getAttachments(suggestionId);
      return attachments.map((attachment) => dbToApi(attachment));
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to get attachments', error);
    }
  }

  /**
   * Add an attachment to a suggestion
   * @param suggestionId - The suggestionId parameter
   * @param attachmentData - The attachmentData parameter
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   */
  async addAttachment(
    suggestionId: number,
    attachmentData: AttachmentData,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<unknown> {
    // Verify access to the suggestion first
    await this.getSuggestionById(suggestionId, tenantId, userId, userRole);

    try {
      const result = await KVPModel.addAttachment(suggestionId, {
        file_name: attachmentData.fileName,
        file_path: attachmentData.filePath,
        file_type: attachmentData.fileType,
        file_size: attachmentData.fileSize,
        uploaded_by: userId,
      });

      return dbToApi(result as unknown as Record<string, unknown>);
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to add attachment', error);
    }
  }

  /**
   * Get attachment details for download
   * @param attachmentId - The attachmentId parameter
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   */
  async getAttachment(
    attachmentId: number,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<unknown> {
    const attachment = await KVPModel.getAttachment(attachmentId, tenantId, userId, userRole);

    if (!attachment) {
      throw new ServiceError('NOT_FOUND', 'Attachment not found');
    }

    return dbToApi(attachment) as unknown;
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
  ): Promise<unknown> {
    // Only admins can award points
    if (userRole !== 'admin' && userRole !== 'root') {
      throw new ServiceError('FORBIDDEN', 'Only admins can award points');
    }

    try {
      const pointId = await KVPModel.awardPoints(
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
  async getUserPoints(tenantId: number, userId: number): Promise<unknown> {
    try {
      const points = await KVPModel.getUserPoints(tenantId, userId);
      return dbToApi(points) as unknown;
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to get user points', error);
    }
  }

  /**
   * Get dashboard statistics
   * @param tenantId - The tenant ID
   */
  async getDashboardStats(tenantId: number): Promise<unknown> {
    try {
      const stats = await KVPModel.getDashboardStats(tenantId);
      return dbToApi(stats) as unknown;
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to get dashboard stats', error);
    }
  }
}

export const kvpService = new KVPService();
