/**
 * Message Scheduler Service
 * Processes scheduled messages and sends them at the appropriate time
 * Runs as part of the main backend process
 */
import { log, error as logError } from 'console';

import { getPendingDueMessages } from '../routes/v2/chat/scheduled-messages.service.js';
import { transaction } from '../utils/db.js';
import type { PoolConnection, RowDataPacket } from '../utils/db.js';

/** Interval in milliseconds between scheduler checks */
const SCHEDULER_INTERVAL_MS = 30000; // 30 seconds

/** Maximum messages to process per interval */
const BATCH_SIZE = 100;

/**
 * Typed interface for scheduled message from DB
 */
interface ScheduledMessageRow extends RowDataPacket {
  id: string;
  tenant_id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
}

/**
 * Typed interface for inserted message result
 */
interface InsertedMessageRow extends RowDataPacket {
  id: number;
  created_at: Date;
}

/**
 * Message Scheduler singleton
 */
class MessageSchedulerService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;
  private isRunning = false;

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      log('[MessageScheduler] Already running');
      return;
    }

    this.isRunning = true;
    log(`[MessageScheduler] Starting... Checking every ${SCHEDULER_INTERVAL_MS / 1000}s`);

    // Initial run
    void this.processScheduledMessages();

    // Set interval for subsequent runs
    this.intervalId = setInterval(() => {
      void this.processScheduledMessages();
    }, SCHEDULER_INTERVAL_MS);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    log('[MessageScheduler] Stopped');
  }

  /**
   * Process all pending scheduled messages that are due
   */
  private async processScheduledMessages(): Promise<void> {
    if (this.isProcessing) {
      log('[MessageScheduler] Already processing, skipping this cycle');
      return;
    }

    this.isProcessing = true;

    try {
      // getPendingDueMessages returns typed ScheduledMessageRow[]
      const pendingMessages = await getPendingDueMessages(BATCH_SIZE);

      if (pendingMessages.length === 0) {
        return; // No messages to process
      }

      log(`[MessageScheduler] Processing ${pendingMessages.length} scheduled message(s)`);

      for (const scheduledMsg of pendingMessages) {
        try {
          await this.sendScheduledMessage(scheduledMsg as ScheduledMessageRow);
        } catch (error) {
          logError(`[MessageScheduler] Failed to send message ${scheduledMsg.id}:`, error);
          // Continue with other messages
        }
      }
    } catch (error) {
      logError('[MessageScheduler] Error processing scheduled messages:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send a single scheduled message
   * Uses transaction with tenant context for RLS compliance
   */
  private async sendScheduledMessage(scheduledMsg: ScheduledMessageRow): Promise<void> {
    // Extract with camelCase aliases
    const {
      id,
      tenant_id: tenantId,
      conversation_id: conversationId,
      sender_id: senderId,
      content,
    } = scheduledMsg;
    const attachmentPath = scheduledMsg.attachment_path;
    const attachmentName = scheduledMsg.attachment_name;
    const attachmentType = scheduledMsg.attachment_type;
    const attachmentSize = scheduledMsg.attachment_size;

    // Execute all DB operations within a transaction with tenant context for RLS
    await transaction(async (conn: PoolConnection) => {
      // 1. Insert into messages table
      const [insertResult] = await conn.execute<InsertedMessageRow[]>(
        `INSERT INTO messages (
          tenant_id, conversation_id, sender_id, content,
          attachment_path, attachment_name, attachment_type, attachment_size,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id, created_at`,
        [
          tenantId,
          conversationId,
          senderId,
          content,
          attachmentPath,
          attachmentName,
          attachmentType,
          attachmentSize,
        ],
      );

      const insertedMessage = insertResult[0];
      if (insertedMessage === undefined) {
        throw new Error('Failed to insert message');
      }

      // 2. Update conversation's updated_at (triggers last activity tracking)
      await conn.execute(`UPDATE conversations SET updated_at = NOW() WHERE id = $1`, [
        conversationId,
      ]);

      // 3. Mark scheduled message as sent (also within tenant context)
      await conn.execute(
        `UPDATE scheduled_messages SET sent_at = NOW(), is_active = 0 WHERE id = $1`,
        [id],
      );

      log(`[MessageScheduler] Sent scheduled message ${id} to conversation ${conversationId}`);
    }, tenantId); // Pass tenantId for RLS context

    // Note: WebSocket broadcast is not available from this service.
    // Users will see the message on next conversation load or refresh.
  }

  /**
   * Get scheduler status
   */
  getStatus(): { isRunning: boolean; isProcessing: boolean } {
    return {
      isRunning: this.isRunning,
      isProcessing: this.isProcessing,
    };
  }
}

// Export singleton instance
export const messageScheduler = new MessageSchedulerService();
