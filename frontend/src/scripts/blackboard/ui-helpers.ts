/* eslint-disable max-lines */
/**
 * Blackboard UI Helper Functions
 * UI utilities for modals, attachments, zoom/fullscreen, and direct attach
 */

import type { BlackboardAttachment, DirectAttachHandlers } from './types';
import { ApiClient } from '../../utils/api-client';
import { $$id, setHTML } from '../../utils/dom-utils';
import { showSuccess, showError } from '../auth';
import { escapeHtml } from '../common';
import { closeModal as dashboardCloseModal } from '../dashboard/common';

// Import the MIME_TYPE_PDF constant
const PDF_MIME_TYPE = 'application/pdf';
const FULLSCREEN_CLASS = 'fullscreen-mode';

// Store event handlers globally to avoid duplicates
export const directAttachHandlers: DirectAttachHandlers = {};

// Global variables for direct attachment
export let directAttachmentFile: File | null = null;

// Global variables for zoom and fullscreen
export let currentZoom = 100;
export let fullscreenAutoRefreshInterval: ReturnType<typeof setInterval> | null = null;

// Initialize API client - used in saveDirectAttachment
// @ts-expect-error TS6133 - false positive, actually used in saveDirectAttachment line 600
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Actually used in saveDirectAttachment on line 600 in conditional v2 API block
const apiClient = ApiClient.getInstance();

