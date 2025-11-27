/* eslint-disable max-lines */
/**
 * Department Groups Management - Main Controller
 * Handles department group CRUD operations for root dashboard
 */

import { ApiClient } from '../../../utils/api-client';
import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';
import { $$id, setSafeHTML } from '../../../utils/dom-utils';
import type { DepartmentGroup, Department, GroupStatusFilter, WindowWithGroupHandlers } from './types';
import { DepartmentGroupAPI } from './api';
import {
  renderGroupTree,
  renderGroupDetails,
  clearGroupDetails,
  showLoading,
  hideLoading,
  showEmptyState,
  showContent,
} from './ui';
import {
  showAddGroupModal,
  showEditGroupModal,
  closeGroupModal,
  showDeleteModal,
  closeDeleteModal,
  setupFormSubmitHandler,
  resetModalScroll,
  setupParentGroupDropdown,
} from './forms';

class DepartmentGroupsManager {
  private readonly api: DepartmentGroupAPI;
  public groups: DepartmentGroup[] = [];
  private filteredGroups: DepartmentGroup[] = [];
  public departments: Department[] = [];
  private selectedGroupId: number | null = null;
  public currentGroupId: number | null = null;
  private currentStatusFilter: GroupStatusFilter = 'all'; // Changed from 'active' - no filter toggle anymore
  private currentSearchQuery = '';

  constructor() {
    const apiClient = ApiClient.getInstance();
    this.api = new DepartmentGroupAPI(apiClient);
    this.initializeEventListeners();
  }

  /**
   * Initialize all event listeners
   */
  private initializeEventListeners(): void {
    this.initFloatingActionButton();
    this.initEmptyStateButton();
    this.initModalCloseButtons();
    this.initTableActions();
    // this.initStatusToggle(); // DISABLED - Status toggle removed from UI
    this.initSearchInput();
  }

  /**
   * Initialize floating action button for adding groups
   */
  private initFloatingActionButton(): void {
    const addBtn = $$id('add-group-btn');
    addBtn?.addEventListener('click', () => {
      this.currentGroupId = null;
      showAddGroupModal();
      this.loadParentGroupsDropdown();
      void this.loadDepartmentsChecklist();
      resetModalScroll();
    });
  }

  /**
   * Initialize empty state add button
   */
  private initEmptyStateButton(): void {
    const emptyStateBtn = $$id('empty-state-add-btn');
    emptyStateBtn?.addEventListener('click', () => {
      this.currentGroupId = null;
      showAddGroupModal();
      this.loadParentGroupsDropdown();
      void this.loadDepartmentsChecklist();
      resetModalScroll();
    });
  }

  /**
   * Initialize modal close buttons
   */
  private initModalCloseButtons(): void {
    // Group modal close buttons
    $$id('close-group-modal')?.addEventListener('click', () => {
      this.currentGroupId = null;
      closeGroupModal();
    });

    $$id('cancel-group-modal')?.addEventListener('click', () => {
      this.currentGroupId = null;
      closeGroupModal();
    });

    // Delete modal close buttons
    $$id('close-delete-modal')?.addEventListener('click', () => {
      closeDeleteModal();
    });

    $$id('cancel-delete-modal')?.addEventListener('click', () => {
      closeDeleteModal();
    });

    // Delete confirmation button
    $$id('confirm-delete-group')?.addEventListener('click', () => {
      const deleteInput = $$id('delete-group-id');
      if (deleteInput instanceof HTMLInputElement && deleteInput.value !== '') {
        void this.confirmDelete(Number.parseInt(deleteInput.value, 10));
      }
    });

    // Close modal on overlay click
    const groupModal = $$id('group-modal');
    groupModal?.addEventListener('click', (e) => {
      if (e.target === groupModal) {
        this.currentGroupId = null;
        closeGroupModal();
      }
    });

    const deleteModal = $$id('delete-group-modal');
    deleteModal?.addEventListener('click', (e) => {
      if (e.target === deleteModal) {
        closeDeleteModal();
      }
    });
  }

