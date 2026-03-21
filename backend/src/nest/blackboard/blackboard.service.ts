/**
 * Blackboard Service - Facade
 *
 * Orchestrates all blackboard operations by delegating to sub-services.
 * This is the main entry point for the blackboard module.
 *
 * Sub-services:
 * - BlackboardEntriesService: Entry CRUD + Dashboard
 * - BlackboardCommentsService: Comment operations
 * - BlackboardConfirmationsService: Read confirmations
 * - BlackboardAttachmentsService: File attachments
 */
import { Injectable, Logger } from '@nestjs/common';

import type { MulterFile } from '../common/interfaces/multer.interface.js';
import { BlackboardAttachmentsService } from './blackboard-attachments.service.js';
import { BlackboardCommentsService } from './blackboard-comments.service.js';
import { BlackboardConfirmationsService } from './blackboard-confirmations.service.js';
import { BlackboardEntriesService } from './blackboard-entries.service.js';
import type {
  BlackboardComment,
  BlackboardEntryResponse,
  EntryFilters,
  PaginatedBlackboardComments,
  PaginatedEntriesResult,
} from './blackboard.types.js';
import type { CreateEntryDto } from './dto/create-entry.dto.js';
import type { UpdateEntryDto } from './dto/update-entry.dto.js';

// Re-export types for consumers
export type {
  BlackboardEntryResponse,
  PaginatedEntriesResult,
  PaginatedBlackboardComments,
  BlackboardComment,
  EntryFilters,
};

@Injectable()
export class BlackboardService {
  private readonly logger = new Logger(BlackboardService.name);

  constructor(
    private readonly entriesService: BlackboardEntriesService,
    private readonly commentsService: BlackboardCommentsService,
    private readonly confirmationsService: BlackboardConfirmationsService,
    private readonly attachmentsService: BlackboardAttachmentsService,
  ) {}

  // ==========================================================================
  // ENTRY OPERATIONS (delegated to BlackboardEntriesService)
  // ==========================================================================

  async listEntries(
    tenantId: number,
    userId: number,
    filters: EntryFilters,
  ): Promise<PaginatedEntriesResult> {
    return await this.entriesService.listEntries(tenantId, userId, filters);
  }

