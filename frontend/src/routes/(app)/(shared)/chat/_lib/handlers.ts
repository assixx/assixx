// =============================================================================
// CHAT - EVENT HANDLERS
// =============================================================================

import { browser } from '$app/environment';

import { getConnectionTicket } from '$lib/utils/connection-ticket';
import { createLogger } from '$lib/utils/logger';

import {
  loadConversations as apiLoadConversations,
  loadMessages as apiLoadMessages,
  loadScheduledMessages as apiLoadScheduledMessages,
  markConversationAsRead as apiMarkConversationAsRead,
  searchUsers as apiSearchUsers,
  createConversation,
  deleteConversation as apiDeleteConversation,
  createScheduledMessage,
  cancelScheduledMessage as apiCancelScheduledMessage,
  uploadAttachment,
  findExistingConversation,
  buildNewConversation,
} from './api';
import {
  WEBSOCKET_CONFIG,
  SCHEDULE_CONSTRAINTS,
  MESSAGES,
  WS_MESSAGE_TYPES,
} from './constants';
import {
  isImageFile,
  validateScheduleTime,
  getMinScheduleDateTime,
} from './utils';
import {
  buildWebSocketUrl,
  transformRawMessage,
  extractTypingData,
  extractStatusData,
  extractReadData,
  addTypingUser,
  removeTypingUser,
  updateConversationsUserStatus,
  markMessageAsRead,
  updateConversationWithMessage,
  buildJoinMessage,
  buildSendMessage,
  buildTypingStartMessage,
  buildTypingStopMessage,
  buildPingMessage,
  calculateReconnectDelay,
  shouldReconnect,
} from './websocket';

import type {
  Conversation,
  Message,
  ScheduledMessage,
  ChatUser,
  RawWebSocketMessage,
} from './types';

const log = createLogger('ChatHandlers');

// ==========================================================================
// Types
// ==========================================================================

export interface ChatHandlers {
  // API
  loadConversations: () => Promise<Conversation[]>;
  loadMessages: (
    conversationId: number,
  ) => Promise<{ messages: Message[]; scheduled: ScheduledMessage[] }>;
  searchUsers: (query: string) => Promise<ChatUser[]>;
  startConversationWith: (
    user: ChatUser,
    conversations: Conversation[],
  ) => Promise<{ conversation: Conversation; isNew: boolean }>;
  deleteConversation: (conversationId: number) => Promise<void>;

  // Messages
  sendMessage: (
    conversationId: number,
    content: string,
    attachmentIds: number[],
    scheduledFor: Date | null,
    ws: WebSocket | null,
  ) => Promise<boolean>;
  cancelScheduledMessage: (messageId: number) => Promise<void>;

  // Files
  uploadFiles: (conversationId: number, files: File[]) => Promise<number[]>;

  // Schedule
  validateAndSetSchedule: (
    date: string,
    time: string,
  ) => { isValid: boolean; date?: Date; error?: string };
  getDefaultScheduleDateTime: () => { date: string; time: string };

  // WebSocket
  connectWebSocket: (
    callbacks: WebSocketCallbacks,
  ) => Promise<WebSocket | null>;
  handleWebSocketMessage: (
    message: { type: string; data: unknown },
    callbacks: WebSocketCallbacks,
  ) => void;
}

export interface WebSocketCallbacks {
  onConnected: (ws: WebSocket) => void;
  /** Called when WebSocket disconnects. permanent=true means max retries exceeded. */
  onDisconnect: (permanent: boolean) => void;
  onNewMessage: (message: Message) => void;
  onTypingStart: (conversationId: number, userId: number) => void;
  onTypingStop: (conversationId: number, userId: number) => void;
  onUserStatus: (userId: number, status: string) => void;
  onMessageRead: (messageId: number) => void;
  onError: (error: string) => void;
  onAuthError: () => void;
  getActiveConversationId: () => number | null;
  getCurrentUserId: () => number;
  getConversations: () => Conversation[];
}

// ==========================================================================
// API Handlers
// ==========================================================================

export async function loadConversations(): Promise<Conversation[]> {
  return await apiLoadConversations();
}

export async function loadMessages(
  conversationId: number,
): Promise<{ messages: Message[]; scheduled: ScheduledMessage[] }> {
  const [msgs, scheduled] = await Promise.all([
    apiLoadMessages(conversationId),
    apiLoadScheduledMessages(conversationId),
  ]);
  await apiMarkConversationAsRead(conversationId);
  return { messages: msgs, scheduled };
}