  /**
   * Initialize event delegation for tree and detail actions
   */
  private initTableActions(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Handle group selection from tree
      const selectBtn = target.closest<HTMLElement>('[data-action="select-group"]');
      if (selectBtn !== null) {
        this.handleSelectGroup(selectBtn);
        return;
      }

      // Handle edit group
      const editBtn = target.closest<HTMLElement>('[data-action="edit-group"]');
      if (editBtn !== null) {
        this.handleEditGroup(editBtn);
        return;
      }

      // Handle delete group
      const deleteBtn = target.closest<HTMLElement>('[data-action="delete-group"]');
      if (deleteBtn !== null) {
        this.handleDeleteGroup(deleteBtn);
      }
    });
  }

  /**
   * Handle group selection click
   */
  private handleSelectGroup(element: HTMLElement): void {
    const groupId = this.getGroupIdFromElement(element);
    if (groupId !== null) {
      this.selectGroup(groupId);
    }
  }

  /**
   * Handle edit group click
   */
  private handleEditGroup(element: HTMLElement): void {
    const groupId = this.getGroupIdFromElement(element);
    if (groupId !== null) {
      const w = window as WindowWithGroupHandlers;
      void w.editGroup?.(groupId);
    }
  }

  /**
   * Handle delete group click
   */
  private handleDeleteGroup(element: HTMLElement): void {
    const groupId = this.getGroupIdFromElement(element);
    if (groupId !== null) {
      const w = window as WindowWithGroupHandlers;
      void w.deleteGroup?.(groupId);
    }
  }

  /**
   * Extract group ID from element dataset
   */
  private getGroupIdFromElement(element: HTMLElement): number | null {
    const idStr = element.dataset['groupId'];
    return idStr !== undefined && idStr !== '' ? Number.parseInt(idStr, 10) : null;
  }

  /**
   * DISABLED - Status toggle removed from UI
   * Initialize status toggle buttons
   */
  /*
  private initStatusToggle(): void {
    const toggleGroup = $$id('group-status-toggle');
    if (toggleGroup === null) {
      console.warn('[initStatusToggle] Toggle group not found');
      return;
    }

    toggleGroup.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest<HTMLElement>('.toggle-group__btn');
      if (button === null) return;

      const status = button.dataset['status'] as GroupStatusFilter | undefined;
      if (status === undefined) return;

      // Update active button
      toggleGroup.querySelectorAll('.toggle-group__btn').forEach((btn) => {
        btn.classList.remove('active');
      });
      button.classList.add('active');

      // Update filter and re-render
      this.currentStatusFilter = status;
      this.filteredGroups = this.applyAllFilters();
      renderGroupTree(this.filteredGroups, this.selectedGroupId);

      // Hide/show add buttons based on status
      this.toggleAddButtons(status);
    });
  }
  */

  /**
   * DISABLED - Status toggle removed from UI
   * Hide or show add buttons based on status filter
   * Add buttons should be hidden when viewing inactive groups
   */
  /*
  private toggleAddButtons(status: GroupStatusFilter): void {
    const floatingBtn = $$id('add-group-btn');
    const emptyStateBtn = $$id('empty-state-add-btn');

    if (status === 'inactive') {
      // Hide buttons when viewing inactive groups
      floatingBtn?.classList.add('u-hidden');
      emptyStateBtn?.classList.add('u-hidden');
    } else {
      // Show buttons for active/all status
      floatingBtn?.classList.remove('u-hidden');
      emptyStateBtn?.classList.remove('u-hidden');
    }
  }
  */

  /**
   * Initialize search input with live search
   */
  private initSearchInput(): void {
    const searchInput = $$id('group-search');
    const searchContainer = $$id('group-search-container');
    const clearButton = $$id('group-search-clear');
    const resultsContainer = $$id('group-search-results');

    if (searchInput === null || !(searchInput instanceof HTMLInputElement)) {
      console.warn('[initSearchInput] Search input not found');
      return;
    }

    // Input event - live search
    searchInput.addEventListener('input', () => {
      const query = searchInput.value;
      this.currentSearchQuery = query;

      // Toggle has-value class
      if (query.length > 0) {
        searchContainer?.classList.add('search-input--has-value');
      } else {
        searchContainer?.classList.remove('search-input--has-value');
      }

      // Apply filters and re-render
      this.filteredGroups = this.applyAllFilters();
      renderGroupTree(this.filteredGroups, this.selectedGroupId);

      // Render search results preview
      if (query.length > 0 && resultsContainer !== null) {
        this.renderSearchResults(this.filteredGroups, query);
      } else {
        this.closeSearchResults();
      }
    });

    // Clear button
    clearButton?.addEventListener('click', () => {
      searchInput.value = '';
      this.currentSearchQuery = '';
      searchContainer?.classList.remove('search-input--has-value');
      this.filteredGroups = this.applyAllFilters();
      renderGroupTree(this.filteredGroups, this.selectedGroupId);
      this.closeSearchResults();
      searchInput.focus();
    });

    // Close results on outside click
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (
        searchContainer !== null &&
        !searchContainer.contains(target) &&
        resultsContainer !== null &&
        !resultsContainer.contains(target)
      ) {
        this.closeSearchResults();
      }
    });
  }

  /**
   * Render search results preview dropdown
   */
  private renderSearchResults(groups: DepartmentGroup[], _query: string): void {
    const resultsContainer = $$id('group-search-results');
    if (resultsContainer === null) return;

    // Flatten groups (including subgroups) for results
    const flattenGroups = (groupsList: DepartmentGroup[]): DepartmentGroup[] => {
      const result: DepartmentGroup[] = [];
      for (const group of groupsList) {
        result.push(group);
        if (group.subgroups !== undefined && group.subgroups.length > 0) {
          result.push(...flattenGroups(group.subgroups));
        }
      }
      return result;
    };

    const flatGroups = flattenGroups(groups);
    const limitedResults = flatGroups.slice(0, 5); // Max 5 results

    if (limitedResults.length === 0) {
      setSafeHTML(
        resultsContainer,
        `
        <div class="search-input__result-item search-input__result-item--empty">
          Keine Gruppen gefunden
        </div>
      `,
      );
      resultsContainer.classList.add('active');
      return;
    }

    const html = limitedResults
      .map(
        (group) => `
        <div class="search-input__result-item" data-group-id="${group.id}">
          <i class="fas fa-folder text-blue-500"></i>
          <span>${group.name}</span>
          ${group.parentName !== undefined && group.parentName !== '' ? `<span class="text-[var(--color-text-secondary)] text-sm ml-2">→ ${group.parentName}</span>` : ''}
        </div>
      `,
      )
      .join('');

    setSafeHTML(resultsContainer, html);
    resultsContainer.classList.add('active');

    // Handle result click
    resultsContainer.querySelectorAll('.search-input__result-item').forEach((item) => {
      item.addEventListener('click', () => {
        const groupId = (item as HTMLElement).dataset['groupId'];
        if (groupId !== undefined && groupId !== '') {
          this.selectGroup(Number.parseInt(groupId, 10));
          this.closeSearchResults();
        }
      });
    });
  }

  /**
   * Close search results dropdown
   */
  private closeSearchResults(): void {
    const resultsContainer = $$id('group-search-results');
    resultsContainer?.classList.remove('active');
  }

  /**
   * Select a group and show its details
   */
  private selectGroup(groupId: number): void {
    this.selectedGroupId = groupId;

    // Update active state in tree
    document.querySelectorAll('.tree-item').forEach((item) => {
      item.classList.remove('tree-item--active');
    });
    const selectedItem = document.querySelector(`[data-group-id="${groupId}"]`);
    selectedItem?.classList.add('tree-item--active');

    // Show group details
    const group = this.findGroupById(groupId);
    if (group !== null) {
      renderGroupDetails(group);
    }
  }

  /**
   * Find group by ID recursively
   * Public method for window handlers access
   */
  public findGroupById(id: number, items: DepartmentGroup[] = this.groups): DepartmentGroup | null {
    for (const group of items) {
      if (group.id === id) return group;
      if (group.subgroups !== undefined && group.subgroups.length > 0) {
        const found = this.findGroupById(id, group.subgroups);
        if (found !== null) return found;
      }
    }
    return null;
  }

  /**
   * Filter groups by status (recursive for subgroups)
   */
  private filterByStatus(groupsList: DepartmentGroup[], status: GroupStatusFilter): DepartmentGroup[] {
    const filterGroup = (group: DepartmentGroup): DepartmentGroup | null => {
      // Filter subgroups recursively
      const filteredSubgroups =
        group.subgroups?.map((sub) => filterGroup(sub)).filter((g): g is DepartmentGroup => g !== null) ?? [];

      // Check if this group matches the filter
      const matchesFilter =
        status === 'all' ||
        (status === 'active' && group.status === 'active') ||
        (status === 'inactive' && group.status === 'inactive');

      // Keep group if it matches OR if it has matching subgroups
      if (matchesFilter || filteredSubgroups.length > 0) {
        return {
          ...group,
          subgroups: filteredSubgroups,
        };
      }

      return null;
    };

    return groupsList.map((group) => filterGroup(group)).filter((g): g is DepartmentGroup => g !== null);
  }

  /**
   * Filter groups by search query (recursive for subgroups)
   */
  private filterBySearch(groupsList: DepartmentGroup[], query: string): DepartmentGroup[] {
    const searchTerm = query.toLowerCase().trim();

    if (searchTerm === '') {
      return groupsList;
    }

    const filterGroup = (group: DepartmentGroup): DepartmentGroup | null => {
      // Filter subgroups recursively
      const filteredSubgroups =
        group.subgroups?.map((sub) => filterGroup(sub)).filter((g): g is DepartmentGroup => g !== null) ?? [];

      // Check if this group matches search
      const matchesSearch = group.name.toLowerCase().includes(searchTerm);

      // Keep group if it matches OR if it has matching subgroups
      if (matchesSearch || filteredSubgroups.length > 0) {
        return {
          ...group,
          subgroups: filteredSubgroups,
        };
      }

      return null;
    };

    return groupsList.map((group) => filterGroup(group)).filter((g): g is DepartmentGroup => g !== null);
  }

  /**
   * Apply all filters (status + search)
   */
  private applyAllFilters(): DepartmentGroup[] {
    let result = this.filterByStatus(this.groups, this.currentStatusFilter);
    result = this.filterBySearch(result, this.currentSearchQuery);
    return result;
  }

  /**
   * Load all groups from API
   */
  async loadGroups(): Promise<void> {
    showLoading();

    this.groups = await this.api.fetchAll();

    hideLoading();

    if (this.groups.length === 0) {
      showEmptyState();
      clearGroupDetails();
      return;
    }

    // Apply filters
    this.filteredGroups = this.applyAllFilters();

    showContent();
    renderGroupTree(this.filteredGroups, this.selectedGroupId);

    // If a group was selected before reload, re-select it
    if (this.selectedGroupId !== null) {
      const group = this.findGroupById(this.selectedGroupId);
      if (group !== null) {
        renderGroupDetails(group);
      }
    } else {
      clearGroupDetails();
    }
  }

  /**
   * Load departments for checklist
   */
  async loadDepartmentsChecklist(selectedIds: number[] = []): Promise<void> {
    if (this.departments.length === 0) {
      this.departments = await this.api.fetchDepartments();
    }
    this.api.loadDepartmentChecklist(this.departments, selectedIds);
  }

  /**
   * Load parent groups dropdown (exclude current group when editing)
   */
  loadParentGroupsDropdown(): void {
    this.api.loadParentGroups(this.groups, this.currentGroupId ?? undefined);
  }

  /**
   * Create new group
   */
  async createGroup(data: Partial<DepartmentGroup>): Promise<DepartmentGroup> {
    const response = await this.api.create(data);
    await this.loadGroups();
    return response;
  }

  /**
   * Update existing group
   */
  async updateGroup(id: number, data: Partial<DepartmentGroup>): Promise<DepartmentGroup> {
    const response = await this.api.update(id, data);
    await this.loadGroups();
    return response;
  }

  /**
   * Delete group
   */
  async deleteGroup(id: number): Promise<void> {
    await this.api.delete(id);
    this.selectedGroupId = null;
    await this.loadGroups();
    clearGroupDetails();
  }

  /**
   * Confirm delete and execute deletion
   */
  async confirmDelete(groupId: number): Promise<void> {
    try {
      await this.deleteGroup(groupId);
      closeDeleteModal();
      showSuccessAlert('Gruppe erfolgreich gelöscht');
    } catch (error) {
      console.error('[confirmDelete] Delete failed:', error);
      showErrorAlert('Fehler beim Löschen der Gruppe');
    }
  }

  /**
   * Get group details by ID
   */
  async getGroupDetails(id: number): Promise<DepartmentGroup | null> {
    return await this.api.getDetails(id);
  }
}

