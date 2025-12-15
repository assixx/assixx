/**
 * Signup Form Controller
 *
 * Main controller for signup form
 * Coordinates validation, dropdowns, and API submission
 * Best Practice 2025: MVC pattern for forms
 */

import {
  validateEmail,
  validateEmailMatch,
  validatePassword,
  validatePasswordMatch,
  validatePhone,
  validateSubdomain,
  validateCompanyName,
  validateFirstName,
  validateLastName,
} from './signup-validators.js';
import { DropdownController } from './signup-dropdown.js';
import { prepareSignupData, submitSignup, getErrorMessage, isSignupSuccessful } from './signup-api.js';
import { setupPasswordStrength } from '../../utils/password-strength-integration.js';
import { $$id } from '../../utils/dom-utils.js';

/**
 * Signup Form Controller
 */
export class SignupFormController {
  private form: HTMLFormElement;
  private countryDropdown: DropdownController;
  private planDropdown: DropdownController;

  constructor() {
    const form = document.querySelector<HTMLFormElement>('#signupForm');
    if (form === null) {
      throw new Error('Signup form not found');
    }
    this.form = form;

    // Initialize dropdowns
    this.countryDropdown = new DropdownController(
      '.country-display',
      '#countryDropdown',
      '#countryCode',
      '.country-display',
    );

    this.planDropdown = new DropdownController('.plan-display', '#planDropdown', '#planValue', '#selectedPlan');
  }

  /**
   * Initialize controller
   */
  public init(): void {
    this.setupEventListeners();
    this.setupRealtimeValidation();
    this.setupPasswordStrengthValidation();
    this.setupHelp();
  }