// Modal helper functions to handle different implementations
export function openModal(modalId: string): void {
  console.log('[Blackboard] openModal called with modalId:', modalId);
  const modal = $$id(modalId);
  console.log('[Blackboard] Modal element found:', modal);
  if (!modal) {
    console.error('[Blackboard] Modal not found:', modalId);
    return;
  }

  console.log('[Blackboard] Modal classList:', modal.classList.toString());
  console.log('[Blackboard] window.showModal exists:', typeof window.showModal);

  // Check if it's the new modal style (class="modal")
  if (modal.classList.contains('modal') && typeof window.showModal === 'function') {
    console.log('[Blackboard] Using window.showModal');
    window.showModal(modalId);
  }
  // Check if it's the old modal style (class="modal-overlay")
  else if (modal.classList.contains('modal-overlay')) {
    // Use the original dashboard modal behavior
    modal.classList.remove('u-hidden'); // Remove u-hidden class first
    modal.style.display = 'flex'; // Add display flex for modal-overlay
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  // Try DashboardUI if available
  else if (typeof window.DashboardUI?.openModal === 'function') {
    window.DashboardUI.openModal(modalId);
  }
  // Fallback implementation
  else {
    modal.classList.remove('u-hidden'); // Remove u-hidden for fallback too
    modal.style.display = 'flex';
    setTimeout(() => {
      modal.classList.add('active');
    }, 10);
  }
}

export function closeModal(modalId: string): void {
  const modal = $$id(modalId);
  if (!modal) return;

  // Check if it's the new modal style (class="modal")
  if (modal.classList.contains('modal') && typeof window.hideModal === 'function') {
    window.hideModal(modalId);
  }
  // Check if it's the old modal style (class="modal-overlay")
  else if (modal.classList.contains('modal-overlay')) {
    // Use the original dashboard modal behavior
    modal.style.opacity = '0';
    modal.style.visibility = 'hidden';
    modal.classList.remove('active');
    modal.classList.add('u-hidden'); // Re-add u-hidden class
    document.body.style.overflow = '';
  }
  // Try DashboardUI if available
  else if (typeof window.DashboardUI?.closeModal === 'function') {
    window.DashboardUI.closeModal(modalId);
  }
  // Use imported function as fallback
  else {
    dashboardCloseModal(modalId);
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // eslint-disable-next-line security/detect-object-injection -- i ist berechneter Index (0-2), basiert auf Math.log(), kein User-Input, 100% sicher
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Helper: Create or get preview modal
function getOrCreatePreviewModal(): HTMLElement {
  const existingModal = document.querySelector('#attachmentPreviewModal');
  if (existingModal !== null) return existingModal as HTMLElement;

  const previewModal = document.createElement('div');
  previewModal.id = 'attachmentPreviewModal';
  previewModal.className = 'modal-overlay';
  previewModal.innerHTML = `
    <div class="modal-container modal-lg">
      <div class="modal-header">
        <h2 id="previewTitle">Vorschau</h2>
        <button type="button" class="modal-close" data-action="close">&times;</button>
      </div>
      <div class="modal-body" id="previewContent" style="overflow: auto; max-height: calc(85vh - 150px); min-height: 400px; padding: 0;">
        <div class="text-center">
          <i class="fas fa-spinner fa-spin fa-3x"></i>
          <p>Lade Vorschau...</p>
        </div>
      </div>
      <div class="modal-footer">
        <a id="downloadLink" class="btn btn-primary" download>
          <i class="fas fa-download"></i> Herunterladen
        </a>
        <button type="button" class="btn btn-secondary" data-action="close">Schließen</button>
      </div>
    </div>
  `;
  document.body.append(previewModal);
  setupCloseButtons();
  return previewModal;
}

/**
 * Setup close buttons for all modals
 */
export function setupCloseButtons(): void {
  // Füge Event-Listener zu allen Elementen mit data-action="close" hinzu
  document.querySelectorAll<HTMLElement>('[data-action="close"]').forEach((button) => {
    button.addEventListener('click', function (this: HTMLElement) {
      // Finde das übergeordnete Modal (both modal-overlay and modal classes)
      const modal = this.closest('.modal-overlay, .modal');
      if (modal) {
        closeModal(modal.id);
      } else {
        console.error('No parent modal found for close button');
      }
    });
  });

  // Schließen beim Klicken außerhalb des Modal-Inhalts
  document.querySelectorAll<HTMLElement>('.modal-overlay, .modal').forEach((modal) => {
    modal.addEventListener('click', (event: MouseEvent) => {
      // Nur schließen, wenn der Klick auf den Modal-Hintergrund erfolgt (nicht auf den Inhalt)
      if (event.target === modal) {
        closeModal(modal.id);
      }
    });
  });
}

// Helper: Setup download link
function setupDownloadLink(attachmentId: number, fileName: string): void {
  const downloadLink = $$id('downloadLink') as HTMLAnchorElement | null;
  if (downloadLink === null) return;

  const endpoint = `/blackboard/attachments/${attachmentId}?download=true`;

  downloadLink.href = `/api/v2${endpoint}`;
  downloadLink.setAttribute('download', fileName);
  downloadLink.dataset.action = 'download-attachment';
  downloadLink.dataset.attachmentId = attachmentId.toString();
  downloadLink.dataset.filename = fileName;
  downloadLink.dataset.endpoint = endpoint;
}

// Helper: Display image preview
async function displayImagePreview(
  endpoint: string,
  fileName: string,
  previewContent: HTMLElement,
  previewModal: HTMLElement,
): Promise<void> {
  const response = await fetch(`/api/v2${endpoint}`, { credentials: 'same-origin' });
  if (!response.ok) throw new Error('Failed to load image');

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  previewContent.innerHTML = '';
  const centerDiv = document.createElement('div');
  centerDiv.className = 'text-center';
  const img = document.createElement('img');
  img.src = blobUrl;
  img.alt = fileName;
  img.style.cssText = 'max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);';
  centerDiv.append(img);
  previewContent.append(centerDiv);

  // Clean up blob URL when modal is closed
  const closeButtons = previewModal.querySelectorAll('[data-action="close"]');
  closeButtons.forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        URL.revokeObjectURL(blobUrl);
      },
      { once: true },
    );
  });
}

// Helper: Display PDF preview
async function displayPDFPreview(
  endpoint: string,
  attachmentUrl: string,
  previewContent: HTMLElement,
  previewModal: HTMLElement,
): Promise<void> {
  const response = await fetch(`/api/v2${endpoint}`, { credentials: 'same-origin' });
  if (!response.ok) throw new Error('Failed to load PDF');

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  setHTML(
    previewContent,
    `
      <div style="width: 100%; height: 100%; background: #525659; display: flex; align-items: center; justify-content: center; overflow: hidden;">
        <iframe src="${blobUrl}#zoom=100"
                style="width: calc(100% + 40px); height: 100%; border: none; display: block; margin-left: -20px;"
                allowfullscreen>
        </iframe>
      </div>
    `,
  );

  setTimeout(() => {
    const openButton = $$id('openPdfNewTab') as HTMLButtonElement | null;
    if (openButton !== null) {
      openButton.dataset.action = 'open-pdf-new-tab';
      openButton.dataset.attachmentUrl = attachmentUrl;
    }
  }, 100);

  const closeButtons = previewModal.querySelectorAll('[data-action="close"]');
  closeButtons.forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        URL.revokeObjectURL(blobUrl);
      },
      { once: true },
    );
  });
}

