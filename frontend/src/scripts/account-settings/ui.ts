/**
 * Account Settings UI Layer
 * Handles all DOM manipulation and modal interactions
 */

import { setHTML } from '../../utils/dom-utils.js';
import type { DeletionStatusData, DeletionStatusModalData } from './types.js';

/**
 * Status labels for deletion workflow states
 */
const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Warte auf Genehmigung',
  approved: 'Genehmigt',
  cooling_off: 'In Nachfrist',
  scheduled: 'Geplant',
  completed: 'Abgeschlossen',
  cancelled: 'Abgebrochen',
};

/**
 * Format ISO date string to German locale
 */
function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Show pending deletion banner with full status data
 * Displays a prominent warning banner when a deletion request is pending
 */
export function showPendingDeletionBanner(data: DeletionStatusData): void {
  const container = document.querySelector<HTMLElement>('#pendingDeletionBanner');
  if (container === null) {
    console.warn('[AccountSettings] #pendingDeletionBanner container not found');
    return;
  }

  const statusLabel = STATUS_LABELS[data.status] ?? data.status;
  const requestedDate = formatDate(data.requestedAt);

  // Build the banner HTML using safe setHTML - compact inline layout
  const bannerHtml = `
    <div class="alert alert--warning mb-6">
      <div class="alert__icon">
        <i class="fas fa-hourglass-half"></i>
      </div>
      <div class="alert__content flex-1">
        <p class="alert__title">Löschanfrage aktiv</p>
        <p class="alert__message">
          <strong>${statusLabel}</strong> · Queue #${String(data.queueId)} · Tenant #${String(data.tenantId)} ·
          Angefordert von ${data.requestedByName ?? 'Unbekannt'} am ${requestedDate}
        </p>
        <a href="/tenant-deletion-status" class="btn btn-warning mt-3">
          <i class="fas fa-external-link-alt mr-2"></i>
          Details anzeigen
        </a>
      </div>
    </div>
  `;
  setHTML(container, bannerHtml);

  // Make sure container is visible
  container.classList.remove('u-hidden');
}

/**
 * Hide the pending deletion banner
 */
export function hidePendingDeletionBanner(): void {
  const container = document.querySelector<HTMLElement>('#pendingDeletionBanner');
  if (container === null) return;

  setHTML(container, '');
  container.classList.add('u-hidden');
}

/**
 * Hide the delete tenant button when deletion is already pending
 */
export function hideDeleteButton(): void {
  const button = document.querySelector<HTMLElement>('[data-action="show-delete-modal"]');
  if (button === null) return;

  button.classList.add('u-hidden');
}

/**
 * Show the delete tenant button when no deletion is pending
 */
export function showDeleteButton(): void {
  const button = document.querySelector<HTMLElement>('[data-action="show-delete-modal"]');
  if (button === null) return;

  button.classList.remove('u-hidden');
}

/**
 * Show the delete confirmation modal
 */
export function showDeleteModal(): void {
  console.log('[AccountSettings] showDeleteModal() called');
  const modal = document.querySelector('#deleteModal');
  console.log('[AccountSettings] Modal element:', modal);
  console.log('[AccountSettings] Modal classes before:', modal?.className);

  if (modal === null) {
    console.error('[AccountSettings] ERROR: Modal #deleteModal not found!');
    return;
  }

  // Add active class to show modal (Design System uses .modal-overlay--active)
  modal.classList.add('modal-overlay--active');
  console.log('[AccountSettings] Modal classes after:', modal.className);
  console.log('[AccountSettings] Modal should now be visible');

  // Reset form
  const confirmationInput = document.querySelector<HTMLInputElement>('#deleteConfirmation');
  if (confirmationInput !== null) {
    confirmationInput.value = '';
  }

  const confirmBtn = document.querySelector<HTMLButtonElement>('#confirmDeleteBtn');
  if (confirmBtn !== null) {
    confirmBtn.disabled = true;
  }
}

/**
 * Close the delete confirmation modal
 */
export function closeDeleteModal(): void {
  const modal = document.querySelector('#deleteModal');
  if (modal === null) return;

  modal.classList.remove('modal-overlay--active');
}

/**
 * Show the deletion status modal with queue information
 */
export function showDeletionStatusModal(data: DeletionStatusModalData): void {
  const modal = document.querySelector('#deletionStatusModal');
  if (modal === null) return;

  modal.classList.add('modal-overlay--active');

  // Update queue ID
  const queueIdDisplay = document.querySelector('#queueIdDisplay');
  if (queueIdDisplay !== null) {
    queueIdDisplay.textContent = String(data.queueId);
  }

  // Update tenant ID
  const tenantIdDisplay = document.querySelector('#tenantIdDisplay');
  if (tenantIdDisplay !== null) {
    tenantIdDisplay.textContent = String(data.tenantId);
  }

  // Calculate and display scheduled deletion date (30 days from now)
  const scheduledDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const scheduledDateDisplay = document.querySelector('#scheduledDateDisplay');
  if (scheduledDateDisplay !== null) {
    scheduledDateDisplay.textContent = scheduledDate.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

/**
 * Close the deletion status modal
 */
export function closeDeletionStatusModal(): void {
  const modal = document.querySelector('#deletionStatusModal');
  if (modal === null) return;

  modal.classList.remove('modal-overlay--active');
}

/**
 * Update delete button state (loading/normal)
 */
export function setDeleteButtonLoading(loading: boolean): void {
  const confirmBtn = document.querySelector<HTMLButtonElement>('#confirmDeleteBtn');
  if (confirmBtn === null) return;

  confirmBtn.disabled = loading;

  if (loading) {
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Lösche...';
  } else {
    confirmBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Endgültig löschen';
  }
}

/**
 * Check if delete confirmation input is valid
 * @returns true if user entered "LÖSCHEN"
 */
export function isDeleteConfirmationValid(): boolean {
  const input = document.querySelector<HTMLInputElement>('#deleteConfirmation');
  return input !== null && input.value === 'LÖSCHEN';
}

/**
 * Get delete reason from textarea
 */
export function getDeleteReason(): string {
  const textarea = document.querySelector<HTMLTextAreaElement>('#deleteReason');
  return textarea?.value ?? '';
}

/**
 * Update confirm button disabled state based on confirmation input
 */
export function updateConfirmButtonState(input: HTMLInputElement): void {
  const confirmBtn = document.querySelector<HTMLButtonElement>('#confirmDeleteBtn');
  if (confirmBtn === null) return;

  confirmBtn.disabled = input.value !== 'LÖSCHEN';
}
