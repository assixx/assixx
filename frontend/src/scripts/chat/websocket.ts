/**
 * Chat Module - WebSocket Management
 * Real-time WebSocket connection handling
 */

import type { WebSocketMessage, Message, TypingData, UserStatusData, MessageReadData } from './types';
import { getChatState } from './state';
import { showNotification } from './utils';

// ============================================================================
// Types
// ============================================================================

export interface WebSocketCallbacks {
  onConnectionEstablished: () => void;
  onNewMessage: (data: { message: Message; conversationId: number }) => void;
  onTypingStart: (data: TypingData) => void;
  onTypingStop: (data: TypingData) => void;
  onUserStatus: (data: UserStatusData) => void;
  onMessageRead: (data: MessageReadData) => void;
  onError: (data: unknown) => void;
}

// ============================================================================
// WebSocket Manager
// ============================================================================

let callbacks: WebSocketCallbacks | null = null;
let pingInterval: NodeJS.Timeout | null = null;

/**
 * Initialize WebSocket callbacks
 */
export function setWebSocketCallbacks(cb: WebSocketCallbacks): void {
  callbacks = cb;
}

/**
 * Connect to WebSocket server
 */
export function connectWebSocket(): void {
  const state = getChatState();

  // Close existing connection
  if (state.ws !== null) {
    state.ws.onclose = null;
    state.ws.close();
    state.ws = null;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/chat-ws?token=${encodeURIComponent(state.token ?? '')}`;

  try {
    state.ws = new WebSocket(wsUrl);

    state.ws.onopen = () => {
      console.info('WebSocket connected');
      state.isConnected = true;
      state.reconnectAttempts = 0;
      updateConnectionStatus(true);
      processMessageQueue();
    };

    state.ws.onmessage = (event) => {
      try {
        const data: string = event.data as string;
        const message: WebSocketMessage = JSON.parse(data) as WebSocketMessage;
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    state.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      state.isConnected = false;
      updateConnectionStatus(false);
    };

    state.ws.onclose = () => {
      console.info('WebSocket disconnected');
      state.isConnected = false;
      updateConnectionStatus(false);
      attemptReconnect();
    };
  } catch (error) {
    console.error('Error creating WebSocket:', error);
    state.isConnected = false;
    updateConnectionStatus(false);
  }
}

/**
 * Handle incoming WebSocket message
 */
function handleWebSocketMessage(message: WebSocketMessage): void {
  const state = getChatState();

  switch (message.type) {
    case 'connection_established':
      handleConnectionEstablished();
      break;

    case 'auth_error':
      console.error('Authentication failed:', message.data);
      state.ws?.close();
      window.location.href = '/login';
      break;

    case 'new_message': {
      const messageData = message.data as Message & { conversation_id: number };
      callbacks?.onNewMessage({
        message: messageData,
        conversationId: messageData.conversationId,
      });
      break;
    }

    case 'typing_start':
    case 'user_typing':
      callbacks?.onTypingStart(message.data as TypingData);
      break;

    case 'typing_stop':
    case 'user_stopped_typing':
      callbacks?.onTypingStop(message.data as TypingData);
      break;

    case 'user_status':
    case 'user_status_changed':
      callbacks?.onUserStatus(message.data as UserStatusData);
      break;

    case 'message_read':
      callbacks?.onMessageRead(message.data as MessageReadData);
      break;

    case 'pong':
      // Connection keepalive response
      break;

    case 'message_sent':
      // Server confirmation that message was sent - no action needed
      break;

    case 'error':
      handleWebSocketError(message.data);
      break;

    default:
      console.info('Unknown message type:', message.type);
  }
}

/**
 * Handle connection established
 */
function handleConnectionEstablished(): void {
  const state = getChatState();
  console.info('Connection established');

  // Join all conversations
  state.conversations.forEach((conv) => {
    if (state.ws !== null && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(
        JSON.stringify({
          type: 'join_conversation',
          data: { conversationId: conv.id },
        }),
      );
    }
  });

  callbacks?.onConnectionEstablished();
}

/**
 * Handle WebSocket error
 */
function handleWebSocketError(data: unknown): void {
  console.error('WebSocket Error:', data);

  if (data !== null && data !== undefined && typeof data === 'object' && 'message' in data) {
    const errorMessage = typeof data.message === 'string' ? data.message : 'Fehler beim Senden der Nachricht';
    showNotification(errorMessage, 'error');
  } else {
    showNotification('Fehler bei der Kommunikation mit dem Server', 'error');
  }

  callbacks?.onError(data);
}

/**
 * Attempt to reconnect to WebSocket
 */
function attemptReconnect(): void {
  const state = getChatState();

  if (state.reconnectAttempts >= state.maxReconnectAttempts) {
    console.error('Max reconnection attempts reached');
    showNotification('Verbindung zum Server verloren. Bitte Seite neu laden.', 'error');
    return;
  }

  state.reconnectAttempts++;
  console.info(`Attempting to reconnect (${state.reconnectAttempts}/${state.maxReconnectAttempts})...`);

  setTimeout(() => {
    connectWebSocket();
  }, state.reconnectDelay * state.reconnectAttempts);
}

/**
 * Process queued messages
 */
function processMessageQueue(): void {
  const state = getChatState();

  while (state.messageQueue.length > 0) {
    const message = state.messageQueue.shift();
    if (message !== undefined) {
      sendWebSocketMessage('send_message', {
        conversationId: message.conversationId,
        content: message.content,
      });
    }
  }
}

/**
 * Update connection status in UI
 */
function updateConnectionStatus(connected: boolean): void {
  const statusIndicator = document.querySelector('#connectionStatus');
  if (statusIndicator) {
    statusIndicator.className = connected ? 'connected' : 'disconnected';
    (statusIndicator as HTMLElement).title = connected ? 'Verbunden' : 'Getrennt';
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Send a WebSocket message
 */
export function sendWebSocketMessage(type: string, data: unknown): boolean {
  const state = getChatState();

  if (state.ws === null || state.ws.readyState !== WebSocket.OPEN) {
    return false;
  }

  state.ws.send(JSON.stringify({ type, data }));
  return true;
}

/**
 * Send a chat message via WebSocket
 */
export function sendChatMessage(conversationId: number, content: string, attachmentIds: number[] = []): boolean {
  return sendWebSocketMessage('send_message', {
    conversationId,
    content,
    attachments: attachmentIds,
  });
}

/**
 * Send typing start indicator
 */
export function sendTypingStart(conversationId: number): void {
  sendWebSocketMessage('typing_start', { conversationId });
}

/**
 * Send typing stop indicator
 */
export function sendTypingStop(conversationId: number): void {
  sendWebSocketMessage('typing_stop', { conversationId });
}

/**
 * Mark message as read
 */
export function markMessageAsRead(messageId: number): void {
  sendWebSocketMessage('mark_read', { messageId });
}

/**
 * Start periodic ping to keep connection alive
 */
export function startPeriodicPing(): void {
  if (pingInterval !== null) {
    clearInterval(pingInterval);
  }

  pingInterval = setInterval(() => {
    const state = getChatState();
    if (state.isConnected && state.ws !== null && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(
        JSON.stringify({
          type: 'ping',
          data: { timestamp: new Date().toISOString() },
        }),
      );
    }
  }, 30000);
}

/**
 * Stop periodic ping
 */
export function stopPeriodicPing(): void {
  if (pingInterval !== null) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

/**
 * Disconnect WebSocket
 */
export function disconnectWebSocket(): void {
  const state = getChatState();

  stopPeriodicPing();

  if (state.ws !== null) {
    state.ws.onclose = null;
    state.ws.close();
    state.ws = null;
  }

  state.isConnected = false;
}
