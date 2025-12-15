/**
 * KVP UI Helpers
 * Handles Design System dropdown, modal, and photo upload UI logic for KVP page
 *
 * Migrated from inline JavaScript to TypeScript module for better maintainability
 * and consistency with Design System patterns.
 */

import { $$, setHTML } from '../../utils/dom-utils';

export class KvpUIHelpers {
  private selectedPhotos: File[] = [];

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Setup all event listeners for dropdowns, modals, and photos
   */
  private setupEventListeners(): void {
    this.setupDropdownDelegation();
    this.setupModalDelegation();
    this.setupPhotoDelegation();
  }

  /**
   * Setup event delegation for Design System dropdown components
   */
  private setupDropdownDelegation(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Dropdown trigger click
      const dropdownTrigger = target.closest('.dropdown__trigger');
      if (dropdownTrigger) {
        e.preventDefault();
        e.stopPropagation();
        this.toggleDropdown(dropdownTrigger as HTMLElement);
        return;
      }

      // Dropdown option selection
      const dropdownOption = target.closest('.dropdown__option');
      if (dropdownOption) {
        e.preventDefault();
        this.selectDropdownOption(dropdownOption as HTMLElement);
        return;
      }

      // Close dropdowns when clicking outside
      if (!target.closest('.dropdown')) {
        this.closeAllDropdowns();
      }
    });
  }

  /**
   * Toggle a specific dropdown (open/close)
   */
  private toggleDropdown(trigger: HTMLElement): void {
    const dropdown = trigger.closest('.dropdown');
    if (!dropdown) return;

    const menu = dropdown.querySelector('.dropdown__menu');
    const isActive = menu?.classList.contains('active') ?? false;

    // Close all other dropdowns first
    this.closeAllDropdowns();

    // Toggle current dropdown
    if (!isActive) {
      trigger.classList.add('active');
      if (menu) menu.classList.add('active');
    }
  }

  /**
   * Handle dropdown option selection
   */
  private selectDropdownOption(option: HTMLElement): void {
    const dropdown = option.closest('.dropdown');
    if (!dropdown) return;

    const value = option.dataset['value'] ?? '';
    const text = option.textContent.trim();
    const action = option.dataset['action'] ?? '';

    // Update trigger text (Design System pattern)
    const trigger = dropdown.querySelector('.dropdown__trigger');
    const triggerText = trigger?.querySelector('span');
    if (triggerText) triggerText.textContent = text;

    // Update hidden input based on action type
    this.updateHiddenInput(dropdown, action, value);

    // Close dropdown
    const menu = dropdown.querySelector('.dropdown__menu');
    if (trigger) trigger.classList.remove('active');
    if (menu) menu.classList.remove('active');

    // Trigger change event for filter dropdowns
    if (
      action.includes('select-status') ||
      action.includes('select-category') ||
      action.includes('select-department')
    ) {
      const hiddenInput = this.getHiddenInputForAction(action);
      if (hiddenInput) {
        const event = new Event('change', { bubbles: true });
        hiddenInput.dispatchEvent(event);
      }
    }
  }

  /**
   * Update hidden input value based on dropdown selection
   */
  private updateHiddenInput(_dropdown: Element, action: string, value: string): void {
    let inputId = '';

    if (action === 'select-status') inputId = 'statusFilterValue';
    else if (action === 'select-category') inputId = 'categoryFilterValue';
    else if (action === 'select-department') inputId = 'departmentFilterValue';
    else if (action === 'select-priority') inputId = 'kvpPriorityValue';
    else if (action === 'select-kvp-category') inputId = 'kvpCategoryValue';

    if (inputId !== '') {
      const input = $$(`#${inputId}`);
      if (input && input instanceof HTMLInputElement) {
        input.value = value;
      }
    }
  }

  /**
   * Get hidden input element for a specific action
   */
  private getHiddenInputForAction(action: string): HTMLInputElement | null {
    if (action === 'select-status') return $$('#statusFilterValue') as HTMLInputElement;
    if (action === 'select-category') return $$('#categoryFilterValue') as HTMLInputElement;
    if (action === 'select-department') return $$('#departmentFilterValue') as HTMLInputElement;
    return null;
  }

  /**
   * Close all open dropdowns
   */
  private closeAllDropdowns(): void {
    document.querySelectorAll('.dropdown__trigger.active').forEach((trigger) => {
      trigger.classList.remove('active');
    });
    document.querySelectorAll('.dropdown__menu.active').forEach((menu) => {
      menu.classList.remove('active');
    });
  }

  /**
   * Setup event delegation for Design System modal components
   */
  private setupModalDelegation(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Modal close button
      const closeBtn = target.closest('[data-action="close-modal"]');
      if (closeBtn) {
        e.preventDefault();
        this.hideCreateModal();
      }
    });

    // Close modal on overlay click (Design System pattern)
    const modalOverlay = $$('#createKvpModal');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          this.hideCreateModal();
        }
      });
    }
  }

  /**
   * Setup event delegation for photo upload functionality
   */
  private setupPhotoDelegation(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Upload box click - trigger file input
      const uploadBox = target.closest('[data-action="upload-photos"]');
      if (uploadBox) {
        e.preventDefault();
        const fileInput = $$('#kvpPhotos');
        if (fileInput && fileInput instanceof HTMLInputElement) {
          fileInput.click();
        }
        return;
      }

      // Remove photo button
      const removeBtn = target.closest('[data-action="remove-photo"]');
      if (removeBtn instanceof HTMLElement) {
        e.preventDefault();
        const index = Number.parseInt(removeBtn.dataset['index'] ?? '0', 10);
        this.removePhoto(index);
      }
    });

    // File input change handler
    const fileInput = $$('#kvpPhotos');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const input = e.target as HTMLInputElement;
        this.handlePhotoSelection(input);
      });
    }
  }

  /**
   * Handle photo file selection
   */
  private handlePhotoSelection(input: HTMLInputElement): void {
    const files = Array.from(input.files ?? []);
    const validFiles = files.filter((file) => {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      const maxSize = 10 * 1024 * 1024; // 10MB
      return validTypes.includes(file.type) && file.size <= maxSize;
    });

    if (this.selectedPhotos.length + validFiles.length > 5) {
      alert('Sie können maximal 5 Fotos hochladen.');
      return;
    }

    validFiles.forEach((file) => {
      this.selectedPhotos.push(file);
      this.displayPhotoPreview(file, this.selectedPhotos.length - 1);
    });

    // Reset input to allow re-selecting same file
    input.value = '';
  }

  /**
   * Display photo preview thumbnail
   */
  private displayPhotoPreview(file: File, index: number): void {
    const reader = new FileReader();
    reader.onload = (e): void => {
      const preview = $$('#photoPreview');
      if (!preview) return;

      // Create preview item (safe DOM construction, no innerHTML)
      const item = document.createElement('div');
      item.className = 'photo-preview-item';

      const img = document.createElement('img');
      img.src = e.target?.result as string;
      img.alt = 'Vorschau';

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-photo';
      removeBtn.setAttribute('data-action', 'remove-photo');
      removeBtn.setAttribute('data-index', index.toString());
      removeBtn.type = 'button';
      removeBtn.textContent = '×';

      item.append(img);
      item.append(removeBtn);
      preview.append(item);
    };
    reader.readAsDataURL(file);
  }

  /**
   * Remove photo from selection
   */
  private removePhoto(index: number): void {
    this.selectedPhotos.splice(index, 1);
    this.refreshPhotoPreview();
  }

  /**
   * Refresh all photo previews (after removal)
   */
  private refreshPhotoPreview(): void {
    const preview = $$('#photoPreview');
    if (!preview) return;

    setHTML(preview, '');
    this.selectedPhotos.forEach((file, index) => {
      this.displayPhotoPreview(file, index);
    });
  }

  // ===== Public API for kvp.ts =====

  /**
   * Show the create KVP modal (Design System modal)
   */
  public showCreateModal(): void {
    const modal = $$('#createKvpModal');
    if (modal) {
      modal.removeAttribute('hidden');
      modal.classList.add('modal-overlay--active');
    }
  }

  /**
   * Hide the create KVP modal (Design System modal)
   */
  public hideCreateModal(): void {
    const modal = $$('#createKvpModal');
    if (modal) {
      modal.setAttribute('hidden', '');
      modal.classList.remove('modal-overlay--active');

      // Clear photos when closing
      this.clearSelectedPhotos();
    }
  }

  /**
   * Get currently selected photos
   */
  public getSelectedPhotos(): File[] {
    return this.selectedPhotos;
  }

  /**
   * Clear all selected photos
   */
  public clearSelectedPhotos(): void {
    this.selectedPhotos = [];
    const preview = $$('#photoPreview');
    if (preview) setHTML(preview, '');
  }

  /**
   * Manually select a dropdown option (used by kvp.ts for category dropdown)
   */
  public selectDropdownValue(dropdownType: string, value: string, text: string): void {
    const displayId = `${dropdownType}Display`;
    const valueId = `${dropdownType}Value`;

    const trigger = $$(`#${displayId}`);
    const triggerText = trigger?.querySelector('span');
    if (triggerText) triggerText.textContent = text;

    const hiddenInput = $$(`#${valueId}`);
    if (hiddenInput && hiddenInput instanceof HTMLInputElement) {
      hiddenInput.value = value;
    }

    // Close the dropdown
    const dropdown = $$(`[data-dropdown="${dropdownType}"]`);
    if (dropdown) {
      const trigger = dropdown.querySelector('.dropdown__trigger');
      const menu = dropdown.querySelector('.dropdown__menu');
      if (trigger) trigger.classList.remove('active');
      if (menu) menu.classList.remove('active');
    }
  }
}

// Create and export singleton instance
export const kvpUIHelpers = new KvpUIHelpers();
