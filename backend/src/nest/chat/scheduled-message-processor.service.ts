/**
 * Scheduled Message Processor Service
 *
 * Handles automatic sending of scheduled chat messages when their time arrives.
 * - Primary: Runs every minute to check for due messages
 * - Startup: Runs on server start to catch missed messages
 *
 * Uses FOR UPDATE SKIP LOCKED to prevent race conditions with multiple workers.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v7 as uuidv7 } from 'uuid';

import { eventBus } from '../../utils/eventBus.js';
import { DatabaseService } from '../database/database.service.js';

// ============================================
// Constants
// ============================================

/** Status values for is_active column */
const SCHEDULED_STATUS = {
  CANCELLED: 0,
  PENDING: 1,
  SENT: 4,
} as const;

/** Maximum messages to process per batch */
const BATCH_SIZE = 100;

// ============================================
// Types
// ============================================

/** Database row for scheduled message */
interface ScheduledMessageRow {
  id: string;
  tenant_id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  scheduled_for: Date;
  is_active: number;
  created_at: Date;
  sent_at: Date | null;
}

/** Recipient info for notifications */
interface RecipientRow {
  user_id: number;
}

// ============================================
// Service
// ============================================

@Injectable()
export class ScheduledMessageProcessorService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledMessageProcessorService.name);
  private isProcessing = false;

  constructor(private readonly db: DatabaseService) {}

  /**
   * Run on server startup to catch any messages missed while server was down
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Server startup: Checking for due scheduled messages...');
    await this.processScheduledMessages();
  }

  /**
   * Primary: Process scheduled messages every minute
   * Runs at second 0 of every minute (Europe/Berlin timezone)
   */
  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'scheduled-message-processor',
    timeZone: 'Europe/Berlin',
  })
  async processAtMinute(): Promise<void> {
    // No log here - only log when there's actual work to do
    await this.processScheduledMessages();
  }

  /**
   * Core processing logic - sends all due scheduled messages
   * Uses FOR UPDATE SKIP LOCKED to prevent race conditions
   */
  private async processScheduledMessages(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      this.logger.debug('Already processing, skipping this run');
      return;
    }

    this.isProcessing = true;

    try {
      // Get all due messages (FOR UPDATE SKIP LOCKED for concurrency safety)
      const dueMessages = await this.db.query<ScheduledMessageRow>(
        `SELECT * FROM scheduled_messages
         WHERE is_active = $1 AND scheduled_for <= NOW()
         ORDER BY scheduled_for ASC
         LIMIT $2
         FOR UPDATE SKIP LOCKED`,
        [SCHEDULED_STATUS.PENDING, BATCH_SIZE],
      );

      if (dueMessages.length === 0) {
        // No log for empty result - reduces noise
        return;
      }

      this.logger.log(`Processing ${dueMessages.length} scheduled message(s)...`);

      let successCount = 0;
      let errorCount = 0;

      for (const scheduled of dueMessages) {
        try {
          await this.sendScheduledMessage(scheduled);
          successCount++;
        } catch (error) {
          errorCount++;
          this.logger.error(
            { error, scheduledId: scheduled.id },
            'Failed to send scheduled message',
          );
        }
      }

      this.logger.log(
        `Processed ${dueMessages.length} messages: ${successCount} sent, ${errorCount} failed`,
      );
    } catch (error) {
      this.logger.error({ error }, 'Error processing scheduled messages');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send a single scheduled message
   * Creates the actual message in messages table and marks scheduled as sent
   */
  private async sendScheduledMessage(scheduled: ScheduledMessageRow): Promise<void> {
    const messageUuid = uuidv7();

    // 1. Insert the message into the messages table
    const insertResult = await this.db.query<{ id: number }>(
      `INSERT INTO messages (
        tenant_id, conversation_id, sender_id, content,
        attachment_path, attachment_name, attachment_type, attachment_size,
        uuid, uuid_created_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING id`,
      [
        scheduled.tenant_id,
        scheduled.conversation_id,
        scheduled.sender_id,
        scheduled.content,
        scheduled.attachment_path,
        scheduled.attachment_name,
        scheduled.attachment_type,
        scheduled.attachment_size,
        messageUuid,
      ],
    );

    const messageId = insertResult[0]?.id;
    if (messageId === undefined) {
      throw new Error('Failed to insert message');
    }

    // 2. Update conversation timestamp
    await this.db.query(
      `UPDATE conversations SET updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [scheduled.conversation_id, scheduled.tenant_id],
    );

    // 3. Mark scheduled message as sent
    await this.db.query(
      `UPDATE scheduled_messages SET is_active = $1, sent_at = NOW() WHERE id = $2`,
      [SCHEDULED_STATUS.SENT, scheduled.id],
    );

    // 4. Emit event for real-time notifications
    await this.emitMessageEvent(scheduled, messageId, messageUuid);

    this.logger.debug(
      { scheduledId: scheduled.id, messageId },
      'Scheduled message sent successfully',
    );
  }

  /**
   * Emit event for SSE notifications to recipients
   */
  private async emitMessageEvent(
    scheduled: ScheduledMessageRow,
    messageId: number,
    messageUuid: string,
  ): Promise<void> {
    try {
      // Get recipients (all participants except sender)
      const recipients = await this.db.query<RecipientRow>(
        `SELECT user_id FROM conversation_participants
         WHERE conversation_id = $1 AND user_id != $2`,
        [scheduled.conversation_id, scheduled.sender_id],
      );

      const recipientIds = recipients.map((r: RecipientRow) => r.user_id);

      // Emit event
      eventBus.emitNewMessage(scheduled.tenant_id, {
        id: messageId,
        uuid: messageUuid,
        conversationId: scheduled.conversation_id,
        senderId: scheduled.sender_id,
        recipientIds,
        preview: scheduled.content.substring(0, 50),
      });
    } catch (error) {
      // Non-critical - log but don't fail the message send
      this.logger.warn({ error }, 'Failed to emit message event');
    }
  }
}
