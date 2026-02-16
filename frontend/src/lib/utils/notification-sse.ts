/**
 * Notification SSE Client
 *
 * EventSource-based client for receiving real-time notifications via Server-Sent Events.
 * Auto-reconnects on connection loss with exponential backoff.
 *
 * Usage:
 *   const sse = getNotificationSSE();
 *   const unsubscribe = sse.subscribe((event) => log.debug(event));
 *   sse.connect();
 *   // Later: sse.disconnect();
 */
import { browser } from '$app/environment';

import { createLogger } from './logger';
import { getTokenManager } from './token-manager';

const log = createLogger('SSE');

// ============================================
// Types
// ============================================

export type NotificationEventType =
  | 'CONNECTED'
  | 'HEARTBEAT'
  | 'NEW_SURVEY'
  | 'NEW_DOCUMENT'
  | 'NEW_KVP'
  | 'NEW_MESSAGE'
  | 'VACATION_REQUEST_CREATED'
  | 'VACATION_REQUEST_RESPONDED'
  | 'VACATION_REQUEST_WITHDRAWN'
  | 'VACATION_REQUEST_CANCELLED';

export interface NotificationEvent {
  type: NotificationEventType;
  timestamp: string;
  /** Message data — present when type is 'NEW_MESSAGE' */
  message?: MessageEventData;
  /** Survey data — present when type is 'NEW_SURVEY' */
  survey?: SurveyEventData;
  /** Document data — present when type is 'NEW_DOCUMENT' */
  document?: DocumentEventData;
  /** KVP data — present when type is 'NEW_KVP' */
  kvp?: KvpEventData;
  /** Vacation request data — present when type starts with 'VACATION_REQUEST_' */
  request?: VacationRequestEventData;
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

interface VacationRequestEventData {
  id: string;
  requesterId: number;
  approverId: number | null;
  startDate: string;
  endDate: string;
  vacationType: string;
  status: string;
  computedDays: number;
  requesterName?: string;
  approverName?: string;
}

export interface MessageEventData {
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
      log.warn('Already connected');
      return;
    }
    if (this.isConnecting) {
      log.warn('Connection already in progress');
      return;
    }

    const tokenManager = getTokenManager();

    // Check if we have a valid token (cookie will be sent automatically)
    if (!tokenManager.hasValidToken()) {
      log.warn('No valid token available, cannot connect to SSE');
      return;
    }

    this.isConnecting = true;

    // SSE endpoint - cookie-based auth (accessToken cookie sent automatically on same-origin)
    // No token in URL = no token in logs/history
    const url = `/api/v2/notifications/stream`;

    try {
      // withCredentials ensures cookies are sent with the request
      this.eventSource = new EventSource(url, { withCredentials: true });

      this.eventSource.onopen = () => {
        log.info('Connected to notification stream');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.isConnecting = false;
      };

      this.eventSource.onmessage = (event: MessageEvent<string>) => {
        this.handleMessage(event);
      };

      this.eventSource.onerror = () => {
        // Normal bei Page-Reload - kein echter Fehler
        log.debug('Connection closed (normal during page reload)');
        this.eventSource?.close();
        this.eventSource = null;
        this.isConnecting = false;
        this.attemptReconnect();
      };

      // Subscribe to token refresh events to reconnect with fresh cookie
      // Cookie is updated by TokenManager.setTokens(), reconnect ensures new session
      this.tokenRefreshUnsubscribe = tokenManager.onTokenRefreshed(() => {
        log.info('Token refreshed, reconnecting SSE with fresh cookie');
        this.reconnect();
      });

      // Close SSE cleanly before page unload to prevent browser error logs
      this.boundBeforeUnload = () => {
        this.eventSource?.close();
      };
      window.addEventListener('beforeunload', this.boundBeforeUnload);
    } catch (error) {
      log.error({ err: error }, 'Failed to create EventSource');
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
      log.error({ err: error, data: event.data }, 'Failed to parse message');
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      log.error('Max reconnect attempts reached, giving up');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay;

    log.warn(
      {
        delay,
        attempt: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
      },
      'Reconnecting',
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
        log.error({ err: error }, 'Handler error');
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
    log.info('Disconnected');
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
