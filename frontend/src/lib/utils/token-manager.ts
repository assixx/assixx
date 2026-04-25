/**
 * Token Manager - Central JWT Token Lifecycle Management
 *
 * RESPONSIBILITIES:
 * - Access token storage (localStorage for Bearer header)
 * - Token refresh logic (proactive refresh when < 10 min remaining)
 * - Token expiry detection
 * - Timer updates (1 second interval)
 * - Event emission (Observer Pattern for UI updates)
 *
 * SECURITY ARCHITECTURE (HttpOnly Cookie for Refresh Token):
 * - Access Token: Stored in localStorage (short-lived, 30 min)
 * - Refresh Token: Stored in HttpOnly cookie by backend (7 days)
 *   → JavaScript CANNOT read HttpOnly cookies (XSS protection)
 *   → Cookie is automatically sent with credentials: 'include'
 *
 * CRITICAL RULE:
 * - If token is expired (remaining = 0) → LOGOUT immediately, NO refresh attempt!
 * - Only refresh when: remaining > 0 AND remaining < 600 seconds (10 minutes)
 *
 * NOTE: This module MUST NOT import from api-client to avoid circular dependencies.
 * Cache clearing is handled by api-client via the AuthTokenProvider pattern.
 */

import { buildLoginUrl, type LoginRedirectReason } from './build-apex-url';
import { parseJwt } from './jwt-utils';
import { createLogger } from './logger';

import type { LogoutReason } from './auth-types';

const log = createLogger('TokenManager');

interface TokenCallbacks {
  onTimerUpdate: ((remainingSeconds: number) => void)[];
  onTokenRefreshed: ((newToken: string) => void)[];
  onTokenExpiringSoon: (() => void)[];
  onTokenExpired: (() => void)[];
}

// Callback for cache clearing - set by api-client to avoid circular dependency
let onCacheClearCallback: (() => void) | null = null;

/**
 * Register a callback to clear caches when tokens change.
 * Called by api-client during initialization.
 */
export function registerCacheClearCallback(callback: () => void): void {
  onCacheClearCallback = callback;
}

/** Check if we're in browser */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Map a `LogoutReason` (token-manager / api-client domain) to a
 * `LoginRedirectReason` (build-apex-url domain). Both enums encode the same
 * intent at different abstraction layers — this adapter keeps the mapping in
 * ONE place so future reason additions don't drift between the two type
 * systems.
 *
 * Mapping rationale (ADR-050 Amendment 2026-04-22):
 *  - `inactivity_timeout` → `inactivity-timeout` → `?timeout=true` (legacy
 *    query the login page already handles with a friendlier inactivity copy)
 *  - `token_expired` / `refresh_failed` → `session-expired` → `?session=expired`
 *    (passive system event, warning-toned toast)
 *  - `logout` (manual) → `session-expired` is the safe default. Manual logouts
 *    today route through `performLogout()` which uses `'logout-success'`
 *    directly — this branch only fires on programmatic auto-clear.
 */
function toLoginRedirectReason(reason: LogoutReason): LoginRedirectReason {
  switch (reason) {
    case 'inactivity_timeout':
      return 'inactivity-timeout';
    case 'token_expired':
    case 'refresh_failed':
      return 'session-expired';
    case 'logout':
      return 'session-expired';
  }
}

/**
 * Read the `accessTokenExp` cookie — a non-httpOnly companion cookie set by
 * the backend alongside the httpOnly `accessToken`. Its value is the Unix
 * timestamp (seconds since epoch) of the JWT's `exp` claim, exposed so the
 * session-countdown UI can work without the JWT itself.
 *
 * Why: OAuth login-success is a 302 redirect (no JSON response body), so the
 * classic "hydrate TokenManager from POST response" path is unreachable and
 * the timer used to render "00:00 / expired" immediately after a fresh login.
 * With this cookie as the canonical expiry source, the timer is auth-method
 * agnostic and always correct.
 *
 * @see ADR-046 OAuth Sign-In — tokenExp-cookie pattern
 * @returns Unix seconds, or null if the cookie is absent / malformed.
 */
