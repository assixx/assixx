// =============================================================================
// CHAT - E2E ENCRYPTION/DECRYPTION HANDLERS
// =============================================================================

import { computeConversationSalt } from '$lib/crypto/conversation-salt';
import { cryptoBridge } from '$lib/crypto/crypto-bridge';
import { e2e } from '$lib/crypto/e2e-state.svelte';
import { getPublicKey as fetchRecipientPublicKey } from '$lib/crypto/public-key-cache';
import { createLogger } from '$lib/utils/logger';

import { buildSendMessage } from './websocket';

import type { Conversation, Message, ScheduledMessage } from './types';

const log = createLogger('E2eHandlers');

// ==========================================================================
// E2E Error Types
// ==========================================================================

/** Typed error codes for E2E failures that callers can switch on */
export type E2eErrorCode = 'no_recipient_key' | 'encrypt_failed';

/** Error thrown when E2E encryption cannot proceed — caller must handle, not ignore */
export class E2eError extends Error {
  readonly code: E2eErrorCode;
  constructor(message: string, code: E2eErrorCode) {
    super(message);
    this.name = 'E2eError';
    this.code = code;
  }
}

// ==========================================================================
// Minimal callback interface (avoids circular import with handlers.ts)
// ==========================================================================

/** Callbacks needed for E2E decryption of incoming WebSocket messages */
export interface E2eDecryptCallbacks {
  getCurrentUserId: () => number;
  getTenantId: () => number;
  getConversations: () => Conversation[];
  onNewMessage: (message: Message) => void;
}

// ==========================================================================
// Type Guard & Shared Helpers
// ==========================================================================

/** Type guard: validates required E2E fields are present and non-null */
function hasRequiredE2eFields(msg: Message): msg is Message & {
  encryptedContent: string;
  e2eNonce: string;
  e2eKeyEpoch: number;
} {
  return (
    msg.encryptedContent !== null &&
    msg.encryptedContent !== undefined &&
    msg.e2eNonce !== null &&
    msg.e2eNonce !== undefined &&
    msg.e2eKeyEpoch !== null &&
    msg.e2eKeyEpoch !== undefined
  );
}

/**
 * Resolve the public key and salt for E2E decryption in a 1:1 conversation.
 * Uses the OTHER participant's public key — works for both received and own echoes.
 */
async function resolveE2eParams(
  conversationId: number,
  currentUserId: number,
  tenantId: number,
  conversations: Conversation[],
): Promise<{ publicKey: string; salt: string } | null> {
  const conv = conversations.find((c) => c.id === conversationId);
  const otherUserId = conv?.participants.find(
    (p) => p.id !== currentUserId,
  )?.id;
  if (otherUserId === undefined) return null;

  const otherKey = await fetchRecipientPublicKey(otherUserId);
  if (otherKey === null) return null;

  const salt = computeConversationSalt(
    tenantId,
    conversationId,
    currentUserId,
    otherUserId,
  );
  return { publicKey: otherKey.publicKey, salt };
}

/** Decrypt a single E2E message. Returns plaintext or null on failure. */
async function decryptSingleMessage(
  msg: Message & {
    encryptedContent: string;
    e2eNonce: string;
    e2eKeyEpoch: number;
  },
  currentUserId: number,
  tenantId: number,
  conversations: Conversation[],
): Promise<string | null> {
  const params = await resolveE2eParams(
    msg.conversationId,
    currentUserId,
    tenantId,
    conversations,
  );
  if (params === null) return null;

  return await cryptoBridge.decrypt(
    msg.encryptedContent,
    msg.e2eNonce,
    params.publicKey,
    params.salt,
    msg.e2eKeyEpoch,
  );
}

// ==========================================================================
// Public API
// ==========================================================================

/** Decrypt an incoming E2E WebSocket message, then deliver via callback */
export async function decryptIncomingMessage(
  message: Message,
  callbacks: E2eDecryptCallbacks,
): Promise<void> {
  try {
    if (!e2e.state.isReady || !hasRequiredE2eFields(message)) {
      message.decryptionFailed = true;
      callbacks.onNewMessage(message);
      return;
    }

    const plaintext = await decryptSingleMessage(
      message,
      callbacks.getCurrentUserId(),
      callbacks.getTenantId(),
      callbacks.getConversations(),
    );

    if (plaintext !== null) {
      // eslint-disable-next-line require-atomic-updates -- fresh local object, not shared state
      message.decryptedContent = plaintext;
    } else {
      // eslint-disable-next-line require-atomic-updates -- fresh local object, not shared state
      message.decryptionFailed = true;
    }
    callbacks.onNewMessage(message);
  } catch (err) {
    log.error({ err, messageId: message.id }, 'E2E decryption failed');

    message.decryptionFailed = true;
    callbacks.onNewMessage(message);
  }
}

/**
 * Prepare a message for sending, encrypting if eligible for E2E.
 * Throws E2eError when encryption should happen but cannot — caller must handle.
 * Falls through to plaintext only for groups or when E2E is not initialized.
 */
