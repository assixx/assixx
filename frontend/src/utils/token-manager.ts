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
  private timerInterval: number | null = null;
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

    // Persist to localStorage
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);

    // Notify all subscribers
    this.callbacks.onTokenRefreshed.forEach((callback) => {
      callback(access);
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

    // Clear localStorage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
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
  public async refresh(): Promise<boolean> {
    // Prevent concurrent refresh attempts
    if (this.isRefreshing) {
      console.info('[TokenManager] Refresh already in progress, skipping');
      return false;
    }

    // Check if refresh token exists
    if (this.refreshToken === null || this.refreshToken === '') {
      console.error('[TokenManager] No refresh token available');
      this.clearTokens('refresh_failed');
      return false;
    }

    this.isRefreshing = true;

    try {
      console.info('[TokenManager] Refreshing access token...');

      const response = await fetch(`${window.location.origin}/api/v2/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: this.refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed with status ${response.status}`);
      }

      const data = (await response.json()) as {
        success?: boolean;
        data?: { accessToken: string; refreshToken: string };
      };

      if (data.success === true && data.data !== undefined) {
        // Success: Update tokens
        this.setTokens(data.data.accessToken, data.data.refreshToken);
        console.info('[TokenManager] Token refreshed successfully');
        return true;
      }

      // Response format invalid
      throw new Error('Invalid refresh response format');
    } catch (error) {
      console.error('[TokenManager] Token refresh failed:', error);
      // Refresh failed = logout
      this.clearTokens('refresh_failed');
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
   * @returns Remaining seconds, or 0 if token is expired/invalid
   */
  public getRemainingTime(): number {
    if (this.accessToken === null) {
      return 0;
    }

    const payload = parseJwt(this.accessToken);
    if (payload?.exp === undefined) {
      return 0;
    }

    const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
    const remaining = payload.exp - now;

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
   * Start timer that updates every second
   */
  private startTimer(): void {
    // Don't start timer if no token
    if (this.accessToken === null) {
      return;
    }

    this.timerInterval = window.setInterval(() => {
      this.tick();
    }, 1000);
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
  }

  /**
   * Timer tick (called every second)
   */
  private tick(): void {
    const remaining = this.getRemainingTime();

    // Emit timer update to all subscribers
    this.callbacks.onTimerUpdate.forEach((callback) => {
      callback(remaining);
    });

    // Check for expiration FIRST (before emitting other events)
    if (remaining === 0) {
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
