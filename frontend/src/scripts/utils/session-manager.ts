/**
 * Session Manager - Handles user session timeout and activity tracking
 */

import { removeAuthToken } from '../auth';

export class SessionManager {
  private static instance: SessionManager | undefined;
  private lastActivityTime: number;
  private checkInterval: number | null = null;
  private readonly INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
  private readonly CHECK_INTERVAL = 60 * 1000; // Check every minute
  private readonly WARNING_TIME = 5 * 60 * 1000; // Show warning 5 minutes before timeout
  private warningShown = false;

  private constructor() {
    this.lastActivityTime = Date.now();
    this.setupActivityListeners();
    this.startInactivityCheck();
  }

  static getInstance(): SessionManager {
    SessionManager.instance ??= new SessionManager();
    return SessionManager.instance;
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
      return originalFetch.apply(window, args);
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
    // Create warning modal
    const warningModal = document.createElement('div');
    warningModal.id = 'session-warning-modal';
    warningModal.innerHTML = `
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
            <button onclick="window.sessionManager.extendSession()" style="
              background: #2196f3;
              color: #fff;
              border: none;
              padding: 10px 20px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 16px;
            ">Aktiv bleiben</button>
            <button onclick="window.sessionManager.logout()" style="
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
    document.body.append(warningModal);
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
    removeAuthToken();
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

  public destroy(): void {
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

// Initialize session manager when module loads
if (typeof window !== 'undefined') {
  interface SessionWindow extends Window {
    sessionManager: SessionManager;
  }
  (window as unknown as SessionWindow).sessionManager = SessionManager.getInstance();
}

// Export for use in other modules
export default SessionManager;
