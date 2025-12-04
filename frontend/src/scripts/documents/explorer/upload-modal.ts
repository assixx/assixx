/* eslint-disable max-lines */
/**
 * Documents Explorer - Upload Modal Module (Refactored 2025-01-12)
 *
 * AUTOMATIC VISIBILITY MAPPING:
 * - User selects category → visibility is automatically determined
 * - No manual visibility selection needed
 * - Direct 1:1 mapping: category → access_scope → database
 *
 * @module explorer/upload-modal
 */

import { isAdmin } from '../../../utils/auth-helpers';
import { stateManager } from './state';
import { documentAPI } from './api';
import type { UploadFormData } from './types';
import { showSuccessAlert, showErrorAlert, showWarningAlert } from '../../utils/alerts';

/**
 * Category Mapping Configuration
 * Maps user-facing categories to database access control
 */
interface CategoryMapping {
  accessScope: 'personal' | 'team' | 'department' | 'company' | 'payroll';
  requiresField?: 'team_id' | 'department_id';
  requiresPayrollPeriod?: boolean;
  categoryValue: string; // DB category field value
}

const CATEGORY_MAPPINGS: Record<string, CategoryMapping | undefined> = {
  company: {
    accessScope: 'company',
    categoryValue: 'general', // Backend ENUM: 'personal', 'work', 'training', 'general', 'salary'
  },
  department: {
    accessScope: 'department',
    requiresField: 'department_id',
    categoryValue: 'work', // Backend ENUM
  },
  team: {
    accessScope: 'team',
    requiresField: 'team_id',
    categoryValue: 'work', // Backend ENUM
  },
  personal: {
    accessScope: 'personal',
    categoryValue: 'personal', // Backend ENUM
  },
  payroll: {
    accessScope: 'payroll',
    requiresPayrollPeriod: true,
    categoryValue: 'salary', // Backend ENUM
  },
};

/**
 * User Info Interface
 */
interface User {
  id: number;
  tenant_id: number;
  department_id?: number | null;
  team_id?: number | null;
  role: string;
}

/**
 * File type display info for upload preview
 */
interface FileTypeDisplayInfo {
  cssClass: string;
  iconClass: string;
}

/**
 * Detect file type and return display info (CSS class + icon)
 * Extracted to reduce cognitive complexity in handleFileSelected
 */
function getFileTypeDisplayInfo(mimeType: string, extension: string): FileTypeDisplayInfo {
  // PDF
  if (mimeType === 'application/pdf' || extension === 'pdf') {
    return { cssClass: 'file-upload-item__preview--pdf', iconClass: 'fas fa-file-pdf' };
  }
  // Images
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  if (mimeType.startsWith('image/') || imageExtensions.includes(extension)) {
    return { cssClass: 'file-upload-item__preview--image', iconClass: 'fas fa-file-image' };
  }
  // Word documents
  const wordExtensions = ['doc', 'docx'];
  if (mimeType.includes('word') || wordExtensions.includes(extension)) {
    return { cssClass: 'file-upload-item__preview--word', iconClass: 'fas fa-file-word' };
  }
  // Excel spreadsheets
  const excelExtensions = ['xls', 'xlsx'];
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || excelExtensions.includes(extension)) {
    return { cssClass: 'file-upload-item__preview--excel', iconClass: 'fas fa-file-excel' };
  }
  // Default: generic file
  return { cssClass: '', iconClass: 'fas fa-file' };
}

/**
 * Upload Modal Manager
 */
