/**
 * Login Form Controller
 * Handles login form interactions, validation, and error display
 */

import { submitLogin, type LoginData } from './login-api.js';

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
    const action = element.dataset.action;
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
   */
  private showError(message: string): void {
    // Remove existing error messages
    const existingErrors = document.querySelectorAll('.alert-error, .temp-alert-error');
    existingErrors.forEach((error) => {
      error.remove();
    });

    const errorDiv = document.createElement('div');
    const isTimeout = message.includes('Sitzung');
    errorDiv.className = `alert ${isTimeout ? 'alert--warning' : 'alert--error'} temp-alert-error`;

    // Create alert structure
    const icon = document.createElement('span');
    icon.className = 'alert__icon';
    icon.textContent = isTimeout ? '⚠️' : '❌';

    const content = document.createElement('div');
    content.className = 'alert__content';

    const title = document.createElement('div');
    title.className = 'alert__title';
    title.textContent = isTimeout ? 'Sitzung abgelaufen' : 'Fehler';

    const messageEl = document.createElement('div');
    messageEl.className = 'alert__message';
    messageEl.textContent = message;

    content.appendChild(title);
    content.appendChild(messageEl);
    errorDiv.appendChild(icon);
    errorDiv.appendChild(content);

    const loginCard = document.querySelector('.login-card');
    const loginForm = document.querySelector('#loginForm');

    if (loginCard !== null && loginForm !== null) {
      loginForm.before(errorDiv);
    }

    // Remove after 10 seconds
    setTimeout(() => {
      errorDiv.remove();
    }, 10000);
  }

  /**
   * Show info message
   */
  private showInfo(message: string, persistent = false): void {
    // Remove existing messages
    const existingInfo = document.querySelectorAll('.alert-info, .temp-alert-info');
    existingInfo.forEach((info) => {
      info.remove();
    });

    const infoDiv = document.createElement('div');
    infoDiv.className = 'alert alert--success temp-alert-info';

    // Create alert structure
    const icon = document.createElement('span');
    icon.className = 'alert__icon';
    icon.textContent = 'ℹ️';

    const content = document.createElement('div');
    content.className = 'alert__content';

    const messageEl = document.createElement('div');
    messageEl.className = 'alert__message';
    messageEl.textContent = message;

    content.appendChild(messageEl);
    infoDiv.appendChild(icon);
    infoDiv.appendChild(content);

    const loginCard = document.querySelector('.login-card');
    const loginForm = document.querySelector('#loginForm');

    if (loginCard !== null && loginForm !== null) {
      loginForm.before(infoDiv);
    }

    // Only auto-remove if not persistent
    if (!persistent) {
      setTimeout(() => {
        infoDiv.remove();
      }, 5000);
    }
  }
}
