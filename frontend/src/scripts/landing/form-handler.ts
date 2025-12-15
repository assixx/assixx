/**
 * Form Handler
 * Handles signup form submission and API communication
 */

import { showSuccessAlert, showErrorAlert } from '../utils/alerts.js';

interface SignupFormData {
  company_name: string;
  subdomain: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  password: string;
}

interface SignupResponse {
  success: boolean;
  data?: unknown;
  error?: {
    message?: string;
  };
}

export class FormHandler {
  private form: HTMLFormElement | null = null;

  constructor() {
    this.form = document.querySelector('#signupForm');
  }

  /**
   * Initialize form handler
   */
  public init(): void {
    if (this.form === null) {
      return;
    }

    this.form.addEventListener('submit', (e: Event) => {
      void this.handleSubmit(e);
    });
  }

  /**
   * Handle form submission
   */
  private async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries()) as unknown as SignupFormData;

    try {
      const response = await fetch('/api/v2/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: data.company_name,
          subdomain: data.subdomain,
          email: data.email,
          phone: data.phone,
          adminEmail: data.email,
          adminPassword: data.password,
          adminFirstName: data.first_name,
          adminLastName: data.last_name,
          selectedPlan: localStorage.getItem('selectedPlan') ?? 'premium',
        }),
      });

      const result = (await response.json()) as SignupResponse;

      if (result.success) {
        // Success notification with Design System Toast
        showSuccessAlert(`Erfolg! Sie können sich jetzt unter ${data.subdomain}.assixx.com anmelden.`);

        // Redirect to login after short delay
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        // Error notification with Design System Toast
        showErrorAlert(result.error?.message ?? 'Fehler bei der Registrierung');
      }
    } catch (error: unknown) {
      console.error('Signup error:', error);

      // Catch error notification with Design System Toast
      showErrorAlert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    }
  }
}
