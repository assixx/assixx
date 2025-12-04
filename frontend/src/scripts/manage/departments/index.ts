/* eslint-disable max-lines */
/**
 * Department Management - Main Controller
 * Handles department CRUD operations for admin dashboard
 */

import { ApiClient } from '../../../utils/api-client';
import { showErrorAlert, showSuccessAlert } from '../../utils/alerts';
import { $$id, setSafeHTML } from '../../../utils/dom-utils';
import type { Department, DepartmentStatusFilter, WindowWithDepartmentHandlers } from './types';
import { renderDepartmentsTable, setupFormSubmitHandler, renderSearchResults, closeSearchResults } from './ui';
import {
  showAddDepartmentModal,
  showEditDepartmentModal,
  closeDepartmentModal,
  showDeleteModal,
  closeDeleteModal,
} from './forms';
import { DepartmentAPI } from './api';

/** CSS class for active modal overlay */
const MODAL_ACTIVE_CLASS = 'modal-overlay--active';

class DepartmentsManager {
  private readonly api: DepartmentAPI;
  public departments: Department[] = [];
  private currentFilter: DepartmentStatusFilter = 'active';
  private searchTerm = '';
  public currentDepartmentId: number | null = null;

  constructor() {
    const apiClient = ApiClient.getInstance();
    this.api = new DepartmentAPI(apiClient);
    this.initializeEventListeners();
  }

  /**
   * Initialize all event listeners
   */
  private initializeEventListeners(): void {
    this.initFloatingActionButton();
    this.initStatusToggle();
    this.initSearchInput();
    this.initModalCloseButtons();
    this.initTableActions();
    this.initCustomDropdowns();
  }

  /**
   * Initialize floating action button and empty state button for adding departments
   */
  private initFloatingActionButton(): void {
    // Floating button (bottom right)
    document.querySelector('.add-department-btn')?.addEventListener('click', () => {
      this.currentDepartmentId = null;
      showAddDepartmentModal();
      void this.loadAreas();
      void this.loadDepartmentLeads();
    });

    // Empty state button
    document.querySelector('#empty-state-add-btn')?.addEventListener('click', () => {
      this.currentDepartmentId = null;
      showAddDepartmentModal();
      void this.loadAreas();
      void this.loadDepartmentLeads();
    });
  }

