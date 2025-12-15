/**
 * Signup Modal Controller
 * Handles showing and hiding the signup modal
 */

export class SignupModal {
  private modal: HTMLElement | null = null;

  constructor() {
    this.modal = document.querySelector('#signupModal');
  }

  /**
   * Initialize modal (setup would go here if needed)
   */
  public init(): void {
    // Modal initialization if needed
    // Currently just used for show/hide methods
  }

  /**
   * Show signup modal
   * @param plan - Optional plan selection (basic, professional, enterprise)
   */
  public show(plan: string | null = null): void {
    if (this.modal === null) {
      return;
    }

    this.modal.style.display = 'flex';

    if (plan !== null) {
      // Pre-select plan when coming from pricing table
      localStorage.setItem('selectedPlan', plan);
    }
  }

  /**
   * Hide signup modal
   */
  public hide(): void {
    if (this.modal === null) {
      return;
    }

    this.modal.style.display = 'none';
  }
}