// Helper: Display unsupported file preview
function displayUnsupportedPreview(fileName: string, previewContent: HTMLElement): void {
  previewContent.innerHTML = '';
  const unsupportedDiv = document.createElement('div');
  unsupportedDiv.className = 'text-center';
  unsupportedDiv.style.padding = '40px';

  const icon = document.createElement('i');
  icon.className = 'fas fa-file fa-5x';
  icon.style.cssText = 'color: var(--text-secondary); margin-bottom: 20px;';

  const p1 = document.createElement('p');
  p1.textContent = 'Vorschau für diesen Dateityp nicht verfügbar.';

  const p2 = document.createElement('p');
  p2.className = 'text-muted';
  p2.textContent = fileName;

  unsupportedDiv.append(icon, p1, p2);
  previewContent.append(unsupportedDiv);
}

/**
 * Preview attachment in modal
 */
export async function previewAttachment(attachmentId: number, mimeType: string, fileName: string): Promise<void> {
  console.info(`[Blackboard] previewAttachment called:`, { attachmentId, mimeType, fileName });

  const previewModal = getOrCreatePreviewModal();

  // Show modal
  previewModal.style.display = 'flex';
  previewModal.classList.add('active');
  previewModal.style.opacity = '1';
  previewModal.style.visibility = 'visible';

  // Update title
  const titleElement = document.querySelector('#previewTitle');
  if (titleElement !== null) titleElement.textContent = `Vorschau: ${fileName}`;

  setupDownloadLink(attachmentId, fileName);

  const previewContent = document.querySelector<HTMLElement>('#previewContent');
  if (previewContent === null) return;

  try {
    const endpoint = `/blackboard/attachments/${attachmentId}`;
    const attachmentUrl = `/api/v2${endpoint}`;

    if (mimeType.startsWith('image/')) {
      await displayImagePreview(endpoint, fileName, previewContent, previewModal);
    } else if (mimeType === PDF_MIME_TYPE) {
      await displayPDFPreview(endpoint, attachmentUrl, previewContent, previewModal);
    } else {
      displayUnsupportedPreview(fileName, previewContent);
    }
  } catch (error) {
    console.error('Error loading preview:', error);
    previewContent.innerHTML = `
      <div class="text-center" style="padding: 40px;">
        <i class="fas fa-exclamation-circle fa-3x" style="color: var(--danger-color); margin-bottom: 20px;"></i>
        <p>Fehler beim Laden der Vorschau.</p>
      </div>
    `;
  }
}

/**
 * Open direct attachment modal
 */
export function openDirectAttachModal(): void {
  console.info('[DirectAttach] Opening modal');
  const modal = document.querySelector('#directAttachModal');
  if (!modal) return;

  // Reset form
  const form = $$id('directAttachForm') as HTMLFormElement | null;
  if (form) form.reset();

  // Reset file input and global file
  const fileInput = $$id('directAttachInput') as HTMLInputElement | null;
  if (fileInput) {
    console.info('[DirectAttach] Resetting file input');
    fileInput.value = '';
  }
  directAttachmentFile = null;

  // Hide preview
  const preview = document.querySelector('#directAttachPreview');
  if (preview) preview.classList.add('d-none');

  // Reset size selection
  document.querySelectorAll('.size-option').forEach((btn) => {
    btn.classList.remove('active');
  });
  const mediumButton = document.querySelector('.size-option[data-size="medium"]');
  if (mediumButton) {
    mediumButton.classList.add('active');
    console.info('[DirectAttach] Set medium size as active');
  }

  // Show modal first
  openModal('directAttachModal');

  // Setup file upload handlers after modal is shown
  setTimeout(() => {
    setupDirectAttachHandlers();
  }, 100);
}

function removeOldDirectAttachHandlers(dropZone: HTMLElement, fileInput: HTMLInputElement): void {
  if (directAttachHandlers.dropZoneClick) {
    dropZone.removeEventListener('click', directAttachHandlers.dropZoneClick);
  }
  if (directAttachHandlers.fileInputChange) {
    fileInput.removeEventListener('change', directAttachHandlers.fileInputChange);
  }
  if (directAttachHandlers.dragOver) {
    dropZone.removeEventListener('dragover', directAttachHandlers.dragOver);
  }
  if (directAttachHandlers.dragLeave) {
    dropZone.removeEventListener('dragleave', directAttachHandlers.dragLeave);
  }
  if (directAttachHandlers.drop) {
    dropZone.removeEventListener('drop', directAttachHandlers.drop);
  }
}

