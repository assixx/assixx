/**
 * Tenant Deletion Status - Main Controller
 *
 * Entry point for the tenant deletion status page.
 * Handles initialization, event delegation, and auto-refresh.
 */

import { showSuccessAlert, showErrorAlert, showConfirm } from '../utils/alerts';
import { loadDeletionStatus, rejectDeletion, cancelDeletion, emergencyStop } from './api';
import { displayStatus } from './ui';
import type { DeletionStatusItem } from './types';

/**
 * Note: Approval functionality moved to separate page /tenant-deletion-approve
 * The "Genehmigen" button is now a link, not a data-action button.
 */

/**
 * Auto-refresh interval in milliseconds (60 seconds)
 */
const REFRESH_INTERVAL_MS = 60000;

/**
 * TenantDeletionManager - Main controller class
 *
 * Manages the lifecycle of the tenant deletion status page:
 * - Initial data loading
 * - Auto-refresh scheduling
 * - Event delegation for action buttons
 */
class TenantDeletionManager {
  private statusData: DeletionStatusItem[] = [];
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private container: HTMLElement | null = null;

  /**
   * Initialize the manager
   *
   * Sets up the container reference, loads initial data,
   * and configures event delegation.
   */
  async init(): Promise<void> {
    this.container = document.querySelector('#statusContent');

    if (!this.container) {
      console.error('Status container #statusContent not found');
      return;
    }

    // Load initial data
    await this.loadAndDisplay();

    // Set up event delegation
    this.setupEventDelegation();
  }

  /**
   * Load deletion status and display in container
   */
  async loadAndDisplay(): Promise<void> {
    try {
      this.statusData = await loadDeletionStatus();
      this.render();
      this.scheduleRefresh();
    } catch (error: unknown) {
      console.error('Error loading status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Fehler beim Laden des Status';
      showErrorAlert(errorMessage);
      // Don't schedule refresh on real errors to avoid loop
    }
  }

  /**
   * Render the current status data
   */
  private render(): void {
    if (!this.container) {
      return;
    }

    displayStatus(this.container, this.statusData);
  }

  /**
   * Schedule the next auto-refresh
   */
  private scheduleRefresh(): void {
    // Clear any existing timer
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
    }

    // Schedule next refresh
    this.refreshTimer = setTimeout(() => {
      void this.loadAndDisplay();
    }, REFRESH_INTERVAL_MS);
  }

  /**
   * Set up event delegation for action buttons
   *
   * Uses data-action and data-queue-id attributes to identify actions.
   * Note: Approval is now handled via separate page, not modal.
   */
  private setupEventDelegation(): void {
    document.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const btn = target.closest<HTMLElement>('[data-action]');

      if (btn === null) {
        return;
      }

      const action = btn.dataset['action'];

      if (action === undefined || action === '') {
        return;
      }

      // All actions require queue ID
      const queueIdStr = btn.dataset['queueId'];

      if (queueIdStr === undefined || queueIdStr === '') {
        return;
      }

      const queueId = Number.parseInt(queueIdStr, 10);

      if (Number.isNaN(queueId)) {
        console.error('Invalid queue ID:', queueIdStr);
        return;
      }

      void this.handleAction(action, queueId);
    });
  }

  /**
   * Handle action button clicks
   *
   * @param action - The action to perform
   * @param queueId - The queue ID to act on
   */
  private async handleAction(action: string, queueId: number): Promise<void> {
    switch (action) {
      case 'reject':
        await this.handleReject(queueId);
        break;
      case 'cancel':
        await this.handleCancel();
        break;
      case 'emergency-stop':
        await this.handleEmergencyStop(queueId);
        break;
      default:
        console.warn('Unknown action:', action);
    }
  }

  /**
   * Handle reject action
   */
  private async handleReject(queueId: number): Promise<void> {
    const reason = prompt('Grund für die Ablehnung:');

    if (reason === null || reason === '') {
      return;
    }

    try {
      await rejectDeletion(queueId, reason);
      showSuccessAlert('Löschung abgelehnt!');
      await this.loadAndDisplay();
    } catch (error: unknown) {
      console.error('Error rejecting:', error);
      const errorMessage = error instanceof Error ? error.message : 'Fehler beim Ablehnen';
      showErrorAlert(errorMessage);
    }
  }

  /**
   * Handle cancel action
   */
  private async handleCancel(): Promise<void> {
    const confirmed = await showConfirm('Möchten Sie Ihre Löschanfrage wirklich abbrechen?');

    if (!confirmed) {
      return;
    }

    try {
      await cancelDeletion();
      showSuccessAlert('Löschanfrage abgebrochen!');
      await this.loadAndDisplay();
    } catch (error: unknown) {
      console.error('Error cancelling:', error);
      const errorMessage = error instanceof Error ? error.message : 'Fehler beim Abbrechen';
      showErrorAlert(errorMessage);
    }
  }

  /**
   * Handle emergency stop action
   */
  private async handleEmergencyStop(queueId: number): Promise<void> {
    const confirmed = await showConfirm(
      'EMERGENCY STOP\n\n' +
        'Dies stoppt die Tenant-Löschung SOFORT!\n\n' +
        'Der Tenant wird reaktiviert und die Löschung abgebrochen.\n\n' +
        'Sind Sie sicher?',
    );

    if (!confirmed) {
      return;
    }

    try {
      await emergencyStop(queueId);
      showSuccessAlert('EMERGENCY STOP aktiviert! Löschung wurde gestoppt.');
      await this.loadAndDisplay();
    } catch (error: unknown) {
      console.error('Error during emergency stop:', error);
      const errorMessage = error instanceof Error ? error.message : 'Fehler beim Emergency Stop';
      showErrorAlert(errorMessage);
    }
  }

  /**
   * Clean up resources (call on page unload if needed)
   */
  destroy(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const manager = new TenantDeletionManager();
  void manager.init();
});

// Export for potential external use
export { TenantDeletionManager };
