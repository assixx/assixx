/* eslint-disable max-lines */
/**
 * Session Manager - Handles user session timeout and activity tracking
 * 1:1 Copy from frontend/src/scripts/utils/session-manager.ts
 *
 * Works in conjunction with TokenManager:
 * - SessionManager: Tracks user activity (mouse, keyboard, etc.)
 * - TokenManager: Handles JWT token lifecycle and expiry
 */

import { createLogger } from './logger';
import { getTokenManager } from './token-manager';

const log = createLogger('SessionManager');

/**
 * Check if we're in browser
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export class SessionManager {
  private static instance: SessionManager | undefined;
  private lastActivityTime: number;
  private checkTimer: number | null = null;
  private idleCallbackId: number | null = null;
  private readonly INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
  private readonly WARNING_TIME = 5 * 60 * 1000; // Show warning 5 minutes before timeout (at 25 min inactivity)
  private readonly DEBUG_MODE: boolean;
  private warningShown = false;
  private isPageVisible = true;

  // Progressive check intervals (battery optimized)
  private readonly CHECK_INTERVALS = {
    ACTIVE: 2 * 60 * 1000, // 2 min when user recently active
    APPROACHING: 30 * 1000, // 30s when approaching warning
    CRITICAL: 5 * 1000, // 5s when in warning zone
  };

  private constructor() {
    this.lastActivityTime = Date.now();
    // CRITICAL: Use import.meta.env.DEV (build-time) NOT hostname (runtime)
    this.DEBUG_MODE = import.meta.env.DEV && isBrowser();

    if (this.DEBUG_MODE) {
      log.debug({ lastActivityTime: new Date(this.lastActivityTime).toISOString() }, 'Initialized');
    }

    this.setupActivityListeners();
    this.setupPageVisibilityListener();
    this.scheduleNextCheck();
    this.setupTokenWarningListener();
  }

  static getInstance(): SessionManager {
    // Return dummy instance for SSR
    if (!isBrowser()) {
      return new SessionManager();
    }

    SessionManager.instance ??= new SessionManager();
    return SessionManager.instance;
  }

  /**
   * Setup Page Visibility API listener for battery optimization
   * Pauses checks when tab is hidden, resumes when visible
   */
  private setupPageVisibilityListener(): void {
    if (!isBrowser()) return;

    document.addEventListener('visibilitychange', () => {
      const wasVisible = this.isPageVisible;
      this.isPageVisible = !document.hidden;

      if (!wasVisible && this.isPageVisible) {
        // Page became visible - resume checking
        this.scheduleNextCheck();
      } else if (wasVisible && !this.isPageVisible) {
        // Page became hidden - pause checking
        this.cancelScheduledCheck();
      }
    });
  }

  private setupActivityListeners(): void {
    if (!isBrowser()) return;

    // Track MANUAL user activity only (mouse, keyboard, touch)
    // NOTE: API calls are NOT tracked to prevent "heartbeat keeps session alive" bug
    // - Background polling (e.g., /chat/unread-count every 10 min) should NOT reset inactivity timer
    // - Only genuine user interactions (clicks, typing, scrolling) count as activity

    // PASSIVE events (only reset inactivity timer, NO token refresh)
    const passiveEvents = ['scroll'];
    passiveEvents.forEach((event) => {
      document.addEventListener(
        event,
        () => {
          this.updateActivity(false);
        },
        { passive: true },
      );
    });

    // ACTIVE events (reset inactivity timer AND refresh token if < 10 min)
    const activeEvents = ['mousedown', 'keydown', 'touchstart', 'click'];
    activeEvents.forEach((event) => {
      document.addEventListener(
        event,
        () => {
          this.updateActivity(true);
        },
        { passive: true },
      );
    });

    // REMOVED: window.fetch patching (was causing "heartbeat keeps session alive" bug)
    // Background API calls should NOT count as user activity
  }

  private updateActivity(isActiveInteraction: boolean = false): void {
    if (!isBrowser()) return;

    const now = Date.now();

    // Throttle updates (max 1 per second for passive events)
    if (now - this.lastActivityTime < 1000 && !isActiveInteraction) {
      return;
    }

    this.lastActivityTime = now;

    // CRITICAL: Do NOT reset warningShown if modal is currently displayed!
    // The modal should only be dismissed by:
    // 1. User clicking "Aktiv bleiben" (calls extendSession())
    // 2. User clicking "Abmelden" (calls logout())
    // 3. Timer expiring (handled by handleSessionTimeout())
    // Note: warningShown is reset in extendSession() and handleCrossTabActivity()

    this.scheduleActivityPersistence();
    this.handleTokenRefreshOnActivity(isActiveInteraction);
  }

  /**
   * Schedule activity persistence to localStorage using requestIdleCallback
   * Battery-optimized: defers non-critical localStorage writes
   */
  private scheduleActivityPersistence(): void {
    if ('requestIdleCallback' in window) {
      if (this.idleCallbackId !== null) {
        cancelIdleCallback(this.idleCallbackId);
      }

      this.idleCallbackId = requestIdleCallback(
        () => {
          localStorage.setItem('lastActivity', this.lastActivityTime.toString());
          this.scheduleNextCheck();
        },
        { timeout: 2000 },
      );
      return;
    }

    // Fallback for older browsers
    localStorage.setItem('lastActivity', this.lastActivityTime.toString());
    this.scheduleNextCheck();
  }

  /**
   * Handle token refresh on active user interaction
   * Only refreshes if token is expiring soon (< 10 min) and warning modal not shown
   */
  private handleTokenRefreshOnActivity(isActiveInteraction: boolean): void {
    if (!isActiveInteraction) {
      return;
    }

    if (this.warningShown) {
      if (this.DEBUG_MODE) {
        log.debug('Auto-refresh blocked - warning modal active. User must click "Aktiv bleiben"');
      }
      return;
    }

    this.refreshTokenIfExpiringSoon();
  }

  /**
   * Refresh token if expiring within 10 minutes
   */
  private refreshTokenIfExpiringSoon(): void {
    const tokenManager = getTokenManager();
    const remaining = tokenManager.getRemainingTime();
    const TOKEN_REFRESH_THRESHOLD = 600; // 10 minutes in seconds

    if (remaining <= 0 || remaining >= TOKEN_REFRESH_THRESHOLD) {
      return;
    }

    if (this.DEBUG_MODE) {
      log.debug({ remaining }, 'Active interaction + token < 10min → refreshing');
    }
    void tokenManager.refresh();
  }

  /**
   * Setup listener for token expiring soon (< 5 min)
   * Shows warning modal based on TOKEN time, not inactivity time
   */
  private setupTokenWarningListener(): void {
    if (!isBrowser()) return;

    const tokenManager = getTokenManager();
    tokenManager.onTokenExpiringSoon(() => {
      // Only show modal once
      if (!this.warningShown) {
        if (this.DEBUG_MODE) {
          log.warn('Token < 5 min - showing warning modal');
        }
        this.showTimeoutWarning();
        this.warningShown = true;
      }
    });
  }

  /**
   * Progressive check scheduling - longer intervals when safe, shorter when urgent
   * Battery optimized: no polling when page hidden
   */
  private scheduleNextCheck(): void {
    if (!isBrowser()) return;

    // Cancel existing check
    this.cancelScheduledCheck();

    // Don't schedule if page hidden (battery save)
    if (!this.isPageVisible) {
      return;
    }

    const timeSinceActivity = Date.now() - this.lastActivityTime;
    const timeUntilWarning = this.INACTIVITY_TIMEOUT - this.WARNING_TIME - timeSinceActivity;
    const timeUntilTimeout = this.INACTIVITY_TIMEOUT - timeSinceActivity;

    // Determine next check interval
    let nextInterval: number;

    if (timeUntilTimeout <= 0) {
      // Already timed out
      this.handleSessionTimeout();
      return;
    } else if (timeUntilWarning <= 0) {
      // In warning zone - check frequently
      nextInterval = this.CHECK_INTERVALS.CRITICAL;

      if (!this.warningShown) {
        this.showTimeoutWarning();
        this.warningShown = true;
      }
    } else if (timeUntilWarning < 2 * 60 * 1000) {
      // Approaching warning (< 2 min) - moderate frequency
      nextInterval = this.CHECK_INTERVALS.APPROACHING;
    } else {
      // Safe zone - check infrequently
      nextInterval = this.CHECK_INTERVALS.ACTIVE;
    }

    // Schedule check at the exact moment needed (don't overshoot warning/timeout)
    nextInterval = Math.min(
      nextInterval,
      timeUntilWarning > 0 ? timeUntilWarning : timeUntilTimeout,
    );

    this.checkTimer = window.setTimeout(() => {
      this.performInactivityCheck();
    }, nextInterval);
  }

  /**
   * Cancel any scheduled check (for cleanup or page hide)
   */
  private cancelScheduledCheck(): void {
    if (this.checkTimer !== null) {
      clearTimeout(this.checkTimer);
      this.checkTimer = null;
    }

    if (this.idleCallbackId !== null && isBrowser()) {
      cancelIdleCallback(this.idleCallbackId);
      this.idleCallbackId = null;
    }
  }

  /**
   * Efficient inactivity check - minimal operations, no console logs in production
   */
  private performInactivityCheck(): void {
    if (!isBrowser()) return;

    // Sync with other tabs (minimal localStorage access)
    this.syncActivityAcrossTabs();

    const timeSinceActivity = Date.now() - this.lastActivityTime;

    // Log debug info if needed
    this.logInactivityDebug(timeSinceActivity);

    // Check for timeout or warning conditions
    if (this.checkForTimeout(timeSinceActivity)) {
      return; // Session timed out, no need to schedule next check
    }

    if (this.checkForWarning(timeSinceActivity)) {
      this.scheduleNextCheck(); // Continue checking in warning zone
      return;
    }

    // Normal zone - schedule next check
    this.scheduleNextCheck();
  }

  /**
   * Log inactivity debug info when approaching critical thresholds
   */
  private logInactivityDebug(timeSinceActivity: number): void {
    if (!this.DEBUG_MODE) {
      return;
    }

    const warningThreshold = this.INACTIVITY_TIMEOUT - this.WARNING_TIME - 60000;
    if (timeSinceActivity >= warningThreshold) {
      const timeSinceActivityMinutes = Math.floor(timeSinceActivity / 60000);
      log.warn({ inactivityMinutes: timeSinceActivityMinutes }, 'Approaching inactivity threshold');
    }
  }

  /**
   * Check if session has timed out
   * @returns true if timed out, false otherwise
   */
  private checkForTimeout(timeSinceActivity: number): boolean {
    if (timeSinceActivity >= this.INACTIVITY_TIMEOUT) {
      if (this.DEBUG_MODE) {
        log.error('Session timeout - 30 min inactivity reached');
      }
      this.handleSessionTimeout();
      return true;
    }
    return false;
  }

  /**
   * Check if warning should be shown
   * @returns true if in warning zone, false otherwise
   */
  private checkForWarning(timeSinceActivity: number): boolean {
    if (timeSinceActivity >= this.INACTIVITY_TIMEOUT - this.WARNING_TIME) {
      if (!this.warningShown) {
        if (this.DEBUG_MODE) {
          log.warn('Triggering warning modal (25 min inactivity)');
        }
        this.showTimeoutWarning();
        this.warningShown = true;
      }
      return true;
    }
    return false;
  }

  /**
   * Optimized cross-tab synchronization
   */
  private syncActivityAcrossTabs(): void {
    if (!isBrowser()) return;

    try {
      const storedTime = this.getStoredActivityTime();
      if (storedTime !== null && storedTime > this.lastActivityTime) {
        this.handleCrossTabActivity(storedTime);
      }
    } catch {
      // Ignore localStorage errors (quota, permissions)
    }
  }

  /**
   * Get stored activity time from localStorage
   * @returns stored time or null if not available
   */
  private getStoredActivityTime(): number | null {
    if (!isBrowser()) return null;

    const stored = localStorage.getItem('lastActivity');
    if (stored === null || stored.length === 0) {
      return null;
    }
    return Number.parseInt(stored, 10);
  }

  /**
   * Handle activity from another tab
   */
  private handleCrossTabActivity(storedTime: number): void {
    this.lastActivityTime = storedTime;

    // Hide warning if it was shown
    if (this.warningShown) {
      this.warningShown = false;
      this.removeWarningModal();
    }
  }

  /**
   * Remove warning modal from DOM
   */
  private removeWarningModal(): void {
    if (!isBrowser()) return;

    const modal = document.querySelector('#session-warning-modal');
    if (modal) {
      modal.remove();
    }
  }

  /**
   * Show timeout warning modal with real-time countdown timer
   * Uses Design System confirm-modal component with dynamic timer integration
   */
  private showTimeoutWarning(): void {
    if (!isBrowser()) return;

    if (this.DEBUG_MODE) {
      log.debug('Creating warning modal...');
    }

    try {
      // Remove existing modal if any
      this.removeWarningModal();

      const warningModal = this.createWarningModal();
      document.body.append(warningModal);
      this.attachWarningModalHandlers(warningModal);
      this.startModalCountdown();
    } catch (error) {
      log.error({ err: error }, 'ERROR creating warning modal');
    }
  }

  /**
   * Create warning modal using Design System confirm-modal component
   * Uses DOM APIs instead of innerHTML for security (no XSS risk)
   */
  private createWarningModal(): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.id = 'session-warning-modal';

    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay modal-overlay--active';

    // Modal container
    const modal = document.createElement('div');
    modal.className = 'confirm-modal confirm-modal--warning';

    // Icon
    const iconDiv = document.createElement('div');
    iconDiv.className = 'confirm-modal__icon';
    const icon = document.createElement('i');
    icon.className = 'fas fa-exclamation-triangle';
    iconDiv.append(icon);

    // Title
    const title = document.createElement('h3');
    title.className = 'confirm-modal__title';
    title.textContent = 'Sitzung läuft bald ab';

    // Message
    const message = document.createElement('p');
    message.className = 'confirm-modal__message';
    message.append('Ihre Sitzung läuft in ');
    const countdown = document.createElement('strong');
    countdown.id = 'session-timer-countdown';
    countdown.style.fontVariantNumeric = 'tabular-nums';
    countdown.textContent = '--:--';
    message.append(countdown);
    message.append(' aufgrund von Inaktivität ab.');
    message.append(document.createElement('br'));
    message.append('Klicken Sie auf "Aktiv bleiben" um angemeldet zu bleiben.');

    // Actions
    const actions = document.createElement('div');
    actions.className = 'confirm-modal__actions';

    const logoutBtn = document.createElement('button');
    logoutBtn.dataset.action = 'session-logout';
    logoutBtn.className = 'confirm-modal__btn confirm-modal__btn--cancel';
    logoutBtn.textContent = 'Abmelden';

    const extendBtn = document.createElement('button');
    extendBtn.dataset.action = 'extend-session';
    extendBtn.className = 'confirm-modal__btn confirm-modal__btn--confirm';
    extendBtn.textContent = 'Aktiv bleiben';

    actions.append(logoutBtn, extendBtn);
    modal.append(iconDiv, title, message, actions);
    overlay.append(modal);
    wrapper.append(overlay);

    return wrapper;
  }

  /**
   * Attach event handlers to modal buttons
   */
  private attachWarningModalHandlers(warningModal: HTMLDivElement): void {
    warningModal.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (target.dataset.action === 'extend-session') {
        void this.extendSession(); // Async call - don't block UI
      }

      if (target.dataset.action === 'session-logout') {
        this.logout();
      }
    });
  }

  /**
   * Start real-time countdown timer in modal
   * Subscribes to TokenManager's timer updates to show accurate remaining time
   */
  private startModalCountdown(): void {
    if (!isBrowser()) return;

    if (this.DEBUG_MODE) {
      log.debug('Starting modal countdown...');
    }

    const tokenManager = getTokenManager();

    // Initial update (don't wait for first tick)
    const initialRemaining = tokenManager.getRemainingTime();
    this.updateModalTimer(initialRemaining);

    // Create DEDICATED 1-second timer for modal (not affected by progressive intervals)
    // This ensures smooth countdown in the warning modal regardless of main timer mode
    const modalInterval = window.setInterval(() => {
      const remainingSeconds = tokenManager.getRemainingTime();
      this.updateModalTimer(remainingSeconds);

      // Stop timer if token expired or modal was closed
      if (remainingSeconds === 0 || document.querySelector('#session-warning-modal') === null) {
        clearInterval(modalInterval);
      }
    }, 1000); // ALWAYS 1 second for modal, regardless of progressive timer mode!
  }

  /**
   * Update modal countdown timer display
   * @param remainingSeconds - Seconds until token expiry
   */
  private updateModalTimer(remainingSeconds: number): void {
    if (!isBrowser()) return;

    const timerElement = document.querySelector('#session-timer-countdown');
    if (timerElement !== null) {
      const formattedTime = this.formatTime(remainingSeconds);
      timerElement.textContent = formattedTime;
    }
    // Silent fail if element not found - modal might be closing
  }

  /**
   * Format seconds as MM:SS
   * @param seconds - Remaining seconds
   * @returns Formatted time string (e.g., "04:32")
   */
  private formatTime(seconds: number): string {
    if (seconds <= 0) {
      return '00:00';
    }

    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  private handleSessionTimeout(): void {
    // Clear the timer
    this.cancelScheduledCheck();

    // Clear session and redirect with timeout parameter
    this.logout(true);
  }

  public async extendSession(): Promise<void> {
    const tokenManager = getTokenManager();

    // CRITICAL: FIRST attempt token refresh BEFORE any UI changes!
    // If this fails, we need to keep the modal visible or logout immediately
    const refreshed = await tokenManager.refresh();

    // Check if refresh was successful
    if (!refreshed) {
      // TOKEN REFRESH FAILED - This is CRITICAL!
      log.error('CRITICAL: Token refresh failed! Cannot extend session.');

      // Update modal to show error (if it still exists)
      const modalMessage = document.querySelector('#session-warning-modal .confirm-modal__message');
      if (modalMessage !== null) {
        // Clear existing content and build error message with DOM APIs
        modalMessage.textContent = '';
        const errorSpan = document.createElement('span');
        errorSpan.style.color = '#f44336';
        const errorIcon = document.createElement('i');
        errorIcon.className = 'fas fa-exclamation-triangle';
        errorSpan.append(errorIcon);
        errorSpan.append(' Session konnte nicht verlängert werden!');
        errorSpan.append(document.createElement('br'));
        errorSpan.append('Sie werden in Kürze ausgeloggt.');
        modalMessage.append(errorSpan);
      }

      // Wait 2 seconds to show error, then logout
      setTimeout(() => {
        log.warn('Logging out due to failed token refresh...');
        this.logout(false);
      }, 2000);

      return; // STOP HERE - Do not proceed with UI updates!
    }

    // SUCCESS: Token was refreshed successfully
    // NOW we can safely update UI since we have a valid new token
    // Remove warning modal
    this.removeWarningModal();

    // Reset warning flag so modal can appear again if needed
    this.warningShown = false;

    // Reset activity timer
    this.lastActivityTime = Date.now();
    if (isBrowser()) {
      localStorage.setItem('lastActivity', this.lastActivityTime.toString());
    }

    // Re-schedule next check with new timing
    this.scheduleNextCheck();
  }

  public logout(isTimeout: boolean = false): void {
    if (!isBrowser()) return;

    // Stop inactivity checking FIRST (prevent race conditions)
    this.cancelScheduledCheck();

    // ===========================================
    // Clear ALL session-related localStorage
    // ===========================================
    // AUTH TOKENS
    localStorage.removeItem('accessToken');
    // NOTE: refreshToken is in HttpOnly cookie, cleared by backend on /auth/logout
    localStorage.removeItem('tokenReceivedAt');
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');

    // USER DATA
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    localStorage.removeItem('userRole');
    localStorage.removeItem('activeRole');
    localStorage.removeItem('tenantId');

    // SESSION DATA
    localStorage.removeItem('lastActivity');
    localStorage.removeItem('browserFingerprint');
    localStorage.removeItem('fingerprintTimestamp');

    // UI STATE
    localStorage.removeItem('sidebarCollapsed');
    localStorage.removeItem('openSubmenu');
    localStorage.removeItem('activeNavigation');
    localStorage.removeItem('profilePictureCache');

    // FEATURE STATE
    localStorage.removeItem('lastKvpClickTimestamp');
    localStorage.removeItem('lastKnownKvpCount');
    localStorage.removeItem('shifts_context');
    localStorage.removeItem('rateLimitTimestamp');

    // COOKIE
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax';

    // ===========================================
    // TokenManager handles redirect to login
    // ===========================================
    const tokenManager = getTokenManager();
    const reason: 'inactivity_timeout' | 'logout' = isTimeout ? 'inactivity_timeout' : 'logout';
    tokenManager.clearTokens(reason);
  }

  public destroy(): void {
    // Cancel any scheduled checks and idle callbacks
    this.cancelScheduledCheck();
  }
}

// Export singleton getter function (SSR-safe)
export function getSessionManager(): SessionManager {
  return SessionManager.getInstance();
}

// Type declaration for browser debugging
declare global {
  interface Window {
    sessionManager?: SessionManager;
  }
}

// For browser debugging (development only)
// CRITICAL: Use import.meta.env.DEV (build-time check) NOT hostname (runtime check)
// hostname check would expose sessionManager in production on localhost (Docker/Nginx)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.sessionManager = SessionManager.getInstance();
}