// Export manager instance
let departmentGroupsManager: DepartmentGroupsManager | null = null;

/**
 * Save group handler (Create or Update)
 */
/**
 * Extract selected departments from checkboxes
 */
function extractSelectedDepartments(formData: FormData): number[] {
  return formData
    .getAll('departments')
    .filter((id): id is string => typeof id === 'string')
    .map((id) => Number.parseInt(id, 10));
}

/**
 * Extract form data into data object
 * NOTE: Optional fields with empty strings are omitted (not set to null)
 * because express-validator's .optional() treats null as invalid
 */
function extractFormData(formData: FormData): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  formData.forEach((value, key) => {
    // Guard: Only process string values
    if (typeof value !== 'string') return;

    // Special case: description (empty → null)
    if (key === 'description') {
      // eslint-disable-next-line security/detect-object-injection -- Safe: key comes from FormData
      data[key] = value === '' ? null : value;
      return;
    }

    // Special case: parentGroupId (omit if empty)
    if (key === 'parentGroupId' && value !== '') {
      data['parentGroupId'] = Number.parseInt(value, 10);
      return;
    }

    // Skip empty parentGroupId
    if (key === 'parentGroupId') return;

    // Default: set all other fields as-is
    // eslint-disable-next-line security/detect-object-injection -- Safe: key comes from FormData
    data[key] = value;
  });

  return data;
}