function readAccessTokenExpCookie(): number | null {
  if (!isBrowser()) return null;
  const match = /(?:^|;\s*)accessTokenExp=([^;]+)/.exec(document.cookie);
  // match[1] is guaranteed present by the capture group `([^;]+)` (1+ chars),
  // but noUncheckedIndexedAccess still types it `string | undefined` — so we
  // narrow explicitly with a runtime check that is effectively dead code.
  const raw = match?.[1];
  if (raw === undefined) return null;
  const exp = Number.parseInt(raw, 10);
  return Number.isFinite(exp) && exp > 0 ? exp : null;
}

export class TokenManager {
  private static instance: TokenManager | undefined;
  private accessToken: string | null = null;
  // NOTE: refreshToken is now stored in HttpOnly cookie (not accessible via JS)
  // We track if user has a session via accessToken presence
  private tokenReceivedAt: number | null = null;
  private timerInterval: number | null = null;
  private currentInterval = 60000;
  private debugMode = false;
  private isPageVisible = true;
  private expiringSoonWarningEmitted = false;
  private callbacks: TokenCallbacks = {
    onTimerUpdate: [],
    onTokenRefreshed: [],
    onTokenExpiringSoon: [],
    onTokenExpired: [],
  };
  private isRefreshing = false;
  private isRedirecting = false;

  private constructor() {
    if (!isBrowser()) return;

    this.loadTokensFromStorage();
    this.startTimer();
    this.setupVisibilityListener();
    this.logDebug('🚀 TokenManager initialized with 1s Timer + Page Visibility API');
  }

  static getInstance(): TokenManager {
    // Return dummy instance for SSR
    if (!isBrowser()) {
      return new TokenManager();
    }

    TokenManager.instance ??= new TokenManager();
    return TokenManager.instance;
  }

  /**
   * Load tokens from localStorage on initialization
   *
   * NOTE: Only accessToken is loaded from localStorage.
   * refreshToken is stored in HttpOnly cookie (not accessible via JS).
   */
  private loadTokensFromStorage(): void {
    if (!isBrowser()) return;

    this.accessToken = localStorage.getItem('accessToken');
    // MIGRATION: Clean up old refreshToken from localStorage if it exists
    // New sessions will only have HttpOnly cookie
    const oldRefreshToken = localStorage.getItem('refreshToken');
    if (oldRefreshToken !== null) {
      localStorage.removeItem('refreshToken');
      log.info('Migrated: Removed refreshToken from localStorage (now HttpOnly cookie)');
    }

    const receivedAtStr = localStorage.getItem('tokenReceivedAt');

    if (receivedAtStr !== null) {
      this.tokenReceivedAt = Number.parseInt(receivedAtStr, 10);
    } else if (this.accessToken !== null) {
      // MIGRATION: Old token without tokenReceivedAt
      this.tokenReceivedAt = Date.now();
      localStorage.setItem('tokenReceivedAt', this.tokenReceivedAt.toString());
    }
  }

  // ========================================
  // TOKEN LIFECYCLE MANAGEMENT
  // ========================================

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Get refresh token status.
   *
   * IMPORTANT: The actual refresh token is in an HttpOnly cookie that JS cannot read!
   * This method returns a placeholder 'HTTPONLY_COOKIE' if the user appears to be
   * logged in (has accessToken). This maintains backward compatibility with code
   * that checks `if (getRefreshToken() !== null)` before attempting refresh.
   *
   * The actual refresh happens via the HttpOnly cookie sent automatically
   * with credentials: 'include'.
   */
  public getRefreshToken(): string | null {
    // If we have an accessToken, assume we also have a refresh cookie
    // (they're always set together by the backend)
    return this.accessToken !== null ? 'HTTPONLY_COOKIE' : null;
  }

  /**
   * Set tokens after login or refresh.
   *
   * NOTE: Refresh token is stored in HttpOnly cookie by backend (not managed here).
   */
  public setTokens(access: string): void {
    if (!isBrowser()) return;

    // SECURITY: Clear API cache from previous user before setting new tokens
    // Prevents data leakage between different user sessions
    if (onCacheClearCallback !== null) {
      onCacheClearCallback();
    }

    this.accessToken = access;
    // NOTE: refreshToken is stored in HttpOnly cookie by backend, not in JS
    this.tokenReceivedAt = Date.now();

    localStorage.setItem('accessToken', access);
    // NOTE: refreshToken is NOT stored in localStorage anymore (HttpOnly cookie)
    localStorage.setItem('tokenReceivedAt', this.tokenReceivedAt.toString());

    this.expiringSoonWarningEmitted = false;

    this.callbacks.onTokenRefreshed.forEach((callback) => {
      callback(access);
    });

    const newRemaining = this.getRemainingTime();
    this.logDebug(
      `🔄 Token refreshed! Immediately updating all subscribers with new time: ${newRemaining}s`,
    );

    this.callbacks.onTimerUpdate.forEach((callback) => {
      callback(newRemaining);
    });

    this.restartTimer();
  }