  /**
   * Initialize status toggle group (Active/Inactive/All)
   */
  private initStatusToggle(): void {
    const toggleGroup = document.querySelector('#department-status-toggle');
    toggleGroup?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.toggle-group__btn');
      if (btn === null || btn.disabled) {
        return;
      }

      const status = btn.dataset['status'] as DepartmentStatusFilter | undefined;
      if (status === undefined) {
        return;
      }

      // Update active state
      toggleGroup.querySelectorAll('.toggle-group__btn').forEach((b) => {
        b.classList.remove('active');
      });
      btn.classList.add('active');

      // Update filter state and reload
      this.currentFilter = status;
      void this.loadDepartments();
    });
  }

  /**
   * Initialize search input with live preview dropdown
   */
  private initSearchInput(): void {
    const searchInput = $$id('department-search');
    const searchClearBtn = $$id('department-search-clear');

    if (searchInput instanceof HTMLInputElement) {
      // Live search on input
      searchInput.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value;
        this.searchTerm = query;

        const filtered = this.filterBySearch(this.departments);
        renderSearchResults(filtered, query);

        void this.loadDepartments();
      });

      // Enter key submits search
      searchInput.addEventListener('keypress', (e) => {
        if (e instanceof KeyboardEvent && e.key === 'Enter') {
          this.searchTerm = searchInput.value;
          closeSearchResults();
          void this.loadDepartments();
        }
      });
    }

    // Clear button
    searchClearBtn?.addEventListener('click', () => {
      if (searchInput instanceof HTMLInputElement) {
        searchInput.value = '';
        this.searchTerm = '';
        closeSearchResults();
        void this.loadDepartments();
        searchInput.focus();
      }
    });

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
      const searchWrapper = document.querySelector('.search-input-wrapper');
      const target = e.target as HTMLElement;
      if (searchWrapper !== null && !searchWrapper.contains(target)) {
        closeSearchResults();
      }
    });
  }

  /**
   * Initialize modal close buttons
   */
  private initModalCloseButtons(): void {
    // Department modal close buttons
    document.querySelector('#close-department-modal')?.addEventListener('click', () => {
      this.currentDepartmentId = null;
      closeDepartmentModal();
    });

    document.querySelector('#cancel-department-modal')?.addEventListener('click', () => {
      this.currentDepartmentId = null;
      closeDepartmentModal();
    });

    // Delete Modal Step 1: Close buttons
    document.querySelector('#close-delete-modal')?.addEventListener('click', () => {
      closeDeleteModal();
    });

    document.querySelector('#cancel-delete-modal')?.addEventListener('click', () => {
      closeDeleteModal();
    });

    // Delete Modal Step 1: Proceed to second confirmation (double-check pattern)
    document.querySelector('#proceed-delete-department')?.addEventListener('click', () => {
      // Close first modal, show second modal
      closeDeleteModal();
      const confirmModal = document.querySelector('#delete-department-confirm-modal');
      confirmModal?.classList.add(MODAL_ACTIVE_CLASS);
    });

    // Delete Modal Step 2: Cancel button
    document.querySelector('#cancel-delete-confirm')?.addEventListener('click', () => {
      const confirmModal = document.querySelector('#delete-department-confirm-modal');
      confirmModal?.classList.remove(MODAL_ACTIVE_CLASS);
    });

    // Delete Modal Step 2: Final confirmation - actually delete
    document.querySelector('#confirm-delete-department-final')?.addEventListener('click', () => {
      const deleteInput = document.querySelector<HTMLInputElement>('#delete-department-id');
      if (deleteInput !== null && deleteInput.value !== '') {
        // Close second modal first
        const confirmModal = document.querySelector('#delete-department-confirm-modal');
        confirmModal?.classList.remove(MODAL_ACTIVE_CLASS);
        void this.confirmDeleteDepartment(Number.parseInt(deleteInput.value, 10));
      }
    });

    // Force Delete modal close buttons
    document.querySelector('#cancel-force-delete')?.addEventListener('click', () => {
      this.closeForceDeleteModal();
    });

    // Force Delete confirmation button
    document.querySelector('#confirm-force-delete')?.addEventListener('click', () => {
      const forceDeleteIdInput = document.querySelector<HTMLInputElement>('#force-delete-department-id');
      if (forceDeleteIdInput !== null && forceDeleteIdInput.value !== '') {
        void this.executeForceDelete(Number.parseInt(forceDeleteIdInput.value, 10));
      }
    });

    // Close on outside click
    document.querySelector('#delete-department-modal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        closeDeleteModal();
      }
    });

    document.querySelector('#force-delete-warning-modal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.closeForceDeleteModal();
      }
    });
  }

  /**
   * Show delete confirmation modal (first stage)
   */
  showConfirmDeleteModal(departmentId: number): void {
    const department = this.departments.find((d) => d.id === departmentId);
    if (department === undefined) {
      showErrorAlert('Abteilung nicht gefunden');
      return;
    }

    const modal = document.querySelector('#delete-department-modal');
    const messageEl = document.querySelector('#delete-department-message');
    const deleteIdInput = document.querySelector<HTMLInputElement>('#delete-department-id');

    if (modal !== null && messageEl !== null && deleteIdInput !== null) {
      messageEl.textContent = `Möchten Sie die Abteilung "${department.name}" wirklich löschen?`;
      deleteIdInput.value = departmentId.toString();
      modal.classList.add(MODAL_ACTIVE_CLASS);
    }
  }

  /**
   * Confirm delete and handle dependencies (second stage if needed)
   */
  async confirmDeleteDepartment(departmentId: number): Promise<void> {
    try {
      await this.api.delete(departmentId);
      await this.handleDeleteSuccess();
    } catch (error) {
      const errorObj = error as { message?: string; code?: string; details?: Record<string, unknown> };

      // Check if error is due to dependencies
      if (
        errorObj.code === 'DEPT_400' ||
        errorObj.message?.includes('dependencies') === true ||
        errorObj.message?.includes('Abhängigkeiten') === true
      ) {
        const details = errorObj.details ?? {};
        const totalDependencies = typeof details['totalDependencies'] === 'number' ? details['totalDependencies'] : 0;
        this.showForceDeleteWarning(departmentId, totalDependencies, details);
      } else {
        this.handleDeleteError(error);
      }
    }
  }

  /**
   * Initialize custom dropdown components
   */
  private initCustomDropdowns(): void {
    // Initialize all dropdowns (area, department lead, status)
    this.initDropdown('area-dropdown', 'area-trigger', 'area-menu', 'department-area');
    this.initDropdown('department-lead-dropdown', 'department-lead-trigger', 'department-lead-menu', 'department-lead');
    // Status dropdown uses unified isActive mapping
    this.initStatusDropdown();
  }

  /**
   * Handle dropdown option selection and update display
   */
  private handleDropdownSelection(
    option: HTMLElement,
    trigger: HTMLElement,
    hiddenInput: HTMLInputElement | null,
    dropdownId: string,
  ): void {
    const value = option.dataset['value'] ?? '';
    const trimmedText = option.textContent.trim();
    const displayText = trimmedText !== '' ? trimmedText : value;

    // Update hidden input
    if (hiddenInput !== null) {
      hiddenInput.value = value;
    }

    // Update trigger text
    const triggerSpan = trigger.querySelector('span');
    if (triggerSpan !== null) {
      const badge = option.querySelector('.badge');
      if (badge !== null) {
        setSafeHTML(triggerSpan, badge.outerHTML);
      } else {
        this.updateTriggerText(triggerSpan, option, dropdownId, displayText);
      }
    }
  }

  /**
   * Update trigger text for non-badge dropdowns
   */
  private updateTriggerText(
    triggerSpan: Element,
    _option: HTMLElement,
    _dropdownId: string,
    displayText: string,
  ): void {
    triggerSpan.textContent = displayText;
  }

  /**
   * Generic dropdown initialization helper
   */
  private initDropdown(dropdownId: string, triggerId: string, menuId: string, hiddenInputId: string): void {
    const trigger = $$id(triggerId);
    const menu = $$id(menuId);
    const dropdown = $$id(dropdownId);
    const hiddenInput = $$id(hiddenInputId) as HTMLInputElement | null;

    if (trigger === null || menu === null || dropdown === null) {
      console.warn(`[initDropdown] Dropdown elements not found for: ${dropdownId}`);
      return;
    }

    // Toggle menu on trigger click
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      trigger.classList.toggle('active');
      menu.classList.toggle('active');
    });

    // Handle option selection
    menu.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const option = target.closest('.dropdown__option');

      if (option === null || !(option instanceof HTMLElement)) {
        return;
      }

      this.handleDropdownSelection(option, trigger, hiddenInput, dropdownId);

      // Close menu
      menu.classList.remove('active');
      trigger.classList.remove('active');
    });

    // Close menu on outside click
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!dropdown.contains(target)) {
        menu.classList.remove('active');
        trigger.classList.remove('active');
      }
    });
  }

  /**
   * Initialize status dropdown with unified isActive mapping (2025-12-02)
   * Status: 0=inactive, 1=active, 3=archived, 4=deleted
   */
  private initStatusDropdown(): void {
    const trigger = $$id('status-trigger');
    const menu = $$id('status-menu');
    const dropdown = $$id('status-dropdown');
    const isActiveInput = $$id('department-is-active') as HTMLInputElement | null;

    if (trigger === null || menu === null || dropdown === null) {
      console.warn('[initStatusDropdown] Status dropdown elements not found');
      return;
    }

    if (isActiveInput === null) {
      console.warn('[initStatusDropdown] Status hidden input not found');
      return;
    }

    // Toggle menu on trigger click
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      trigger.classList.toggle('active');
      menu.classList.toggle('active');
    });

    // Handle option selection
    menu.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const option = target.closest('.dropdown__option');

      if (option === null || !(option instanceof HTMLElement)) {
        return;
      }

      const value = option.dataset['value'] ?? '';
      const badge = option.querySelector('.badge');

      // Map UI value to unified isActive status
      // Status: 0=inactive, 1=active, 3=archived, 4=deleted
      switch (value) {
        case 'active':
          isActiveInput.value = '1';
          break;
        case 'inactive':
          isActiveInput.value = '0';
          break;
        case 'archived':
          isActiveInput.value = '3';
          break;
      }

      // Update trigger with badge
      const triggerSpan = trigger.querySelector('span');
      if (triggerSpan !== null && badge !== null) {
        setSafeHTML(triggerSpan, badge.outerHTML);
      }

      // Close menu
      menu.classList.remove('active');
      trigger.classList.remove('active');
    });

    // Close menu on outside click
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!dropdown.contains(target)) {
        menu.classList.remove('active');
        trigger.classList.remove('active');
      }
    });
  }

  /**
   * Initialize event delegation for table actions (edit, delete)
   */
  private initTableActions(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const w = window as WindowWithDepartmentHandlers;

      // Handle edit department (from table)
      const editBtn = target.closest<HTMLElement>('[data-action="edit-department"]');
      if (editBtn) {
        const departmentId = editBtn.dataset['deptId'];
        if (departmentId !== undefined) {
          void w.editDepartment?.(Number.parseInt(departmentId, 10));
        }
      }

      // Handle edit from search results
      const searchResultItem = target.closest<HTMLElement>('[data-action="edit-from-search"]');
      if (searchResultItem) {
        const departmentId = searchResultItem.dataset['deptId'];
        if (departmentId !== undefined) {
          closeSearchResults();
          void w.editDepartment?.(Number.parseInt(departmentId, 10));
        }
      }

      // Handle delete department
      const deleteBtn = target.closest<HTMLElement>('[data-action="delete-department"]');
      if (deleteBtn) {
        const departmentId = deleteBtn.dataset['deptId'];
        if (departmentId !== undefined) {
          void w.deleteDepartment?.(Number.parseInt(departmentId, 10));
        }
      }
    });
  }

  /**
   * Filter by status (unified isActive: 0=inactive, 1=active, 3=archived, 4=deleted)
   */
  private filterByStatus(departments: Department[]): Department[] {
    switch (this.currentFilter) {
      case 'active':
        return departments.filter((dept) => dept.isActive === 1);
      case 'inactive':
        return departments.filter((dept) => dept.isActive === 0);
      case 'archived':
        return departments.filter((dept) => dept.isActive === 3);
      case 'all':
      default:
        // Show all except deleted (isActive !== 4)
        return departments.filter((dept) => dept.isActive !== 4);
    }
  }

  /**
   * Filter by search term
   */
  private filterBySearch(departments: Department[]): Department[] {
    if (this.searchTerm.length === 0) return departments;

    const search = this.searchTerm.toLowerCase();
    return departments.filter(
      (dept) =>
        dept.name.toLowerCase().includes(search) ||
        (dept.description?.toLowerCase().includes(search) ?? false) ||
        (dept.areaName?.toLowerCase().includes(search) ?? false),
    );
  }

  /**
   * Load departments from API
   */
  async loadDepartments(): Promise<void> {
    const departments = await this.api.fetchAll();
    this.departments = departments;

    // Apply filters
    let filteredDepartments = this.filterByStatus(this.departments);
    filteredDepartments = this.filterBySearch(filteredDepartments);

    renderDepartmentsTable(filteredDepartments, this.currentFilter);

    // Initialize tooltips after rendering table
    initDataTooltips();
  }

  /**
   * Create new department
   */
  async createDepartment(data: Partial<Department>): Promise<Department> {
    const response = await this.api.create(data);
    await this.loadDepartments();
    return response;
  }

  /**
   * Update existing department
   */
  async updateDepartment(id: number, data: Partial<Department>): Promise<Department> {
    const response = await this.api.update(id, data);
    await this.loadDepartments();
    return response;
  }

  /**
   * Delete department (now just called by confirmDeleteDepartment)
   */
  async deleteDepartment(id: number): Promise<void> {
    await this.api.delete(id);
    await this.loadDepartments();
  }

  /**
   * Handle successful deletion
   */
  private async handleDeleteSuccess(): Promise<void> {
    showSuccessAlert('Abteilung erfolgreich gelöscht');
    closeDeleteModal();
    await this.loadDepartments();
  }

  /**
   * Handle delete errors
   */
  private handleDeleteError(error: unknown): void {
    console.error('Error deleting department:', error);
    showErrorAlert('Fehler beim Löschen der Abteilung');
  }

  /**
   * Build user-friendly dependency message from details object
   */
  private buildDependencyMessage(details: Record<string, unknown>): string {
    // Static list of dependencies (safe from injection - keys are constants)
    const dependencies = [
      { key: 'users' as const, label: 'Benutzer' },
      { key: 'teams' as const, label: 'Teams' },
      { key: 'machines' as const, label: 'Maschinen' },
      { key: 'shifts' as const, label: 'Schichten' },
      { key: 'shiftPlans' as const, label: 'Schichtpläne' },
      { key: 'shiftFavorites' as const, label: 'Favoriten' },
      { key: 'kvpSuggestions' as const, label: 'KVP-Vorschläge' },
      { key: 'documents' as const, label: 'Dokumente' },
      { key: 'calendarEvents' as const, label: 'Kalendereinträge' },
      { key: 'surveyAssignments' as const, label: 'Umfragen' },
      { key: 'adminPermissions' as const, label: 'Admin-Berechtigungen' },
      { key: 'departmentGroupMembers' as const, label: 'Abteilungsgruppen' },
      { key: 'documentPermissions' as const, label: 'Dokument-Berechtigungen' },
    ] as const;

    const messages = dependencies
      .map(({ key, label }) => {
        // Safe: key is a compile-time constant from static array above
        // eslint-disable-next-line security/detect-object-injection
        const count = details[key];
        return typeof count === 'number' && count > 0 ? `${count} ${label}` : null;
      })
      .filter((msg): msg is string => msg !== null);

    return messages.join(', ');
  }

  /**
   * Show force delete warning modal
   */
  private showForceDeleteWarning(id: number, totalDependencies: number, details: Record<string, unknown>): void {
    const modal = document.querySelector('#force-delete-warning-modal');
    const messageEl = document.querySelector('#force-delete-warning-message');
    const departmentIdInput = document.querySelector<HTMLInputElement>('#force-delete-department-id');

    if (modal === null || messageEl === null || departmentIdInput === null) {
      showErrorAlert('Force-Delete-Modal nicht gefunden');
      return;
    }

    const dependencyList = this.buildDependencyMessage(details);
    const message = `Diese Abteilung wird von ${totalDependencies} ${totalDependencies === 1 ? 'Element' : 'Elementen'} verwendet (${dependencyList}). Möchten Sie die Abteilung trotzdem löschen? Alle Zuordnungen werden automatisch entfernt.`;

    messageEl.textContent = message;
    departmentIdInput.value = id.toString();

    // Close the first delete modal and show warning modal
    closeDeleteModal();
    modal.classList.add(MODAL_ACTIVE_CLASS);
  }

  /**
   * Close force delete modal
   */
  private closeForceDeleteModal(): void {
    const modal = document.querySelector('#force-delete-warning-modal');
    if (modal) {
      modal.classList.remove(MODAL_ACTIVE_CLASS);
    }
  }

  /**
   * Execute force delete (with force=true parameter)
   */
  async executeForceDelete(id: number): Promise<void> {
    try {
      await this.api.delete(id, true);
      showSuccessAlert('Abteilung und alle Zuordnungen erfolgreich gelöscht');
      this.closeForceDeleteModal();
      await this.loadDepartments();
    } catch (error) {
      console.error('Error force deleting department:', error);
      showErrorAlert('Fehler beim Löschen der Abteilung');
      this.closeForceDeleteModal();
    }
  }

  /**
   * Get department details by ID
   */
  async getDepartmentDetails(id: number): Promise<Department | null> {
    return await this.api.getDetails(id);
  }

  /**
   * Load areas for dropdown
   */
  async loadAreas(): Promise<void> {
    await this.api.loadAreas();
  }

  /**
   * Load department leads (admin/root users) for dropdown
   */
  async loadDepartmentLeads(): Promise<void> {
    await this.api.loadDepartmentLeads();
  }
}