function createDirectAttachHandlers(dropZone: HTMLElement, fileInput: HTMLInputElement): void {
  directAttachHandlers.dropZoneClick = () => {
    console.info('[DirectAttach] Drop zone clicked');
    fileInput.click();
  };

  directAttachHandlers.fileInputChange = (event: Event) => {
    const target = event.target as HTMLInputElement | null;
    console.info('[DirectAttach] File input changed:', target?.files?.length);
    if (target?.files?.[0]) {
      handleDirectAttachFile(target.files[0]);
    }
  };

  directAttachHandlers.dragOver = (event: DragEvent) => {
    event.preventDefault();
    dropZone.style.borderColor = 'rgba(0, 142, 255, 0.5)';
    dropZone.style.background = 'rgba(0, 142, 255, 0.05)';
  };

  directAttachHandlers.dragLeave = () => {
    dropZone.style.borderColor = 'rgba(255,255,255,0.3)';
    dropZone.style.background = 'transparent';
  };

  directAttachHandlers.drop = (event: DragEvent) => {
    event.preventDefault();
    dropZone.style.borderColor = 'rgba(255,255,255,0.3)';
    dropZone.style.background = 'transparent';

    if (event.dataTransfer?.files[0]) {
      console.info('[DirectAttach] File dropped:', event.dataTransfer.files[0].name);
      handleDirectAttachFile(event.dataTransfer.files[0]);
    }
  };
}

function attachDirectAttachListeners(dropZone: HTMLElement, fileInput: HTMLInputElement): void {
  if (
    !directAttachHandlers.dropZoneClick ||
    !directAttachHandlers.fileInputChange ||
    !directAttachHandlers.dragOver ||
    !directAttachHandlers.dragLeave ||
    !directAttachHandlers.drop
  ) {
    return;
  }

  dropZone.addEventListener('click', directAttachHandlers.dropZoneClick);
  fileInput.addEventListener('change', directAttachHandlers.fileInputChange);
  dropZone.addEventListener('dragover', directAttachHandlers.dragOver);
  dropZone.addEventListener('dragleave', directAttachHandlers.dragLeave);
  dropZone.addEventListener('drop', directAttachHandlers.drop);
}

function setupSizeSelectionHandlers(): void {
  document.querySelectorAll('.size-option').forEach((btn) => {
    btn.addEventListener('click', function (this: HTMLElement) {
      console.info('[DirectAttach] Size button clicked:', this.dataset.size);
      document.querySelectorAll('.size-option').forEach((b) => {
        b.classList.remove('active');
      });
      this.classList.add('active');
    });
  });
}

/**
 * Setup direct attachment handlers
 */
export function setupDirectAttachHandlers(): void {
  console.info('[DirectAttach] Setting up handlers');
  const dropZone = $$id('directAttachDropZone');
  const fileInput = $$id('directAttachInput') as HTMLInputElement | null;
  const saveBtn = $$id('saveDirectAttachBtn') as HTMLButtonElement | null;

  if (!dropZone || !fileInput) {
    console.error('[DirectAttach] Missing required elements');
    return;
  }

  removeOldDirectAttachHandlers(dropZone, fileInput);
  createDirectAttachHandlers(dropZone, fileInput);
  attachDirectAttachListeners(dropZone, fileInput);
  setupSizeSelectionHandlers();

  // Save button handler
  if (saveBtn) {
    saveBtn.dataset.action = 'save-direct-attachment';
  }
}

/**
 * Handle direct attachment file selection
 */
