/**
 * Scheduled Messages Service v2
 * Business logic for scheduling chat messages to be sent at a future time
 */
import type { RowDataPacket } from '../../../utils/db.js';
import { execute } from '../../../utils/db.js';
import { ServiceError } from '../users/users.service.js';

/** Minimum time in minutes before a message can be scheduled */
const MIN_SCHEDULE_MINUTES = 5;

/** Maximum time in days a message can be scheduled in advance */
const MAX_SCHEDULE_DAYS = 30;

/** Status values for is_active column */
const STATUS = {
  CANCELLED: 0,
  PENDING: 1,
  SENT: 4,
} as const;

/**
 * Scheduled message row from database
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
  scheduled_for: Date;
  is_active: number;
  created_at: Date;
  sent_at: Date | null;
}

/**
 * Input data for creating a scheduled message
 * Note: Optional properties include undefined for exactOptionalPropertyTypes compatibility
 */
export interface CreateScheduledMessageInput {
  conversationId: number;
  content: string;
  scheduledFor: string; // ISO 8601 string
  attachmentPath?: string | undefined;
  attachmentName?: string | undefined;
  attachmentType?: string | undefined;
  attachmentSize?: number | undefined;
}

/**
 * Attachment data for scheduled messages
 */
export interface ScheduledMessageAttachment {
  path: string;
  name: string;
  type: string;
  size: number;
}

/**
 * Scheduled message response format
 */
export interface ScheduledMessage {
  id: string;
  conversationId: number;
  senderId: number;
  content: string;
  scheduledFor: string;
  status: 'pending' | 'sent' | 'cancelled';
  createdAt: string;
  sentAt: string | null;
  attachment: ScheduledMessageAttachment | null;
}

/**
 * Verify user is participant of conversation
 */
async function verifyConversationAccess(
  conversationId: number,
  userId: number,
  tenantId: number,
): Promise<void> {
  const [participant] = await execute<RowDataPacket[]>(
    `SELECT 1 FROM conversation_participants
     WHERE conversation_id = $1 AND user_id = $2 AND tenant_id = $3`,
    [conversationId, userId, tenantId],
  );

  if (participant.length === 0) {
    throw new ServiceError(
      'CONVERSATION_ACCESS_DENIED',
      'Sie sind kein Teilnehmer dieser Unterhaltung',
      403,
    );
  }
}

/**
 * Validate scheduled time is within allowed range
 */
function validateScheduledTime(scheduledFor: Date): void {
  const now = new Date();
  const minTime = new Date(now.getTime() + MIN_SCHEDULE_MINUTES * 60 * 1000);
  const maxTime = new Date(now.getTime() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000);

  if (scheduledFor <= minTime) {
    throw new ServiceError(
      'SCHEDULE_TOO_SOON',
      `Der Zeitpunkt muss mindestens ${MIN_SCHEDULE_MINUTES} Minuten in der Zukunft liegen`,
      400,
    );
  }

  if (scheduledFor > maxTime) {
    throw new ServiceError(
      'SCHEDULE_TOO_FAR',
      `Der Zeitpunkt darf maximal ${MAX_SCHEDULE_DAYS} Tage in der Zukunft liegen`,
      400,
    );
  }
}

/**
 * Map database row to response format
 */
function mapRowToScheduledMessage(row: ScheduledMessageRow): ScheduledMessage {
  let status: 'pending' | 'sent' | 'cancelled';
  switch (row.is_active) {
    case STATUS.CANCELLED:
      status = 'cancelled';
      break;
    case STATUS.SENT:
      status = 'sent';
      break;
    default:
      status = 'pending';
  }

  // Build attachment object if all required fields are present
  let attachment: ScheduledMessageAttachment | null = null;
  if (
    row.attachment_path !== null &&
    row.attachment_name !== null &&
    row.attachment_type !== null &&
    row.attachment_size !== null
  ) {
    attachment = {
      path: row.attachment_path,
      name: row.attachment_name,
      type: row.attachment_type,
      size: row.attachment_size,
    };
  }

  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.content,
    scheduledFor: row.scheduled_for.toISOString(),
    status,
    createdAt: row.created_at.toISOString(),
    sentAt: row.sent_at?.toISOString() ?? null,
    attachment,
  };
}

/**
 * Create a scheduled message
 */
