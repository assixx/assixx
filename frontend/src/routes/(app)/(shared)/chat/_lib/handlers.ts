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
  onNewMessage: (message: Message) => void;
  onTypingStart: (conversationId: number, userId: number) => void;
  onTypingStop: (userId: number) => void;
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

/**
 * Connect to WebSocket using connection ticket
 * SECURITY: Fetches short-lived ticket instead of using JWT to prevent token leakage in logs
 * @see docs/TOKEN-SECURITY-REFACTORING-PLAN.md
 */
export async function connectWebSocket(
  callbacks: WebSocketCallbacks,
): Promise<WebSocket | null> {
  if (!browser) return null;

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
    callbacks.onAuthError();
    return null;
  }

  const wsUrl = buildWebSocketUrl(ticket);

  try {
    // Create new WebSocket in local variable first to avoid race conditions
    const newWs = new WebSocket(wsUrl);

    newWs.onopen = () => {
      callbacks.onConnected(newWs);
    };

    newWs.onmessage = (event: MessageEvent) => {
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
    };

    newWs.onerror = (err) => {
      log.error({ err }, 'WebSocket error');
    };

    newWs.onclose = () => {
      // Connection closed
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
  callbacks.onTypingStop(stopData.userId);
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
  sendWebSocketMessage(buildTypingStartMessage(conversationId));

  if (typingTimeoutId !== undefined) clearTimeout(typingTimeoutId);
  typingTimeoutId = window.setTimeout(() => {
    sendWebSocketMessage(buildTypingStopMessage(conversationId));
  }, WEBSOCKET_CONFIG.typingTimeout);
}

export function startPeriodicPing(): void {
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
 * Attempt to reconnect WebSocket with exponential backoff
 * SECURITY: Uses connection tickets instead of JWT
 */
export function attemptReconnect(
  currentAttempts: number,
  callbacks: WebSocketCallbacks,
): { success: boolean; attempts: number } {
  if (!shouldReconnect(currentAttempts)) {
    log.error({ currentAttempts }, 'Max reconnection attempts reached');
    return { success: false, attempts: currentAttempts };
  }

  const attempts = currentAttempts + 1;

  setTimeout(() => {
    void connectWebSocket(callbacks);
  }, calculateReconnectDelay(attempts));

  return { success: true, attempts };
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
