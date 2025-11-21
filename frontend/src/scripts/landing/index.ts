/**
 * Landing Page Main Controller
 * Orchestrates all landing page functionality
 */

import { SignupModal } from './signup-modal.js';
import { FormValidator } from './form-validator.js';
import { FormHandler } from './form-handler.js';

export class LandingPageController {
  private modal: SignupModal;
  private validator: FormValidator;
  private formHandler: FormHandler;

  constructor() {
    this.modal = new SignupModal();
    this.validator = new FormValidator();
    this.formHandler = new FormHandler();
  }

  /**
   * Initialize all landing page functionality
   */
  public init(): void {
    this.modal.init();
    this.validator.init();
    this.formHandler.init();
    this.setupEventDelegation();
  }

  /**
   * Setup event delegation for action buttons
   */
  private setupEventDelegation(): void {
    document.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-action]');

      if (button === null) {
        return;
      }

      const buttonEl = button as HTMLElement;
      const action = buttonEl.dataset.action;

      if (action === 'reload-page') {
        window.location.reload();
      } else if (action === 'hide-signup') {
        this.modal.hide();
      }
    });
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new LandingPageController().init();
  });
} else {
  new LandingPageController().init();
}