  async getEntryById(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<BlackboardEntryResponse> {
    return await this.entriesService.getEntryById(id, tenantId, userId);
  }

  async getEntryFull(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<{
    entry: BlackboardEntryResponse;
    comments: PaginatedBlackboardComments;
    attachments: Record<string, unknown>[];
  }> {
    this.logger.debug(`Getting full entry ${String(id)} for tenant ${tenantId}`);

    const entry = await this.entriesService.getEntryById(id, tenantId, userId);
    const numericId = (entry as Record<string, unknown>)['id'] as number;
    const comments = await this.commentsService.getComments(numericId, tenantId);
    const attachments = await this.attachmentsService.getAttachments(numericId, tenantId, userId);

    return { entry, comments, attachments };
  }

  async createEntry(
    dto: CreateEntryDto,
    tenantId: number,
    userId: number,
  ): Promise<BlackboardEntryResponse> {
    return await this.entriesService.createEntry(dto, tenantId, userId);
  }

  async updateEntry(
    id: number | string,
    dto: UpdateEntryDto,
    tenantId: number,
    userId: number,
  ): Promise<BlackboardEntryResponse> {
    return await this.entriesService.updateEntry(id, dto, tenantId, userId);
  }

  async deleteEntry(
    id: number | string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<{ message: string }> {
    return await this.entriesService.deleteEntry(id, tenantId, userId, userRole);
  }

  async archiveEntry(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<BlackboardEntryResponse> {
    return await this.entriesService.archiveEntry(id, tenantId, userId);
  }

  async unarchiveEntry(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<BlackboardEntryResponse> {
    return await this.entriesService.unarchiveEntry(id, tenantId, userId);
  }

  // ==========================================================================
  // DASHBOARD (delegated to BlackboardEntriesService)
  // ==========================================================================

  async getDashboardEntries(
    tenantId: number,
    userId: number,
    limit: number = 3,
  ): Promise<BlackboardEntryResponse[]> {
    return await this.entriesService.getDashboardEntries(tenantId, userId, limit);
  }

  // ==========================================================================
  // CONFIRMATION OPERATIONS (delegated to BlackboardConfirmationsService)
  // ==========================================================================

  async confirmEntry(id: number | string, userId: number): Promise<{ message: string }> {
    return await this.confirmationsService.confirmEntry(id, userId);
  }

  async unconfirmEntry(id: number | string, userId: number): Promise<{ message: string }> {
    return await this.confirmationsService.unconfirmEntry(id, userId);
  }

  async getConfirmationStatus(
    id: number | string,
    tenantId: number,
  ): Promise<Record<string, unknown>[]> {
    return await this.confirmationsService.getConfirmationStatus(id, tenantId);
  }

  async getUnconfirmedCount(userId: number, tenantId: number): Promise<{ count: number }> {
    return await this.confirmationsService.getUnconfirmedCount(userId, tenantId);
  }

  // ==========================================================================
  // COMMENT OPERATIONS (delegated to BlackboardCommentsService)
  // ==========================================================================

  async getComments(
    id: number | string,
    tenantId: number,
    limit?: number,
    offset?: number,
  ): Promise<PaginatedBlackboardComments> {
    return await this.commentsService.getComments(id, tenantId, limit, offset);
  }

  async getReplies(commentId: number, tenantId: number): Promise<BlackboardComment[]> {
    return await this.commentsService.getReplies(commentId, tenantId);
  }

  async addComment(
    id: number | string,
    userId: number,
    tenantId: number,
    comment: string,
    isInternal: boolean,
    parentId?: number,
  ): Promise<{ id: number; message: string }> {
    return await this.commentsService.addComment(
      id,
      userId,
      tenantId,
      comment,
      isInternal,
      parentId,
    );
  }

  async deleteComment(commentId: number, tenantId: number): Promise<{ message: string }> {
    return await this.commentsService.deleteComment(commentId, tenantId);
  }

  // ==========================================================================
  // ATTACHMENT OPERATIONS (delegated to BlackboardAttachmentsService)
  // ==========================================================================

  async uploadAttachment(
    entryId: number | string,
    file: MulterFile,
    tenantId: number,
    userId: number,
  ): Promise<Record<string, unknown>> {
    const entry = await this.entriesService.getEntryById(entryId, tenantId, userId);
    const numericId = (entry as Record<string, unknown>)['id'] as number;
    return await this.attachmentsService.uploadAttachment(numericId, file, tenantId, userId);
  }

  async getAttachments(
    entryId: number | string,
    tenantId: number,
    userId: number,
  ): Promise<Record<string, unknown>[]> {
    const entry = await this.entriesService.getEntryById(entryId, tenantId, userId);
    const numericId = (entry as Record<string, unknown>)['id'] as number;
    return await this.attachmentsService.getAttachments(numericId, tenantId, userId);
  }

  async downloadAttachment(
    attachmentId: number,
    userId: number,
    tenantId: number,
  ): Promise<{
    content: Buffer;
    originalName: string;
    mimeType: string;
    fileSize: number;
  }> {
    return await this.attachmentsService.downloadAttachment(attachmentId, userId, tenantId);
  }

  async previewAttachment(
    attachmentId: number,
    userId: number,
    tenantId: number,
  ): Promise<{
    content: Buffer;
    originalName: string;
    mimeType: string;
    fileSize: number;
  }> {
    return await this.attachmentsService.previewAttachment(attachmentId, userId, tenantId);
  }

  async downloadByFileUuid(
    fileUuid: string,
    userId: number,
    tenantId: number,
  ): Promise<{
    content: Buffer;
    originalName: string;
    mimeType: string;
    fileSize: number;
  }> {
    return await this.attachmentsService.downloadByFileUuid(fileUuid, userId, tenantId);
  }

  async deleteAttachment(
    attachmentId: number,
    userId: number,
    tenantId: number,
  ): Promise<{ message: string }> {
    return await this.attachmentsService.deleteAttachment(attachmentId, userId, tenantId);
  }
}
