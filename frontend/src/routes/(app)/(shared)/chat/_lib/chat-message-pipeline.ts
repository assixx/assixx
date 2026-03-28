// =============================================================================
// CHAT MESSAGE PIPELINE — Upload, Encrypt, Schedule, Send
// =============================================================================
//
// Extracted from chat-page-state.svelte.ts for maintainability.
// Pure functions that handle the message-sending sub-steps.
// State mutations remain in the factory (chat-page-state.svelte.ts).

import { computeConversationSalt } from '$lib/crypto/conversation-salt';
import { cryptoBridge } from '$lib/crypto/crypto-bridge';
import { e2e } from '$lib/crypto/e2e-state.svelte';
import { getPublicKey as fetchRecipientPublicKey } from '$lib/crypto/public-key-cache';
import { createLogger } from '$lib/utils/logger';

import { MESSAGES } from './constants';
import { E2eError, prepareMessageForSending } from './e2e-handlers';
import * as handlers from './handlers';

import type { FilePreviewItem, ScheduledMessage } from './types';

const log = createLogger('ChatPipeline');

/** Callback for surfacing notifications to the user */
export type NotifyFn = (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;

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

/** E2E context needed for encrypting scheduled messages */
export interface ScheduleE2eContext {
  isGroup: boolean;
  recipientId: number | null;
  currentUserId: number;
  tenantId: number;
}

/**
 * Send a scheduled message. Encrypts if eligible for E2E (1:1, E2E ready).
 * Returns updated scheduled list, or null on failure.
 * Shows success/error notification internally.
 */
export async function scheduleMessage(
  conversationId: number,
  content: string,
  time: Date,
  attachments: handlers.UploadedAttachmentInfo[],
  notify: NotifyFn,
  e2eContext?: ScheduleE2eContext,
): Promise<ScheduledMessage[] | null> {
  try {
    // Encrypt if eligible: 1:1 conversation, E2E ready, recipient has key
    let e2eFields: handlers.ScheduledE2eFields | undefined;

    if (
      e2eContext !== undefined &&
      !e2eContext.isGroup &&
      e2eContext.recipientId !== null &&
      e2e.state.isReady
    ) {
      const encrypted = await encryptForScheduledMessage(
        content,
        conversationId,
        e2eContext.recipientId,
        e2eContext.currentUserId,
        e2eContext.tenantId,
      );
      if (encrypted !== null) {
        e2eFields = encrypted;
      }
      // encrypted === null means recipient has no key → send plaintext
    }

    const result = await handlers.sendScheduledMessage(
      conversationId,
      content,
      time,
      attachments,
      e2eFields,
    );
    notify(MESSAGES.successScheduled, 'success');
    return result;
  } catch (err: unknown) {
    if (err instanceof E2eError) {
      log.error(
        { code: err.code, message: err.message },
        'E2E ERROR — scheduled message NOT created',
      );
      notify(getE2eErrorMessage(err.code), 'error');
      return null;
    }
    notify(MESSAGES.errorScheduleMessage, 'error');
    return null;
  }
}

/**
 * Encrypt content for a scheduled message.
 * Returns E2E fields or null if recipient has no key.
 * Throws E2eError if encryption fails.
 */
async function encryptForScheduledMessage(
  content: string,
  conversationId: number,
  recipientId: number,
  currentUserId: number,
  tenantId: number,
): Promise<handlers.ScheduledE2eFields | null> {
  const recipientKey = await fetchRecipientPublicKey(recipientId);
  if (recipientKey === null) {
    log.warn({ recipientId }, 'Recipient has no E2E key — scheduling as plaintext');
    return null;
  }

  try {
    const salt = computeConversationSalt(tenantId, conversationId, currentUserId, recipientId);
    const encrypted = await cryptoBridge.encrypt(content, recipientKey.publicKey, salt);
    log.info({ keyEpoch: encrypted.keyEpoch }, 'Scheduled message encrypted successfully');
    return {
      encryptedContent: encrypted.ciphertext,
      e2eNonce: encrypted.nonce,
      e2eKeyVersion: e2e.state.keyVersion ?? 1,
      e2eKeyEpoch: encrypted.keyEpoch,
    };
  } catch (err: unknown) {
    log.error({ err }, 'E2E encryption failed for scheduled message');
    throw new E2eError('Encryption failed', 'encrypt_failed');
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
    log.info({ messageType: message.type }, 'Message prepared — sending via WebSocket');
    const sent = handlers.sendWebSocketMessage(message);
    if (!sent) {
      log.error('WebSocket send FAILED — connection not open');
      notify(MESSAGES.errorConnectionRetry, 'error');
    } else {
      log.info('Message sent via WebSocket successfully');
    }
    return true;
  } catch (err: unknown) {
    if (err instanceof E2eError) {
      log.error({ code: err.code, message: err.message }, 'E2E ERROR — message NOT sent');
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