export async function createScheduledMessage(
  data: CreateScheduledMessageInput,
  userId: number,
  tenantId: number,
): Promise<ScheduledMessage> {
  // Verify access
  await verifyConversationAccess(data.conversationId, userId, tenantId);

  // Parse and validate scheduled time
  const scheduledFor = new Date(data.scheduledFor);
  if (Number.isNaN(scheduledFor.getTime())) {
    throw new ServiceError('INVALID_DATE', 'Ungültiges Datumsformat', 400);
  }
  validateScheduledTime(scheduledFor);

  // Insert scheduled message
  const [result] = await execute<ScheduledMessageRow[]>(
    `INSERT INTO scheduled_messages (
      tenant_id, conversation_id, sender_id, content,
      attachment_path, attachment_name, attachment_type, attachment_size,
      scheduled_for
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      tenantId,
      data.conversationId,
      userId,
      data.content,
      data.attachmentPath ?? null,
      data.attachmentName ?? null,
      data.attachmentType ?? null,
      data.attachmentSize ?? null,
      scheduledFor.toISOString(),
    ],
  );

  const row = result[0];
  if (row === undefined) {
    throw new ServiceError('CREATE_FAILED', 'Nachricht konnte nicht geplant werden', 500);
  }

  return mapRowToScheduledMessage(row);
}

/**
 * Get scheduled message by ID
 */
export async function getScheduledMessage(
  id: string,
  userId: number,
  tenantId: number,
): Promise<ScheduledMessage> {
  const [result] = await execute<ScheduledMessageRow[]>(
    `SELECT * FROM scheduled_messages
     WHERE id = $1 AND sender_id = $2 AND tenant_id = $3`,
    [id, userId, tenantId],
  );

  const row = result[0];
  if (row === undefined) {
    throw new ServiceError('MESSAGE_NOT_FOUND', 'Geplante Nachricht nicht gefunden', 404);
  }

  return mapRowToScheduledMessage(row);
}

/**
 * Get all pending scheduled messages for a user
 */
export async function getUserScheduledMessages(
  userId: number,
  tenantId: number,
): Promise<ScheduledMessage[]> {
  const [result] = await execute<ScheduledMessageRow[]>(
    `SELECT * FROM scheduled_messages
     WHERE sender_id = $1 AND tenant_id = $2 AND is_active = $3
     ORDER BY scheduled_for ASC`,
    [userId, tenantId, STATUS.PENDING],
  );

  return result.map(mapRowToScheduledMessage);
}

/**
 * Cancel a scheduled message
 */
export async function cancelScheduledMessage(
  id: string,
  userId: number,
  tenantId: number,
): Promise<ScheduledMessage> {
  // First check if message exists and belongs to user
  const [existing] = await execute<ScheduledMessageRow[]>(
    `SELECT * FROM scheduled_messages
     WHERE id = $1 AND sender_id = $2 AND tenant_id = $3`,
    [id, userId, tenantId],
  );

  const message = existing[0];
  if (message === undefined) {
    throw new ServiceError('MESSAGE_NOT_FOUND', 'Geplante Nachricht nicht gefunden', 404);
  }

  if (message.is_active === STATUS.SENT) {
    throw new ServiceError('ALREADY_SENT', 'Diese Nachricht wurde bereits gesendet', 409);
  }

  if (message.is_active === STATUS.CANCELLED) {
    throw new ServiceError('ALREADY_CANCELLED', 'Diese Nachricht wurde bereits storniert', 409);
  }

  // Cancel the message
  const [result] = await execute<ScheduledMessageRow[]>(
    `UPDATE scheduled_messages
     SET is_active = $1
     WHERE id = $2
     RETURNING *`,
    [STATUS.CANCELLED, id],
  );

  const cancelledRow = result[0];
  if (cancelledRow === undefined) {
    throw new ServiceError('CANCEL_FAILED', 'Nachricht konnte nicht storniert werden', 500);
  }

  return mapRowToScheduledMessage(cancelledRow);
}

/**
 * Get pending scheduled messages that are due to be sent
 * Uses FOR UPDATE SKIP LOCKED to prevent race conditions with multiple workers
 */
export async function getPendingDueMessages(limit: number = 100): Promise<ScheduledMessageRow[]> {
  const [result] = await execute<ScheduledMessageRow[]>(
    `SELECT * FROM scheduled_messages
     WHERE is_active = $1 AND scheduled_for <= NOW()
     ORDER BY scheduled_for ASC
     LIMIT $2
     FOR UPDATE SKIP LOCKED`,
    [STATUS.PENDING, limit],
  );

  return result;
}

/**
 * Mark a scheduled message as sent
 */
export async function markMessageAsSent(id: string): Promise<void> {
  await execute(
    `UPDATE scheduled_messages
     SET is_active = $1, sent_at = NOW()
     WHERE id = $2`,
    [STATUS.SENT, id],
  );
}

/**
 * Get pending scheduled messages for a specific conversation
 * Only returns messages from the current user that are still pending
 */
export async function getConversationScheduledMessages(
  conversationId: number,
  userId: number,
  tenantId: number,
): Promise<ScheduledMessage[]> {
  // Verify user is participant
  await verifyConversationAccess(conversationId, userId, tenantId);

  const [result] = await execute<ScheduledMessageRow[]>(
    `SELECT * FROM scheduled_messages
     WHERE conversation_id = $1 AND sender_id = $2 AND tenant_id = $3 AND is_active = $4
     ORDER BY scheduled_for ASC`,
    [conversationId, userId, tenantId, STATUS.PENDING],
  );

  return result.map(mapRowToScheduledMessage);
}

/**
 * Export STATUS for use in worker
 */
export { STATUS as SCHEDULED_MESSAGE_STATUS };