export async function prepareMessageForSending(params: {
  conversationId: number;
  content: string;
  attachmentIds: number[];
  isGroup: boolean;
  recipientId: number | null;
  currentUserId: number;
  tenantId: number;
}): Promise<{ type: string; data: unknown }> {
  log.info(
    {
      conversationId: params.conversationId,
      isGroup: params.isGroup,
      recipientId: params.recipientId,
      e2eReady: e2e.state.isReady,
      hasContent: params.content.length > 0,
    },
    'prepareMessageForSending — entry',
  );

  // Groups and non-E2E sessions → plaintext (correct behavior, not a fallback)
  if (params.isGroup || params.recipientId === null || !e2e.state.isReady) {
    log.info(
      {
        reason:
          params.isGroup ? 'group'
          : params.recipientId === null ? 'no_recipient'
          : 'e2e_not_ready',
      },
      'Sending plaintext (no E2E)',
    );
    return buildSendMessage(
      params.conversationId,
      params.content,
      params.attachmentIds,
    );
  }

  // 1:1 with E2E ready → must encrypt, never silently fall back
  return await encryptForRecipient(
    params.recipientId,
    params.content,
    params.conversationId,
    params.attachmentIds,
    params.tenantId,
    params.currentUserId,
  );
}

/** Fetch recipient key, encrypt content, and build the WebSocket message */
async function encryptForRecipient(
  recipientId: number,
  content: string,
  conversationId: number,
  attachmentIds: number[],
  tenantId: number,
  currentUserId: number,
): Promise<{ type: string; data: unknown }> {
  log.info({ recipientId }, 'Fetching recipient public key');
  const recipientKey = await fetchRecipientPublicKey(recipientId);
  if (recipientKey === null) {
    log.error(
      { recipientId },
      'BLOCKED: Recipient has no E2E key on server — message cannot be sent',
    );
    throw new E2eError(
      'Recipient has not set up encryption yet',
      'no_recipient_key',
    );
  }

  log.info(
    {
      recipientId,
      keyVersion: recipientKey.keyVersion,
      fingerprint: recipientKey.fingerprint.substring(0, 16) + '…',
    },
    'Recipient key found — encrypting',
  );

  try {
    const salt = computeConversationSalt(
      tenantId,
      conversationId,
      currentUserId,
      recipientId,
    );
    const encrypted = await cryptoBridge.encrypt(
      content,
      recipientKey.publicKey,
      salt,
    );
    log.info(
      { keyEpoch: encrypted.keyEpoch },
      'Message encrypted successfully — sending via WebSocket',
    );
    return buildSendMessage(conversationId, null, attachmentIds, {
      encryptedContent: encrypted.ciphertext,
      e2eNonce: encrypted.nonce,
      e2eKeyVersion: e2e.state.keyVersion ?? 1,
      e2eKeyEpoch: encrypted.keyEpoch,
    });
  } catch (err) {
    log.error({ err }, 'E2E encryption failed');
    throw new E2eError('Encryption failed', 'encrypt_failed');
  }
}

/** Decrypt E2E messages loaded via REST API (batch). Non-E2E messages pass through. */
export async function decryptLoadedMessages(
  loadedMessages: Message[],
  currentUserId: number,
  tenantId: number,
  conversations: Conversation[],
): Promise<Message[]> {
  if (!e2e.state.isReady) return loadedMessages;

  const e2eMessages = loadedMessages
    .filter((m) => m.isE2e === true)
    .filter(hasRequiredE2eFields);
  if (e2eMessages.length === 0) return loadedMessages;

  const results = new Map<number, string | null>();
  await Promise.allSettled(
    e2eMessages.map(async (msg) => {
      try {
        results.set(
          msg.id,
          await decryptSingleMessage(
            msg,
            currentUserId,
            tenantId,
            conversations,
          ),
        );
      } catch {
        results.set(msg.id, null);
      }
    }),
  );

  return loadedMessages.map((msg) => {
    if (!results.has(msg.id)) return msg;
    const plaintext = results.get(msg.id);
    if (plaintext !== null && plaintext !== undefined) {
      return { ...msg, decryptedContent: plaintext };
    }
    return { ...msg, decryptionFailed: true };
  });
}

/** Decrypt E2E scheduled messages loaded via REST API. Non-E2E pass through. */
export async function decryptLoadedScheduledMessages(
  scheduled: ScheduledMessage[],
  currentUserId: number,
  tenantId: number,
  conversations: Conversation[],
): Promise<ScheduledMessage[]> {
  if (!e2e.state.isReady) return scheduled;

  const e2eScheduled = scheduled.filter(
    (
      s,
    ): s is ScheduledMessage & {
      encryptedContent: string;
      e2eNonce: string;
      e2eKeyEpoch: number;
    } =>
      s.isE2e === true &&
      s.encryptedContent !== null &&
      s.encryptedContent !== undefined &&
      s.e2eNonce !== null &&
      s.e2eNonce !== undefined &&
      s.e2eKeyEpoch !== null &&
      s.e2eKeyEpoch !== undefined,
  );
  if (e2eScheduled.length === 0) return scheduled;

  const results = new Map<string, string | null>();
  await Promise.allSettled(
    e2eScheduled.map(async (s) => {
      try {
        const params = await resolveE2eParams(
          s.conversationId,
          currentUserId,
          tenantId,
          conversations,
        );
        if (params === null) {
          results.set(s.id, null);
          return;
        }
        const plaintext = await cryptoBridge.decrypt(
          s.encryptedContent,
          s.e2eNonce,
          params.publicKey,
          params.salt,
          s.e2eKeyEpoch,
        );
        results.set(s.id, plaintext);
      } catch {
        results.set(s.id, null);
      }
    }),
  );

  return scheduled.map((s) => {
    if (!results.has(s.id)) return s;
    const plaintext = results.get(s.id);
    if (plaintext !== null && plaintext !== undefined) {
      return { ...s, decryptedContent: plaintext };
    }
    return { ...s, decryptionFailed: true };
  });
}
