// =============================================================================
// CHAT - EVENT HANDLERS
// =============================================================================

import { browser } from '$app/environment';
import type {
  Conversation,
  Message,
  ScheduledMessage,
  ChatUser,
  RawWebSocketMessage,
} from './types';
import { WEBSOCKET_CONFIG, SCHEDULE_CONSTRAINTS, MESSAGES, WS_MESSAGE_TYPES } from './constants';
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
import { isImageFile, validateScheduleTime, getMinScheduleDateTime } from './utils';
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
  createWebSocket: (token: string) => WebSocket;
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
  return apiLoadConversations();
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
  if (!query.trim()) return [];
  return apiSearchUsers(query);
}

export async function startConversationWith(
  user: ChatUser,
  conversations: Conversation[],
): Promise<{ conversation: Conversation; isNew: boolean }> {
  const existing = findExistingConversation(conversations, user.id);
  if (existing) {
    return { conversation: existing, isNew: false };
  }

  const apiConversation = await createConversation([user.id], false);
  const newConv = buildNewConversation(apiConversation);
  return { conversation: newConv, isNew: true };
}

export async function deleteConversation(conversationId: number): Promise<void> {
  await apiDeleteConversation(conversationId);
}

// ==========================================================================
// Message Handlers
// ==========================================================================

export async function sendScheduledMessage(
  conversationId: number,
  content: string,
  scheduledFor: Date,
  attachmentIds: number[],
): Promise<ScheduledMessage[]> {
  await createScheduledMessage(conversationId, content, scheduledFor.toISOString(), attachmentIds);
  return apiLoadScheduledMessages(conversationId);
}

export async function cancelScheduledMessage(messageId: string): Promise<void> {
  await apiCancelScheduledMessage(messageId);
}

// ==========================================================================
// File Handlers
// ==========================================================================

export async function uploadFiles(conversationId: number, files: File[]): Promise<number[]> {
  const uploadedIds: number[] = [];

  for (const file of files) {
    try {
      const result = await uploadAttachment(conversationId, file);
      uploadedIds.push(result.id);
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  }

  return uploadedIds;
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
  if (!date || !time) {
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
  return getMinScheduleDateTime(SCHEDULE_CONSTRAINTS.minFutureTime);
}

// ==========================================================================
// WebSocket Handlers
// ==========================================================================

let ws: WebSocket | null = null;
let pingIntervalId: number | null = null;
let typingTimeoutId: number | undefined;

export function connectWebSocket(token: string, callbacks: WebSocketCallbacks): WebSocket | null {
  if (!browser) return null;

  if (ws) {
    ws.onclose = null;
    ws.close();
  }

  const wsUrl = buildWebSocketUrl(token);

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.info('WebSocket connected');
      if (ws) callbacks.onConnected(ws);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message, callbacks);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.info('WebSocket disconnected');
    };

    return ws;
  } catch (error) {
    console.error('Error creating WebSocket:', error);
    return null;
  }
}

export function handleWebSocketMessage(
  message: { type: string; data: unknown },
  callbacks: WebSocketCallbacks,
): void {
  switch (message.type) {
    case WS_MESSAGE_TYPES.CONNECTION_ESTABLISHED:
      callbacks.getConversations().forEach((conv) => {
        sendWebSocketMessage(buildJoinMessage(conv.id));
      });
      break;

    case WS_MESSAGE_TYPES.AUTH_ERROR:
      console.error('Authentication failed:', message.data);
      callbacks.onAuthError();
      break;

    case WS_MESSAGE_TYPES.NEW_MESSAGE: {
      const newMessage = transformRawMessage(message.data as RawWebSocketMessage);
      callbacks.onNewMessage(newMessage);
      break;
    }

    case WS_MESSAGE_TYPES.TYPING_START:
    case WS_MESSAGE_TYPES.USER_TYPING: {
      const typingData = extractTypingData(message.data as RawWebSocketMessage);
      callbacks.onTypingStart(typingData.conversationId, typingData.userId);
      break;
    }

    case WS_MESSAGE_TYPES.TYPING_STOP:
    case WS_MESSAGE_TYPES.USER_STOPPED_TYPING: {
      const stopData = extractTypingData(message.data as RawWebSocketMessage);
      callbacks.onTypingStop(stopData.userId);
      break;
    }

    case WS_MESSAGE_TYPES.USER_STATUS:
    case WS_MESSAGE_TYPES.USER_STATUS_CHANGED: {
      const statusData = extractStatusData(message.data as RawWebSocketMessage);
      callbacks.onUserStatus(statusData.userId, statusData.status);
      break;
    }

    case WS_MESSAGE_TYPES.MESSAGE_READ: {
      const readData = extractReadData(message.data as RawWebSocketMessage);
      callbacks.onMessageRead(readData.messageId);
      break;
    }

    case WS_MESSAGE_TYPES.PONG:
    case WS_MESSAGE_TYPES.MESSAGE_SENT:
      break;

    case WS_MESSAGE_TYPES.ERROR:
      console.error('WebSocket Error:', message.data);
      callbacks.onError(MESSAGES.errorWebSocket);
      break;

    default:
      console.info('Unknown message type:', message.type);
  }
}

export function sendWebSocketMessage(message: { type: string; data: unknown }): boolean {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return false;
  }
  ws.send(JSON.stringify(message));
  return true;
}

export function sendTypingStart(conversationId: number): void {
  sendWebSocketMessage(buildTypingStartMessage(conversationId));

  if (typingTimeoutId) clearTimeout(typingTimeoutId);
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

export function attemptReconnect(
  token: string,
  currentAttempts: number,
  callbacks: WebSocketCallbacks,
): { success: boolean; attempts: number } {
  if (!shouldReconnect(currentAttempts)) {
    console.error('Max reconnection attempts reached');
    return { success: false, attempts: currentAttempts };
  }

  const attempts = currentAttempts + 1;
  console.info(`Attempting to reconnect (${attempts}/${WEBSOCKET_CONFIG.maxReconnectAttempts})...`);

  setTimeout(() => {
    connectWebSocket(token, callbacks);
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