export function handleDirectAttachFile(file: File): void {
  console.info('[DirectAttach] handleDirectAttachFile called with:', file.name, file.type, file.size);

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', PDF_MIME_TYPE];
  if (!allowedTypes.includes(file.type)) {
    showError('Nur JPG, PNG und PDF Dateien sind erlaubt');
    return;
  }

  // Validate file size (10MB)
  if (file.size > 10 * 1024 * 1024) {
    showError('Die Datei darf maximal 10 MB groß sein');
    return;
  }

  // Store the file globally
  directAttachmentFile = file;
  console.info('[DirectAttach] File stored globally');

  // Show preview
  const preview = document.querySelector('#directAttachPreview');
  const previewImage = document.querySelector('#previewImage');
  const fileName = document.querySelector('#previewFileName');
  const fileSize = document.querySelector('#previewFileSize');

  if (!preview || !previewImage || !fileName || !fileSize) return;

  preview.classList.remove('d-none');
  fileName.textContent = file.name;
  fileSize.textContent = formatFileSize(file.size);

  // Set title from filename if empty
  const titleInput = $$id('directAttachTitle') as HTMLInputElement | null;
  if (titleInput && titleInput.value.length === 0) {
    titleInput.value = file.name.replace(/\.[^./]+$/, ''); // Remove extension
  }

  // Show preview based on file type
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      // Create img element safely to prevent XSS
      previewImage.innerHTML = '';

      const img = document.createElement('img');
      img.src = e.target?.result as string;
      img.alt = file.name;
      img.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain;';
      previewImage.append(img);
    };
    reader.readAsDataURL(file);
  } else if (file.type === PDF_MIME_TYPE) {
    previewImage.innerHTML = `<i class="fas fa-file-pdf" style="font-size: 64px; color: #dc3545;"></i>`;
  }
}

/**
 * Clear direct attachment
 */
export function clearDirectAttachment(): void {
  console.info('[DirectAttach] Clearing attachment');
  const fileInput = $$id('directAttachInput') as HTMLInputElement | null;
  const preview = document.querySelector('#directAttachPreview');

  if (fileInput) fileInput.value = '';
  if (preview) preview.classList.add('d-none');

  // Clear global file
  directAttachmentFile = null;
}

function buildDirectAttachFormData(
  file: File,
  title: string,
  size: string,
  orgLevelSelect: HTMLSelectElement | null,
  prioritySelect: HTMLSelectElement | null,
): FormData {
  const formData = new FormData();
  formData.append('title', title);
  formData.append('content', `[Attachment:${size}]`); // Special content format
  formData.append('org_level', orgLevelSelect?.value ?? 'company');
  formData.append('org_id', '1'); // TODO: Get actual org_id based on level
  formData.append('priority_level', prioritySelect?.value ?? 'normal');
  formData.append('color', 'white'); // White background for images
  formData.append('tags', 'attachment,image');
  formData.append('attachment', file);
  return formData;
}

async function submitDirectAttachment(formData: FormData): Promise<void> {
  const token = localStorage.getItem('token');
  if (token === null || token.length === 0) {
    showError('Keine Authentifizierung gefunden');
    return;
  }

  const apiClient = ApiClient.getInstance();
  const endpoint = '/blackboard/entries';

  try {
    await apiClient.request(
      endpoint,
      {
        method: 'POST',
        body: formData,
      },
      { version: 'v2', contentType: '' },
    );
  } catch (error) {
    throw new Error((error as { message?: string }).message ?? 'Fehler beim Speichern');
  }
}

function resetDirectAttachForm(): void {
  const form = $$id('directAttachForm') as HTMLFormElement | null;
  if (form) form.reset();

  const fileInput = $$id('directAttachInput') as HTMLInputElement | null;
  if (fileInput) fileInput.value = '';

  const preview = $$id('directAttachPreview');
  if (preview) preview.classList.add('d-none');
}

/**
 * Save direct attachment
 */
export async function saveDirectAttachment(): Promise<void> {
  console.info('[DirectAttach] saveDirectAttachment called');
  console.info('[DirectAttach] Global file:', directAttachmentFile?.name ?? 'none');

  const titleInput = $$id('directAttachTitle') as HTMLInputElement | null;
  const orgLevelSelect = $$id('directAttachOrgLevel') as HTMLSelectElement | null;
  const prioritySelect = $$id('directAttachPriority') as HTMLSelectElement | null;
  const sizeOption = document.querySelector<HTMLElement>('.size-option.active');

  console.info('[DirectAttach] Elements found:', {
    globalFile: directAttachmentFile?.name ?? 'none',
    titleInput: !!titleInput,
    orgLevelSelect: !!orgLevelSelect,
    prioritySelect: !!prioritySelect,
    sizeOption: sizeOption?.dataset.size ?? 'none',
  });

  if (!directAttachmentFile) {
    console.error('[DirectAttach] No file in global variable');
    showError('Bitte wählen Sie eine Datei aus');
    return;
  }

  const file = directAttachmentFile;
  const title = titleInput?.value ?? file.name.replace(/\.[^./]+$/, '');
  const size = sizeOption?.dataset.size ?? 'medium';

  const formData = buildDirectAttachFormData(file, title, size, orgLevelSelect, prioritySelect);

  // Clear before async operation to avoid race condition
  directAttachmentFile = null;

  try {
    await submitDirectAttachment(formData);

    showSuccess('Datei erfolgreich angeheftet!');
    closeModal('directAttachModal');
    resetDirectAttachForm();

    // Trigger reload via custom event
    window.dispatchEvent(new CustomEvent('reloadBlackboardEntries'));
  } catch (error) {
    console.error('Error saving direct attachment:', error);
    showError(error instanceof Error ? error.message : 'Fehler beim Speichern');
  }
}

