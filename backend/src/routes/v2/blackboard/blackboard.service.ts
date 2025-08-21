/**
 * Blackboard API v2 Service Layer
 * Business logic for company announcements and bulletin board
 */
import Blackboard, {
  DbBlackboardEntry,
  EntryCreateData,
  EntryQueryOptions,
  EntryUpdateData,
} from '../../../models/blackboard.js';
import { ServiceError } from '../../../utils/ServiceError.js';
import { dbToApi } from '../../../utils/fieldMapping.js';

export interface BlackboardFilters {
  status?: 'active' | 'archived';
  filter?: 'all' | 'company' | 'department' | 'team';
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
  priority?: string;
  requiresConfirmation?: boolean;
}

export interface BlackboardEntry {
  id: number;
  title: string;
  content: string;
  status: string;
  priority: string;
  isConfirmed?: boolean;
  requiresConfirmation?: boolean;
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
  orgLevel: 'company' | 'department' | 'team';
  orgId?: number | null;
  expiresAt?: Date | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  color?: string;
  tags?: string[];
  requiresConfirmation?: boolean;
}

export interface BlackboardUpdateData {
  title?: string;
  content?: string;
  orgLevel?: 'company' | 'department' | 'team';
  orgId?: number | null;
  expiresAt?: Date | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  color?: string;
  status?: 'active' | 'archived';
  requiresConfirmation?: boolean;
  tags?: string[];
}

export interface AttachmentData {
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  uploadedBy: number;
}

/**
 *
 */
export class BlackboardService {
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
      const options: EntryQueryOptions = {
        status: filters.status,
        filter: filters.filter,
        search: filters.search,
        page: filters.page,
        limit: filters.limit,
        sortBy: filters.sortBy,
        sortDir: filters.sortDir,
        priority: filters.priority,
        requiresConfirmation: filters.requiresConfirmation,
      };