async function handleSaveGroup(): Promise<void> {
  console.info('[saveGroup] Function called');

  const form = $$id('group-form');
  if (!(form instanceof HTMLFormElement)) {
    console.error('[saveGroup] Form not found or not a form element');
    return;
  }

  const formData = new FormData(form);
  const data = extractFormData(formData);
  data['departmentIds'] = extractSelectedDepartments(formData);

  // Ensure required fields
  if (typeof data['name'] !== 'string' || data['name'].length === 0) {
    showErrorAlert('Bitte füllen Sie alle Pflichtfelder aus');
    return;
  }

  // Validate minimum department count
  if (!Array.isArray(data['departmentIds']) || data['departmentIds'].length < 2) {
    showErrorAlert('Mindestens 2 Abteilungen erforderlich');
    return;
  }

  try {
    console.info('[saveGroup] Starting save operation...');

    const groupIdInput = $$id('group-id');
    const isEdit = groupIdInput instanceof HTMLInputElement && groupIdInput.value !== '';

    if (isEdit) {
      const groupId = Number.parseInt(groupIdInput.value, 10);
      console.info('[saveGroup] Updating group ID:', groupId);
      await departmentGroupsManager?.updateGroup(groupId, data as Partial<DepartmentGroup>);
      showSuccessAlert('Gruppe erfolgreich aktualisiert');
    } else {
      console.info('[saveGroup] Creating new group...');
      await departmentGroupsManager?.createGroup(data as Partial<DepartmentGroup>);
      showSuccessAlert('Gruppe erfolgreich erstellt');
    }

    console.info('[saveGroup] Save successful, closing modal...');
    const w = window as WindowWithGroupHandlers;
    w.hideGroupModal?.();
    form.reset();

    if (departmentGroupsManager !== null) {
      departmentGroupsManager.currentGroupId = null;
    }
  } catch (error) {
    console.error('[saveGroup] Error saving group:', error);
    showErrorAlert('Fehler beim Speichern der Gruppe');
  }
}