/**
 * Setup zoom controls for the blackboard
 */
export function setupZoomControls(): void {
  const zoomInBtn = document.querySelector('#zoomInBtn');
  const zoomOutBtn = document.querySelector('#zoomOutBtn');
  const zoomLevelDisplay = document.querySelector('#zoomLevel');
  const blackboardContainer = document.querySelector<HTMLElement>('#blackboardContainer');

  if (!zoomInBtn || !zoomOutBtn || !zoomLevelDisplay || !blackboardContainer) {
    console.error('[Zoom] Required elements not found');
    return;
  }

  // Zoom in
  zoomInBtn.addEventListener('click', () => {
    if (currentZoom < 200) {
      currentZoom += 10;
      blackboardContainer.style.zoom = `${currentZoom}%`;
      zoomLevelDisplay.textContent = `${currentZoom}%`;
    }
  });

  // Zoom out
  zoomOutBtn.addEventListener('click', () => {
    if (currentZoom > 50) {
      currentZoom -= 10;
      blackboardContainer.style.zoom = `${currentZoom}%`;
      zoomLevelDisplay.textContent = `${currentZoom}%`;
    }
  });
}

/**
 * Setup fullscreen controls
 */
export function setupFullscreenControls(): void {
  const fullscreenBtn = document.querySelector('#fullscreenBtn');
  const blackboardContainer = document.querySelector('#blackboardContainer');

  if (!fullscreenBtn || !blackboardContainer) {
    console.error('[Fullscreen] Required elements not found');
    return;
  }

  // Enter fullscreen
  fullscreenBtn.addEventListener('click', (_e) => {
    void (async () => {
      try {
        // Add fullscreen mode class to body
        document.body.classList.add(FULLSCREEN_CLASS);

        // Request fullscreen - check for browser compatibility
        const elem = document.documentElement as Document['documentElement'] & {
          webkitRequestFullscreen?: () => Promise<void>;
          msRequestFullscreen?: () => Promise<void>;
        };

        if ('requestFullscreen' in document.documentElement) {
          await document.documentElement.requestFullscreen();
        } else if (elem.webkitRequestFullscreen !== undefined) {
          await elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen !== undefined) {
          await elem.msRequestFullscreen();
        }

        // Start auto-refresh (every 60 minutes)
        startAutoRefresh();

        // Update button icon
        const icon = fullscreenBtn.querySelector('i');
        if (icon) {
          icon.classList.remove('fa-expand');
          icon.classList.add('fa-compress');
        }
      } catch (error) {
        console.error('[Fullscreen] Error entering fullscreen:', error);
        document.body.classList.remove(FULLSCREEN_CLASS);
      }
    })();
  });

  // Handle ESC key or browser exit fullscreen
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange);

  // ESC key handler
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains(FULLSCREEN_CLASS)) {
      exitFullscreen();
    }
  });
}

/**
 * Handle fullscreen state changes
 */