// Export manager instance
let departmentsManager: DepartmentsManager | null = null;

/**
 * Process a single form field and add to data object
 * Handles field mapping (snake_case → camelCase) and type conversion
 */
function processFormField(data: Record<string, unknown>, key: string, value: string): void {
  // Field mapping configuration: formKey → { apiKey, parseAsNumber }
  const fieldMappings: Record<string, { apiKey: string; parseAsNumber: boolean }> = {
    area_id: { apiKey: 'areaId', parseAsNumber: true },
    departmentLeadId: { apiKey: 'departmentLeadId', parseAsNumber: true },
  };

  // Check if field needs special mapping
  // eslint-disable-next-line security/detect-object-injection -- Safe: key comes from FormData, not user input
  const mapping = fieldMappings[key];

  if (mapping !== undefined) {
    data[mapping.apiKey] = value === '' ? null : Number.parseInt(value, 10);
    return;
  }

  // Handle description (empty string → null)
  if (key === 'description' && value === '') {
    // eslint-disable-next-line security/detect-object-injection -- Safe: key is literal 'description'
    data[key] = null;
    return;
  }

  // Default: use value as-is
  // eslint-disable-next-line security/detect-object-injection -- Safe: key comes from FormData, not user input
  data[key] = value;
}

// Save department handler
async function handleSaveDepartment(): Promise<void> {
  console.info('[saveDepartment] Function called');
  const form = $$id('department-form');
  if (!(form instanceof HTMLFormElement)) {
    console.error('[saveDepartment] Form not found or not a form element');
    return;
  }

  const formData = new FormData(form);
  const data: Record<string, unknown> = {};

  formData.forEach((value, key) => {
    if (typeof value === 'string') {
      processFormField(data, key, value);
    }
  });

  // Ensure required fields
  if (typeof data['name'] !== 'string' || data['name'].length === 0) {
    showErrorAlert('Bitte füllen Sie alle Pflichtfelder aus');
    return;
  }

  try {
    console.info('[saveDepartment] Starting save operation...');
    if (departmentsManager?.currentDepartmentId !== null && departmentsManager?.currentDepartmentId !== undefined) {
      console.info('[saveDepartment] Updating department ID:', departmentsManager.currentDepartmentId);
      await departmentsManager.updateDepartment(departmentsManager.currentDepartmentId, data as Partial<Department>);
    } else {
      console.info('[saveDepartment] Creating new department...');
      await departmentsManager?.createDepartment(data as Partial<Department>);
    }
    console.info('[saveDepartment] Save successful, closing modal...');
    const w = window as WindowWithDepartmentHandlers;
    w.hideDepartmentModal?.();
    form.reset();
    if (departmentsManager) {
      departmentsManager.currentDepartmentId = null;
    }
  } catch (error) {
    console.error('Error saving department:', error);
    showErrorAlert('Fehler beim Speichern der Abteilung');
  }
}

