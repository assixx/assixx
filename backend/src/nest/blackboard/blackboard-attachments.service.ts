/**
 * Blackboard Attachments Service
 *
 * Handles file attachments for blackboard entries.
 * Delegates to DocumentsService for actual file operations.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import crypto from 'node:crypto';
import path from 'node:path';
import { v7 as uuidv7 } from 'uuid';

import type { MulterFile } from '../common/interfaces/multer.interface.js';
import { DatabaseService } from '../database/database.service.js';
import { DocumentsService } from '../documents/documents.service.js';

@Injectable()
export class BlackboardAttachmentsService {
  private readonly logger = new Logger(BlackboardAttachmentsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly documentsService: DocumentsService,
  ) {}

  /**
   * Upload attachment to entry.
   */
  async uploadAttachment(
    entryId: number,
    file: MulterFile,
    tenantId: number,
    userId: number,
  ): Promise<Record<string, unknown>> {
    this.logger.log(`Uploading attachment to entry ${entryId}`);

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
        blackboardEntryId: entryId,
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
   * Get attachments for entry.
   */
  async getAttachments(
    entryId: number,
    tenantId: number,
    userId: number,
  ): Promise<Record<string, unknown>[]> {
    this.logger.debug(`Getting attachments for entry ${entryId}`);

    const result = await this.documentsService.listDocuments(tenantId, userId, {
      blackboardEntryId: entryId,
      isActive: 1,
      page: 1,
      limit: 100,
    });

    return result.documents;
  }

  /**
   * Download attachment by ID.
   */
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
    this.logger.log(`Downloading attachment ${attachmentId}`);
    return await this.documentsService.getDocumentContent(attachmentId, userId, tenantId);
  }

  /**
   * Preview attachment.
   */
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
    this.logger.log(`Previewing attachment ${attachmentId}`);
    return await this.documentsService.getDocumentContent(attachmentId, userId, tenantId);
  }

  /**
   * Download attachment by file UUID.
   */
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
   * Delete attachment.
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