      const result = (await Blackboard.getAllEntries(tenantId, userId, options)) as {
        entries: unknown[];
        pagination: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        };
      };

      return {
        entries: result.entries.map((entry) => this.transformEntry(entry as DbBlackboardEntry)),
        pagination: result.pagination,
      };
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to list entries', error);
    }
  }

  /**
   * Get a specific blackboard entry by ID
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   */
  async getEntryById(id: number, tenantId: number, userId: number) {
    const entry = await Blackboard.getEntryById(id, tenantId, userId);
    if (!entry) {
      throw new ServiceError('NOT_FOUND', 'Entry not found');
    }
    return this.transformEntry(entry);
  }

  /**
   * Create a new blackboard entry
   * @param data - The data object
   * @param tenantId - The tenant ID
   * @param authorId - The authorId parameter
   */
  async createEntry(data: BlackboardCreateData, tenantId: number, authorId: number) {
    // Validate org_id requirement
    if (data.orgLevel !== 'company' && !data.orgId) {
      throw new ServiceError(
        'VALIDATION_ERROR',
        `Organization ID is required for ${data.orgLevel} level entries`,
      );
    }

    const entryData: EntryCreateData = {
      tenant_id: tenantId,
      title: data.title,
      content: data.content,
      org_level: data.orgLevel,
      org_id: data.orgId ?? null,
      author_id: authorId,
      expires_at: data.expiresAt,
      priority: data.priority,
      color: data.color,
      tags: data.tags,
      requires_confirmation: data.requiresConfirmation,
    };

    const entry = await Blackboard.createEntry(entryData);
    if (!entry) {
      throw new ServiceError('SERVER_ERROR', 'Failed to create entry');
    }

    return this.transformEntry(entry);
  }

  /**
   * Update a blackboard entry
   * @param id - The resource ID
   * @param data - The data object
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   */
  async updateEntry(id: number, data: BlackboardUpdateData, tenantId: number, userId: number) {
    // Check if entry exists and user has access
    const existingEntry = await Blackboard.getEntryById(id, tenantId, userId);
    if (!existingEntry) {
      throw new ServiceError('NOT_FOUND', 'Entry not found');
    }

    const updateData: EntryUpdateData = {
      title: data.title,
      content: data.content,
      org_level: data.orgLevel,
      org_id: data.orgId === null ? undefined : data.orgId,
      expires_at: data.expiresAt,
      priority: data.priority,
      color: data.color,
      status: data.status,
      requires_confirmation: data.requiresConfirmation,
      tags: data.tags,
      author_id: userId,
    };

    const entry = await Blackboard.updateEntry(id, updateData, tenantId);
    if (!entry) {
      throw new ServiceError('SERVER_ERROR', 'Failed to update entry');
    }

    return this.transformEntry(entry);
  }

  /**
   * Delete a blackboard entry
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   */
  async deleteEntry(id: number, tenantId: number, userId: number) {
    // Check if entry exists and user has access
    const entry = await Blackboard.getEntryById(id, tenantId, userId);
    if (!entry) {
      throw new ServiceError('NOT_FOUND', 'Entry not found');
    }

    const success = await Blackboard.deleteEntry(id, tenantId);
    if (!success) {
      throw new ServiceError('SERVER_ERROR', 'Failed to delete entry');
    }

    return { message: 'Entry deleted successfully' };
  }

  /**
   * Archive a blackboard entry
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   */
  async archiveEntry(id: number, tenantId: number, userId: number) {
    return await this.updateEntry(id, { status: 'archived' }, tenantId, userId);
  }

  /**
   * Unarchive a blackboard entry
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   */
  async unarchiveEntry(id: number, tenantId: number, userId: number) {
    return await this.updateEntry(id, { status: 'active' }, tenantId, userId);
  }

  /**
   * Confirm reading a blackboard entry
   * @param entryId - The entryId parameter
   * @param userId - The user ID
   */
  async confirmEntry(entryId: number, userId: number) {
    const success = await Blackboard.confirmEntry(entryId, userId);
    if (!success) {
      throw new ServiceError(
        'BAD_REQUEST',
        'Entry does not require confirmation or already confirmed',
      );
    }
    return { message: 'Entry confirmed successfully' };
  }

  /**
   * Get confirmation status for an entry
   * @param entryId - The entryId parameter
   * @param tenantId - The tenant ID
   */
  async getConfirmationStatus(entryId: number, tenantId: number) {
    const users = await Blackboard.getConfirmationStatus(entryId, tenantId);
    return users.map((user) => dbToApi(user));
  }

  /**
   * Get dashboard entries for a user
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param limit - The result limit
   */
  async getDashboardEntries(tenantId: number, userId: number, limit = 3) {
    const entries = await Blackboard.getDashboardEntries(tenantId, userId, limit);
    return entries.map((entry) => this.transformEntry(entry));
  }

  /**
   * Get all available tags
   * @param tenantId - The tenant ID
   */
  async getAllTags(tenantId: number) {
    const tags = await Blackboard.getAllTags(tenantId);
    return tags.map((tag) => dbToApi(tag));
  }

  /**
   * Get tags for a specific entry
   * @param entryId - The entryId parameter
   */
  async getEntryTags(entryId: number) {
    const tags = await Blackboard.getEntryTags(entryId);
    // Return just the tag names as string array for backward compatibility
    return tags.map((tag) => tag.name);
  }

  /**
   * Add attachment to entry
   * @param entryId - The entryId parameter
   * @param attachment - The attachment parameter
   */
  async addAttachment(entryId: number, attachment: AttachmentData) {
    const attachmentId = await Blackboard.addAttachment(entryId, {
      filename: attachment.filename,
      originalName: attachment.originalName,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      filePath: attachment.filePath,
      uploadedBy: attachment.uploadedBy,
    });

    return { id: attachmentId, message: 'Attachment added successfully' };
  }

  /**
   * Get attachments for an entry
   * @param entryId - The entryId parameter
   */
  async getEntryAttachments(entryId: number) {
    const attachments = await Blackboard.getEntryAttachments(entryId);
    return attachments.map((attachment) => dbToApi(attachment));
  }

  /**
   * Get single attachment
   * @param attachmentId - The attachmentId parameter
   * @param tenantId - The tenant ID
   */
  async getAttachmentById(attachmentId: number, tenantId: number) {
    const attachment = await Blackboard.getAttachmentById(attachmentId, tenantId);
    if (!attachment) {
      throw new ServiceError('NOT_FOUND', 'Attachment not found');
    }
    return dbToApi(attachment);
  }

  /**
   * Delete attachment
   * @param attachmentId - The attachmentId parameter
   * @param tenantId - The tenant ID
   */
  async deleteAttachment(attachmentId: number, tenantId: number) {
    const success = await Blackboard.deleteAttachment(attachmentId, tenantId);
    if (!success) {
      throw new ServiceError('NOT_FOUND', 'Attachment not found');
    }
    return { message: 'Attachment deleted successfully' };
  }

  /**
   * Transform database entry to API format
   * @param entry - The entry parameter
   */
  private transformEntry(entry: DbBlackboardEntry): BlackboardEntry {
    const transformed = dbToApi(entry);

    // Handle special transformations
    transformed.isConfirmed = Boolean(entry.is_confirmed);
    transformed.requiresConfirmation = Boolean(entry.requires_confirmation);

    // Handle author info
    if (entry.author_full_name) {
      transformed.authorFullName = entry.author_full_name;
    }
    if (entry.author_first_name) {
      transformed.authorFirstName = entry.author_first_name;
    }
    if (entry.author_last_name) {
      transformed.authorLastName = entry.author_last_name;
    }

    // Transform tags from objects to string array if present
    if (entry.tags && Array.isArray(entry.tags)) {
      transformed.tags = entry.tags.map((tag: unknown) =>
        typeof tag === 'string' ?
          tag !== null && tag !== undefined
        : (tag as { name: string }).name,
      );
    }

    // Remove raw database fields
    delete transformed.is_confirmed;

    return transformed as BlackboardEntry;
  }
}

export const blackboardService = new BlackboardService();