function handleFullscreenChange(): void {
  const isFullscreen = !!(
    document.fullscreenElement ??
    (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement ??
    (document as Document & { mozFullScreenElement?: Element }).mozFullScreenElement ??
    (document as Document & { msFullscreenElement?: Element }).msFullscreenElement
  );

  if (!isFullscreen) {
    // User exited fullscreen
    document.body.classList.remove(FULLSCREEN_CLASS);
    stopAutoRefresh();

    // Reset button icon
    const fullscreenBtn = document.querySelector('#fullscreenBtn');
    if (fullscreenBtn) {
      const icon = fullscreenBtn.querySelector('i');
      if (icon) {
        icon.classList.remove('fa-compress');
        icon.classList.add('fa-expand');
      }
    }
  }
}

/**
 * Exit fullscreen mode
 */
export function exitFullscreen(): void {
  // Check for browser compatibility
  const doc = document as Document & {
    webkitExitFullscreen?: () => void;
    mozCancelFullScreen?: () => void;
    msExitFullscreen?: () => void;
  };

  if ('exitFullscreen' in document) {
    void document.exitFullscreen();
  } else if (doc.webkitExitFullscreen !== undefined) {
    doc.webkitExitFullscreen();
  } else if (doc.mozCancelFullScreen !== undefined) {
    doc.mozCancelFullScreen();
  } else if (doc.msExitFullscreen !== undefined) {
    doc.msExitFullscreen();
  }

  document.body.classList.remove(FULLSCREEN_CLASS);
  stopAutoRefresh();
}

/**
 * Start auto-refresh in fullscreen mode
 */
function startAutoRefresh(): void {
  // Initial load
  window.dispatchEvent(new CustomEvent('reloadBlackboardEntries'));

  // Set up interval for 60 minutes (3600000 ms)
  fullscreenAutoRefreshInterval = setInterval(() => {
    console.info('[AutoRefresh] Reloading entries...');
    window.dispatchEvent(new CustomEvent('reloadBlackboardEntries'));
  }, 3600000); // 60 minutes

  // Update indicator text
  const indicator = document.querySelector('.auto-refresh-indicator');
  if (indicator) {
    indicator.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Auto-Refresh: 60 Min';
  }
}

/**
 * Stop auto-refresh
 */
function stopAutoRefresh(): void {
  if (fullscreenAutoRefreshInterval) {
    clearInterval(fullscreenAutoRefreshInterval);
    fullscreenAutoRefreshInterval = null;
  }
}

export async function openPdfInNewTab(attachmentUrl: string): Promise<void> {
  try {
    const resp = await fetch(attachmentUrl, {
      credentials: 'same-origin',
    });
    const fileBlob = await resp.blob();
    const url = URL.createObjectURL(fileBlob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.error('Error opening PDF in new tab:', error);
    showError('Fehler beim Öffnen der PDF');
  }
}

// Helper: Build attachment item HTML
export function buildAttachmentItem(att: BlackboardAttachment): string {
  const isPDF = att.mime_type === PDF_MIME_TYPE;
  const iconClass = isPDF ? 'fa-file-pdf' : 'fa-file-image';

  return `
    <div class="entry-attachment-item"
         data-attachment-id="${att.id}"
         data-mime-type="${att.mime_type}"
         data-filename="${escapeHtml(att.original_name)}"
         style="cursor: pointer;"
         title="Vorschau: ${escapeHtml(att.original_name)}"
         data-action="preview-attachment-link">
      <i class="fas ${iconClass}"></i>
      <span>${escapeHtml(att.original_name)}</span>
      <span class="attachment-size">(${formatFileSize(att.file_size)})</span>
    </div>
  `;
}

// Helper: Build attachments section HTML
export function buildAttachmentsSection(attachments: BlackboardAttachment[], entryId: number): string {
  if (attachments.length === 0) return '';

  const attachmentItems = attachments.map((att) => buildAttachmentItem(att)).join('');

  return `
    <div class="entry-attachments">
      <h4 class="entry-attachments-title">
        <i class="fas fa-paperclip"></i> Anhänge (${attachments.length})
      </h4>
      <div class="entry-attachment-list" id="attachment-list-${entryId}">
        ${attachmentItems}
      </div>
    </div>
  `;
}

// Helper: Setup attachment click handlers
export function setupAttachmentHandlers(entryId: number, attachments: BlackboardAttachment[]): void {
  if (attachments.length === 0) return;

  setTimeout(() => {
    const attachmentList = document.querySelector(`#attachment-list-${entryId}`);
    if (attachmentList === null) {
      console.error('[Blackboard] Attachment list not found!');
      return;
    }

    const attachmentItems = attachmentList.querySelectorAll('.entry-attachment-item');
    console.info(`[Blackboard] Found ${attachmentItems.length} attachment items`);

    attachmentItems.forEach((item) => {
      const htmlItem = item as HTMLElement;
      const attachmentId = Number.parseInt(htmlItem.dataset.attachmentId ?? '0', 10);

      htmlItem.dataset.action = 'preview-attachment-item';
      htmlItem.dataset.attachmentId = attachmentId.toString();
      htmlItem.style.cursor = 'pointer';
    });
  }, 100);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
