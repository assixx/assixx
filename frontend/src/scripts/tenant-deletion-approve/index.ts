/**
 * Tenant Deletion Approve Controller
 *
 * Standalone page controller for approving tenant deletion.
 * Implements the two-person principle security requirement.
 */

import { ApiClient } from '../../utils/api-client';

interface DeletionStatusData {
  queueId: number;
  tenantId: number;
  status: string;
  requestedBy: number;
  requestedByName?: string;
  canApprove: boolean;
}

/** API may return null when no active deletion exists */
type DeletionStatusResponse = DeletionStatusData | { data: null; message: string };

/**
 * TenantDeletionApproveController
 *
 * Handles the approval page logic:
 * - Load queue data from URL parameter
 * - Validate form inputs
 * - Submit approval with password
 */
class TenantDeletionApproveController {
  private queueId: number | null = null;
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = ApiClient.getInstance();
  }

  /**
   * Initialize the controller
   */
  async init(): Promise<void> {
    // Get queue ID from URL
    this.queueId = this.getQueueIdFromUrl();

    if (this.queueId === null) {
      this.showError('Keine Queue-ID in der URL gefunden');
      return;
    }

    // Load queue data
    await this.loadQueueData();

    // Setup form validation
    this.setupFormValidation();

    // Setup form submission
    this.setupFormSubmission();
  }

  /**
   * Extract queue ID from URL parameters
   */
  private getQueueIdFromUrl(): number | null {
    const params = new URLSearchParams(window.location.search);
    const queueIdStr = params.get('queueId');

    if (queueIdStr === null || queueIdStr === '') {
      return null;
    }

    const queueId = Number.parseInt(queueIdStr, 10);
    return Number.isNaN(queueId) ? null : queueId;
  }

  /**
   * Load queue data from API
   */
  private async loadQueueData(): Promise<void> {
    try {
      const response = await this.apiClient.request<DeletionStatusResponse>('/root/tenant/deletion-status', {
        method: 'GET',
      });

      // API returns data directly when deletion exists, or { data: null } when not
      // Check if response has queueId (indicates valid deletion data)
      if (!('queueId' in response)) {
        this.showError('Keine Löschanfrage gefunden');
        return;
      }

      const statusData = response;

      // Verify queue ID matches
      if (statusData.queueId !== this.queueId) {
        this.showError('Queue-ID stimmt nicht überein');
        return;
      }

      // Check if user can approve
      if (!statusData.canApprove) {
        this.showError('Sie können diese Löschanfrage nicht genehmigen (Zwei-Personen-Prinzip)');
        return;
      }

      // Display queue info
      this.displayQueueInfo(statusData);
    } catch (error) {
      console.error('Error loading queue data:', error);
      this.showError('Fehler beim Laden der Löschanfrage');
    }
  }

  /**
   * Display queue information in the UI
   */
  private displayQueueInfo(data: DeletionStatusData): void {
    const queueIdDisplay = document.querySelector('#queueIdDisplay');
    const tenantIdDisplay = document.querySelector('#tenantIdDisplay');
    const requestedByDisplay = document.querySelector('#requestedByDisplay');

    if (queueIdDisplay !== null) {
      queueIdDisplay.textContent = String(data.queueId);
    }
    if (tenantIdDisplay !== null) {
      tenantIdDisplay.textContent = String(data.tenantId);
    }
    if (requestedByDisplay !== null) {
      requestedByDisplay.textContent = data.requestedByName ?? `User ${data.requestedBy}`;
    }
  }

  /**
   * Setup form validation
   */
  private setupFormValidation(): void {
    const confirmInput = document.querySelector<HTMLInputElement>('#confirmationInput');
    const passwordInput = document.querySelector<HTMLInputElement>('#passwordInput');
    const approveBtn = document.querySelector<HTMLButtonElement>('#approveBtn');

    if (confirmInput === null || passwordInput === null || approveBtn === null) {
      return;
    }

    const updateButtonState = (): void => {
      const confirmValid = confirmInput.value === 'LÖSCHEN';
      const passwordValid = passwordInput.value.length > 0;
      approveBtn.disabled = !(confirmValid && passwordValid);
    };

    confirmInput.addEventListener('input', updateButtonState);
    passwordInput.addEventListener('input', updateButtonState);
  }

  /**
   * Setup form submission
   */
  private setupFormSubmission(): void {
    const form = document.querySelector<HTMLFormElement>('#approvalForm');

    if (form === null) {
      return;
    }

    form.addEventListener('submit', (e: Event) => {
      e.preventDefault();
      void this.handleSubmit();
    });
  }

  /**
   * Handle form submission
   */
  private async handleSubmit(): Promise<void> {
    if (this.queueId === null) {
      this.showError('Queue-ID fehlt');
      return;
    }

    const passwordInput = document.querySelector<HTMLInputElement>('#passwordInput');
    const approveBtn = document.querySelector<HTMLButtonElement>('#approveBtn');

    if (passwordInput === null || approveBtn === null) {
      return;
    }

    const password = passwordInput.value;

    if (password.length === 0) {
      this.showError('Bitte geben Sie Ihr Passwort ein');
      return;
    }

    // Set loading state
    this.setLoading(true);
    this.hideError();

    try {
      await this.apiClient.request(`/root/deletion-approvals/${this.queueId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      // Show success
      this.showSuccess();

      // Redirect after delay
      setTimeout(() => {
        window.location.href = '/tenant-deletion-status';
      }, 2000);
    } catch (error) {
      console.error('Error approving deletion:', error);
      const message = error instanceof Error ? error.message : 'Fehler bei der Genehmigung';
      this.showError(message);
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Set loading state on button
   */
  private setLoading(loading: boolean): void {
    const approveBtn = document.querySelector<HTMLButtonElement>('#approveBtn');

    if (approveBtn === null) {
      return;
    }

    approveBtn.disabled = loading;

    if (loading) {
      approveBtn.classList.add('btn--loading');
      approveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Wird genehmigt...';
    } else {
      approveBtn.classList.remove('btn--loading');
      approveBtn.innerHTML = '<i class="fas fa-check mr-2"></i> Genehmigen';
    }
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    const errorDiv = document.querySelector('#errorMessage');
    const errorText = document.querySelector('#errorText');

    if (errorDiv !== null && errorText !== null) {
      errorText.textContent = message;
      errorDiv.classList.remove('u-hidden');
    }
  }

  /**
   * Hide error message
   */
  private hideError(): void {
    const errorDiv = document.querySelector('#errorMessage');

    if (errorDiv !== null) {
      errorDiv.classList.add('u-hidden');
    }
  }

  /**
   * Show success message
   */
  private showSuccess(): void {
    const successDiv = document.querySelector('#successMessage');
    const form = document.querySelector('#approvalForm');

    if (successDiv !== null) {
      successDiv.classList.remove('u-hidden');
    }

    if (form !== null) {
      form.classList.add('u-hidden');
    }
  }
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const controller = new TenantDeletionApproveController();
  void controller.init();
});
