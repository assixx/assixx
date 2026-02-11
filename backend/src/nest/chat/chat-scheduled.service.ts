/**
 * Chat Scheduled Messages Service
 *
 * Handles scheduled message operations.
 * Sub-service of ChatService facade.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import { DatabaseService } from '../database/database.service.js';
import { mapScheduledMessage, validateScheduledTime } from './chat.helpers.js';
import type { ScheduledMessage, ScheduledMessageRow } from './chat.types.js';
import {
  MAX_SCHEDULE_DAYS,
  MIN_SCHEDULE_MINUTES,
  SCHEDULED_STATUS,
} from './chat.types.js';
import type { CreateScheduledMessageBody } from './dto/scheduled-message.dto.js';

@Injectable()
export class ChatScheduledService {
  constructor(
    private readonly cls: ClsService,
    private readonly databaseService: DatabaseService,
  ) {}

  // ============================================
  // Context Helpers
  // ============================================

  private getTenantId(): number {
    const tenantId = this.cls.get<number | undefined>('tenantId');
    if (tenantId === undefined) {
      throw new ForbiddenException('Tenant context not available');
    }
    return tenantId;
  }

  private getUserId(): number {
    const userId = this.cls.get<number | undefined>('userId');
    if (userId === undefined) {
      throw new ForbiddenException('User context not available');
    }
    return userId;
  }

  // ============================================
  // Public Methods
  // ============================================

  /**
   * Create a scheduled message
   */
  async createScheduledMessage(
    dto: CreateScheduledMessageBody,
    verifyAccess: (
      conversationId: number,
      userId: number,
      tenantId: number,
    ) => Promise<void>,
  ): Promise<ScheduledMessage> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();

    // Verify access
    await verifyAccess(dto.conversationId, userId, tenantId);

    // Parse and validate scheduled time
    const scheduledFor = new Date(dto.scheduledFor);
    if (Number.isNaN(scheduledFor.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    const validationError = validateScheduledTime(
      scheduledFor,
      MIN_SCHEDULE_MINUTES,
      MAX_SCHEDULE_DAYS,
    );
    if (validationError !== null) {
      throw new BadRequestException(validationError);
    }

    // Determine if this is an E2E message
    const isE2e =
      typeof dto.encryptedContent === 'string' &&
      dto.encryptedContent.length > 0;

    // Insert scheduled message
    const result = await this.databaseService.query<ScheduledMessageRow>(
      `INSERT INTO chat_scheduled_messages (
        tenant_id, conversation_id, sender_id, content,
        attachment_path, attachment_name, attachment_type, attachment_size,
        scheduled_for,
        encrypted_content, e2e_nonce, is_e2e, e2e_key_version, e2e_key_epoch
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        tenantId,
        dto.conversationId,
        userId,
        isE2e ? null : dto.content,
        dto.attachmentPath ?? null,
        dto.attachmentName ?? null,
        dto.attachmentType ?? null,
        dto.attachmentSize ?? null,
        scheduledFor.toISOString(),
        dto.encryptedContent ?? null,
        dto.e2eNonce ?? null,
        isE2e,
        dto.e2eKeyVersion ?? null,
        dto.e2eKeyEpoch ?? null,
      ],
    );

    const row = result[0];
    if (row === undefined) {
      throw new BadRequestException('Failed to create scheduled message');
    }

    return mapScheduledMessage(row, SCHEDULED_STATUS);
  }

  /**
   * Get user's scheduled messages
   */
  async getScheduledMessages(): Promise<ScheduledMessage[]> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();

    const result = await this.databaseService.query<ScheduledMessageRow>(
      `SELECT * FROM chat_scheduled_messages
       WHERE sender_id = $1 AND tenant_id = $2 AND is_active = $3
       ORDER BY scheduled_for ASC`,
      [userId, tenantId, SCHEDULED_STATUS.PENDING],
    );

    return result.map((row: ScheduledMessageRow) =>
      mapScheduledMessage(row, SCHEDULED_STATUS),
    );
  }

  /**
   * Get a specific scheduled message
   */
  async getScheduledMessage(id: string): Promise<ScheduledMessage> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();

    const result = await this.databaseService.query<ScheduledMessageRow>(
      `SELECT * FROM chat_scheduled_messages
       WHERE id = $1 AND sender_id = $2 AND tenant_id = $3`,
      [id, userId, tenantId],
    );

    const row = result[0];
    if (row === undefined) {
      throw new NotFoundException('Scheduled message not found');
    }

    return mapScheduledMessage(row, SCHEDULED_STATUS);
  }

  /**
   * Cancel a scheduled message
   */
  async cancelScheduledMessage(id: string): Promise<{ message: string }> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();

    // Check if message exists
    const existing = await this.databaseService.query<ScheduledMessageRow>(
      `SELECT * FROM chat_scheduled_messages
       WHERE id = $1 AND sender_id = $2 AND tenant_id = $3`,
      [id, userId, tenantId],
    );

    const message = existing[0];
    if (message === undefined) {
      throw new NotFoundException('Scheduled message not found');
    }

    if (message.is_active === SCHEDULED_STATUS.SENT) {
      throw new BadRequestException('This message has already been sent');
    }

    if (message.is_active === SCHEDULED_STATUS.CANCELLED) {
      throw new BadRequestException('This message has already been cancelled');
    }

    await this.databaseService.query(
      `UPDATE chat_scheduled_messages SET is_active = $1 WHERE id = $2`,
      [SCHEDULED_STATUS.CANCELLED, id],
    );

    return { message: 'Scheduled message cancelled successfully' };
  }

  /**
   * Get scheduled messages for a conversation
   */
  async getConversationScheduledMessages(
    conversationId: number,
    verifyAccess: (
      conversationId: number,
      userId: number,
      tenantId: number,
    ) => Promise<void>,
  ): Promise<ScheduledMessage[]> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();

    // Verify access
    await verifyAccess(conversationId, userId, tenantId);

    const result = await this.databaseService.query<ScheduledMessageRow>(
      `SELECT * FROM chat_scheduled_messages
       WHERE conversation_id = $1 AND sender_id = $2 AND tenant_id = $3 AND is_active = $4
       ORDER BY scheduled_for ASC`,
      [conversationId, userId, tenantId, SCHEDULED_STATUS.PENDING],
    );

    return result.map((row: ScheduledMessageRow) =>
      mapScheduledMessage(row, SCHEDULED_STATUS),
    );
  }
}