export async function searchUsers(query: string): Promise<ChatUser[]> {
  if (query.trim() === '') return [];
  return await apiSearchUsers(query);
}

/**
 * Counter for generating temporary IDs for pending conversations.
 * Uses negative numbers to distinguish from real DB IDs.
 */
let pendingConversationIdCounter: number = -1;

/**
 * Start a conversation with a user.
 * LAZY CREATION: If no existing conversation exists, returns a PENDING conversation
 * that is NOT persisted to the database. The conversation is only created when
 * the first message is sent.
 *
 * @param user - User to start conversation with
 * @param conversations - Existing conversations list
 * @returns Conversation object (existing or pending) and isNew flag
 */
export function startConversationWith(
  user: ChatUser,
  conversations: Conversation[],
): { conversation: Conversation; isNew: boolean } {
  const existing = findExistingConversation(conversations, user.id);
  if (existing) {
    return { conversation: existing, isNew: false };
  }

  // Create a PENDING conversation (not persisted to DB yet)
  // Will be created when first message is sent
  const pendingId = pendingConversationIdCounter--;
  const pendingConversation: Conversation = {
    id: pendingId, // Temporary negative ID
    uuid: `pending-${pendingId}`, // Temporary UUID
    isGroup: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    participants: [
      {
        id: user.id,
        username: user.username,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        profileImageUrl: user.profileImageUrl ?? user.profilePicture,
        status: user.status,
      },
    ],
    unreadCount: 0,
    isPending: true,
    pendingTargetUserId: user.id,
  };

  return { conversation: pendingConversation, isNew: true };
}

/**
 * Create a pending conversation in the database.
 * Called when the first message is sent to a pending conversation.
 *
 * @param pendingConversation - The pending conversation to persist
 * @returns The persisted conversation with real DB ID
 */
export async function persistPendingConversation(
  pendingConversation: Conversation,
): Promise<Conversation> {
  if (pendingConversation.pendingTargetUserId === undefined) {
    throw new Error('Pending conversation has no target user ID');
  }

  const apiConversation = await createConversation(
    [pendingConversation.pendingTargetUserId],
    false,
  );
  const persistedConv = buildNewConversation(apiConversation);

  // Copy over participant info from pending conversation
  return {
    ...persistedConv,
    isPending: false,
    pendingTargetUserId: undefined,
  };
}

export async function deleteConversation(
  conversationId: number,
): Promise<void> {
  await apiDeleteConversation(conversationId);
}

// ==========================================================================
// Message Handlers
// ==========================================================================

/**
 * Uploaded attachment info for scheduled messages
 */
export interface UploadedAttachmentInfo {
  id: number;
  path: string;
  name: string;
  type: string;
  size: number;
}

export async function sendScheduledMessage(
  conversationId: number,
  content: string,
  scheduledFor: Date,
  attachments: UploadedAttachmentInfo[],
): Promise<ScheduledMessage[]> {
  // For now, only support single attachment (first one)
  const firstAttachment = attachments.length > 0 ? attachments[0] : undefined;
  const attachmentInfo =
    firstAttachment !== undefined ?
      {
        path: firstAttachment.path,
        name: firstAttachment.name,
        type: firstAttachment.type,
        size: firstAttachment.size,
      }
    : undefined;

  await createScheduledMessage(
    conversationId,
    content,
    scheduledFor.toISOString(),
    attachmentInfo,
  );
  return await apiLoadScheduledMessages(conversationId);
}

export async function cancelScheduledMessage(messageId: string): Promise<void> {
  await apiCancelScheduledMessage(messageId);
}

// ==========================================================================
// File Handlers
// ==========================================================================

/**
 * Upload files and return full attachment info
 */
export async function uploadFiles(
  conversationId: number,
  files: File[],
): Promise<UploadedAttachmentInfo[]> {
  const uploaded: UploadedAttachmentInfo[] = [];

  for (const file of files) {
    try {
      const result = await uploadAttachment(conversationId, file);
      uploaded.push({
        id: result.id,
        path: result.fileUuid,
        name: result.originalName,
        type: result.mimeType,
        size: result.fileSize,
      });
    } catch (err) {
      log.error({ err }, 'Error uploading file');
    }
  }

  return uploaded;
}

export function createFilePreview(file: File): {
  file: File;
  previewUrl: string;
  isImage: boolean;
} {
  const isImg = isImageFile(file);
  return {
    file,
    previewUrl: isImg ? URL.createObjectURL(file) : '',
    isImage: isImg,
  };
}

