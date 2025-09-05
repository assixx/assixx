/**
 * Server-Sent Events Client for Real-Time Notifications
 * Replaces polling with push-based updates
 */

import type unifiedNavigation from '../components/unified-navigation';

// SSE Message types
interface SSEMessage {
  type: string;
  user?: unknown;
  survey?: {
    title?: string;
  };
  kvp?: {
    title?: string;
  };
  document?: {
    filename?: string;
  };
  message?: string;
}

// Extend the Window interface with additional properties
// unifiedNav is already declared in unified-navigation.ts
declare global {
  interface Window {
    unifiedNav?: unifiedNavigation;
    showErrorAlert?: (message: string) => void;
    showSuccessAlert?: (message: string) => void;
    showInfoAlert?: (message: string) => void;
  }
}

export class SSEClient {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;

  constructor(private url: string) {
    console.info('[SSE] Client initialized');
  }

  connect(): void {
    // Prevent multiple simultaneous connections
    if (this.isConnecting || this.eventSource?.readyState === EventSource.OPEN) {
      console.info('[SSE] Already connected or connecting');
      return;
    }

    const token = localStorage.getItem('token');
    if (token === null || token === '' || token === 'test-mode') {
      console.warn('[SSE] No valid token available');
      return;
    }

    this.isConnecting = true;

    // Add token as query parameter (SSE doesn't support headers easily)
    const urlWithToken = `${this.url}?token=${encodeURIComponent(token)}`;

    console.info('[SSE] Connecting to:', this.url);
    this.eventSource = new EventSource(urlWithToken);

    this.eventSource.onopen = () => {
      console.info('[SSE] Connection established');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.isConnecting = false;
    };

    this.eventSource.onmessage = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as SSEMessage;
        this.handleMessage(data);
      } catch (error) {
        console.error('[SSE] Failed to parse message:', error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);
      this.isConnecting = false;

      // Close the connection
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }

      // Try to reconnect
      this.handleReconnect();
    };
  }

  private handleMessage(data: SSEMessage): void {
    console.info('[SSE] Received:', data.type, data);

    switch (data.type) {
      case 'CONNECTED':
        console.info('[SSE] Successfully connected to notification stream');
        console.info('[SSE] User info:', data.user);
        break;

      case 'NEW_SURVEY':
        console.info('[SSE] New survey notification received');

        // Update survey badge immediately
        if (window.unifiedNav !== undefined && 'updatePendingSurveys' in window.unifiedNav) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          void (window.unifiedNav as any).updatePendingSurveys();
        }

        // Show toast notification
        if (data.survey?.title !== undefined && data.survey.title !== '') {
          this.showToast(`Neue Umfrage: ${data.survey.title}`, 'info');
        }
        break;

      case 'SURVEY_UPDATED':
        console.info('[SSE] Survey updated notification received');

        // Refresh survey badge
        if (window.unifiedNav !== undefined && 'updatePendingSurveys' in window.unifiedNav) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          void (window.unifiedNav as any).updatePendingSurveys();
        }
        break;

      case 'NEW_SURVEY_CREATED':
        // Admin notification when they create a survey
        console.info('[SSE] Admin: New survey created');

        if (data.survey?.title !== undefined && data.survey.title !== '') {
          this.showToast(`Umfrage erstellt: ${data.survey.title}`, 'success');
        }
        break;

      case 'NEW_DOCUMENT':
        console.info('[SSE] New document notification received');

        // Update document badge
        if (window.unifiedNav?.updateUnreadDocuments) {
          void window.unifiedNav.updateUnreadDocuments();
        }

        if (data.document?.filename !== undefined && data.document.filename !== '') {
          this.showToast(`Neues Dokument: ${data.document.filename}`, 'info');
        }
        break;

      case 'NEW_KVP':
        console.info('[SSE] New KVP notification received');

        // Update KVP badge for admins
        if (window.unifiedNav?.updateNewKvpSuggestions) {
          void window.unifiedNav.updateNewKvpSuggestions();
        }

        if (data.kvp?.title !== undefined && data.kvp.title !== '') {
          this.showToast(`Neuer KVP-Vorschlag: ${data.kvp.title}`, 'info');
        }
        break;

      default:
        console.warn('[SSE] Unknown message type:', data.type);
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SSE] Max reconnection attempts reached');
      this.showToast('Verbindung zu Echtzeit-Benachrichtigungen verloren', 'error');
      return;
    }

    this.reconnectAttempts++;
    console.info(
      `[SSE] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff: double the delay for next attempt, max 30 seconds
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  private showToast(message: string, type: 'info' | 'success' | 'error'): void {
    console.info(`[SSE] Toast (${type}):`, message);

    // Use existing toast system if available
    let showFn: ((msg: string) => void) | undefined;

    switch (type) {
      case 'error':
        showFn = window.showErrorAlert;
        break;
      case 'success':
        showFn = window.showSuccessAlert;
        break;
      case 'info':
      default:
        showFn = window.showInfoAlert;
        break;
    }

    if (showFn) {
      showFn(message);
    } else {
      // Fallback to console if toast functions not available
      console.log(`[Toast ${type}]:`, message);
    }
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnecting = false;
      console.info('[SSE] Disconnected');
    }
  }

  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  getConnectionState(): string {
    if (!this.eventSource) return 'DISCONNECTED';

    switch (this.eventSource.readyState) {
      case EventSource.CONNECTING:
        return 'CONNECTING';
      case EventSource.OPEN:
        return 'CONNECTED';
      case EventSource.CLOSED:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }
}
