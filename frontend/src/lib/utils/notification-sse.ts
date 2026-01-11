/**
 * Notification SSE Client
 *
 * EventSource-based client for receiving real-time notifications via Server-Sent Events.
 * Auto-reconnects on connection loss with exponential backoff.
 *
 * Usage:
 *   const sse = getNotificationSSE();
 *   const unsubscribe = sse.subscribe((event) => console.log(event));
 *   sse.connect();
 *   // Later: sse.disconnect();
 */
import { browser } from '$app/environment';

import { getTokenManager } from './token-manager';

// ============================================
// Types
// ============================================

export type NotificationEventType =
  | 'CONNECTED'
  | 'HEARTBEAT'
  | 'NEW_SURVEY'
  | 'NEW_DOCUMENT'
  | 'NEW_KVP'
  | 'NEW_MESSAGE';

export interface NotificationEvent {
  type: NotificationEventType;
  data?: SurveyEventData | DocumentEventData | KvpEventData | MessageEventData;
  timestamp: string;
  user?: {
    id: number;
    role: string;
  };
}

interface SurveyEventData {
  id: number;
  title: string;
  deadline?: string;
}

interface DocumentEventData {
  id: number;
  filename: string;
  category?: string;
}

interface KvpEventData {
  id: number;
  title: string;
  submitted_by?: string;
}

interface MessageEventData {
  id: number;
  senderId: number;
  conversationId: number;
  preview?: string;
}

type NotificationHandler = (event: NotificationEvent) => void;

/** Public interface for SSE client */
interface INotificationSSE {
  connect(): void;
  disconnect(): void;
  reconnect(): void;
  subscribe(handler: NotificationHandler): () => void;
  getState(): 'connecting' | 'open' | 'closed';
  isConnected(): boolean;
}

// ============================================
// SSE Client Class
// ============================================

class NotificationSSEClient implements INotificationSSE {
  private eventSource: EventSource | null = null;
  private handlers = new Set<NotificationHandler>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private tokenRefreshUnsubscribe: (() => void) | null = null;
  private boundBeforeUnload: (() => void) | null = null;

  /**
   * Connect to the SSE endpoint
   */
  connect(): void {
    if (!browser) return;

    // Already connected or connecting
    if (this.eventSource?.readyState === EventSource.OPEN) {
      console.warn('[SSE] Already connected');
      return;
    }
    if (this.isConnecting) {
      console.warn('[SSE] Connection already in progress');
      return;
    }

    const tokenManager = getTokenManager();
    const token = tokenManager.getAccessToken();

    if (token === null) {
      console.warn('[SSE] No access token available, cannot connect');
      return;
    }

    this.isConnecting = true;

    // SSE endpoint with token as query param (EventSource doesn't support headers)
    const url = `/api/v2/notifications/stream?token=${encodeURIComponent(token)}`;

    try {
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        console.warn('[SSE] Connected to notification stream');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.isConnecting = false;
      };

      this.eventSource.onmessage = (event: MessageEvent<string>) => {
        this.handleMessage(event);
      };

      this.eventSource.onerror = () => {
        // Normal bei Page-Reload - kein echter Fehler
        console.warn('[SSE] Connection closed (normal during page reload)');
        this.eventSource?.close();
        this.eventSource = null;
        this.isConnecting = false;
        this.attemptReconnect();
      };

      // Subscribe to token refresh events to reconnect with new token
      this.tokenRefreshUnsubscribe = tokenManager.onTokenRefreshed(() => {
        console.warn('[SSE] Token refreshed, reconnecting with new token');
        this.reconnect();
      });

      // Close SSE cleanly before page unload to prevent browser error logs
      this.boundBeforeUnload = () => {
        this.eventSource?.close();
      };
      window.addEventListener('beforeunload', this.boundBeforeUnload);
    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error);
      this.isConnecting = false;
    }
  }

  /**
   * Handle incoming SSE message
   */
  private handleMessage(event: MessageEvent<string>): void {
    try {
      const data = JSON.parse(event.data) as NotificationEvent;
      this.notifyHandlers(data);
    } catch (error) {
      console.error('[SSE] Failed to parse message:', error, event.data);
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SSE] Max reconnect attempts reached, giving up');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay;

    console.warn(
      `[SSE] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );

    setTimeout(() => {
      this.connect();
    }, delay);

    // Exponential backoff with max 30 seconds
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  /**
   * Force reconnect (used after token refresh)
   */
  reconnect(): void {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.connect();
  }

  /**
   * Subscribe to notification events
   * @returns Unsubscribe function
   */
  subscribe(handler: NotificationHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Notify all handlers of an event
   */
  private notifyHandlers(event: NotificationEvent): void {
    this.handlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error('[SSE] Handler error:', error);
      }
    });
  }

  /**
   * Disconnect from SSE endpoint
   */
  disconnect(): void {
    if (this.eventSource !== null) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.tokenRefreshUnsubscribe !== null) {
      this.tokenRefreshUnsubscribe();
      this.tokenRefreshUnsubscribe = null;
    }

    if (this.boundBeforeUnload !== null) {
      window.removeEventListener('beforeunload', this.boundBeforeUnload);
      this.boundBeforeUnload = null;
    }

    this.isConnecting = false;
    console.warn('[SSE] Disconnected');
  }

  /**
   * Get connection state
   */
  getState(): 'connecting' | 'open' | 'closed' {
    if (this.isConnecting) return 'connecting';
    if (this.eventSource?.readyState === EventSource.OPEN) return 'open';
    return 'closed';
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}

// ============================================
// Singleton Instance
// ============================================

let instance: NotificationSSEClient | null = null;

/** No-op SSE client for SSR */
const ssrNoOpClient: INotificationSSE = {
  connect: () => undefined,
  disconnect: () => undefined,
  reconnect: () => undefined,
  subscribe: () => () => undefined,
  getState: () => 'closed',
  isConnected: () => false,
};

/**
 * Get the singleton NotificationSSEClient instance
 */
export function getNotificationSSE(): INotificationSSE {
  if (!browser) {
    return ssrNoOpClient;
  }
  instance ??= new NotificationSSEClient();
  return instance;
}
