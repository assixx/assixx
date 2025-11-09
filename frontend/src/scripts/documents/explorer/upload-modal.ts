/**
 * Documents Explorer - Upload Modal Module
 *
 * Handles document upload modal for admin/root users
 * Integrates with existing File Upload component from Design System
 *
 * @module explorer/upload-modal
 * @requires isAdmin from auth-helpers
 */

import { isAdmin } from '../../../utils/auth-helpers';
import { stateManager } from './state';
import { documentAPI } from './api';
import type { UploadFormData } from './types';

/**
 * Upload Modal Manager
 * Manages document upload form and submission
 */
class UploadModalManager {
  private modalEl: HTMLElement | null = null;
  private formEl: HTMLFormElement | null = null;
  private fileInput: HTMLInputElement | null = null;
  private recipientTypeInputs: NodeListOf<HTMLInputElement> | null = null;
  private categorySelect: HTMLInputElement | null = null; // Hidden input controlled by dropdown
  private submitBtn: HTMLButtonElement | null = null;
  private closeBtn: HTMLButtonElement | null = null;

  /**
   * Initialize upload modal
   */
  public init(): void {
    // Only initialize for admin/root users
    if (!isAdmin()) {
      return;
    }

    // Show upload button for admin/root users
    const uploadBtn = document.getElementById('upload-btn');
    if (uploadBtn) {
      uploadBtn.classList.remove('hidden');
      uploadBtn.addEventListener('click', () => {
        this.open();
      });
    }

    this.modalEl = document.getElementById('upload-modal');

    if (!this.modalEl) {
      console.error('Upload modal not found');
      return;
    }

    // IMPORTANT: We use the HTML from documents-explorer.html, not renderModalContent()
    // Commenting out to preserve our Storybook-based design
    // this.renderModalContent();

    // Get form elements from existing HTML
    this.formEl = this.modalEl.querySelector('#upload-form');

    // Get elements with updated IDs matching our new HTML
    const fileInput = this.modalEl.querySelector<HTMLInputElement>('#file-input');
    if (!fileInput) {
      console.error('File input not found');
      return;
    }
    this.fileInput = fileInput;

    // Update to use 'visibility' instead of 'recipientType' for our new design
    this.recipientTypeInputs = this.modalEl.querySelectorAll('input[name="visibility"]');

    // We don't have recipient-id-select in new design - commenting out
    // const recipientIdSelect = this.modalEl.querySelector<HTMLSelectElement>('#recipient-id-select');
    // if (!recipientIdSelect) {
    //   console.error('Recipient ID select not found');
    //   return;
    // }
    // this.recipientIdSelect = recipientIdSelect;

    // Category is now a hidden input controlled by dropdown
    const categorySelect = this.modalEl.querySelector<HTMLInputElement>('#category-input');
    if (!categorySelect) {
      console.error('Category input not found');
      // Don't return - continue initialization
    }
    this.categorySelect = categorySelect;

    // Year and Month selects don't exist in new design - commenting out
    // const yearSelect = this.modalEl.querySelector<HTMLSelectElement>('#year-select');
    // if (!yearSelect) {
    //   console.error('Year select not found');
    //   return;
    // }
    // this.yearSelect = yearSelect;

    // const monthSelect = this.modalEl.querySelector<HTMLSelectElement>('#month-select');
    // if (!monthSelect) {
    // console.error('Month select not found');
    // return;
    // }
    // this.monthSelect = monthSelect;

    const submitBtn = this.modalEl.querySelector<HTMLButtonElement>('#upload-submit');
    if (!submitBtn) {
      console.error('Submit button not found');
      return;
    }
    this.submitBtn = submitBtn;

    const closeBtn = this.modalEl.querySelector<HTMLButtonElement>('#upload-close');
    if (!closeBtn) {
      console.error('Close button not found');
      return;
    }
    this.closeBtn = closeBtn;

    // Attach event listeners
    this.attachEventListeners();

    // Setup drag and drop for upload zone
    this.setupDragAndDrop();

    // Setup custom dropdown for category selection
    this.setupCustomDropdown();
  }

