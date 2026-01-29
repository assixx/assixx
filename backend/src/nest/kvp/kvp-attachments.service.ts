/**
 * KVP Attachments Sub-Service
 *
 * Manages file attachments on KVP suggestions. Own bounded context with kvp_attachments table.
 * Called by KvpService facade — never directly by the controller.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type { DbAttachment, KVPAttachment } from './kvp.types.js';

/** Attachment row joined with suggestion data for access control */
export interface AttachmentWithSuggestion extends DbAttachment {
  submitted_by: number;
  status: string;
  org_level: string;
  org_id: number;
}

@Injectable()
export class KvpAttachmentsService {
  private readonly logger = new Logger(KvpAttachmentsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Get attachments for a suggestion
   * @param numericId - Resolved numeric suggestion ID (facade handles UUID resolution)
   * @param tenantId - Tenant ID for isolation
   */
  async getAttachments(
    numericId: number,
    tenantId: number,
  ): Promise<KVPAttachment[]> {
    this.logger.debug(`Getting attachments for suggestion ${numericId}`);

    const rows = await this.db.query<DbAttachment>(
      `SELECT a.*, u.first_name, u.last_name
       FROM kvp_attachments a
       JOIN kvp_suggestions s ON a.suggestion_id = s.id
       LEFT JOIN users u ON a.uploaded_by = u.id
       WHERE a.suggestion_id = $1 AND s.tenant_id = $2
       ORDER BY a.uploaded_at DESC`,
      [numericId, tenantId],
    );

    return rows.map((row: DbAttachment) => ({
      id: row.id,
      suggestionId: row.suggestion_id,
      fileName: row.file_name,
      filePath: row.file_path,
      fileType: row.file_type,
      fileSize: row.file_size,
      uploadedBy: row.uploaded_by,
      fileUuid: row.file_uuid,
      createdAt:
        row.uploaded_at !== null ?
          row.uploaded_at.toISOString()
        : new Date().toISOString(),
    }));
  }

  /**
   * Add attachment record to database
   * @param numericId - Resolved numeric suggestion ID (facade handles UUID resolution)
   */
  async addAttachment(
    numericId: number,
    attachmentData: {
      fileName: string;
      filePath: string;
      fileType: string;
      fileSize: number;
      uploadedBy: number;
      fileUuid: string;
      fileChecksum?: string;
    },
  ): Promise<KVPAttachment> {
    this.logger.log(`Adding attachment to suggestion ${numericId}`);

    const rows = await this.db.query<{ id: number }>(
      `INSERT INTO kvp_attachments
       (file_uuid, suggestion_id, file_name, file_path, file_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        attachmentData.fileUuid,
        numericId,
        attachmentData.fileName,
        attachmentData.filePath,
        attachmentData.fileType,
        attachmentData.fileSize,
        attachmentData.uploadedBy,
      ],
    );

    if (rows[0] === undefined) {
      throw new Error('Failed to add attachment');
    }

    return {
      id: rows[0].id,
      suggestionId: numericId,
      fileName: attachmentData.fileName,
      filePath: attachmentData.filePath,
      fileType: attachmentData.fileType,
      fileSize: attachmentData.fileSize,
      uploadedBy: attachmentData.uploadedBy,
      fileUuid: attachmentData.fileUuid,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Find attachment by file UUID with associated suggestion data.
   * Returns raw DB row for the facade to perform visibility checks.
   */
  async findAttachmentByUuid(
    fileUuid: string,
    tenantId: number,
  ): Promise<AttachmentWithSuggestion> {
    this.logger.debug(`Finding attachment by UUID ${fileUuid}`);

    const rows = await this.db.query<AttachmentWithSuggestion>(
      `SELECT a.*, s.submitted_by, s.tenant_id, s.org_level, s.org_id, s.status
       FROM kvp_attachments a
       JOIN kvp_suggestions s ON a.suggestion_id = s.id
       WHERE a.file_uuid = $1 AND s.tenant_id = $2`,
      [fileUuid, tenantId],
    );

    const attachment = rows[0];
    if (attachment === undefined) {
      throw new NotFoundException('Attachment not found');
    }

    return attachment;
  }
}
