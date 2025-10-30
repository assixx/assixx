/**
 * Session Manager - Handles user session timeout and activity tracking
 * Works in conjunction with TokenManager:
 * - SessionManager: Tracks user activity (mouse, keyboard, etc.)
 * - TokenManager: Handles JWT token lifecycle and expiry
 */

import { setHTML } from '../../utils/dom-utils';
import { parseJwt } from '../../utils/jwt-utils';
import { tokenManager } from '../../utils/token-manager';

export class SessionManager {
  private static instance: SessionManager | undefined;
  private lastActivityTime: number;
  private checkInterval: number | null = null;
  private readonly INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
  private readonly CHECK_INTERVAL = 10 * 1000; // Check every 15 seconds (improved accuracy, max 15s delay)
  private readonly WARNING_TIME = 5 * 60 * 1000; // Show warning 5 minutes before timeout (at 25 min inactivity)
  private warningShown = false;

  private constructor() {
    this.lastActivityTime = Date.now();
    console.log(
      '[SessionManager] 🚀 Initialized - lastActivityTime set to:',
      new Date(this.lastActivityTime).toISOString(),
    );
    this.setupActivityListeners();
    this.startInactivityCheck();
    this.setupTokenWarningListener();
  }

  static getInstance(): SessionManager {
    SessionManager.instance ??= new SessionManager();
    return SessionManager.instance;
  }

  private setupActivityListeners(): void {
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
    this.lastActivityTime = Date.now();
    this.warningShown = false;

    // DEBUG: Only log occasionally to avoid console spam
    if (Math.random() < 0.05) {
      // Log 5% of activity updates
      console.log('[SessionManager] 👆 User activity detected - timer reset, active:', isActiveInteraction);
    }

    // Store last activity in localStorage for cross-tab synchronization
    localStorage.setItem('lastActivity', this.lastActivityTime.toString());

    // If active interaction (click, keydown, etc.) and token < 10 min → refresh token
    if (isActiveInteraction && tokenManager.isExpiringSoon(600)) {
      console.info('[SessionManager] 🔄 Active interaction detected, token < 10 min → refreshing...');
      void tokenManager.refresh();
    }
  }

  /**
   * Setup listener for token expiring soon (< 5 min)
   * Shows warning modal based on TOKEN time, not inactivity time
   */
  private setupTokenWarningListener(): void {
    tokenManager.onTokenExpiringSoon(() => {
      // Only show modal once
      if (!this.warningShown) {
        console.warn('[SessionManager] 🚨 Token < 5 min - showing warning modal');
        this.showTimeoutWarning();
        this.warningShown = true;
      }
    });
  }

  private startInactivityCheck(): void {
    // Clear any existing interval
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = window.setInterval(() => {
      this.checkInactivity();
    }, this.CHECK_INTERVAL);
  }

  private checkInactivity(): void {
    // Check localStorage for activity from other tabs
    const storedLastActivity = localStorage.getItem('lastActivity');
    if (storedLastActivity !== null && storedLastActivity !== '') {
      const storedTime = Number.parseInt(storedLastActivity, 10);
      if (storedTime > this.lastActivityTime) {
        this.lastActivityTime = storedTime;
      }
    }

    const now = Date.now();
    const timeSinceActivity = now - this.lastActivityTime;
    const timeSinceActivityMinutes = Math.floor(timeSinceActivity / 60000);
    const warningThresholdMinutes = (this.INACTIVITY_TIMEOUT - this.WARNING_TIME) / 60000;

    // DEBUG: Log inactivity check
    console.log('[SessionManager] Inactivity check:', {
      timeSinceActivityMinutes,
      warningThresholdMinutes,
      warningShown: this.warningShown,
      shouldShowWarning: !this.warningShown && timeSinceActivity >= this.INACTIVITY_TIMEOUT - this.WARNING_TIME,
    });

    // Check if we should show warning
    if (!this.warningShown && timeSinceActivity >= this.INACTIVITY_TIMEOUT - this.WARNING_TIME) {
      console.warn('[SessionManager] 🚨 Triggering warning modal (25 min inactivity reached)');
      this.showTimeoutWarning();
      this.warningShown = true;
    }

    // Check if session should timeout
    if (timeSinceActivity >= this.INACTIVITY_TIMEOUT) {
      console.error('[SessionManager] ⏰ Session timeout - 30 min inactivity reached');
      this.handleSessionTimeout();
    }
  }

