/**
 * Modal Manager - Zentrale Verwaltung aller Modals
 * Erstellt Modals dynamisch bei Bedarf
 */

export interface ModalConfig {
  id: string;
  title?: string;
  content?: string;
  size?: 'sm' | 'md' | 'lg';
  showCloseButton?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

class ModalManager {
  private activeModals: Map<string, HTMLElement> = new Map();
  private templates: Map<string, string> = new Map();

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Register a modal template
   */
  registerTemplate(id: string, template: string): void {
    console.info(`[ModalManager] Registering template for modalId: ${id}`);
    this.templates.set(id, template);
    console.info(`[ModalManager] Template registered. Total templates: ${this.templates.size}`);
  }

  /**
   * Show a modal
   */
  show(modalId: string, config?: Partial<ModalConfig>): HTMLElement | null {
    console.info(`[ModalManager] show() called for modalId: ${modalId}`);

    // Check if modal already exists in activeModals
    let modal = this.activeModals.get(modalId);
    console.info(`[ModalManager] Existing modal in map: ${!!modal}`);

    // Also check if it's in the DOM
    const modalInDom = document.getElementById(modalId);
    console.info(`[ModalManager] Modal in DOM: ${!!modalInDom}`);

    // If modal exists in map but not in DOM, remove from map
    if (modal && !modalInDom) {
      console.info(`[ModalManager] Modal was removed from DOM, clearing from map`);
      this.activeModals.delete(modalId);
      modal = undefined;
    }

    if (!modal) {
      // Create modal from template or config
      console.info(`[ModalManager] Creating new modal...`);
      const createdModal = this.createModal(modalId, config);
      modal = createdModal ?? undefined;
      if (!modal) {
        console.error(`[ModalManager] Failed to create modal!`);
        return null;
      }
      console.info(`[ModalManager] Modal created successfully`);
      console.info(`[ModalManager] Modal element:`, modal);
      console.info(`[ModalManager] Modal parentElement before append:`, modal.parentElement);
    }

    // Add to DOM if not already there or not in document.body
    if (!modal.parentElement || modal.parentElement !== document.body) {
      console.info(`[ModalManager] Adding modal to DOM...`);
      console.info(`[ModalManager] Current parent:`, modal.parentElement);

      // Remove from current parent if it has one
      if (modal.parentElement) {
        modal.parentElement.removeChild(modal);
      }

      document.body.appendChild(modal);
      console.info(`[ModalManager] Modal added to DOM. Parent:`, modal.parentElement?.tagName);
      console.info(`[ModalManager] Modal in DOM:`, document.getElementById(modalId) !== null);
      console.info(`[ModalManager] document.body contains modal:`, document.body.contains(modal));
    } else {
      console.info(`[ModalManager] Modal already in document.body`);
    }

    // Remove active class first to reset animation
    modal.classList.remove('active');

    // Show modal with animation
    console.info(`[ModalManager] Showing modal with animation...`);

    // Ensure the modal is visible by removing any inline styles that might interfere
    modal.style.removeProperty('display');
    modal.style.removeProperty('visibility');
    modal.style.removeProperty('opacity');

    // Force a reflow to ensure the browser processes the state change
    void modal.offsetHeight;

    // Use requestAnimationFrame to ensure smooth animation
    window.requestAnimationFrame(() => {
      if (!modal) return;
      modal.classList.add('active');
      console.info(`[ModalManager] Modal classes after show: ${modal.className}`);

      // Double-check visibility after a frame
      window.requestAnimationFrame(() => {
        if (!modal) return;
        const styles = window.getComputedStyle(modal);
        console.info(`[ModalManager] Modal computed style visibility:`, styles.visibility);
        console.info(`[ModalManager] Modal computed style opacity:`, styles.opacity);
        console.info(`[ModalManager] Modal computed style display:`, styles.display);

        // If still not visible, force it (also check for empty string)
        if (
          !styles.opacity ||
          styles.opacity === '0' ||
          styles.opacity === '' ||
          styles.visibility === 'hidden' ||
          styles.visibility === '' ||
          styles.display === 'none'
        ) {
          console.warn('[ModalManager] Modal not visible, forcing visibility');
          modal.style.opacity = '1';
          modal.style.visibility = 'visible';
          modal.style.display = 'flex';
        }
      });
    });

    // Track active modal
    this.activeModals.set(modalId, modal);

    // Call onOpen callback
    if (config?.onOpen) {
      console.info(`[ModalManager] Calling onOpen callback...`);
      config.onOpen();
    }

    return modal;
  }