// ==========================================================================
// Schedule Handlers
// ==========================================================================

export function validateAndSetSchedule(
  date: string,
  time: string,
): { isValid: boolean; date?: Date; error?: string } {
  if (date === '' || time === '') {
    return { isValid: false, error: MESSAGES.warningSelectDateTime };
  }

  const selectedDate = new Date(`${date}T${time}`);
  const validation = validateScheduleTime(
    selectedDate,
    SCHEDULE_CONSTRAINTS.minFutureTime,
    SCHEDULE_CONSTRAINTS.maxFutureTime,
  );

  if (!validation.isValid) {
    return { isValid: false, error: validation.error ?? undefined };
  }

  return { isValid: true, date: selectedDate };
}

export function getDefaultScheduleDateTime(): { date: string; time: string } {
  return getMinScheduleDateTime(SCHEDULE_CONSTRAINTS.defaultFutureTime);
}

// ==========================================================================
// WebSocket Handlers
// ==========================================================================

let ws: WebSocket | null = null;
let pingIntervalId: number | null = null;
let typingTimeoutId: number | undefined;

// Reconnection state
let reconnectAttempts = 0;
let reconnectTimeoutId: number | null = null;
let originalCallbacks: WebSocketCallbacks | null = null;

// ==========================================================================
// Callback Management (presence vs chat)
// ==========================================================================
// The WebSocket connection lives at app layout level for presence tracking.
// When the chat page mounts, it "upgrades" callbacks to include chat handlers.
// When it unmounts, callbacks are "downgraded" back to presence-only.
// The WebSocket itself is NEVER closed during this swap.

/** Active callbacks used by the WebSocket onmessage/onopen/onclose handlers */
let activeCallbacks: WebSocketCallbacks | null = null;

/** Presence-only callbacks set by the app layout (minimal handlers) */
let presenceCallbacks: WebSocketCallbacks | null = null;

/**
 * Register presence-only callbacks (called once from app layout).
 * These are the "baseline" callbacks restored when leaving the chat page.
 */
export function setPresenceCallbacks(callbacks: WebSocketCallbacks): void {
  presenceCallbacks = callbacks;
}

/**
 * Upgrade active callbacks (e.g., when chat page mounts).
 * Does NOT reconnect — just swaps which handlers receive messages.
 */
export function updateCallbacks(callbacks: WebSocketCallbacks): void {
  activeCallbacks = callbacks;
  originalCallbacks = callbacks;
}

/**
 * Downgrade to presence-only callbacks (e.g., when chat page unmounts).
 * WebSocket stays connected — user remains "online".
 */
export function restorePresenceCallbacks(): void {
  if (presenceCallbacks !== null) {
    activeCallbacks = presenceCallbacks;
    originalCallbacks = presenceCallbacks;
  }
}

/** Parse raw WebSocket MessageEvent and dispatch to handler */
function handleRawMessage(
  event: MessageEvent,
  callbacks: WebSocketCallbacks,
): void {
  try {
    // MessageEvent.data is typed as 'any' in DOM lib - explicitly type it
    const rawData: unknown = event.data;
    if (typeof rawData !== 'string') {
      log.error(
        { rawDataType: typeof rawData },
        'Unexpected WebSocket message type',
      );
      return;
    }
    const message = JSON.parse(rawData) as { type: string; data: unknown };
    handleWebSocketMessage(message, callbacks);
  } catch (err) {
    log.error({ err }, 'Error parsing WebSocket message');
  }
}

/**
 * Connect to WebSocket using connection ticket
 * SECURITY: Fetches short-lived ticket instead of using JWT to prevent token leakage in logs
 * @see docs/TOKEN-SECURITY-REFACTORING-PLAN.md
 */