  /**
   * Setup form submit handler
   */
  private setupEventListeners(): void {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.handleSubmit();
    });
  }

  /**
   * Setup real-time validation
   */
  private setupRealtimeValidation(): void {
    this.setupSubdomainValidation();
    this.setupPasswordValidation();
    this.setupPhoneValidation();
    this.setupEmailValidation();
  }

  /**
   * Setup subdomain real-time validation
   */
  private setupSubdomainValidation(): void {
    const subdomainInput = this.form.querySelector<HTMLInputElement>('input[name="subdomain"]');
    const subdomainError = this.form.querySelector<HTMLElement>('#subdomainError');

    if (subdomainInput !== null && subdomainError !== null) {
      subdomainInput.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const value = target.value.toLowerCase();
        target.value = value;

        const result = validateSubdomain(value);
        if (!result.valid && value !== '') {
          subdomainError.style.display = 'block';
        } else {
          subdomainError.style.display = 'none';
        }
      });
    }
  }

  /**
   * Setup password confirmation real-time validation
   */
  private setupPasswordValidation(): void {
    const passwordInput = this.form.querySelector<HTMLInputElement>('input[name="password"]');
    const passwordConfirmInput = this.form.querySelector<HTMLInputElement>('input[name="password_confirm"]');
    const passwordError = this.form.querySelector<HTMLElement>('#passwordError');

    if (passwordInput !== null && passwordConfirmInput !== null && passwordError !== null) {
      passwordConfirmInput.addEventListener('input', () => {
        if (passwordConfirmInput.value !== '' && passwordInput.value !== passwordConfirmInput.value) {
          passwordError.style.display = 'block';
          passwordConfirmInput.style.borderColor = '#ef4444';
        } else {
          passwordError.style.display = 'none';
          passwordConfirmInput.style.borderColor = '';
        }
      });
    }
  }

  /**
   * Setup phone real-time validation
   */
  private setupPhoneValidation(): void {
    const phoneInput = this.form.querySelector<HTMLInputElement>('input[name="phone"]');
    const phoneError = this.form.querySelector<HTMLElement>('#phoneError');
    const countryCodeInput = this.form.querySelector<HTMLInputElement>('#countryCode');

    if (phoneInput !== null && phoneError !== null && countryCodeInput !== null) {
      phoneInput.addEventListener('input', () => {
        const phoneValue = phoneInput.value.trim();
        const countryCode = countryCodeInput.value;

        const result = validatePhone(phoneValue, countryCode);
        if (!result.valid && phoneValue !== '') {
          phoneError.textContent = result.message ?? '';
          phoneError.style.display = 'block';
          phoneInput.style.borderColor = '#ef4444';
        } else {
          phoneError.style.display = 'none';
          phoneInput.style.borderColor = '';
        }
      });
    }
  }

  /**
   * Setup email confirmation real-time validation
   */
  private setupEmailValidation(): void {
    const emailInput = this.form.querySelector<HTMLInputElement>('input[name="email"]');
    const emailConfirmInput = this.form.querySelector<HTMLInputElement>('input[name="email_confirm"]');
    const emailMatchError = this.form.querySelector<HTMLElement>('#emailMatchError');

    if (emailInput !== null && emailConfirmInput !== null && emailMatchError !== null) {
      const checkEmailMatch = (): void => {
        if (emailConfirmInput.value !== '' && emailInput.value !== emailConfirmInput.value) {
          emailMatchError.style.display = 'block';
          emailConfirmInput.style.borderColor = '#ef4444';
        } else {
          emailMatchError.style.display = 'none';
          emailConfirmInput.style.borderColor = '';
        }
      };

      emailConfirmInput.addEventListener('input', checkEmailMatch);
      emailInput.addEventListener('input', checkEmailMatch);
    }
  }

  /**
   * Setup password strength validation
   * Uses zxcvbn-ts for intelligent password strength analysis
   */
  private setupPasswordStrengthValidation(): void {
    setupPasswordStrength({
      passwordFieldId: 'password',
      strengthContainerId: 'password-strength-container',
      strengthBarId: 'password-strength-bar',
      strengthLabelId: 'password-strength-label',
      strengthTimeId: 'password-strength-time',
      feedbackContainerId: 'password-feedback',
      feedbackWarningId: 'password-feedback-warning',
      feedbackSuggestionsId: 'password-feedback-suggestions',
      errorElementId: 'password-error',
      getUserInputs: () => {
        const companyName = ($$id('company_name') as HTMLInputElement | null)?.value ?? '';
        const firstName = ($$id('first_name') as HTMLInputElement | null)?.value ?? '';
        const lastName = ($$id('last_name') as HTMLInputElement | null)?.value ?? '';
        const email = ($$id('email') as HTMLInputElement | null)?.value ?? '';
        return [companyName, firstName, lastName, email].filter((v) => v !== '');
      },
    });
  }

  /**
   * Setup help button
   */
  private setupHelp(): void {
    document.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-action]');
      if (target === null) return;

      const action = target.getAttribute('data-action');

      if (action === 'show-help') {
        this.showHelp();
      }
    });
  }

  /**
   * Show help alert
   */
  private showHelp(): void {
    alert(
      'Hilfe zur Registrierung:\n\n' +
        '1. Geben Sie Ihre Firmendaten ein\n' +
        '2. Wählen Sie eine eindeutige Subdomain\n' +
        '3. Erstellen Sie ein sicheres Passwort\n' +
        '4. 14 Tage kostenlos testen!\n\n' +
        'Bei Fragen: support@assixx.com',
    );
  }

  /**
   * Validate entire form before submission
   */
  private validateForm(): boolean {
    const formData = new FormData(this.form);

    // Get values
    const companyName = formData.get('company_name') as string;
    const subdomain = formData.get('subdomain') as string;
    const email = formData.get('email') as string;
    const emailConfirm = formData.get('email_confirm') as string;
    const firstName = formData.get('first_name') as string;
    const lastName = formData.get('last_name') as string;
    const phone = formData.get('phone') as string;
    const password = formData.get('password') as string;
    const passwordConfirm = formData.get('password_confirm') as string;
    const countryCodeInput = document.querySelector<HTMLInputElement>('#countryCode');
    const countryCode = countryCodeInput !== null ? countryCodeInput.value : '+49';

    // Validate all fields
    const validations = [
      validateCompanyName(companyName),
      validateSubdomain(subdomain),
      validateEmail(email),
      validateEmailMatch(email, emailConfirm),
      validateFirstName(firstName),
      validateLastName(lastName),
      validatePhone(phone, countryCode),
      validatePassword(password),
      validatePasswordMatch(password, passwordConfirm),
    ];

    // Find first error
    const firstError = validations.find((v) => !v.valid);

    if (firstError !== undefined) {
      alert(firstError.message);
      return false;
    }

    return true;
  }

  /**
   * Handle form submission
   */
  private async handleSubmit(): Promise<void> {
    // Validate form
    if (!this.validateForm()) {
      return;
    }

    // Get form data
    const formData = new FormData(this.form);
    const submitButton = this.form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submitButton === null) return;

    // Preserve exact original text (including null if button has no text)
    const originalText = submitButton.textContent;

    try {
      // Disable button
      submitButton.disabled = true;
      submitButton.textContent = '⏳ Wird erstellt...';

      // Prepare data
      const signupData = prepareSignupData(
        formData.get('company_name') as string,
        formData.get('subdomain') as string,
        formData.get('email') as string,
        formData.get('first_name') as string,
        formData.get('last_name') as string,
        formData.get('phone') as string,
        this.countryDropdown.getValue(),
        formData.get('password') as string,
        this.planDropdown.getValue(),
      );

      // Submit to API
      const response = await submitSignup(signupData);

      // Handle response
      if (isSignupSuccessful(response)) {
        this.handleSuccess();
      } else {
        this.handleError(getErrorMessage(response));
      }
    } catch (error) {
      console.error('Signup error:', error);
      this.handleError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      // Re-enable button (submitButton guaranteed non-null by early return)
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  }

  /**
   * Handle successful signup
   */
  private handleSuccess(): void {
    const successMessage = document.querySelector<HTMLElement>('#successMessage');
    if (successMessage !== null) {
      successMessage.style.display = 'flex';
    }

    this.form.reset();

    setTimeout(() => {
      window.location.href = '/login';
    }, 5000);
  }

  /**
   * Handle error
   */
  private handleError(message: string): void {
    alert(message);
  }
}