  /**
   * Clear all tokens and redirect to login.
   *
   * NOTE: The HttpOnly refresh token cookie is cleared by the backend
   * when calling /auth/logout. We only clear localStorage items here.
   */
  public clearTokens(reason: LogoutReason = 'logout'): void {
    if (!isBrowser()) return;

    // SECURITY: Clear API cache to prevent data leakage to next user
    if (onCacheClearCallback !== null) {
      onCacheClearCallback();
    }

    this.accessToken = null;
    // NOTE: refreshToken is in HttpOnly cookie, cleared by backend on logout
    this.tokenReceivedAt = null;

    localStorage.removeItem('accessToken');
    // NOTE: refreshToken is not in localStorage anymore (HttpOnly cookie)
    localStorage.removeItem('tokenReceivedAt');
    localStorage.removeItem('user');

    // Clear the non-httpOnly exp cookie client-side as belt-and-braces — the
    // backend also clears it via the /auth/logout response (`clearAuthCookies`
    // in auth.controller.ts), but wiping here guarantees `hasSessionSignal()`
    // flips to false immediately, even if the logout API call is in flight.
    if (isBrowser()) {
      document.cookie = 'accessTokenExp=; Path=/; Max-Age=0';
    }

    this.stopTimer();

    // GUARD: Don't redirect if already on login page
    // This prevents unnecessary redirects when user is already logging in
    if (window.location.pathname === '/login') {
      return;
    }

    this.redirectToLogin(reason);
  }

  /**
   * Refresh tokens if needed (proactive refresh before expiry).
   *
   * Called by api-client before every authenticated request. Uses
   * `hasSessionSignal()` so cookie-only sessions (OAuth 302 login-success per
   * ADR-046, ADR-050 cross-origin tenant-subdomain handoff) trigger proactive
   * refresh too — otherwise they silently no-op and the user gets a hard logout
   * once the access token expires. ADR-046 §"D1 third occurrence" identified
   * this exact "localStorage == session truth" assumption as a recurring bug;
   * `hasSessionSignal()` is the central predicate that fixes it.
   */
  public async refreshIfNeeded(): Promise<boolean> {
    if (!this.hasSessionSignal()) {
      return false;
    }

    if (this.isExpired()) {
      log.warn('Token expired, logging out immediately (no refresh)');
      this.clearTokens('token_expired');
      return false;
    }

    if (this.isExpiringSoon(600)) {
      return await this.refresh();
    }

    return true;
  }

  private validateNewToken(accessToken: string): boolean {
    const payload = parseJwt(accessToken);
    const exp = payload?.exp ?? 0;
    const now = Math.floor(Date.now() / 1000);
    const remaining = exp - now;

    this.logDebug('🔍 New token validity check', {
      exp: exp,
      now: now,
      remaining: remaining,
      remainingMinutes: Math.floor(remaining / 60),
      isAlreadyExpired: exp <= now,
    });

    if (exp <= now) {
      log.error({ exp, now }, 'CRITICAL: Server returned ALREADY EXPIRED token!');
      return false;
    }

    return true;
  }

  /**
   * Check if refresh can proceed. Uses `hasSessionSignal()` (in-memory token OR
   * non-httpOnly `accessTokenExp` cookie) instead of localStorage-only — cookie-
   * only sessions (OAuth 302 login-success per ADR-046, ADR-050 cross-origin
   * tenant-subdomain handoff) MUST NOT be blocked here. The actual refresh hits
   * /auth/refresh with credentials:'include' and reads the HttpOnly refreshToken
   * cookie, so localStorage emptiness is irrelevant for the refresh itself.
   * Without this, the activity-triggered refresh path silently fails and the
   * user gets a hard logout once the access token expires instead of seamless
   * rotation, plus Sentry-noise from log.error on every mouse-move.
   */
  private canRefresh(): boolean {
    if (!isBrowser()) {
      return false;
    }
    if (this.isRefreshing) {
      return false;
    }
    if (!this.hasSessionSignal()) {
      // warn (not error): legitimate state for a logged-out user; not an anomaly
      log.warn('No session signal available, cannot refresh');
      return false;
    }
    return true;
  }