  /**
   * Show timeout warning modal with real-time countdown timer
   * Uses Design System confirm-modal component with dynamic timer integration
   */
  private showTimeoutWarning(): void {
    console.log('[SessionManager] 🔔 showTimeoutWarning() called - creating modal...');

    try {
      const warningModal = this.createWarningModal();
      console.log('[SessionManager] ✅ Modal created:', warningModal);

      document.body.append(warningModal);
      console.log('[SessionManager] ✅ Modal appended to body');

      this.attachWarningModalHandlers(warningModal);
      console.log('[SessionManager] ✅ Event handlers attached');

      this.startModalCountdown();
      console.log('[SessionManager] ✅ Countdown timer started');

      // Verify modal is in DOM
      const modalInDom = document.querySelector('#session-warning-modal');
      console.log('[SessionManager] ✅ Modal in DOM:', modalInDom !== null, modalInDom);
    } catch (error) {
      console.error('[SessionManager] ❌ ERROR creating warning modal:', error);
    }
  }

  /**
   * Create warning modal using Design System confirm-modal component
   */
  private createWarningModal(): HTMLDivElement {
    const warningModal = document.createElement('div');
    warningModal.id = 'session-warning-modal';
    setHTML(warningModal, this.getWarningModalHTML());
    return warningModal;
  }

  /**
   * Generate modal HTML using Design System confirm-modal--warning component
   * Includes real-time countdown timer element
   */
  private getWarningModalHTML(): string {
    return `
      <div class="modal-overlay modal-overlay--active">
        <div class="confirm-modal confirm-modal--warning">
          <div class="confirm-modal__icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <h3 class="confirm-modal__title">Sitzung läuft bald ab</h3>
          <p class="confirm-modal__message">
            Ihre Sitzung läuft in <strong id="session-timer-countdown" style="font-variant-numeric: tabular-nums;">--:--</strong> aufgrund von Inaktivität ab.<br>
            Klicken Sie auf "Aktiv bleiben" um angemeldet zu bleiben.
          </p>
          <div class="confirm-modal__actions">
            <button data-action="session-logout" class="confirm-modal__btn confirm-modal__btn--cancel">
              Abmelden
            </button>
            <button data-action="extend-session" class="confirm-modal__btn confirm-modal__btn--confirm">
              Aktiv bleiben
            </button>
          </div>
        </div>
      </div>
    `;
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
    console.log('[SessionManager] 🕒 Subscribing to TokenManager timer updates...');

    // Subscribe to TokenManager's timer updates (fired every second)
    tokenManager.onTimerUpdate((remainingSeconds: number) => {
      console.log('[SessionManager] ⏱️ Timer update received:', remainingSeconds);
      this.updateModalTimer(remainingSeconds);
    });

    // Initial update (don't wait for first tick)
    const initialRemaining = tokenManager.getRemainingTime();
    console.log('[SessionManager] 🕒 Initial token time:', initialRemaining, 'seconds');
    this.updateModalTimer(initialRemaining);
  }

  /**
   * Update modal countdown timer display
   * @param remainingSeconds - Seconds until token expiry
   */
  private updateModalTimer(remainingSeconds: number): void {
    const timerElement = document.querySelector('#session-timer-countdown');
    if (timerElement !== null) {
      const formattedTime = this.formatTime(remainingSeconds);
      timerElement.textContent = formattedTime;
      console.log('[SessionManager] 🕐 Modal timer updated:', formattedTime);
    } else {
      console.warn('[SessionManager] ⚠️ Timer element #session-timer-countdown NOT FOUND in DOM!');
    }
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
    console.info('Session timeout due to inactivity');

    // Clear the interval
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // Clear session and redirect with timeout parameter
    this.logout(true);
  }

  public async extendSession(): Promise<void> {
    console.info('[SessionManager] 🔄 User clicked "Aktiv bleiben" - extending session...');

    // Remove warning modal
    const modal = document.querySelector('#session-warning-modal');
    if (modal) {
      modal.remove();
      console.info('[SessionManager] ✅ Modal removed');
    }

    // Reset warning flag so modal can appear again if needed
    this.warningShown = false;

    // Reset activity timer (but don't trigger refresh - click event already did that!)
    this.lastActivityTime = Date.now();
    localStorage.setItem('lastActivity', this.lastActivityTime.toString());
    console.info('[SessionManager] ✅ Activity timer reset');

    // CRITICAL: Refresh token immediately to extend session
    // Note: If click event already triggered refresh (< 10 min), isRefreshing flag prevents duplicate
    console.info('[SessionManager] 🔄 Refreshing token explicitly...');
    const refreshed = await tokenManager.refresh();

    if (refreshed) {
      const newRemainingTime = tokenManager.getRemainingTime();
      console.info('[SessionManager] ✅ Token refreshed successfully! New time:', newRemainingTime, 'seconds');
      console.info('[SessionManager] 🎉 Session extended - timer reset to 30:00');
    } else {
      console.error('[SessionManager] ❌ Token refresh failed - session could not be extended');
    }
  }