/**
 * Setup window handlers for global access
 */
function setupWindowHandlers(): void {
  const w = window as WindowWithGroupHandlers;

  w.editGroup = async (id: number) => {
    const group = await departmentGroupsManager?.getGroupDetails(id);
    if (group === null || group === undefined) {
      showErrorAlert('Gruppe nicht gefunden');
      return;
    }

    console.info('[editGroup] Editing group:', group);

    // Set current group ID for update
    if (departmentGroupsManager !== null) {
      departmentGroupsManager.currentGroupId = id;
    }

    // Load parent groups dropdown (exclude current group)
    departmentGroupsManager?.loadParentGroupsDropdown();

    // Load departments checklist with selected departments
    const selectedDepartmentIds = group.departments?.map((d) => d.id) ?? [];
    await departmentGroupsManager?.loadDepartmentsChecklist(selectedDepartmentIds);

    // Show modal in edit mode with group data
    showEditGroupModal(group);
    resetModalScroll();
  };

  w.deleteGroup = (id: number): Promise<void> => {
    const group = departmentGroupsManager?.findGroupById(id);
    if (group === undefined || group === null) {
      showErrorAlert('Gruppe nicht gefunden');
      return Promise.resolve();
    }
    showDeleteModal(id, group.name);
    return Promise.resolve();
  };

  w.showGroupModal = () => {
    if (departmentGroupsManager !== null) {
      departmentGroupsManager.currentGroupId = null;
    }
    showAddGroupModal();
    departmentGroupsManager?.loadParentGroupsDropdown();
    if (departmentGroupsManager !== null) {
      void departmentGroupsManager.loadDepartmentsChecklist();
    }
    resetModalScroll();
  };

  w.hideGroupModal = () => {
    if (departmentGroupsManager !== null) {
      departmentGroupsManager.currentGroupId = null;
    }
    closeGroupModal();
  };

  w.saveGroup = handleSaveGroup;

  // Setup form handlers
  setupFormSubmitHandler();
  setupParentGroupDropdown();
}

/**
 * Initialize on DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname === '/manage-department-groups') {
    departmentGroupsManager = new DepartmentGroupsManager();
    setupWindowHandlers(); // Already calls setupParentGroupDropdown() inside!
    void departmentGroupsManager.loadGroups();
    void departmentGroupsManager.loadDepartmentsChecklist();
  }
});

export { DepartmentGroupsManager };
