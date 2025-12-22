/**
 * Login Form Controller
 * Handles login form interactions, validation, and error display
 */

import { submitLogin, type LoginData } from './login-api.js';
import { createElement } from '../../utils/dom-utils.js';

/**
 * Login Form Controller Class
 */
export class LoginFormController {
  private form: HTMLFormElement | null = null;
  private usernameInput: HTMLInputElement | null = null;
  private passwordInput: HTMLInputElement | null = null;

  /**
   * Initialize the login form controller
   */
  public init(): void {
    this.form = document.querySelector<HTMLFormElement>('#loginForm');
    this.usernameInput = document.querySelector<HTMLInputElement>('#username');
    this.passwordInput = document.querySelector<HTMLInputElement>('#password');

    if (this.form === null) {
      console.error('[LoginForm] Form not found');
      return;
    }

    this.setupEventListeners();
    this.checkForMessages();
    console.info('[LoginForm] Initialized');
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (this.form === null) return;

    // Form submit
    this.form.addEventListener('submit', (e) => {
      void this.handleSubmit(e);
    });

    // Click delegation for actions
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const actionElement = target.closest<HTMLElement>('[data-action]');
      if (actionElement !== null) {
        this.handleAction(actionElement, e);
      }
    });
  }

  /**
   * Check for URL parameters and show messages
   */
  private checkForMessages(): void {
    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.get('timeout') === 'true' || urlParams.get('session') === 'expired') {
      this.showError('Ihre Sitzung ist aus Sicherheitsgründen abgelaufen. Bitte melden Sie sich erneut an.');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('ratelimit') === 'expired') {
      this.showInfo('Die Wartezeit ist abgelaufen. Sie können sich jetzt wieder anmelden.', true);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  /**
   * Handle form submission
   */
  private async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();

    if (this.usernameInput === null || this.passwordInput === null) {
      this.showError('Formular nicht gefunden');
      return;
    }

    const username = this.usernameInput.value.trim();
    const password = this.passwordInput.value;

    if (username === '' || password === '') {
      this.showError('Bitte füllen Sie alle Felder aus');
      return;
    }

    const loginData: LoginData = {
      email: username,
      password,
    };

    const result = await submitLogin(loginData);

    if (!result.success) {
      this.showError(result.error ?? 'Login fehlgeschlagen');
    }
    // On success, redirect happens in login-api.ts
  }

  /**
   * Handle click actions via data-action attributes
   */
  private handleAction(element: HTMLElement, e: Event): void {
    const action = element.dataset['action'];
    if (action === undefined || action === '') return;

    e.preventDefault();

    switch (action) {
      case 'show-help':
        alert(
          'Hilfe:\n\nBitte kontaktieren Sie Ihren Administrator für Unterstützung.\n\nE-Mail: admin@assixx.de\nTelefon: +49 123 456789',
        );
        break;

      case 'reload-page':
        window.location.reload();
        break;

      case 'show-password-reset':
        alert('Passwort zurücksetzen:\n\nBitte wenden Sie sich an Ihren Administrator um Ihr Passwort zurückzusetzen.');
        break;

      case 'request-access':
        alert(
          'Zugangsdaten beantragen:\n\nBitte kontaktieren Sie Ihren Administrator um Zugangsdaten zu erhalten.\n\nE-Mail: admin@assixx.de',
        );
        break;
    }
  }

  /**
   * Show error message
   * Uses Design System toast component with data-temp-toast for JS identification
   * XSS-safe: Uses programmatic DOM creation instead of innerHTML
   */
  private showError(message: string): void {
    // Remove existing error toasts
    const existingErrors = document.querySelectorAll('[data-temp-toast="error"]');
    existingErrors.forEach((error) => {
      error.remove();
    });

    const isTimeout = message.includes('Sitzung');

    // CRITICAL: Single source of truth for timing - progress bar and setTimeout must match!
    const TOAST_DURATION_SECONDS = 3;

    // Build toast structure programmatically (XSS-safe - no innerHTML)
    // Session expired = danger (red), Login error = error (red) - both are errors that already happened
    const toast = createElement('div', { className: `toast ${isTimeout ? 'toast--danger' : 'toast--error'}` });
    toast.dataset['tempToast'] = 'error';

    // Icon - always fa-times-circle for errors (warning icon is for "will happen soon", not "already happened")
    const iconDiv = createElement('div', { className: 'toast__icon' });
    const icon = createElement('i', { className: 'fas fa-times-circle' });
    iconDiv.appendChild(icon);

    // Content
    const contentDiv = createElement('div', { className: 'toast__content' });
    const titleDiv = createElement('div', { className: 'toast__title' }, isTimeout ? 'Sitzung abgelaufen' : 'Fehler');
    const messageDiv = createElement('div', { className: 'toast__message' }, message); // Safe: textContent is used
    contentDiv.appendChild(titleDiv);
    contentDiv.appendChild(messageDiv);

    // Close button
    const closeBtn = createElement('button', { className: 'toast__close', type: 'button' });
    const closeIcon = createElement('i', { className: 'fas fa-times' });
    closeBtn.appendChild(closeIcon);
    closeBtn.addEventListener('click', () => {
      toast.remove();
    });

    // Progress bar
    const progressDiv = createElement('div', { className: 'toast__progress' });
    const progressBar = createElement('div', { className: 'toast__progress-bar' });
    progressBar.style.animationDuration = `${String(TOAST_DURATION_SECONDS)}s`;
    progressDiv.appendChild(progressBar);

    // Assemble toast
    toast.appendChild(iconDiv);
    toast.appendChild(contentDiv);
    toast.appendChild(closeBtn);
    toast.appendChild(progressDiv);

    const loginCard = document.querySelector('.login-card');
    const loginForm = document.querySelector('#loginForm');

    if (loginCard !== null && loginForm !== null) {
      loginForm.before(toast);
    }

    // Auto-remove after duration (synced with progress bar animation)
    setTimeout(() => {
      toast.remove();
    }, TOAST_DURATION_SECONDS * 1000);
  }

  /**
   * Show info message
   * Uses Design System toast component with data-temp-toast for JS identification
   * XSS-safe: Uses programmatic DOM creation instead of innerHTML
   */
  private showInfo(message: string, persistent: boolean = false): void {
    // Remove existing info toasts
    const existingInfo = document.querySelectorAll('[data-temp-toast="info"]');
    existingInfo.forEach((info) => {
      info.remove();
    });

    // CRITICAL: Single source of truth for timing - progress bar and setTimeout must match!
    const TOAST_DURATION_SECONDS = 5;

    // Build toast structure programmatically (XSS-safe - no innerHTML)
    const toast = createElement('div', { className: 'toast toast--success' });
    toast.dataset['tempToast'] = 'info';

    // Icon
    const iconDiv = createElement('div', { className: 'toast__icon' });
    const icon = createElement('i', { className: 'fas fa-check-circle' });
    iconDiv.appendChild(icon);

    // Content
    const contentDiv = createElement('div', { className: 'toast__content' });
    const messageDiv = createElement('div', { className: 'toast__message' }, message); // Safe: textContent is used
    contentDiv.appendChild(messageDiv);

    // Close button
    const closeBtn = createElement('button', { className: 'toast__close', type: 'button' });
    const closeIcon = createElement('i', { className: 'fas fa-times' });
    closeBtn.appendChild(closeIcon);
    closeBtn.addEventListener('click', () => {
      toast.remove();
    });

    // Assemble toast
    toast.appendChild(iconDiv);
    toast.appendChild(contentDiv);
    toast.appendChild(closeBtn);

    // Progress bar (only if not persistent)
    if (!persistent) {
      const progressDiv = createElement('div', { className: 'toast__progress' });
      const progressBar = createElement('div', { className: 'toast__progress-bar' });
      progressBar.style.animationDuration = `${String(TOAST_DURATION_SECONDS)}s`;
      progressDiv.appendChild(progressBar);
      toast.appendChild(progressDiv);
    }

    const loginCard = document.querySelector('.login-card');
    const loginForm = document.querySelector('#loginForm');

    if (loginCard !== null && loginForm !== null) {
      loginForm.before(toast);
    }

    // Auto-remove after duration (synced with progress bar animation) - unless persistent
    if (!persistent) {
      setTimeout(() => {
        toast.remove();
      }, TOAST_DURATION_SECONDS * 1000);
    }
  }
}