  public logout(isTimeout: boolean = false): void {
    // Clear session data via TokenManager (handles tokens + redirect)
    const reason: 'inactivity_timeout' | 'logout' = isTimeout ? 'inactivity_timeout' : 'logout';
    tokenManager.clearTokens(reason);

    // Clear additional session-specific data
    localStorage.removeItem('userRole');
    localStorage.removeItem('activeRole');
    localStorage.removeItem('lastActivity');
    localStorage.removeItem('browserFingerprint');
    localStorage.removeItem('fingerprintTimestamp');
    localStorage.removeItem('sidebarCollapsed'); // Reset sidebar state on logout

    // Stop inactivity checking
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // TokenManager already handles redirect to login with appropriate parameters
  }

  /**
   * Extract and update roles from JWT token
   */
  private extractRoles(): { activeRole: string | null; userRole: string | null } {
    const token = localStorage.getItem('token');
    let activeRole: string | null = null;
    let userRole = localStorage.getItem('userRole');

    if (token !== null && token !== '') {
      const payload = parseJwt(token);
      if (payload !== null) {
        activeRole = payload.activeRole ?? payload.role;
        userRole = payload.role;

        if (activeRole !== '') {
          localStorage.setItem('activeRole', activeRole);
        }
        localStorage.setItem('userRole', userRole);
      } else {
        activeRole = localStorage.getItem('activeRole') ?? userRole;
      }
    } else {
      activeRole = localStorage.getItem('activeRole') ?? userRole;
    }

    return { activeRole, userRole };
  }

  /**
   * Validates root dashboard access
   */
  private validateRootAccess(userRole: string | null, activeRole: string | null): boolean {
    if (userRole === 'root' && activeRole === 'root') {
      console.info('[Root Dashboard] User has root access');
      return true;
    }
    if (userRole === 'root' && activeRole !== 'root') {
      console.info('[Root Dashboard] Root user has switched to', activeRole, '- redirecting');
      this.redirectToDashboard(activeRole);
    } else {
      console.info('[Root Dashboard] Non-root user detected - redirecting to login');
      window.location.replace('/login');
    }
    return false;
  }

  /**
   * Validates admin dashboard access
   */
  private validateAdminAccess(activeRole: string | null): boolean {
    if (activeRole === 'admin') {
      console.info('[Admin Dashboard] User has admin access');
      return true;
    }
    if (activeRole === 'root') {
      console.info('[Admin Dashboard] Root user detected - redirecting to root dashboard');
      window.location.replace('/root-dashboard');
    } else if (activeRole === 'employee') {
      console.info('[Admin Dashboard] Employee user detected - redirecting to employee dashboard');
      window.location.replace('/employee-dashboard');
    } else {
      console.info('[Admin Dashboard] No valid role - redirecting to login');
      window.location.replace('/login');
    }
    return false;
  }

  /**
   * Validates dashboard access based on required role
   */
  public validateDashboardAccess(requiredDashboard: 'root' | 'admin' | 'employee'): boolean {
    const { activeRole, userRole } = this.extractRoles();

    switch (requiredDashboard) {
      case 'root':
        return this.validateRootAccess(userRole, activeRole);
      case 'admin':
        return this.validateAdminAccess(activeRole);
      case 'employee':
        if (activeRole === 'employee' || activeRole === 'admin' || activeRole === 'root') {
          console.info('[Employee Dashboard] User has access');
          return true;
        }
        console.info('[Employee Dashboard] Invalid role - redirecting to login');
        window.location.replace('/login');
        return false;
      default:
        window.location.replace('/login');
        return false;
    }
  }

  private redirectToDashboard(role: string | null): void {
    if (role === null || role === '') {
      window.location.replace('/login');
      return;
    }

    switch (role) {
      case 'root':
        window.location.replace('/root-dashboard');
        break;
      case 'admin':
        window.location.replace('/admin-dashboard');
        break;
      case 'employee':
        window.location.replace('/employee-dashboard');
        break;
      default:
        window.location.replace('/login');
        break;
    }
  }

  public destroy(): void {
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}
