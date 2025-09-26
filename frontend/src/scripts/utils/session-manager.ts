/**
 * Session Manager - Handles user session timeout and activity tracking
 */

import { setHTML } from '../../utils/dom-utils';
import { parseJwt } from '../../utils/jwt-utils';

export class SessionManager {
  private static instance: SessionManager | undefined;
  private lastActivityTime: number;
  private checkInterval: number | null = null;
  private readonly INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
  private readonly CHECK_INTERVAL = 60 * 1000; // Check every minute
  private readonly WARNING_TIME = 5 * 60 * 1000; // Show warning 5 minutes before timeout
  private warningShown = false;
  private removeAuthTokenCallback?: () => void;

  private constructor() {
    this.lastActivityTime = Date.now();
    this.setupActivityListeners();
    this.startInactivityCheck();
  }

  static getInstance(): SessionManager {
    SessionManager.instance ??= new SessionManager();
    return SessionManager.instance;
  }

  public setRemoveAuthTokenCallback(removeTokenFn: () => void): void {
    this.removeAuthTokenCallback = removeTokenFn;
  }

  private setupActivityListeners(): void {
    // Track user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    events.forEach((event) => {
      document.addEventListener(
        event,
        () => {
          this.updateActivity();
        },
        { passive: true },
      );
    });

    // Also track API calls as activity
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      this.updateActivity();
      return await originalFetch.apply(window, args);
    };
  }

  private updateActivity(): void {
    this.lastActivityTime = Date.now();
    this.warningShown = false;

    // Store last activity in localStorage for cross-tab synchronization
    localStorage.setItem('lastActivity', this.lastActivityTime.toString());
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

    // Check if we should show warning
    if (!this.warningShown && timeSinceActivity >= this.INACTIVITY_TIMEOUT - this.WARNING_TIME) {
      this.showTimeoutWarning();
      this.warningShown = true;
    }

    // Check if session should timeout
    if (timeSinceActivity >= this.INACTIVITY_TIMEOUT) {
      this.handleSessionTimeout();
    }
  }

  private showTimeoutWarning(): void {
    const warningModal = this.createWarningModal();
    document.body.append(warningModal);
    this.attachWarningModalHandlers(warningModal);
  }

  private createWarningModal(): HTMLDivElement {
    const warningModal = document.createElement('div');
    warningModal.id = 'session-warning-modal';
    setHTML(warningModal, this.getWarningModalHTML());
    return warningModal;
  }

  private getWarningModalHTML(): string {
    return `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 999999;
      ">
        <div style="
          background: #1a1a1a;
          border: 1px solid #ff9800;
          border-radius: 8px;
          padding: 24px;
          max-width: 400px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        ">
          <h3 style="color: #ff9800; margin-top: 0;">⚠️ Sitzung läuft bald ab</h3>
          <p style="color: #ccc;">
            Ihre Sitzung läuft in 5 Minuten aufgrund von Inaktivität ab.
            Klicken Sie auf "Aktiv bleiben" um angemeldet zu bleiben.
          </p>
          <div style="display: flex; gap: 12px; margin-top: 20px;">
            <button data-action="extend-session" style="
              background: #2196f3;
              color: #fff;
              border: none;
              padding: 10px 20px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 16px;
            ">Aktiv bleiben</button>
            <button data-action="session-logout" style="
              background: #666;
              color: #fff;
              border: none;
              padding: 10px 20px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 16px;
            ">Abmelden</button>
          </div>
        </div>
      </div>
    `;
  }

  private attachWarningModalHandlers(warningModal: HTMLDivElement): void {
    warningModal.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      if (target.dataset.action === 'extend-session') {
        this.extendSession();
      }

      if (target.dataset.action === 'session-logout') {
        this.logout();
      }
    });
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

  public extendSession(): void {
    // Remove warning modal
    const modal = document.querySelector('#session-warning-modal');
    if (modal) {
      modal.remove();
    }

    // Reset activity
    this.updateActivity();
    console.info('Session extended');
  }

  public logout(isTimeout = false): void {
    // Clear session data
    if (this.removeAuthTokenCallback) {
      this.removeAuthTokenCallback();
    } else {
      // Fallback: directly clear the token if callback not set
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
    }
    localStorage.removeItem('userRole');
    localStorage.removeItem('activeRole');
    localStorage.removeItem('lastActivity');
    localStorage.removeItem('browserFingerprint');
    localStorage.removeItem('fingerprintTimestamp');
    localStorage.removeItem('sidebarCollapsed'); // Reset sidebar state on logout

    // Stop checking
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // Redirect to login with timeout parameter if applicable
    if (isTimeout) {
      window.location.href = '/login?timeout=true';
    } else {
      window.location.href = '/login';
    }
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

// Export for use in other modules
export default SessionManager;