// Setup window handlers
function setupWindowHandlers(): void {
  const w = window as WindowWithDepartmentHandlers;

  w.editDepartment = async (id: number) => {
    const department = await departmentsManager?.getDepartmentDetails(id);
    if (department === null || department === undefined) return;

    console.info('Edit department:', department);

    // Set current department ID for update
    if (departmentsManager) {
      departmentsManager.currentDepartmentId = id;
    }

    // Load areas and department leads before showing modal
    await Promise.all([departmentsManager?.loadAreas(), departmentsManager?.loadDepartmentLeads()]);

    // Show modal in edit mode with department data
    showEditDepartmentModal(department);
  };

  w.deleteDepartment = (id: number): Promise<void> => {
    const department = departmentsManager?.departments.find((d) => d.id === id);
    if (department === undefined) {
      showErrorAlert('Abteilung nicht gefunden');
      return Promise.resolve();
    }
    showDeleteModal(id, department.name);
    return Promise.resolve();
  };

  w.showDepartmentModal = () => {
    if (departmentsManager) {
      departmentsManager.currentDepartmentId = null;
    }
    showAddDepartmentModal();
    void departmentsManager?.loadAreas();
    void departmentsManager?.loadDepartmentLeads();
  };

  w.hideDepartmentModal = () => {
    if (departmentsManager) {
      departmentsManager.currentDepartmentId = null;
    }
    closeDepartmentModal();
  };

  w.saveDepartment = handleSaveDepartment;

  // Setup form submit handler
  setupFormSubmitHandler();
}