  /**
   * Process successful refresh response.
   *
   * NOTE: The response only contains accessToken. The new refreshToken
   * is set as an HttpOnly cookie by the backend (not visible to JS).
   */
  private processRefreshResponse(data: {
    success?: boolean;
    data?: { accessToken: string; refreshToken?: string };
  }): boolean {
    if (data.success !== true || data.data === undefined) {
      throw new Error('Invalid refresh response format');
    }

    if (!this.validateNewToken(data.data.accessToken)) {
      throw new Error('Server returned expired token');
    }

    // Only accessToken is used, refreshToken is in HttpOnly cookie
    this.setTokens(data.data.accessToken);
    return true;
  }

  /**
   * Refresh the access token using the HttpOnly refresh token cookie.
   *
   * SECURITY: The refresh token is sent automatically via HttpOnly cookie.
   * We use credentials: 'include' to send cookies with the request.
   * The body is empty since the token is in the cookie.
   */
  public async refresh(): Promise<boolean> {
    if (!this.canRefresh()) {
      return false;
    }

    this.isRefreshing = true;

    try {
      const response = await fetch(`${window.location.origin}/api/v2/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // CRITICAL: Send HttpOnly cookie!
        body: JSON.stringify({}), // Empty body, refresh token is in cookie
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed with status ${response.status}`);
      }

      const data = (await response.json()) as {
        success?: boolean;
        data?: { accessToken: string; refreshToken?: string };
      };

      this.logDebug('🔍 Refresh response received', {
        status: response.status,
        success: data.success,
        hasData: data.data !== undefined,
        hasAccessToken: Boolean(data.data?.accessToken),
        // refreshToken is now in HttpOnly cookie, not in response
      });

      return this.processRefreshResponse(data);
    } catch (error: unknown) {
      log.error({ err: error }, 'Token refresh failed');
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  // ========================================
  // TOKEN STATUS QUERIES
  // ========================================

  /**
   * Compute seconds remaining on the current session.
   *
   * Resolution order (first hit wins):
   *   1. `accessTokenExp` cookie — canonical, set by backend on every auth
   *      event (password login, OAuth login-success, OAuth signup, refresh).
   *      This is the ONLY source that works for OAuth login-success because
   *      that flow is a 302 redirect with no JSON body to hydrate localStorage.
   *   2. `accessToken` JWT `exp` claim — fallback for legacy sessions that
   *      predate the cookie rollout (pre-2026-04-16).
   *   3. `tokenReceivedAt` + fixed 30-min lifetime — last-ditch fallback for
   *      sessions where the token was stored without `exp` (shouldn't happen,
   *      but keeps the timer honest instead of showing 0).
   *
   * Returns 0 only when no session material exists at all.
   */
  public getRemainingTime(): number {
    const now = Math.floor(Date.now() / 1000);

    // 1. Canonical: exp cookie
    const cookieExp = readAccessTokenExpCookie();
    if (cookieExp !== null) {
      return Math.max(0, cookieExp - now);
    }

    // No cookie and no token in localStorage → no session
    if (this.accessToken === null) {
      return 0;
    }

    // 2. Legacy fallback: decode the locally-stored JWT
    const payload = parseJwt(this.accessToken);
    if (payload?.exp !== undefined) {
      return Math.max(0, payload.exp - now);
    }

    // 3. Last-ditch: received-at + fixed lifetime
    if (this.tokenReceivedAt === null) {
      return 0;
    }
    const elapsedSeconds = Math.floor((Date.now() - this.tokenReceivedAt) / 1000);
    const TOKEN_LIFETIME_SECONDS = 30 * 60;
    return Math.max(0, TOKEN_LIFETIME_SECONDS - elapsedSeconds);
  }

  public isExpiringSoon(thresholdSeconds: number = 600): boolean {
    const remaining = this.getRemainingTime();
    return remaining > 0 && remaining < thresholdSeconds;
  }

  public isExpired(): boolean {
    return this.getRemainingTime() === 0;
  }

  /**
   * True if a session is active and not yet expired.
   *
   * After OAuth login-success, `accessToken` in JS memory/localStorage is null
   * (the flow is a 302 with no JSON body). The session is still real — it
   * lives in the httpOnly `accessToken` cookie and is visible to JS only via
   * the `accessTokenExp` companion cookie. Either signal counts as "have a
   * session"; the timer and guard logic both rely on this.
   */
  public hasValidToken(): boolean {
    return this.hasSessionSignal() && !this.isExpired();
  }

  /**
   * Private: true if we have ANY proof of an active session — either the
   * in-memory JWT (set via setTokens after JSON auth response) or the
   * non-httpOnly `accessTokenExp` cookie (set by backend on every auth event,
   * including the 302-redirect OAuth login-success that cannot hydrate
   * localStorage). Central predicate for timer start/tick guards and
   * hasValidToken — ensures all three agree on "is there a session?".
   */
  private hasSessionSignal(): boolean {
    return this.accessToken !== null || readAccessTokenExpCookie() !== null;
  }

  // ========================================
  // OBSERVER PATTERN (Event Callbacks)
  // Returns unsubscribe function to prevent memory leaks
  // ========================================

  public onTimerUpdate(callback: (remainingSeconds: number) => void): () => void {
    this.callbacks.onTimerUpdate.push(callback);
    callback(this.getRemainingTime());

    // Ensure the tick loop is running. First subscription after an auth event
    // that only set cookies (OAuth login-success) needs this: setTokens was
    // never called → restartTimer was never called → timer sat idle. Idempotent.
    this.startTimer();

    return () => {
      const index = this.callbacks.onTimerUpdate.indexOf(callback);
      if (index > -1) {
        this.callbacks.onTimerUpdate.splice(index, 1);
      }
    };
  }

  public onTokenRefreshed(callback: (newToken: string) => void): () => void {
    this.callbacks.onTokenRefreshed.push(callback);

    return () => {
      const index = this.callbacks.onTokenRefreshed.indexOf(callback);
      if (index > -1) {
        this.callbacks.onTokenRefreshed.splice(index, 1);
      }
    };
  }

  public onTokenExpiringSoon(callback: () => void): () => void {
    this.callbacks.onTokenExpiringSoon.push(callback);

    return () => {
      const index = this.callbacks.onTokenExpiringSoon.indexOf(callback);
      if (index > -1) {
        this.callbacks.onTokenExpiringSoon.splice(index, 1);
      }
    };
  }

  public onTokenExpired(callback: () => void): () => void {
    this.callbacks.onTokenExpired.push(callback);

    return () => {
      const index = this.callbacks.onTokenExpired.indexOf(callback);
      if (index > -1) {
        this.callbacks.onTokenExpired.splice(index, 1);
      }
    };
  }

  // ========================================
  // TIMER MANAGEMENT
  // ========================================

  /**
   * Start the countdown tick loop. Idempotent: safe to call repeatedly — only
   * the first call with a valid session signal actually registers the interval.
   *
   * Guard uses `hasSessionSignal()` (not the old `accessToken !== null`) so
   * that OAuth login-success — which lands with only the exp cookie and no
   * localStorage token — can still start the timer. Before this fix the
   * guard rejected cookie-only sessions and the widget froze until reload.
   */
  private startTimer(): void {
    if (!isBrowser()) return;
    if (!this.hasSessionSignal()) return;
    // Idempotent: skip if an interval is already registered. Prevents duplicate
    // intervals when onTimerUpdate subscribes after restartTimer has already run.
    if (this.timerInterval !== null) return;

    const interval = this.getOptimalInterval();
    this.currentInterval = interval;

    this.logDebug(`⏱️ Starting Timer with ${interval}ms interval`, {
      remaining: this.getRemainingTime(),
      interval,
      mode: this.getIntervalMode(),
    });

    this.timerInterval = window.setInterval(() => {
      if (!this.isPageVisible) return;
      this.tick();
    }, interval);
  }

  private stopTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private restartTimer(): void {
    this.stopTimer();
    this.startTimer();
  }

  private tick(): void {
    // GUARD: Don't process expiry logic if there's no session signal at all.
    // This prevents false "session expired" redirects on login page
    // when user switches tabs (visibilitychange event triggers tick()).
    // Accepts either signal (in-memory JWT or exp cookie) — same rationale
    // as startTimer's guard; OAuth login-success has only the cookie.
    if (!this.hasSessionSignal()) {
      return;
    }

    const remaining = this.getRemainingTime();

    this.callbacks.onTimerUpdate.forEach((callback) => {
      callback(remaining);
    });

    if (remaining === 0) {
      this.logDebug('💀 TOKEN EXPIRED! Initiating logout...');
      log.warn('Token expired (00:00), logging out immediately');

      this.stopTimer();

      this.callbacks.onTokenExpired.forEach((callback) => {
        callback();
      });

      this.clearTokens('token_expired');
      return;
    }

    if (this.isExpiringSoon(300) && !this.expiringSoonWarningEmitted) {
      this.expiringSoonWarningEmitted = true;
      this.logDebug('⚠️ Token expiring soon (<5 min), emitting warning');
      this.callbacks.onTokenExpiringSoon.forEach((callback) => {
        callback();
      });
    }
  }

  // ========================================
  // UTILITIES
  // ========================================

  private redirectToLogin(reason: LogoutReason): void {
    if (!isBrowser()) return;

    if (this.isRedirecting) {
      return;
    }

    this.isRedirecting = true;

    // ADR-050 Amendment 2026-04-22: cross-origin redirect to apex login.
    // The previous implementation built a relative `/login?session=expired`
    // URL and called `window.location.replace(url)` — relative paths are
    // resolved against the current origin, so a session-timeout on
    // `<slug>.assixx.com` kept the user on the tenant subdomain (defeating
    // the entire apex-redirect design). The fix routes through
    // `buildLoginUrl()` which resolves to the absolute apex origin via the
    // browser-fallback (env-or-window.location-derived).
    const url = buildLoginUrl(toLoginRedirectReason(reason));

    log.warn({ reason, url }, 'Redirecting to login');
    window.location.replace(url);
  }

  private setupVisibilityListener(): void {
    if (!isBrowser()) return;

    document.addEventListener('visibilitychange', () => {
      const wasVisible = this.isPageVisible;
      this.isPageVisible = !document.hidden;

      if (!wasVisible && this.isPageVisible) {
        this.tick();
      }
    });
  }

  /**
   * Timer interval for UI countdown.
   * Must be 1s — the header shows a MM:SS countdown that users expect to tick live.
   * The isPageVisible guard in tick() already skips work for background tabs.
   * Cost: ~0.01ms per tick = 18ms total over 30 min token lifetime. Negligible.
   */
  private getOptimalInterval(): number {
    return 1000;
  }

  private getIntervalMode(): string {
    return 'LIVE (1s)';
  }

  private logDebug(message: string, data?: Record<string, unknown>): void {
    // Only log in debug mode OR in development environment
    const isDev = import.meta.env.DEV;
    if (!this.debugMode && !isDev) return;

    const remaining = this.getRemainingTime();
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (data !== undefined) {
      log.debug({ ...data, remaining: timeStr }, message);
    } else {
      log.debug({ remaining: timeStr }, message);
    }
  }

  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    this.logDebug(enabled ? '🐛 Debug mode ENABLED' : '🔇 Debug mode DISABLED');
  }