  // NOTE: The renderModalContent and related methods have been removed
  // We now use the HTML directly from documents-explorer.html instead of dynamic rendering
  // This improves performance and maintainability by keeping HTML in one place

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.modalEl) return;

    // Close buttons
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => {
        this.close();
      });
    }

    const cancelBtn = this.modalEl.querySelector('#upload-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.close();
      });
    }

    // Close on overlay click
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalEl && !this.modalEl.classList.contains('hidden')) {
        this.close();
      }
    });

    // File input change
    if (this.fileInput) {
      this.fileInput.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          this.handleFileSelected(file);
        }
      });
    }

    // File remove
    const fileRemoveBtn = this.modalEl.querySelector('#file-remove');
    if (fileRemoveBtn) {
      fileRemoveBtn.addEventListener('click', () => {
        this.clearFileSelection();
      });
    }

    // Recipient type change
    if (this.recipientTypeInputs) {
      this.recipientTypeInputs.forEach((input) => {
        input.addEventListener('change', () => {
          this.handleRecipientTypeChange();
        });
      });
    }

    // Form submission
    if (this.formEl) {
      this.formEl.addEventListener('submit', (e) => {
        e.preventDefault();
        // Use void operator for fire-and-forget async call
        void this.handleSubmit();
      });
    }

    // Submit button (alternative to form submit)
    if (this.submitBtn) {
      this.submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Use void operator for fire-and-forget async call
        void this.handleSubmit();
      });
    }
  }

  /**
   * Handle file selected
   */
  private handleFileSelected(file: File): void {
    // Validate file type - allow multiple formats as per HTML
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
    ];

    if (!allowedTypes.includes(file.type)) {
      alert('Nur PDF, Word, Excel, JPG und PNG Dateien sind erlaubt!');
      this.clearFileSelection();
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('Datei ist zu groß! Maximale Größe: 5 MB');
      this.clearFileSelection();
      return;
    }

    // Show file preview
    const preview = this.modalEl?.querySelector('#file-preview');
    const fileName = this.modalEl?.querySelector('#file-name');
    const fileSize = this.modalEl?.querySelector('#file-size');

    if (preview && fileName && fileSize) {
      fileName.textContent = file.name;
      fileSize.textContent = this.formatFileSize(file.size);
      preview.classList.remove('hidden');
    }
  }

  /**
   * Clear file selection
   */
  private clearFileSelection(): void {
    if (this.fileInput) {
      this.fileInput.value = '';
    }

    const preview = this.modalEl?.querySelector('#file-preview');
    if (preview) {
      preview.classList.add('hidden');
    }
  }

  /**
   * Handle recipient type change
   */
  private handleRecipientTypeChange(): void {
    const selectedType = Array.from(this.recipientTypeInputs ?? []).find((input) => input.checked)?.value;

    // Update UI based on visibility selection
    // In current design, we don't have recipient selection dropdown
    // The backend will handle recipient based on visibility type

    // Optional: Show/hide additional fields based on visibility
    if (selectedType === 'private') {
      // Personal document - no additional selection needed
      console.log('Private document selected');
    } else if (selectedType === 'team') {
      // Team document - backend will use user's team
      console.log('Team document selected');
    } else if (selectedType === 'department') {
      // Department document - backend will use user's department
      console.log('Department document selected');
    } else if (selectedType === 'company') {
      // Company-wide document
      console.log('Company document selected');
    }
  }

  /**
   * Handle form submission
   */
  private async handleSubmit(): Promise<void> {
    if (!this.fileInput?.files?.[0]) {
      alert('Bitte wählen Sie eine Datei aus!');
      return;
    }

    const formData = this.getFormData();
    if (!formData) {
      return;
    }

    try {
      // Disable submit button
      if (this.submitBtn) {
        this.submitBtn.disabled = true;
        this.submitBtn.textContent = 'Wird hochgeladen...';
      }

      // Use statically imported documentAPI to avoid Vite warning
      await documentAPI.uploadDocument(formData, (progress) => {
        if (this.submitBtn) {
          this.submitBtn.textContent = `Wird hochgeladen... ${progress}%`;
        }
      });

      // Success
      alert('Dokument erfolgreich hochgeladen!');
      this.close();

      // Refresh documents list (not async)
      stateManager.refreshDocuments();
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Fehler beim Hochladen. Bitte versuchen Sie es erneut.');
    } finally {
      // Re-enable submit button
      if (this.submitBtn) {
        this.submitBtn.disabled = false;
        this.submitBtn.textContent = 'Hochladen';
      }
    }
  }

  /**
   * Get form data
   */
  private getFormData(): UploadFormData | null {
    if (!this.fileInput?.files?.[0]) {
      return null;
    }

    // Get visibility/recipientType from radio buttons
    const selectedType = Array.from(this.recipientTypeInputs ?? []).find((input) => input.checked)?.value as
      | 'private'
      | 'team'
      | 'department'
      | 'company';

    // Map visibility values to recipientType for API compatibility
    const recipientType = selectedType === 'private' ? 'user' : selectedType;

    // Get category from hidden input (controlled by dropdown)
    const category = this.categorySelect?.value ?? 'general';

    // For now, use current year and month since HTML doesn't have year/month selects
    const now = new Date();
    const year = now.getFullYear();
    const month = category === 'salary' ? now.getMonth() + 1 : null; // Month only for salary docs

    // Simplified: no recipient ID selection in current design
    // Backend will determine recipient based on current user and visibility
    const recipientId = null;

    return {
      file: this.fileInput.files[0],
      recipientType: recipientType,
      recipientId,
      category,
      year,
      month,
    };
  }

  /**
   * Open modal
   */
  public open(): void {
    // Use nullish coalescing assignment to find element if not cached
    this.modalEl ??= document.getElementById('upload-modal');

    if (!this.modalEl) {
      console.error('[Upload Modal] Modal element not found!');
      return;
    }

    // Use Design System pattern - add active class
    this.modalEl.classList.add('modal-overlay--active');

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  /**
   * Close modal
   */
  private close(): void {
    if (!this.modalEl) return;

    // Use Design System pattern - remove active class
    this.modalEl.classList.remove('modal-overlay--active');

    this.clearFileSelection();

    // Reset form
    if (this.formEl) {
      this.formEl.reset();
    }

    // Restore body scroll
    document.body.style.overflow = '';
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'] as const;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    // Clamp index to valid array bounds to prevent object injection
    // While TypeScript knows sizes is an array, ESLint security rule requires explicit bounds checking
    const clampedIndex = Math.max(0, Math.min(i, sizes.length - 1));
    // eslint-disable-next-line security/detect-object-injection -- clampedIndex is clamped to valid array bounds (0 to sizes.length-1)
    const sizeLabel = sizes[clampedIndex];
    return `${Math.round((bytes / Math.pow(k, clampedIndex)) * 100) / 100} ${sizeLabel}`;
  }

  /**
   * Setup drag and drop functionality for upload zone
   */
  private setupDragAndDrop(): void {
    const dropzone = document.getElementById('upload-dropzone');
    if (!dropzone) return;

    // Prevent default drag behaviors - bind the method properly
    const preventDefaults = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
    };

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
      dropzone.addEventListener(eventName, preventDefaults, false);
      document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach((eventName) => {
      dropzone.addEventListener(
        eventName,
        () => {
          dropzone.classList.add('drag-over');
        },
        false,
      );
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropzone.addEventListener(
        eventName,
        () => {
          dropzone.classList.remove('drag-over');
        },
        false,
      );
    });

    // Handle dropped files
    dropzone.addEventListener(
      'drop',
      (e: DragEvent) => {
        if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) return;

        const file = e.dataTransfer.files[0];
        if (this.fileInput) {
          // Create a new FileList with the dropped file
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          this.fileInput.files = dataTransfer.files;

          // Trigger change event to update UI
          const event = new Event('change', { bubbles: true });
          this.fileInput.dispatchEvent(event);
        }
      },
      false,
    );

    // Click to upload
    dropzone.addEventListener('click', () => {
      this.fileInput?.click();
    });
  }

  /**
   * Setup custom dropdown for category selection
   */
  private setupCustomDropdown(): void {
    const dropdownTrigger = document.getElementById('category-dropdown');
    const dropdownMenu = dropdownTrigger?.nextElementSibling as HTMLElement | null;
    const categoryText = document.getElementById('category-text');
    const categoryInput = document.getElementById('category-input') as HTMLInputElement | null;

    if (!dropdownTrigger || !dropdownMenu || !categoryText || !categoryInput) {
      console.error('[Upload Modal] Category dropdown elements not found');
      return;
    }

    // Toggle dropdown on click - using Design System pattern
    dropdownTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropdownMenu.classList.toggle('active');
    });

    // Handle option selection
    const options = dropdownMenu.querySelectorAll('.dropdown__option');
    options.forEach((option) => {
      option.addEventListener('click', () => {
        const value = option.getAttribute('data-value');
        // textContent is never null for HTML elements selected with querySelectorAll
        const text = option.textContent.trim();

        if (value !== null && value !== '') {
          // Update displayed text (remove icon)
          const textOnly = text.replace(/^[^\s]+\s/, ''); // Remove first icon and space
          categoryText.textContent = textOnly;

          // Update hidden input value
          categoryInput.value = value;

          // Close dropdown using Design System pattern
          dropdownMenu.classList.remove('active');
        }
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!dropdownTrigger.contains(e.target as Node) && !dropdownMenu.contains(e.target as Node)) {
        dropdownMenu.classList.remove('active');
      }
    });
  }
}

// Singleton instance
export const uploadModalManager = new UploadModalManager();

// Export type for testing/mocking
export type { UploadModalManager };