/**
 * Initialize Design System tooltips from data-tooltip attributes
 * Converts data-tooltip="text" to proper tooltip HTML structure
 */
function initDataTooltips(): void {
  const elements = document.querySelectorAll('[data-tooltip]');

  elements.forEach((element) => {
    const tooltipText = element.getAttribute('data-tooltip');

    if (tooltipText === null || tooltipText === '') {
      return;
    }

    // CRITICAL: Inside scroll containers (overflow:auto), position:absolute tooltips
    // will ALWAYS be clipped - no matter if top or bottom.
    // Solution: Use native title attribute which browser renders outside any container
    const isInsideScrollContainer = element.closest('.table-responsive') !== null;

    if (isInsideScrollContainer) {
      // Use native title - browser handles positioning, never clipped
      element.setAttribute('title', tooltipText);
      element.removeAttribute('data-tooltip');
      return;
    }

    // For elements NOT in scroll containers: use custom tooltip
    const tooltipPosition = element.getAttribute('data-tooltip-position') ?? 'top';

    // Wrap element if not already wrapped
    const isAlreadyWrapped = element.parentElement?.classList.contains('tooltip') ?? false;

    if (!isAlreadyWrapped) {
      const wrapper = document.createElement('div');
      wrapper.className = 'tooltip';

      // Replace element with wrapper using element.before()
      element.before(wrapper);
      wrapper.appendChild(element);

      // Create tooltip content
      const tooltipContent = document.createElement('div');
      tooltipContent.className = `tooltip__content tooltip__content--${tooltipPosition} tooltip__content--multiline`;
      tooltipContent.setAttribute('role', 'tooltip');
      // Use textContent for multiline support - preserves newlines
      tooltipContent.textContent = tooltipText;

      wrapper.appendChild(tooltipContent);
    }
  });
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname === '/manage-departments') {
    departmentsManager = new DepartmentsManager();
    setupWindowHandlers();
    void departmentsManager.loadDepartments();
  }
});

export { DepartmentsManager };
