/**
 * Server-Sent Events Client for Real-Time Notifications
 * Replaces polling with push-based updates
 */

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
// NOTE: unifiedNav is declared in unified-navigation.ts to avoid circular dependency
declare global {
  interface Window {
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

    // Ensure clean disconnection on page unload
    window.addEventListener('beforeunload', () => {
      if (this.isConnected()) {
        console.info('[SSE] Page unloading - disconnecting SSE');
        this.disconnect();
      }
    });
  }

  connect(): void {
    // Prevent multiple simultaneous connections
    if (this.isConnecting || this.eventSource?.readyState === EventSource.OPEN) {
      console.info('[SSE] Already connected or connecting');
      return;
    }

    // Check if user is authenticated before attempting SSE connection
    // (Cookie will be sent automatically, but we verify auth state first)
    const token = localStorage.getItem('accessToken') ?? localStorage.getItem('token');
    if (token === null || token === '' || token === 'test-mode') {
      console.warn('[SSE] No valid token available - skipping SSE connection');
      return;
    }

    this.isConnecting = true;

    // SECURITY FIX: Use cookies instead of URL parameter
    // Cookies are set on login (auth/index.ts line 60) and sent automatically
    // withCredentials: true ensures cookies are included (required for cross-origin, harmless for same-origin)
    console.info('[SSE] Connecting to:', this.url);
    this.eventSource = new EventSource(this.url, { withCredentials: true });

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
      // During page unload, SSE will throw errors - this is expected
      // The beforeunload handler in unified-navigation.ts handles clean disconnection
      // Here we only handle real connection errors

      // If the error source is closed, it's likely due to page navigation
      const isClosedConnection = this.eventSource?.readyState === EventSource.CLOSED;

      if (!isClosedConnection) {
        console.error('[SSE] Connection error:', error);
      }

      this.isConnecting = false;

      // Close the connection
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }

      // Only try to reconnect if connection wasn't intentionally closed
      if (!isClosedConnection) {
        this.handleReconnect();
      }
    };
  }

  private updateSurveyBadge(): void {
    // Call updatePendingSurveys if unifiedNav is available
    // Type is defined in global.d.ts as UnifiedNavigation
    window.unifiedNav?.updatePendingSurveys();
  }

  private handleConnected(data: SSEMessage): void {
    console.info('[SSE] Successfully connected to notification stream');
    console.info('[SSE] User info:', data.user);
  }

  private handleNewSurvey(data: SSEMessage): void {
    console.info('[SSE] New survey notification received');
    this.updateSurveyBadge();

    if (data.survey?.title !== undefined && data.survey.title !== '') {
      this.showToast(`Neue Umfrage: ${data.survey.title}`, 'info');
    }
  }

  private handleSurveyUpdated(): void {
    console.info('[SSE] Survey updated notification received');
    this.updateSurveyBadge();
  }

  private handleNewSurveyCreated(data: SSEMessage): void {
    console.info('[SSE] Admin: New survey created');

    if (data.survey?.title !== undefined && data.survey.title !== '') {
      this.showToast(`Umfrage erstellt: ${data.survey.title}`, 'success');
    }
  }

  private handleNewDocument(data: SSEMessage): void {
    console.info('[SSE] New document notification received');

    if (window.unifiedNav?.updateUnreadDocuments) {
      window.unifiedNav.updateUnreadDocuments();
    }

    if (data.document?.filename !== undefined && data.document.filename !== '') {
      this.showToast(`Neues Dokument: ${data.document.filename}`, 'info');
    }
  }

  private handleNewKvp(data: SSEMessage): void {
    console.info('[SSE] New KVP notification received');

    if (window.unifiedNav?.updateNewKvpSuggestions) {
      window.unifiedNav.updateNewKvpSuggestions();
    }

    if (data.kvp?.title !== undefined && data.kvp.title !== '') {
      this.showToast(`Neuer KVP-Vorschlag: ${data.kvp.title}`, 'info');
    }
  }

  private handleMessage(data: SSEMessage): void {
    console.info('[SSE] Received:', data.type, data);

    switch (data.type) {
      case 'CONNECTED':
        this.handleConnected(data);
        break;
      case 'NEW_SURVEY':
        this.handleNewSurvey(data);
        break;
      case 'SURVEY_UPDATED':
        this.handleSurveyUpdated();
        break;
      case 'NEW_SURVEY_CREATED':
        this.handleNewSurveyCreated(data);
        break;
      case 'NEW_DOCUMENT':
        this.handleNewDocument(data);
        break;
      case 'NEW_KVP':
        this.handleNewKvp(data);
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

  /**
   * Reconnect with new token (e.g., after token refresh)
   */
  reconnectWithNewToken(): void {
    console.info('[SSE] Reconnecting with new token...');
    // Reset reconnect attempts since this is a manual reconnect
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;

    // Disconnect existing connection
    this.disconnect();

    // Small delay to ensure clean disconnect
    setTimeout(() => {
      this.connect();
    }, 100);
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
