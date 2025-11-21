/**
 * Form Validator
 * Handles client-side validation for signup form
 */

export class FormValidator {
  private subdomainInput: HTMLInputElement | null = null;
  private subdomainError: HTMLElement | null = null;

  constructor() {
    this.subdomainInput = document.querySelector('input[name="subdomain"]');
    this.subdomainError = document.querySelector('#subdomainError');
  }

  /**
   * Initialize form validation
   */
  public init(): void {
    this.setupSubdomainValidation();
  }

  /**
   * Setup real-time subdomain validation
   */
  private setupSubdomainValidation(): void {
    if (this.subdomainInput === null) {
      return;
    }

    this.subdomainInput.addEventListener('input', (e: Event) => {
      const target = e.target as HTMLInputElement;
      const value = target.value.toLowerCase();
      target.value = value;

      // Validate: only lowercase letters, numbers, and hyphens
      if (!/^[a-z0-9-]*$/.test(value)) {
        this.showSubdomainError('Nur Kleinbuchstaben, Zahlen und Bindestriche erlaubt');
      } else {
        this.hideSubdomainError();
      }
    });
  }

  /**
   * Show subdomain validation error
   */
  private showSubdomainError(message: string): void {
    if (this.subdomainError === null) {
      return;
    }

    this.subdomainError.textContent = message;
    this.subdomainError.classList.remove('u-hidden');
  }

  /**
   * Hide subdomain validation error
   */
  private hideSubdomainError(): void {
    if (this.subdomainError === null) {
      return;
    }

    this.subdomainError.textContent = '';
    this.subdomainError.classList.add('u-hidden');
  }
}