class UploadModalManager {
  private modalEl: HTMLElement | null = null;
  private formEl: HTMLFormElement | null = null;
  private fileInput: HTMLInputElement | null = null;
  private categoryInput: HTMLInputElement | null = null;
  private submitBtn: HTMLButtonElement | null = null;
  private closeBtn: HTMLButtonElement | null = null;
  private currentUser: User | null = null;

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
        // Use void operator for fire-and-forget async call
        void this.open();
      });
    }

    this.modalEl = document.getElementById('upload-modal');
    if (!this.modalEl) {
      console.error('[Upload Modal] Modal element not found');
      return;
    }

    // Get form elements
    this.formEl = this.modalEl.querySelector('#upload-form');
    this.fileInput = this.modalEl.querySelector('#file-input');
    this.categoryInput = this.modalEl.querySelector('#category-input');
    this.submitBtn = this.modalEl.querySelector('#upload-submit');
    this.closeBtn = this.modalEl.querySelector('#upload-close');

    if (!this.fileInput || !this.categoryInput) {
      console.error('[Upload Modal] Required form elements not found');
      return;
    }

    // Attach event listeners
    this.attachEventListeners();

    // Setup drag and drop
    this.setupDragAndDrop();

    // Setup custom dropdown
    this.setupCustomDropdown();
  }

  /**
   * Get current user info from API
   */
  private async getCurrentUser(): Promise<User | null> {
    if (this.currentUser) {
      return this.currentUser;
    }

    try {
      const token = localStorage.getItem('token');
      if (token === null || token === '') {
        throw new Error('No auth token found');
      }

      const response = await fetch('/api/v2/users/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.status}`);
      }

      const data: unknown = await response.json();

      // Type assertion after fetching - API returns user data in various formats
      this.currentUser = ((data as Record<string, unknown>)['data'] ??
        (data as Record<string, unknown>)['user'] ??
        data) as User;
      return this.currentUser;
    } catch (error) {
      console.error('[Upload Modal] Failed to get user info:', error);
      showErrorAlert('Fehler beim Laden der Benutzerdaten');
      return null;
    }
  }

  /**
   * Validate upload based on category and user data
   */
  /**
   * Validate user has required field for upload
   */
  private validateUserRequiredField(mapping: CategoryMapping, user: User): boolean {
    if (mapping.requiresField === undefined) {
      return true;
    }

    if (mapping.requiresField === 'team_id' && (user.team_id === null || user.team_id === undefined)) {
      showWarningAlert('Sie müssen einem Team zugeordnet sein, um Team-Dokumente hochzuladen!');
      return false;
    }

    if (
      mapping.requiresField === 'department_id' &&
      (user.department_id === null || user.department_id === undefined)
    ) {
      showWarningAlert('Sie müssen einer Abteilung zugeordnet sein, um Abteilungs-Dokumente hochzuladen!');
      return false;
    }

    return true;
  }

  private async validateUpload(category: string, file: File): Promise<boolean> {
    // Safe: CATEGORY_MAPPINGS is Record<string, CategoryMapping | undefined>
    // Invalid keys (including __proto__) return undefined, which we check immediately
    // eslint-disable-next-line security/detect-object-injection
    const mapping = CATEGORY_MAPPINGS[category];
    if (mapping === undefined) {
      showWarningAlert('Bitte wählen Sie eine gültige Kategorie aus!');
      return false;
    }

    // Get user info
    const user = await this.getCurrentUser();
    if (!user) {
      return false;
    }

    // Check if user has required field
    if (!this.validateUserRequiredField(mapping, user)) {
      return false;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      showWarningAlert('Datei ist zu groß! Maximale Größe: 5 MB');
      return false;
    }

    // Validate file type
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
      showWarningAlert('Nur PDF, Word, Excel, JPG und PNG Dateien sind erlaubt!');
      return false;
    }

    return true;
  }

  /**
   * Populate upload data IDs based on access scope
   */
  private populateUploadDataIds(uploadData: UploadFormData, mapping: CategoryMapping, user: User): void {
    switch (mapping.accessScope) {
      case 'personal':
      case 'payroll':
        uploadData.ownerUserId = user.id;
        break;

      case 'team':
        if (user.team_id !== null && user.team_id !== undefined) {
          uploadData.targetTeamId = user.team_id;
        }
        break;

      case 'department':
        if (user.department_id !== null && user.department_id !== undefined) {
          uploadData.targetDepartmentId = user.department_id;
        }
        break;

      case 'company':
        // No specific ID needed - all in tenant
        break;
    }
  }

  /**
   * Add payroll period fields to upload data
   * Returns false if validation fails
   */
  private addPayrollPeriodFields(uploadData: UploadFormData): boolean {
    const yearSelect = this.modalEl?.querySelector('#salary-year') as HTMLSelectElement | null;
    const monthSelect = this.modalEl?.querySelector('#salary-month') as HTMLSelectElement | null;

    if (yearSelect !== null && yearSelect.value !== '' && monthSelect !== null && monthSelect.value !== '') {
      uploadData.salaryYear = Number.parseInt(yearSelect.value, 10);
      uploadData.salaryMonth = Number.parseInt(monthSelect.value, 10);
      return true;
    }

    showWarningAlert('Bitte wählen Sie Jahr und Monat für die Gehaltsabrechnung!');
    return false;
  }

  /**
   * Build UploadFormData with automatic visibility mapping
   */
  private async buildFormData(file: File, category: string): Promise<UploadFormData | null> {
    // Safe: CATEGORY_MAPPINGS is Record<string, CategoryMapping | undefined>
    // Invalid keys (including __proto__) return undefined, which we check immediately
    // eslint-disable-next-line security/detect-object-injection
    const mapping = CATEGORY_MAPPINGS[category];
    if (mapping === undefined) {
      return null;
    }

    const user = await this.getCurrentUser();
    if (!user) {
      return null;
    }

    // Read document name and description from inputs
    const docNameInput = this.modalEl?.querySelector('#doc-name') as HTMLInputElement | null;
    const docDescInput = this.modalEl?.querySelector('#doc-description') as HTMLTextAreaElement | null;

    const documentName = docNameInput !== null && docNameInput.value !== '' ? docNameInput.value.trim() : null;
    const description = docDescInput !== null && docDescInput.value !== '' ? docDescInput.value.trim() : null;

    console.log('[Upload Modal] Building FormData:', {
      fileName: file.name,
      documentName,
      description,
      accessScope: mapping.accessScope,
      category: mapping.categoryValue,
      userId: user.id,
    });

    // Build UploadFormData object (api.ts will convert to FormData)
    const uploadData: UploadFormData = {
      file,
      accessScope: mapping.accessScope,
      category: mapping.categoryValue,
      documentName,
      description,
    };

    // Auto-populate IDs based on access scope
    this.populateUploadDataIds(uploadData, mapping, user);

    // Payroll extra fields
    if (mapping.requiresPayrollPeriod === true && !this.addPayrollPeriodFields(uploadData)) {
      return null;
    }

    console.log('[Upload Modal] Final UploadData:', uploadData);

    return uploadData;
  }

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
    const fileRemoveBtn = this.modalEl.querySelector('#remove-file');
    if (fileRemoveBtn) {
      fileRemoveBtn.addEventListener('click', () => {
        this.clearFileSelection();
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

    // Submit button
    if (this.submitBtn) {
      this.submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Use void operator for fire-and-forget async call
        void this.handleSubmit();
      });
    }
  }

  /**
   * Handle file selected - updates preview with Design System styling
   */
  private handleFileSelected(file: File): void {
    // Show file preview
    const selectedFileDiv = this.modalEl?.querySelector('#selected-file');
    const fileName = this.modalEl?.querySelector('#file-name');
    const fileSize = this.modalEl?.querySelector('#file-size');
    const filePreview = this.modalEl?.querySelector('#file-preview');
    const fileIcon = this.modalEl?.querySelector('#file-icon');

    if (selectedFileDiv && fileName && fileSize) {
      fileName.textContent = file.name;
      fileSize.textContent = this.formatFileSize(file.size);
      selectedFileDiv.classList.remove('hidden');
    }

    // Set icon and preview class based on file type
    if (filePreview && fileIcon) {
      // Remove any existing type-specific classes
      filePreview.classList.remove(
        'file-upload-item__preview--pdf',
        'file-upload-item__preview--image',
        'file-upload-item__preview--word',
        'file-upload-item__preview--excel',
      );

      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      const mimeType = file.type.toLowerCase();
      const displayInfo = getFileTypeDisplayInfo(mimeType, extension);

      if (displayInfo.cssClass !== '') {
        filePreview.classList.add(displayInfo.cssClass);
      }
      fileIcon.className = displayInfo.iconClass;
    }

    // Auto-fill document name if empty
    const docNameInput = this.modalEl?.querySelector('#doc-name') as HTMLInputElement | null;
    if (docNameInput !== null && docNameInput.value === '') {
      docNameInput.value = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
    }
  }

  /**
   * Clear file selection
   */
  private clearFileSelection(): void {
    if (this.fileInput) {
      this.fileInput.value = '';
    }

    const selectedFileDiv = this.modalEl?.querySelector('#selected-file');
    if (selectedFileDiv) {
      selectedFileDiv.classList.add('hidden');
    }
  }

  /**
   * Handle form submission
   */
  private async handleSubmit(): Promise<void> {
    if (!this.fileInput?.files?.[0]) {
      showWarningAlert('Bitte wählen Sie eine Datei aus!');
      return;
    }

    const category = this.categoryInput?.value;
    if (category === undefined || category === '') {
      showWarningAlert('Bitte wählen Sie eine Kategorie aus!');
      return;
    }

    const file = this.fileInput.files[0];

    // Validate
    const isValid = await this.validateUpload(category, file);
    if (!isValid) {
      return;
    }

    // Build form data
    const formData = await this.buildFormData(file, category);
    if (!formData) {
      return;
    }

    try {
      // Disable submit button
      if (this.submitBtn) {
        this.submitBtn.disabled = true;
        this.submitBtn.textContent = 'Wird hochgeladen...';
      }

      // Upload
      await documentAPI.uploadDocument(formData, (progress) => {
        if (this.submitBtn) {
          this.submitBtn.textContent = `Wird hochgeladen... ${progress}%`;
        }
      });

      // Success
      showSuccessAlert('Dokument erfolgreich hochgeladen!');
      this.close();

      // Refresh documents list in background (fire-and-forget)
      // User doesn't need to wait - observer pattern updates UI automatically
      stateManager.refreshDocuments().catch((error: unknown) => {
        console.error('[Upload Modal] Failed to refresh after upload:', error);
      });
    } catch (error) {
      console.error('[Upload Modal] Upload failed:', error);
      const errorMessage = this.parseUploadError(error);
      showErrorAlert(errorMessage);
    } finally {
      // Re-enable submit button
      if (this.submitBtn) {
        this.submitBtn.disabled = false;
        this.submitBtn.textContent = 'Hochladen';
      }
    }
  }

  /**
   * Parse upload error
   */
  private parseUploadError(error: unknown): string {
    const defaultMessage = 'Fehler beim Hochladen. Bitte versuchen Sie es erneut.';

    if (!(error instanceof Error)) {
      return defaultMessage;
    }

    const msg = error.message;

    if (msg.includes('Netzwerkfehler')) {
      return 'Keine Verbindung zum Server. Bitte prüfen Sie Ihre Internetverbindung.';
    }
    if (msg.includes('HTTP 401')) {
      return 'Sitzung abgelaufen. Bitte melden Sie sich erneut an.';
    }
    if (msg.includes('HTTP 403')) {
      return 'Keine Berechtigung. Nur Admins können Dokumente hochladen.';
    }
    if (msg.includes('HTTP 400')) {
      return 'Ungültige Daten. Bitte prüfen Sie Kategorie und Eingabefelder.';
    }
    if (msg.includes('HTTP 500') || msg.includes('HTTP 503')) {
      return 'Server-Fehler. Bitte versuchen Sie es später erneut.';
    }
    if (msg.includes('too large') || msg.includes('zu groß')) {
      return 'Datei ist zu groß. Maximale Größe: 5 MB.';
    }

    return msg.length > 0 ? msg : defaultMessage;
  }

  /**
   * Open modal
   */
  public async open(): Promise<void> {
    this.modalEl ??= document.getElementById('upload-modal');

    if (!this.modalEl) {
      console.error('[Upload Modal] Modal element not found!');
      return;
    }

    // Show modal (remove hidden first, then activate)
    this.modalEl.classList.remove('hidden');
    this.modalEl.classList.add('modal-overlay--active');

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Preload user info
    await this.getCurrentUser();
  }

  /**
   * Close modal
   */
  private close(): void {
    if (!this.modalEl) return;

    this.modalEl.classList.remove('modal-overlay--active');
    this.modalEl.classList.add('hidden');

    this.clearFileSelection();

    // Reset form
    if (this.formEl) {
      this.formEl.reset();
    }

    // Hide payroll fields
    const payrollFields = this.modalEl.querySelector('#payroll-fields');
    if (payrollFields) {
      payrollFields.classList.add('hidden');
    }

    // Reset category text
    const categoryText = this.modalEl.querySelector('#category-text');
    if (categoryText) {
      categoryText.textContent = 'Kategorie wählen';
    }

    // Restore body scroll
    document.body.style.overflow = '';
  }

  /**
   * Format file size
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'] as const;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    const clampedIndex = Math.max(0, Math.min(i, sizes.length - 1));
    // eslint-disable-next-line security/detect-object-injection
    const sizeLabel = sizes[clampedIndex] ?? 'Bytes';
    return `${Math.round((bytes / Math.pow(k, clampedIndex)) * 100) / 100} ${sizeLabel}`;
  }

  /**
   * Setup drag and drop functionality
   */
  private setupDragAndDrop(): void {
    const dropzone = document.getElementById('upload-dropzone');
    if (!dropzone) return;

    const preventDefaults = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
    };

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
      dropzone.addEventListener(eventName, preventDefaults, false);
      document.body.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropzone.addEventListener(
        eventName,
        () => {
          dropzone.classList.add('file-upload-zone--dragover');
        },
        false,
      );
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropzone.addEventListener(
        eventName,
        () => {
          dropzone.classList.remove('file-upload-zone--dragover');
        },
        false,
      );
    });

    dropzone.addEventListener(
      'drop',
      (e: DragEvent) => {
        if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) return;

        const file = e.dataTransfer.files[0];
        if (this.fileInput && file !== undefined) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          this.fileInput.files = dataTransfer.files;

          const event = new Event('change', { bubbles: true });
          this.fileInput.dispatchEvent(event);
        }
      },
      false,
    );

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
    const categoryInput = this.categoryInput;

    if (!dropdownTrigger || !dropdownMenu || !categoryText || !categoryInput) {
      console.error('[Upload Modal] Category dropdown elements not found');
      return;
    }

    // Toggle dropdown
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

        // Get text from text nodes only (skip icon element)
        let displayText = '';
        option.childNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            displayText += node.textContent?.trim() ?? '';
          }
        });

        if (value !== null && value !== '') {
          // Update displayed text (without icon)
          categoryText.textContent = displayText;

          // Update hidden input value
          categoryInput.value = value;

          // Close dropdown
          dropdownMenu.classList.remove('active');

          // Show/hide payroll fields
          this.handleCategoryChange(value);
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

  /**
   * Handle category change (show/hide payroll fields)
   */
  private handleCategoryChange(category: string): void {
    const payrollFields = this.modalEl?.querySelector('#payroll-fields');
    if (!payrollFields) return;

    if (category === 'payroll') {
      payrollFields.classList.remove('hidden');
    } else {
      payrollFields.classList.add('hidden');
    }
  }
}

// Singleton instance
export const uploadModalManager = new UploadModalManager();

// Export type for testing/mocking
export type { UploadModalManager };
