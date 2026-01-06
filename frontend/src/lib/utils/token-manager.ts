/**
 * Token Manager - Central JWT Token Lifecycle Management
 * 1:1 Copy from frontend/src/utils/token-manager.ts + SSR safety
 *
 * RESPONSIBILITIES:
 * - Token storage (accessToken, refreshToken)
 * - Token refresh logic (proactive refresh when < 10 min remaining)
 * - Token expiry detection
 * - Timer updates (1 second interval)
 * - Event emission (Observer Pattern for UI updates)
 *
 * CRITICAL RULE:
 * - If token is expired (remaining = 0) → LOGOUT immediately, NO refresh attempt!
 * - Only refresh when: remaining > 0 AND remaining < 600 seconds (10 minutes)
 */

import { parseJwt } from './jwt-utils';

interface TokenCallbacks {
  onTimerUpdate: ((remainingSeconds: number) => void)[];
  onTokenRefreshed: ((newToken: string) => void)[];
  onTokenExpiringSoon: (() => void)[];
  onTokenExpired: (() => void)[];
}

export type LogoutReason = 'logout' | 'inactivity_timeout' | 'token_expired' | 'refresh_failed';

/**
 * Check if we're in browser
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export class TokenManager {
  private static instance: TokenManager | undefined;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
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
   */
  private loadTokensFromStorage(): void {
    if (!isBrowser()) return;

    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');

    const receivedAtStr = localStorage.getItem('tokenReceivedAt');

    if (receivedAtStr !== null) {
      this.tokenReceivedAt = Number.parseInt(receivedAtStr, 10);
    } else if (this.accessToken !== null) {
      // MIGRATION: Old token without tokenReceivedAt
      this.tokenReceivedAt = Date.now();
      localStorage.setItem('tokenReceivedAt', this.tokenReceivedAt.toString());
      console.info('[TokenManager] Migrated old token: set tokenReceivedAt to now');
    }
  }

  // ========================================
  // TOKEN LIFECYCLE MANAGEMENT
  // ========================================

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public getRefreshToken(): string | null {
    return this.refreshToken;
  }

  public setTokens(access: string, refresh: string): void {
    if (!isBrowser()) return;

    // SECURITY: Clear API cache from previous user before setting new tokens
    // Prevents data leakage between different user sessions
    import('./api-client').then(({ getApiClient }) => {
      getApiClient().clearCache();
      console.info('[TokenManager] API cache cleared for new session');
    });

    this.accessToken = access;
    this.refreshToken = refresh;
    this.tokenReceivedAt = Date.now();

    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
    localStorage.setItem('tokenReceivedAt', this.tokenReceivedAt.toString());

    // Legacy cookie for backward compatibility
    document.cookie = `token=${access}; path=/; max-age=86400; SameSite=Lax`;

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

  public clearTokens(reason: LogoutReason = 'logout'): void {
    if (!isBrowser()) return;

    // SECURITY: Clear API cache to prevent data leakage to next user
    import('./api-client').then(({ getApiClient }) => {
      getApiClient().clearCache();
      console.info('[TokenManager] API cache cleared on logout');
    });

    this.accessToken = null;
    this.refreshToken = null;
    this.tokenReceivedAt = null;

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
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

  public async refreshIfNeeded(): Promise<boolean> {
    if (this.accessToken === null || this.refreshToken === null) {
      return false;
    }

    if (this.isExpired()) {
      console.warn('[TokenManager] Token expired, logging out immediately (no refresh)');
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

    console.warn('[TokenManager] 🔍 DEBUG - New token validity:', {
      exp: exp,
      now: now,
      remaining: remaining,
      remainingMinutes: Math.floor(remaining / 60),
      isAlreadyExpired: exp <= now,
      tokenPreview: accessToken.substring(0, 50) + '...',
    });

    if (exp <= now) {
      console.error('[TokenManager] ❌ CRITICAL: Server returned ALREADY EXPIRED token!');
      return false;
    }

    return true;
  }

  public async refresh(): Promise<boolean> {
    if (!isBrowser()) return false;

    if (this.isRefreshing) {
      console.info('[TokenManager] Refresh already in progress, skipping');
      return false;
    }

    if (this.refreshToken === null) {
      console.error('[TokenManager] No refresh token available');
      return false;
    }

    this.isRefreshing = true;

    try {
      console.info('[TokenManager] Refreshing access token...');

      const response = await fetch(`${window.location.origin}/api/v2/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed with status ${response.status}`);
      }

      const data = (await response.json()) as {
        success?: boolean;
        data?: { accessToken: string; refreshToken: string };
      };

      console.warn('[TokenManager] 🔍 DEBUG - Refresh response:', {
        status: response.status,
        success: data.success,
        hasData: data.data !== undefined,
        hasAccessToken: data.data?.accessToken !== undefined && data.data.accessToken !== '',
        hasRefreshToken: data.data?.refreshToken !== undefined && data.data.refreshToken !== '',
      });

      if (data.success === true && data.data !== undefined) {
        if (!this.validateNewToken(data.data.accessToken)) {
          throw new Error('Server returned expired token');
        }

        this.setTokens(data.data.accessToken, data.data.refreshToken);
        console.info('[TokenManager] Token refreshed successfully');
        return true;
      }

      throw new Error('Invalid refresh response format');
    } catch (error) {
      console.error('[TokenManager] Token refresh failed:', error);
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
  // ========================================

  public onTimerUpdate(callback: (remainingSeconds: number) => void): void {
    this.callbacks.onTimerUpdate.push(callback);
    callback(this.getRemainingTime());
  }

  public onTokenRefreshed(callback: (newToken: string) => void): void {
    this.callbacks.onTokenRefreshed.push(callback);
  }

  public onTokenExpiringSoon(callback: () => void): void {
    this.callbacks.onTokenExpiringSoon.push(callback);
  }

  public onTokenExpired(callback: () => void): void {
    this.callbacks.onTokenExpired.push(callback);
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
      console.warn('[TokenManager] Token expired (00:00), logging out immediately');

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
      console.info('[TokenManager] Redirect already in progress, skipping duplicate');
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

    const url = params.toString() !== '' ? `/login?${params.toString()}` : '/login';

    console.warn(`[TokenManager] Redirecting to login (reason: ${reason})`);
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

  private getOptimalInterval(): number {
    return 1000;
  }

  private getIntervalMode(): string {
    return 'LIVE (1s)';
  }

  private logDebug(message: string, data?: Record<string, unknown>): void {
    if (!this.debugMode) return;

    const timestamp = new Date().toISOString().split('T')[1]?.slice(0, 8) ?? '';
    const remaining = this.getRemainingTime();
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (data !== undefined) {
      console.info(`[TokenManager ${timestamp}] [${timeStr}] ${message}`, data);
    } else {
      console.info(`[TokenManager ${timestamp}] [${timeStr}] ${message}`);
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

// For browser debugging (development only)
if (isBrowser()) {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).tokenManager = TokenManager.getInstance();
    console.info('[TokenManager] Debug mode - available as window.tokenManager');
  }
}