  /**
   * Hide a modal
   */
  hide(modalId: string): void {
    const modal = this.activeModals.get(modalId);
    if (!modal) return;

    // Hide with animation
    modal.classList.remove('active');

    // Remove from DOM after animation
    setTimeout(() => {
      if (modal.parentElement) {
        modal.remove();
      }
      this.activeModals.delete(modalId);
    }, 300);
  }

  /**
   * Hide all modals
   */
  hideAll(): void {
    this.activeModals.forEach((_, modalId) => {
      this.hide(modalId);
    });
  }

  /**
   * Create a modal element
   */
  private createModal(modalId: string, config?: Partial<ModalConfig>): HTMLElement | null {
    console.info(`[ModalManager] createModal() called for modalId: ${modalId}`);
    console.info(`[ModalManager] Available templates:`, Array.from(this.templates.keys()));

    // Try to get template first
    const template = this.templates.get(modalId);
    console.info(`[ModalManager] Template found: ${!!template}`);

    if (template) {
      console.info(`[ModalManager] Creating modal from template...`);
      const div = document.createElement('div');
      div.innerHTML = template;
      const modal = div.firstElementChild as HTMLElement;
      console.info(`[ModalManager] Modal element created:`, modal?.tagName, modal?.id);
      return modal;
    }

    // Create modal from config
    console.info(`[ModalManager] No template found, creating from config...`);
    if (!config) {
      console.error(`[ModalManager] No config provided!`);
      return null;
    }

    const modalHtml = `
      <div class="modal-overlay" id="${modalId}">
        <div class="modal-container modal-${config.size ?? 'md'}">
          ${
            config.title
              ? `
            <div class="modal-header">
              <h2 class="modal-title">${config.title}</h2>
              ${config.showCloseButton !== false ? '<button type="button" class="modal-close" data-action="close">&times;</button>' : ''}
            </div>
          `
              : ''
          }
          <div class="modal-body">
            ${config.content ?? ''}
          </div>
        </div>
      </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    return div.firstElementChild as HTMLElement;
  }

  /**
   * Setup global event listeners
   */
  private setupEventListeners(): void {
    // Use event delegation for close buttons and overlay clicks
    document.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Close button clicked
      if (target.matches('[data-action="close"]') ?? target.closest('[data-action="close"]')) {
        const modal = target.closest('.modal-overlay') as HTMLElement;
        if (modal?.id) {
          this.hide(modal.id);
        }
      }

      // Overlay clicked (outside modal content)
      if (target.classList.contains('modal-overlay')) {
        const modalId = target.id;
        if (modalId) {
          this.hide(modalId);
        }
      }
    });

    // ESC key to close topmost modal
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.activeModals.size > 0) {
        // Get the last added modal
        const lastModalId = Array.from(this.activeModals.keys()).pop();
        if (lastModalId) {
          this.hide(lastModalId);
        }
      }
    });
  }
}

// Export singleton instance
export const modalManager = new ModalManager();

// Export convenience functions
export function openModal(content: string, config?: Partial<ModalConfig>): void {
  const modalId = config?.id ?? `modal-${Date.now()}`;
  modalManager.show(modalId, {
    ...config,
    content,
  });
}

export function closeModal(modalId?: string): void {
  if (modalId) {
    modalManager.hide(modalId);
  } else {
    modalManager.hideAll();
  }
}

// Global verfügbar machen gemäß Plan
declare global {
  interface Window {
    showModal: (modalId: string) => void;
    hideModal: (modalId: string) => void;
    modalManager: ModalManager;
  }
}

// Also export for window access
if (typeof window !== 'undefined') {
  window.modalManager = modalManager;

  // Globale Funktionen gemäß Plan hinzufügen
  window.showModal = (modalId: string) => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('u-hidden');
      modal.classList.add('u-flex');
    } else {
      // Fallback to modalManager if element doesn't exist
      modalManager.show(modalId);
    }
  };

  window.hideModal = (modalId: string) => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('u-flex');
      modal.classList.add('u-hidden');
    } else {
      // Fallback to modalManager
      modalManager.hide(modalId);
    }
  };
}