export async function connectWebSocket(
  callbacks: WebSocketCallbacks,
): Promise<WebSocket | null> {
  if (!browser) return null;

  // Set active callbacks (used by onmessage/onopen/onclose via module reference)
  activeCallbacks = callbacks;
  // Store original callbacks for reconnection (only on first connection)
  originalCallbacks ??= callbacks;

  // Close existing connection before async operation
  if (ws !== null) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }

  // Fetch connection ticket (30s TTL, single-use)
  const ticket = await getConnectionTicket('websocket');
  if (ticket === null) {
    log.error('Failed to get connection ticket for WebSocket');
    activeCallbacks.onAuthError();
    return null;
  }

  const wsUrl = buildWebSocketUrl(ticket);

  try {
    // Create new WebSocket in local variable first to avoid race conditions
    const newWs = new WebSocket(wsUrl);

    // IMPORTANT: All handlers reference activeCallbacks (module-level mutable)
    // instead of closure-captured callbacks. This allows the chat page to
    // upgrade/downgrade handlers without reconnecting.

    newWs.onopen = () => {
      activeCallbacks?.onConnected(newWs);
    };

    newWs.onmessage = (event: MessageEvent) => {
      if (activeCallbacks !== null) {
        handleRawMessage(event, activeCallbacks);
      }
    };

    newWs.onerror = (err) => {
      log.error({ err }, 'WebSocket error');
    };

    newWs.onclose = (event: CloseEvent) => {
      ws = null;

      // 1001 = "going away" — browser is navigating away from the page.
      // App layout onDestroy → disconnectWebSocket() handles full cleanup.
      if (event.code === 1001) {
        log.debug({ code: event.code }, 'WebSocket closed (page navigation)');
        return;
      }

      log.warn(
        { code: event.code, reason: event.reason },
        'WebSocket connection closed unexpectedly',
      );
      activeCallbacks?.onDisconnect(false);
      scheduleReconnect();
    };

    // Assign to module-level variable after setup complete
    // eslint-disable-next-line require-atomic-updates -- Safe: ws is set to null before async, and JS is single-threaded
    ws = newWs;
    return ws;
  } catch (err) {
    log.error({ err }, 'Error creating WebSocket');
    return null;
  }
}

// Individual message handlers to reduce complexity
type MessageHandler = (data: unknown, callbacks: WebSocketCallbacks) => void;

function handleConnectionEstablished(
  _data: unknown,
  callbacks: WebSocketCallbacks,
): void {
  // Reset reconnection state on successful connection
  reconnectAttempts = 0;
  if (reconnectTimeoutId !== null) {
    window.clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }

  callbacks.getConversations().forEach((conv) => {
    sendWebSocketMessage(buildJoinMessage(conv.id));
  });
}

function handleAuthError(data: unknown, callbacks: WebSocketCallbacks): void {
  log.error({ data }, 'Authentication failed');
  callbacks.onAuthError();
}

function handleNewMessage(data: unknown, callbacks: WebSocketCallbacks): void {
  const newMessage = transformRawMessage(data as RawWebSocketMessage);
  callbacks.onNewMessage(newMessage);
}

function handleTypingStart(data: unknown, callbacks: WebSocketCallbacks): void {
  const typingData = extractTypingData(data as RawWebSocketMessage);
  callbacks.onTypingStart(typingData.conversationId, typingData.userId);
}

function handleTypingStop(data: unknown, callbacks: WebSocketCallbacks): void {
  const stopData = extractTypingData(data as RawWebSocketMessage);
  callbacks.onTypingStop(stopData.conversationId, stopData.userId);
}

function handleUserStatus(data: unknown, callbacks: WebSocketCallbacks): void {
  const statusData = extractStatusData(data as RawWebSocketMessage);
  callbacks.onUserStatus(statusData.userId, statusData.status);
}

function handleMessageRead(data: unknown, callbacks: WebSocketCallbacks): void {
  const readData = extractReadData(data as RawWebSocketMessage);
  callbacks.onMessageRead(readData.messageId);
}

function handleError(data: unknown, callbacks: WebSocketCallbacks): void {
  log.error({ data }, 'WebSocket Error');
  callbacks.onError(MESSAGES.errorWebSocket);
}

// Handler map for message type dispatch
const messageHandlers: Record<string, MessageHandler> = {
  [WS_MESSAGE_TYPES.CONNECTION_ESTABLISHED]: handleConnectionEstablished,
  [WS_MESSAGE_TYPES.AUTH_ERROR]: handleAuthError,
  [WS_MESSAGE_TYPES.NEW_MESSAGE]: handleNewMessage,
  [WS_MESSAGE_TYPES.TYPING_START]: handleTypingStart,
  [WS_MESSAGE_TYPES.USER_TYPING]: handleTypingStart,
  [WS_MESSAGE_TYPES.TYPING_STOP]: handleTypingStop,
  [WS_MESSAGE_TYPES.USER_STOPPED_TYPING]: handleTypingStop,
  [WS_MESSAGE_TYPES.USER_STATUS]: handleUserStatus,
  [WS_MESSAGE_TYPES.USER_STATUS_CHANGED]: handleUserStatus,
  [WS_MESSAGE_TYPES.MESSAGE_READ]: handleMessageRead,
  [WS_MESSAGE_TYPES.ERROR]: handleError,
};

