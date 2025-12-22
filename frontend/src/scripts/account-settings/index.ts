/**
 * Account Settings - Main Controller
 * Orchestrates tenant deletion workflow and UI interactions
 *
 * Architecture:
 * - types.ts: TypeScript interfaces
 * - api.ts: API communication layer
 * - ui.ts: DOM manipulation and modal handlers
 * - index.ts: Event orchestration and business logic
 */

import { showErrorAlert, showSuccessAlert } from '../utils/alerts.js';
import { deleteTenant, getDeletionStatus, getRootUserCount } from './api.js';
import type { ActionHandler } from './types.js';
import * as ui from './ui.js';

/**
 * Account Settings Controller
 * Manages the complete tenant deletion workflow
 */
class AccountSettingsController {
  /**
   * Initialize the account settings page
   */
  public init(): void {
    this.checkAuthentication();
    this.checkForPendingDeletion();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
  }

  /**
   * Check if user is authenticated
   * Redirect to login if no token found
   */
  private checkAuthentication(): void {
    const token = localStorage.getItem('token');
    if (token === null || token === '') {
      window.location.href = '/login';
    }
  }

  /**
   * Check for pending deletion status on page load
   * Show prominent banner with deletion status if pending deletion exists
   */
  private checkForPendingDeletion(): void {
    void getDeletionStatus()
      .then((statusData) => {
        if (statusData !== null) {
          console.info('[AccountSettings] Pending deletion found:', statusData);
          ui.showPendingDeletionBanner(statusData);
          ui.hideDeleteButton(); // Hide "Tenant löschen" button when deletion is pending
        }
        return undefined; // Explicit return for ESLint promise/always-return
      })
      .catch(() => {
        // Silent fail - logged in api.ts
        return undefined;
      });
  }

  /**
   * Setup event listeners for all interactive elements
   */
  private setupEventListeners(): void {
    // Event delegation for all data-action elements
    document.addEventListener('click', (e: MouseEvent) => {
      const clickedElement = e.target as HTMLElement;
      const target = clickedElement.closest('[data-action]');
      if (target === null) return;

      // Type assertion safe: closest() with attribute selector returns Element
      const htmlTarget = target as HTMLElement;
      const action = htmlTarget.dataset['action'];
      if (action === undefined || action === '') return;

      this.handleAction(action, htmlTarget);
    });

    // Delete confirmation input listener
    const deleteConfirmation = document.querySelector('#deleteConfirmation');
    if (deleteConfirmation !== null) {
      deleteConfirmation.addEventListener('input', () => {
        ui.updateConfirmButtonState();
      });
    }

    // Delete reason input listener (min 10 chars validation)
    const deleteReason = document.querySelector('#deleteReason');
    if (deleteReason !== null) {
      deleteReason.addEventListener('input', () => {
        ui.updateReasonValidation();
      });
    }

    // Backdrop click handlers (close modal when clicking outside)
    this.setupBackdropHandlers();
  }

  /**
   * Setup backdrop click handlers for modals
   * Close modal when clicking on backdrop (not on modal content)
   */
  private setupBackdropHandlers(): void {
    const deleteModal = document.querySelector('#deleteModal');
    if (deleteModal !== null) {
      deleteModal.addEventListener('click', (e: Event) => {
        if (e.target === deleteModal) {
          ui.closeDeleteModal();
        }
      });
    }
  }

  /**
   * Setup keyboard shortcuts (Escape to close modals)
   */
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        ui.closeDeleteModal();
      }
    });
  }

  /**
   * Action handler mapping
   */
  private readonly actionHandlers = new Map<string, ActionHandler>([
    ['show-delete-modal', () => this.handleShowDeleteModal()],
    [
      'close-delete-modal',
      () => {
        ui.closeDeleteModal();
      },
    ],
    ['delete-tenant', (target: HTMLElement) => this.handleDeleteTenant(target)],
  ]);

  /**
   * Handle action based on data-action attribute
   */
  private handleAction(action: string, target: HTMLElement): void {
    const handler = this.actionHandlers.get(action);
    if (handler !== undefined) {
      handler(target);
    }
  }

  /**
   * Handle show delete modal action
   * Checks for minimum 2 root users before showing modal
   */
  private async handleShowDeleteModal(): Promise<void> {
    console.log('[AccountSettings] handleShowDeleteModal() called');
    try {
      console.log('[AccountSettings] Fetching root user count...');
      const rootUserCount = await getRootUserCount();

      console.info(`[AccountSettings] Found ${rootUserCount} root users in tenant`);

      if (rootUserCount < 2) {
        const userText = rootUserCount === 1 ? 'Es gibt nur 1 Root-Benutzer' : 'Es gibt keine Root-Benutzer';
        console.warn('[AccountSettings] Not enough root users, showing error');
        showErrorAlert(
          `Tenant-Löschung nicht möglich: ${userText}. Um den Tenant zu löschen, erstellen Sie bitte mindestens einen weiteren Root-Benutzer (Zwei-Personen-Prinzip).`,
        );
        return;
      }

      console.log('[AccountSettings] Root user count OK, calling ui.showDeleteModal()');
      ui.showDeleteModal();
      console.log('[AccountSettings] ui.showDeleteModal() completed');
    } catch (error) {
      console.error('[AccountSettings] Error checking root users:', error);
      console.log('[AccountSettings] Showing modal anyway despite error');
      ui.showDeleteModal(); // Show modal anyway if check fails
    }
  }

  /**
   * Handle delete tenant action
   * Validates confirmation and executes deletion
   */
  private async handleDeleteTenant(target: HTMLElement): Promise<void> {
    // Check if button is disabled
    if ((target as HTMLButtonElement).disabled) return;

    // Set loading state
    ui.setDeleteButtonLoading(true);

    try {
      const reason = ui.getDeleteReason();
      await deleteTenant(reason);

      // Show success toast
      showSuccessAlert('Löschanfrage erfolgreich eingereicht! Genehmigung von zweitem Root-Benutzer erforderlich.');

      // Close delete confirmation modal and reload to show pending banner
      ui.closeDeleteModal();
      this.checkForPendingDeletion();
      ui.hideDeleteButton();
    } catch (error) {
      console.error('Error deleting tenant:', error);
      const message = error instanceof Error ? error.message : 'Fehler beim Löschen des Tenants';
      showErrorAlert(message);
    } finally {
      ui.setDeleteButtonLoading(false);
    }
  }
}

// Initialize controller when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const controller = new AccountSettingsController();
  controller.init();
});
