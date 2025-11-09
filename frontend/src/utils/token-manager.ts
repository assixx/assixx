/**
 * Token Manager - Central JWT Token Lifecycle Management
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

export class TokenManager {
  private static instance: TokenManager | undefined;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenReceivedAt: number | null = null; // Client timestamp when token was received (Clock Skew fix)
  private timerInterval: number | null = null;
  private currentInterval = 60000; // Start with 1 minute interval
  private debugMode = true; // Enable debug logging for testing
  private isPageVisible = true;
  private callbacks: TokenCallbacks = {
    onTimerUpdate: [],
    onTokenRefreshed: [],
    onTokenExpiringSoon: [],
    onTokenExpired: [],
  };
  private isRefreshing = false; // Prevent concurrent refresh attempts
  private isRedirecting = false; // Prevent multiple logout redirects

  private constructor() {
    this.loadTokensFromStorage();
    this.startTimer();
    this.setupVisibilityListener();
    this.logDebug('🚀 TokenManager initialized with 1s Timer + Page Visibility API');
  }

  static getInstance(): TokenManager {
    TokenManager.instance ??= new TokenManager();
    return TokenManager.instance;
  }

  /**
   * Load tokens from localStorage on initialization
   */
  private loadTokensFromStorage(): void {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');

    const receivedAtStr = localStorage.getItem('tokenReceivedAt');

    if (receivedAtStr !== null) {
      // Token has tokenReceivedAt (new method)
      this.tokenReceivedAt = Number.parseInt(receivedAtStr, 10);
    } else if (this.accessToken !== null) {
      // MIGRATION: Old token without tokenReceivedAt
      // Set to NOW (Client time) - not perfect but better than Clock Skew
      // Token might be X seconds old already, but we can't know exactly when it was received
      this.tokenReceivedAt = Date.now();
      localStorage.setItem('tokenReceivedAt', this.tokenReceivedAt.toString());
      console.log('[TokenManager] Migrated old token: set tokenReceivedAt to now');
    }
  }

  // ========================================
  // TOKEN LIFECYCLE MANAGEMENT
  // ========================================

  /**
   * Get current access token
   */
  public getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Get current refresh token
   */
  public getRefreshToken(): string | null {
    return this.refreshToken;
  }

  /**
   * Set new token pair (after login or refresh)
   * @param access - New access token
   * @param refresh - New refresh token
   */
  public setTokens(access: string, refresh: string): void {
    this.accessToken = access;
    this.refreshToken = refresh;
    this.tokenReceivedAt = Date.now(); // Capture client timestamp (Clock Skew fix)

    // Persist to localStorage
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
    localStorage.setItem('tokenReceivedAt', this.tokenReceivedAt.toString());

    // Also update cookie for legacy compatibility (some endpoints might still check it)
    // Using 'token' for backward compatibility with backend
    document.cookie = `token=${access}; path=/; max-age=86400; SameSite=Lax`;

    // Notify all subscribers about new token
    this.callbacks.onTokenRefreshed.forEach((callback) => {
      callback(access);
    });

    // CRITICAL: Immediately notify all timer subscribers about the new time
    // This ensures UI updates instantly after token refresh (not waiting for next tick)
    const newRemaining = this.getRemainingTime();
    this.logDebug(`🔄 Token refreshed! Immediately updating all subscribers with new time: ${newRemaining}s`);

    this.callbacks.onTimerUpdate.forEach((callback) => {
      callback(newRemaining);
    });

    // Restart timer with new token
    this.restartTimer();
  }

  /**
   * Clear tokens and redirect to login
   * @param reason - Why tokens are being cleared
   */
  public clearTokens(reason: LogoutReason = 'logout'): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenReceivedAt = null;

    // Clear localStorage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenReceivedAt');
    localStorage.removeItem('user');

    // Stop timer
    this.stopTimer();

    // Redirect to login with appropriate message
    this.redirectToLogin(reason);
  }

  /**
   * Proactively refresh token if it expires soon (< 10 min)
   * CRITICAL: Only refresh if remaining > 0! If token is expired, logout immediately.
   * @returns true if token is fresh or successfully refreshed, false if refresh failed
   */
  public async refreshIfNeeded(): Promise<boolean> {
    // No token = can't refresh
    if (this.accessToken === null || this.refreshToken === null) {
      return false;
    }

    // Token expired = immediate logout, NO refresh attempt
    if (this.isExpired()) {
      console.warn('[TokenManager] Token expired, logging out immediately (no refresh)');
      this.clearTokens('token_expired');
      return false;
    }

    // Token expires soon (< 10 min) = proactive refresh
    if (this.isExpiringSoon(600)) {
      // 600 seconds = 10 minutes
      return await this.refresh();
    }

    // Token still fresh (> 10 min remaining)
    return true;
  }

  /**
   * Refresh access token using refresh token
   * Can be called manually (e.g., when user clicks "Stay Active" button in session warning modal)
   * @returns true if refresh succeeded, false otherwise
   */
  /**
   * Validate newly received token
   */
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
    // Prevent concurrent refresh attempts
    if (this.isRefreshing) {
      console.info('[TokenManager] Refresh already in progress, skipping');
      return false;
    }

    // Check if refresh token exists
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

      // DEBUG: Log response
      console.warn('[TokenManager] 🔍 DEBUG - Refresh response:', {
        status: response.status,
        success: data.success,
        hasData: data.data !== undefined,
        hasAccessToken: data.data?.accessToken !== undefined && data.data.accessToken !== '',
        hasRefreshToken: data.data?.refreshToken !== undefined && data.data.refreshToken !== '',
      });

      if (data.success === true && data.data !== undefined) {
        // Validate new token
        if (!this.validateNewToken(data.data.accessToken)) {
          throw new Error('Server returned expired token');
        }

        // Success: Update tokens
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

  /**
   * Get remaining time until token expires (in seconds)
   * CLOCK SKEW FIX: Uses only client time (Date.now()) to avoid server-client time mismatch
   *
   * NEW TOKENS (with tokenReceivedAt - clock skew immune):
   *   elapsed = now (client time) - receivedAt (client time)
   *   remaining = TOKEN_LIFETIME - elapsed
   *
   * OLD TOKENS (without tokenReceivedAt - fallback to exp):
   *   remaining = exp (server time) - now (client time)
   *
   * @returns Remaining seconds, or 0 if token is expired/invalid
   */
  public getRemainingTime(): number {
    // No token = no time remaining
    if (this.accessToken === null) {
      return 0;
    }

    // FALLBACK: If tokenReceivedAt is missing (old tokens before update), use JWT exp
    if (this.tokenReceivedAt === null) {
      const payload = parseJwt(this.accessToken);
      if (payload?.exp === undefined) {
        return 0;
      }

      const now = Math.floor(Date.now() / 1000);
      const remaining = payload.exp - now;
      return Math.max(0, remaining);
    }

    // NEW METHOD: Clock Skew immune calculation using client time only
    const elapsedMs = Date.now() - this.tokenReceivedAt;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    // Token lifetime is 30 minutes = 1800 seconds (hardcoded to match backend)
    const TOKEN_LIFETIME_SECONDS = 30 * 60;
    const remaining = TOKEN_LIFETIME_SECONDS - elapsedSeconds;

    return Math.max(0, remaining);
  }

  /**
   * Check if token expires soon (within threshold)
   * @param thresholdSeconds - Threshold in seconds (default: 600 = 10 minutes)
   * @returns true if token expires within threshold, false otherwise
   */
  public isExpiringSoon(thresholdSeconds: number = 600): boolean {
    const remaining = this.getRemainingTime();
    return remaining > 0 && remaining < thresholdSeconds;
  }

  /**
   * Check if token is expired
   * @returns true if token is expired or invalid, false otherwise
   */
  public isExpired(): boolean {
    return this.getRemainingTime() === 0;
  }

  /**
   * Check if user has a valid token
   * @returns true if token exists and is not expired
   */
  public hasValidToken(): boolean {
    return this.accessToken !== null && !this.isExpired();
  }

  // ========================================
  // OBSERVER PATTERN (Event Callbacks)
  // ========================================

  /**
   * Subscribe to timer updates (called every second)
   * @param callback - Function to call with remaining seconds
   */
  public onTimerUpdate(callback: (remainingSeconds: number) => void): void {
    this.callbacks.onTimerUpdate.push(callback);
    // Immediately call callback with current value (prevents --:-- flash on page load)
    callback(this.getRemainingTime());
  }

  /**
   * Subscribe to token refresh events
   * @param callback - Function to call when token is refreshed
   */
  public onTokenRefreshed(callback: (newToken: string) => void): void {
    this.callbacks.onTokenRefreshed.push(callback);
  }

  /**
   * Subscribe to "token expiring soon" warnings
   * @param callback - Function to call when token is expiring soon (< 5 min)
   */
  public onTokenExpiringSoon(callback: () => void): void {
    this.callbacks.onTokenExpiringSoon.push(callback);
  }

  /**
   * Subscribe to token expiry events
   * @param callback - Function to call when token expires
   */
  public onTokenExpired(callback: () => void): void {
    this.callbacks.onTokenExpired.push(callback);
  }

  // ========================================
  // TIMER MANAGEMENT
  // ========================================

  /**
   * Start timer with 1 second interval for live countdown
   * UX: Always 1 second for smooth, real-time timer display
   */
  private startTimer(): void {
    // Don't start timer if no token
    if (this.accessToken === null) {
      return;
    }

    const interval = this.getOptimalInterval();
    this.currentInterval = interval;

    this.logDebug(`⏱️ Starting Timer with ${interval}ms interval`, {
      remaining: this.getRemainingTime(),
      interval,
      mode: this.getIntervalMode(),
    });

    this.timerInterval = window.setInterval(() => {
      // Skip tick if page is hidden (Page Visibility API)
      if (!this.isPageVisible) {
        return;
      }

      this.tick();
    }, interval);
  }

  /**
   * Stop timer
   */
  private stopTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Restart timer (after token refresh)
   */
  private restartTimer(): void {
    this.stopTimer();
    this.startTimer();
    // Note: setTokens() already notifies all subscribers, so no tick() needed here
  }

  /**
   * Timer tick (fires every second for live countdown)
   */
  private tick(): void {
    const remaining = this.getRemainingTime();

    // Note: Removed "Tick fired" debug log - it fires every 1 second and pollutes console
    // If you need to debug timer ticks, use: tokenManager.getTimerStats()

    // Emit timer update to all subscribers
    this.callbacks.onTimerUpdate.forEach((callback) => {
      callback(remaining);
    });

    // Check for expiration FIRST (before emitting other events)
    if (remaining === 0) {
      this.logDebug('💀 TOKEN EXPIRED! Initiating logout...');
      console.warn('[TokenManager] Token expired (00:00), logging out immediately');

      // Stop timer FIRST to prevent further ticks
      this.stopTimer();

      // Emit expiration event to all subscribers
      this.callbacks.onTokenExpired.forEach((callback) => {
        callback();
      });

      // Clear tokens and redirect (will skip timer stop since already stopped)
      this.clearTokens('token_expired');

      return; // Exit immediately after logout
    }

    // Emit warning if token expires soon (< 5 minutes)
    if (this.isExpiringSoon(300)) {
      this.logDebug('⚠️ Token expiring soon (<5 min), emitting warning');
      this.callbacks.onTokenExpiringSoon.forEach((callback) => {
        callback();
      });
    }
  }

  // ========================================
  // UTILITIES
  // ========================================

  /**
   * Redirect to login page with reason parameter
   * @param reason - Why user is being redirected
   */
  private redirectToLogin(reason: LogoutReason): void {
    // Prevent multiple simultaneous redirects (race condition protection)
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
      // 'logout': no params
    }

    const url = params.toString() !== '' ? `/login?${params.toString()}` : '/login';

    console.warn(`[TokenManager] Redirecting to login (reason: ${reason})`);

    // Use replace() instead of href to prevent back-button issues
    // Also more reliable for immediate redirect
    window.location.replace(url);
  }

  /**
   * Setup Page Visibility API listener for battery optimization
   * BEST PRACTICE 2025: Pause timer when tab is hidden (saves 75% battery)
   */
  private setupVisibilityListener(): void {
    document.addEventListener('visibilitychange', () => {
      const wasVisible = this.isPageVisible;
      this.isPageVisible = !document.hidden;

      if (!wasVisible && this.isPageVisible) {
        // Page became visible - immediately update on visibility to sync UI
        this.tick();
      }
      // Note: No action needed when page becomes hidden - timer continues in background
    });
  }

  /**
   * Get timer interval (always 1 second for live countdown)
   * UX: User expects to see timer update every second (like a real clock)
   */
  private getOptimalInterval(): number {
    // Always 1 second for best UX
    // Progressive intervals (60s, 10s, 5s) were causing "jumpy" timer
    return 1000;
  }

  /**
   * Get current interval mode for debugging
   */
  private getIntervalMode(): string {
    return 'LIVE (1s)';
  }

  /**
   * Debug logging helper - only logs when debugMode is true
   */
  private logDebug(message: string, data?: Record<string, unknown>): void {
    if (!this.debugMode) return;

    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    const remaining = this.getRemainingTime();
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (data !== undefined) {
      console.log(`[TokenManager ${timestamp}] [${timeStr}] ${message}`, data);
    } else {
      console.log(`[TokenManager ${timestamp}] [${timeStr}] ${message}`);
    }
  }

  /**
   * Enable/disable debug mode
   */
  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    this.logDebug(enabled ? '🐛 Debug mode ENABLED' : '🔇 Debug mode DISABLED');
  }

  /**
   * Get current timer stats for debugging
   */
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

  /**
   * Destroy instance (for testing)
   */
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

// Export singleton instance
export const tokenManager = TokenManager.getInstance();

// Extend Window interface for debug mode
declare global {
  interface Window {
    tokenManager?: TokenManager;
  }
}

// Make available globally for debugging (ONLY in development)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  window.tokenManager = tokenManager;
  console.log('[TokenManager] Debug mode - available as window.tokenManager');
}