// No-op types (acknowledged but no action needed)
const noopMessageTypes = new Set<string>([
  WS_MESSAGE_TYPES.PONG,
  WS_MESSAGE_TYPES.MESSAGE_SENT,
  WS_MESSAGE_TYPES.USER_JOINED_CONVERSATION,
]);

export function handleWebSocketMessage(
  message: { type: string; data: unknown },
  callbacks: WebSocketCallbacks,
): void {
  if (message.type in messageHandlers) {
    messageHandlers[message.type](message.data, callbacks);
    return;
  }
  // PONG and MESSAGE_SENT are acknowledged but need no action
  // Unknown types are logged in development for debugging
  if (!noopMessageTypes.has(message.type)) {
    log.warn({ messageType: message.type }, 'Unhandled WebSocket message type');
  }
}

export function sendWebSocketMessage(message: {
  type: string;
  data: unknown;
}): boolean {
  if (ws?.readyState !== WebSocket.OPEN) {
    return false;
  }
  ws.send(JSON.stringify(message));
  return true;
}

export function sendTypingStart(conversationId: number): void {
  const sent = sendWebSocketMessage(buildTypingStartMessage(conversationId));

  // Clear any existing timer regardless
  if (typingTimeoutId !== undefined) {
    clearTimeout(typingTimeoutId);
    typingTimeoutId = undefined;
  }

  // Only start auto-stop timer if the start message was actually sent
  if (!sent) return;

  typingTimeoutId = window.setTimeout(() => {
    sendWebSocketMessage(buildTypingStopMessage(conversationId));
    typingTimeoutId = undefined;
  }, WEBSOCKET_CONFIG.typingTimeout);
}

/**
 * Explicitly stop typing indicator.
 * Clears the auto-stop timer and sends typing_stop immediately.
 * Called when a message is sent to prevent ghost typing indicators.
 */
export function sendTypingStop(conversationId: number): void {
  if (typingTimeoutId !== undefined) {
    clearTimeout(typingTimeoutId);
    typingTimeoutId = undefined;
  }
  sendWebSocketMessage(buildTypingStopMessage(conversationId));
}

export function startPeriodicPing(): void {
  // Idempotency guard: prevent duplicate ping intervals
  if (pingIntervalId !== null) return;

  pingIntervalId = window.setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(buildPingMessage()));
    }
  }, WEBSOCKET_CONFIG.pingInterval);
}

export function stopPeriodicPing(): void {
  if (pingIntervalId !== null) {
    window.clearInterval(pingIntervalId);
    pingIntervalId = null;
  }
}

export function disconnectWebSocket(): void {
  stopPeriodicPing();

  // Cancel any pending reconnection
  if (reconnectTimeoutId !== null) {
    window.clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
  reconnectAttempts = 0;
  originalCallbacks = null;

  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
}

export function getWebSocket(): WebSocket | null {
  return ws;
}

/**
 * Schedule a WebSocket reconnection with exponential backoff.
 * Uses stored original callbacks to ensure consistent behavior across retries.
 * Overrides onAuthError during reconnection to retry instead of redirecting to login,
 * since ticket fetch failures during reconnection are likely transient network issues.
 */
function scheduleReconnect(): void {
  if (originalCallbacks === null) return;
  if (reconnectTimeoutId !== null) return; // Already scheduled

  if (!shouldReconnect(reconnectAttempts)) {
    log.error(
      { reconnectAttempts },
      'Max reconnection attempts reached, giving up',
    );
    originalCallbacks.onDisconnect(true);
    return;
  }

  reconnectAttempts++;
  const delay = calculateReconnectDelay(reconnectAttempts);
  log.info(
    { attempt: reconnectAttempts, delay },
    'Scheduling WebSocket reconnect',
  );

  reconnectTimeoutId = window.setTimeout(() => {
    reconnectTimeoutId = null;
    if (originalCallbacks === null) return;

    // During reconnection, override onAuthError to retry instead of redirecting
    const reconnectCallbacks: WebSocketCallbacks = {
      ...originalCallbacks,
      onAuthError: () => {
        log.warn('Auth error during reconnect, will retry');
        scheduleReconnect();
      },
    };
    void connectWebSocket(reconnectCallbacks);
  }, delay);
}

// Re-export websocket utilities for convenience
export {
  addTypingUser,
  removeTypingUser,
  updateConversationsUserStatus,
  markMessageAsRead,
  updateConversationWithMessage,
  buildJoinMessage,
  buildSendMessage,
};
