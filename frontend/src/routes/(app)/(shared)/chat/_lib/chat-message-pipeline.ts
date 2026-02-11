// =============================================================================
// CHAT MESSAGE PIPELINE — Upload, Encrypt, Schedule, Send
// =============================================================================
//
// Extracted from chat-page-state.svelte.ts for maintainability.
// Pure functions that handle the message-sending sub-steps.
// State mutations remain in the factory (chat-page-state.svelte.ts).

import { createLogger } from '$lib/utils/logger';

import { MESSAGES } from './constants';
import { E2eError, prepareMessageForSending } from './e2e-handlers';
import * as handlers from './handlers';

import type { FilePreviewItem, ScheduledMessage } from './types';

const log = createLogger('ChatPipeline');

/** Callback for surfacing notifications to the user */
export type NotifyFn = (
  msg: string,
  type: 'success' | 'error' | 'info' | 'warning',
) => void;

/**
 * Upload files for a conversation message.
 * Returns attachment info array, or null when upload fails (notification shown).
 */
export async function uploadMessageFiles(
  conversationId: number,
  files: FilePreviewItem[],
  notify: NotifyFn,
): Promise<handlers.UploadedAttachmentInfo[] | null> {
  if (files.length === 0) return [];
  const uploaded = await handlers.uploadFiles(
    conversationId,
    files.map((f) => f.file),
  );
  if (uploaded.length === 0 && files.length > 0) {
    notify(MESSAGES.errorUploadFiles, 'error');
    return null;
  }
  return uploaded;
}

/**
 * Send a scheduled message. Returns updated scheduled list, or null on failure.
 * Shows success/error notification internally.
 */
export async function scheduleMessage(
  conversationId: number,
  content: string,
  time: Date,
  attachments: handlers.UploadedAttachmentInfo[],
  notify: NotifyFn,
): Promise<ScheduledMessage[] | null> {
  try {
    const result = await handlers.sendScheduledMessage(
      conversationId,
      content,
      time,
      attachments,
    );
    notify(MESSAGES.successScheduled, 'success');
    return result;
  } catch {
    notify(MESSAGES.errorScheduleMessage, 'error');
    return null;
  }
}

/** Map E2E error code to user-facing message string */
export function getE2eErrorMessage(code: string): string {
  return code === 'no_recipient_key' ?
      MESSAGES.errorE2eNoRecipientKey
    : MESSAGES.errorE2eEncryptFailed;
}

/** Parameters for sending an immediate (non-scheduled) message */
export interface SendImmediateOpts {
  conversationId: number;
  content: string;
  attachments: handlers.UploadedAttachmentInfo[];
  isGroup: boolean;
  recipientId: number | null;
  currentUserId: number;
  tenantId: number;
}

/**
 * Encrypt (if applicable) and send a message via WebSocket.
 * Returns true if sent successfully, false on E2E failure (notification shown).
 * Throws on non-E2E errors.
 */
export async function sendImmediateMessage(
  opts: SendImmediateOpts,
  notify: NotifyFn,
): Promise<boolean> {
  log.info(
    {
      conversationId: opts.conversationId,
      recipientId: opts.recipientId,
      isGroup: opts.isGroup,
      contentLen: opts.content.length,
      attachments: opts.attachments.length,
    },
    'sendImmediateMessage — starting',
  );
  const attachmentIds = opts.attachments.map((a) => a.id);
  try {
    const message = await prepareMessageForSending({
      conversationId: opts.conversationId,
      content: opts.content,
      attachmentIds,
      isGroup: opts.isGroup,
      recipientId: opts.recipientId,
      currentUserId: opts.currentUserId,
      tenantId: opts.tenantId,
    });
    log.info(
      { messageType: message.type },
      'Message prepared — sending via WebSocket',
    );
    const sent = handlers.sendWebSocketMessage(message);
    if (!sent) {
      log.error('WebSocket send FAILED — connection not open');
      notify(MESSAGES.errorConnectionRetry, 'error');
    } else {
      log.info('Message sent via WebSocket successfully');
    }
    return true;
  } catch (err) {
    if (err instanceof E2eError) {
      log.error(
        { code: err.code, message: err.message },
        'E2E ERROR — message NOT sent',
      );
      notify(getE2eErrorMessage(err.code), 'error');
      return false;
    }
    throw err;
  }
}

/**
 * Cancel a scheduled message. Returns filtered list on success, null on failure.
 * Shows success/error notification internally.
 */
export async function cancelScheduledMessage(
  scheduledId: string,
  currentList: ScheduledMessage[],
  notify: NotifyFn,
): Promise<ScheduledMessage[] | null> {
  try {
    await handlers.cancelScheduledMessage(scheduledId);
    notify(MESSAGES.successCancelScheduled, 'success');
    return currentList.filter((s) => s.id !== scheduledId);
  } catch {
    notify(MESSAGES.errorCancelScheduled, 'error');
    return null;
  }
}