  public getTimerStats(): Record<string, unknown> {
    return {
      remaining: this.getRemainingTime(),
      interval: this.currentInterval,
      mode: this.getIntervalMode(),
      isPageVisible: this.isPageVisible,
      isRefreshing: this.isRefreshing,
      hasToken: this.accessToken !== null,
      callbacks: {
        onTimerUpdate: this.callbacks.onTimerUpdate.length,
        onTokenRefreshed: this.callbacks.onTokenRefreshed.length,
        onTokenExpiringSoon: this.callbacks.onTokenExpiringSoon.length,
        onTokenExpired: this.callbacks.onTokenExpired.length,
      },
    };
  }

  public destroy(): void {
    this.stopTimer();
    this.callbacks = {
      onTimerUpdate: [],
      onTokenRefreshed: [],
      onTokenExpiringSoon: [],
      onTokenExpired: [],
    };
  }
}

// Export singleton getter function (SSR-safe)
export function getTokenManager(): TokenManager {
  return TokenManager.getInstance();
}

// Re-export LogoutReason for backward compatibility
export type { LogoutReason } from './auth-types';

// For browser debugging (development only)
// CRITICAL: Use import.meta.env.DEV (build-time check) NOT hostname (runtime check)
// hostname check would expose tokenManager in production on localhost (Docker/Nginx)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { tokenManager: TokenManager }).tokenManager = TokenManager.getInstance();
}
