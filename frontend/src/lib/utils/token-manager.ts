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
    this.logDebug(
      '🚀 TokenManager initialized with 1s Timer + Page Visibility API',
    );
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
      log.info(
        'Migrated: Removed refreshToken from localStorage (now HttpOnly cookie)',
      );
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
   * NOTE: We check accessToken presence to determine if user has a session.
   * The actual refresh uses the HttpOnly cookie automatically.
   */
  public async refreshIfNeeded(): Promise<boolean> {
    // No access token = no session
    if (this.accessToken === null) {
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
      log.error(
        { exp, now },
        'CRITICAL: Server returned ALREADY EXPIRED token!',
      );
      return false;
    }

    return true;
  }

  /**
   * Check if refresh can proceed.
   *
   * NOTE: We can't check if HttpOnly cookie exists from JS.
   * We assume it exists if user has an accessToken (set together by backend).
   */
  private canRefresh(): boolean {
    if (!isBrowser()) {
      return false;
    }
    if (this.isRefreshing) {
      return false;
    }
    // Can't check HttpOnly cookie directly, assume it exists if we have accessToken
    if (this.accessToken === null) {
      log.error('No access token available, cannot refresh');
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
      const response = await fetch(
        `${window.location.origin}/api/v2/auth/refresh`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // CRITICAL: Send HttpOnly cookie!
          body: JSON.stringify({}), // Empty body, refresh token is in cookie
        },
      );

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
    } catch (error) {
      log.error({ err: error }, 'Token refresh failed');
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  // ========================================
  // TOKEN STATUS QUERIES
  // ========================================

  public getRemainingTime(): number {
    if (this.accessToken === null) {
      return 0;
    }

    if (this.tokenReceivedAt === null) {
      const payload = parseJwt(this.accessToken);
      if (payload?.exp === undefined) {
        return 0;
      }

      const now = Math.floor(Date.now() / 1000);
      const remaining = payload.exp - now;
      return Math.max(0, remaining);
    }

    const elapsedMs = Date.now() - this.tokenReceivedAt;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    const TOKEN_LIFETIME_SECONDS = 30 * 60;
    const remaining = TOKEN_LIFETIME_SECONDS - elapsedSeconds;

    return Math.max(0, remaining);
  }

  public isExpiringSoon(thresholdSeconds: number = 600): boolean {
    const remaining = this.getRemainingTime();
    return remaining > 0 && remaining < thresholdSeconds;
  }

  public isExpired(): boolean {
    return this.getRemainingTime() === 0;
  }

  public hasValidToken(): boolean {
    return this.accessToken !== null && !this.isExpired();
  }

  // ========================================
  // OBSERVER PATTERN (Event Callbacks)
  // Returns unsubscribe function to prevent memory leaks
  // ========================================

  public onTimerUpdate(
    callback: (remainingSeconds: number) => void,
  ): () => void {
    this.callbacks.onTimerUpdate.push(callback);
    callback(this.getRemainingTime());

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

  private startTimer(): void {
    if (!isBrowser()) return;
    if (this.accessToken === null) return;

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
    // GUARD: Don't process expiry logic if there's no token
    // This prevents false "session expired" redirects on login page
    // when user switches tabs (visibilitychange event triggers tick())
    if (this.accessToken === null) {
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

    const params = new URLSearchParams();

    switch (reason) {
      case 'inactivity_timeout':
        params.set('timeout', 'true');
        break;
      case 'token_expired':
      case 'refresh_failed':
        params.set('session', 'expired');
        break;
    }

    const url =
      params.toString() !== '' ? `/login?${params.toString()}` : '/login';

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
  (window as unknown as { tokenManager: TokenManager }).tokenManager =
    TokenManager.getInstance();
}
