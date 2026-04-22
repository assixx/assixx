// =============================================================================
// APP LAYOUT — Extracted helpers
// Pure functions with explicit deps (no $state, no runes)
// =============================================================================

import { clearActiveRole } from '$lib/utils/auth';
import { buildLoginUrl } from '$lib/utils/build-apex-url';

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

/**
 * Dependencies injected into {@link performLogout}. `navigate` deliberately
 * NOT part of the contract: the post-logout destination is fixed (apex
 * `/login?logout=success`) per ADR-050 Amendment and cross-origin from any
 * tenant subdomain. The hard-navigate happens inside `performLogout` via
 * `window.location.href`.
 */
interface LogoutDeps {
  apiClient: { post: (url: string) => Promise<unknown> };
  onError: (err: unknown) => void;
  lockE2E: () => Promise<void>;
  clearCaches: () => void;
}

export async function performLogout(deps: LogoutDeps): Promise<void> {
  const loginUrl = buildLoginUrl('logout-success');

  try {
    // Call logout API first (while we still have a valid token)
    await deps.apiClient.post('/auth/logout');
  } catch (err: unknown) {
    deps.onError(err);
  }

  // Clear E2E encryption state + private key from Worker memory + IndexedDB
  await deps.lockE2E();
  deps.clearCaches();

  // Clear all tokens and role data from localStorage. Subdomain-scoped
  // cookies are wiped server-side by POST /auth/logout (HttpOnly). The
  // upcoming cross-origin navigation leaves anything we missed orphaned
  // on the subdomain, where no authenticated request will read it again.
  localStorage.removeItem('userRole');
  clearActiveRole();
  localStorage.removeItem('token'); // Legacy token
  localStorage.removeItem('accessToken');
  // NOTE: refreshToken is in HttpOnly cookie, cleared by backend on /auth/logout
  localStorage.removeItem('tokenReceivedAt');
  localStorage.removeItem('user');

  // Prefetch the apex login route BEFORE the hard-nav so the Vite dev
  // server's compile cache is primed and the browser already holds the
  // HTML bytes for the target origin. The gain:
  //   - Dev: first compile of /login after a fresh restart costs 200–500 ms
  //     and otherwise happens during the cross-origin blank frame — the
  //     reason the user perceives an "empty page" between logout and login.
  //     After this prefetch, the subsequent nav hits a warm Vite cache →
  //     login paints ~10x faster and the blank window collapses to the
  //     browser's unavoidable document-swap frame (~50 ms).
  //   - Prod: apex is usually same-host-family (edge-cached), so this is
  //     a no-op cost-wise; no harm done.
  // `mode: 'no-cors'` is deliberate — we cannot (and do not need to) read
  // the response; we only care that the server processed the request and
  // warmed its cache. `credentials: 'omit'` keeps the apex origin cookie-
  // free which is the ADR-050 R1 isolation guarantee anyway (apex cookies
  // would leak cross-tenant — architectural test R1 blocks this).
  try {
    await fetch(loginUrl, {
      method: 'GET',
      mode: 'no-cors',
      credentials: 'omit',
    });
  } catch {
    // Prefetch is best-effort; a network hiccup here MUST NOT block the
    // actual navigation. Swallow silently and proceed to the hard-nav.
  }

  // ADR-050 Amendment (Logout → Apex): post-logout surface is the apex
  // login page, not the tenant subdomain. Hard-navigate — SvelteKit's
  // goto() is client-router-bound and cannot cross origins. The full page
  // load also discards stale TokenManager in-memory state without
  // triggering clearTokens()'s own redirect logic.
  window.location.href = loginUrl;
}
