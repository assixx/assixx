// =============================================================================
// APP LAYOUT — Extracted helpers
// Pure functions with explicit deps (no $state, no runes)
// =============================================================================

import type { WebSocketCallbacks } from '../(shared)/chat/_lib/handlers';

// ─── Presence WebSocket ──────────────────────────────────────────────

interface PresenceConfig {
  userId: number;
  tenantId: number;
  onInfo: (msg: string) => void;
  onError: (msg: string) => void;
  onAuthError: () => void;
}

export function createPresenceCallbacks(config: PresenceConfig): WebSocketCallbacks {
  return {
    onConnected: () => {
      config.onInfo('Presence WebSocket connected');
    },
    onDisconnect: (_permanent: boolean) => {
      // Reconnection handled automatically by handlers.ts
    },
    // No-op handlers: SSE handles notification badges outside chat page.
    // Chat page upgrades these with real handlers when mounted.
    onNewMessage: () => {
      /* no-op: SSE handles badges */
    },
    onTypingStart: () => {
      /* no-op: chat-page-only */
    },
    onTypingStop: () => {
      /* no-op: chat-page-only */
    },
    onUserStatus: () => {
      /* no-op: chat-page-only */
    },
    onMessageRead: () => {
      /* no-op: chat-page-only */
    },
    onError: (error: string) => {
      config.onError(error);
    },
    onAuthError: () => {
      config.onAuthError();
    },
    getActiveConversationId: () => null,
    getCurrentUserId: () => config.userId,
    getTenantId: () => config.tenantId,
    getConversations: () => [],
  };
}

// ─── Token Timer ─────────────────────────────────────────────────────

export interface TokenTimeResult {
  timeLeft: string;
  warning: boolean;
  expired: boolean;
}

export function formatTokenTime(remainingSeconds: number): TokenTimeResult {
  if (remainingSeconds <= 0) {
    return { timeLeft: '00:00', expired: true, warning: false };
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return {
    timeLeft: `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
    warning: remainingSeconds <= 120,
    expired: false,
  };
}

// ─── Logout ──────────────────────────────────────────────────────────

interface LogoutDeps {
  apiClient: { post: (url: string) => Promise<unknown> };
  onError: (err: unknown) => void;
  lockE2E: () => Promise<void>;
  clearCaches: () => void;
  navigate: (url: string) => Promise<void>;
}

export async function performLogout(deps: LogoutDeps): Promise<void> {
  try {
    // Call logout API first (while we still have a valid token)
    await deps.apiClient.post('/auth/logout');
  } catch (err: unknown) {
    deps.onError(err);
  }

  // Clear E2E encryption state + private key from Worker memory + IndexedDB
  await deps.lockE2E();
  deps.clearCaches();

  // Clear all tokens and role data from localStorage
  localStorage.removeItem('userRole');
  localStorage.removeItem('activeRole');
  localStorage.removeItem('token'); // Legacy token
  localStorage.removeItem('accessToken');
  // NOTE: refreshToken is in HttpOnly cookie, cleared by backend on /auth/logout
  localStorage.removeItem('tokenReceivedAt');
  localStorage.removeItem('user');

  // Note: TokenManager in-memory state will be stale, but page navigation
  // will reinitialize it. No need to call clearTokens() which would trigger
  // a window.location redirect that we want to avoid.

  // Use SvelteKit's goto() for client-side navigation (no full page reload)
  await deps.navigate('/login');
}
