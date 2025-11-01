/* eslint-disable max-lines */
/**
 * Admin Employees Management
 * Handles employee CRUD operations for admin dashboard
 */

import { ApiClient } from '../../../utils/api-client';
import { mapUsers, type UserAPIResponse } from '../../../utils/api-mappers';
import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';
import { $$id, setSafeHTML } from '../../../utils/dom-utils';
import type { Employee, Department, Team, WindowWithEmployeeHandlers } from './types';
import { renderEmployeesTable, setupFormSubmitHandler } from './ui';
import { setEmployeesManager } from './data';
import {
  showAddEmployeeModal,
  closeEmployeeModal,
  closeDeleteModal,
  setupValidationListeners,
  setupEditEmployee,
  setupDeleteEmployee,
  setupShowEmployeeModal,
  setupHideEmployeeModal,
  setupCloseEmployeeModal,
  setupSaveEmployee,
  setupLoadEmployeesTable,
  setupLoadDropdowns,
} from './forms';

class EmployeesManager {
  public apiClient: ApiClient;
  public employees: Employee[] = []; // Public for window handler access
  private currentFilter: 'all' | 'active' | 'inactive' = 'all';
  private searchTerm = '';
  public currentEmployeeId: number | null = null; // Track current employee being edited

  constructor() {
    this.apiClient = ApiClient.getInstance();
    this.initializeEventListeners();
  }

  public handleEmployeeSaveError(error: unknown): void {
    console.error('Error saving employee:', error);

    const errorObj = error as {
      message?: string;
      code?: string;
      name?: string;
      details?: { field: string; message: string }[];
    };

    // First check for validation errors with details
    if (errorObj.code === 'VALIDATION_ERROR' && errorObj.details !== undefined && errorObj.details.length > 0) {
      const validationMessages = errorObj.details.map((detail) => {
        if (detail.field === 'employeeNumber') {
          if (detail.message.includes('max 10 characters')) {
            return 'Personalnummer: Maximal 10 Zeichen (Buchstaben, Zahlen, Bindestrich)';
          }
          return 'Personalnummer ist ein Pflichtfeld und darf nicht leer sein';
        }
        if (detail.field === 'email') return 'E-Mail-Adresse ist ungültig oder fehlt';
        if (detail.field === 'firstName') return 'Vorname ist ein Pflichtfeld';
        if (detail.field === 'lastName') return 'Nachname ist ein Pflichtfeld';
        if (detail.field === 'password') return 'Passwort muss mindestens 8 Zeichen lang sein';
        return `${detail.field}: ${detail.message}`;
      });

      showErrorAlert('Bitte korrigieren Sie folgende Eingaben:\n' + validationMessages.join('\n'));
      return;
    }

    if (errorObj.message !== undefined) {
      const errorMessage = errorObj.message.toLowerCase();
      console.error('Error message to check:', errorObj.message);

      if (errorMessage.includes('email already exists') || errorMessage.includes('email existiert bereits')) {
        showErrorAlert('Diese E-Mail-Adresse ist bereits vergeben. Bitte verwenden Sie eine andere E-Mail-Adresse.');
      } else if (
        errorMessage.includes('username already exists') ||
        errorMessage.includes('benutzername existiert bereits')
      ) {
        showErrorAlert('Dieser Benutzername ist bereits vergeben. Bitte wählen Sie einen anderen Benutzernamen.');
      } else if (errorMessage.includes('duplicate') || errorMessage.includes('duplikat')) {
        showErrorAlert('Ein Mitarbeiter mit diesen Daten existiert bereits.');
      } else if (errorMessage.includes('invalid input')) {
        showErrorAlert('Bitte überprüfen Sie Ihre Eingaben. Alle Pflichtfelder müssen ausgefüllt sein.');
      } else {
        showErrorAlert(errorObj.message);
      }
      return;
    }

    console.error('Unknown error type:', error);
    showErrorAlert('Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
  }

  /**
   * Initialize all event listeners - orchestrates setup
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
   * Initialize floating action button for adding employees
   */
  private initFloatingActionButton(): void {
    document.querySelector('.add-employee-btn')?.addEventListener('click', () => {
      // Reset current employee ID for new employee
      this.currentEmployeeId = null;
      showAddEmployeeModal();
    });
  }

  /**
   * Initialize status toggle group (Active/Inactive/All)
   */
  private initStatusToggle(): void {
    const toggleGroup = document.querySelector('#employee-status-toggle');
    toggleGroup?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.toggle-group__btn');
      if (btn === null || btn.disabled) {
        return;
      }

      const status = btn.dataset.status as 'active' | 'inactive' | 'all' | undefined;
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
      void this.loadEmployees();
    });
  }

  /**
   * Initialize search input with live preview dropdown
   */
  private initSearchInput(): void {
    const searchInput = $$id('employee-search');
    if (searchInput instanceof HTMLInputElement) {
      // Live search on input
      searchInput.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value;
        this.searchTerm = query;

        const filtered = this.filterBySearch(this.employees);
        renderSearchResults(filtered, query);

        void this.loadEmployees();
      });

      // Enter key submits search
      searchInput.addEventListener('keypress', (e) => {
        if (e instanceof KeyboardEvent && e.key === 'Enter') {
          this.searchTerm = searchInput.value;
          closeSearchResults();
          void this.loadEmployees();
        }
      });
    }

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
   * Initialize modal close buttons (employee modal and delete modal)
   */
  private initModalCloseButtons(): void {
    // Employee modal close buttons
    document.querySelector('#close-employee-modal')?.addEventListener('click', () => {
      // Reset current employee ID when closing modal
      this.currentEmployeeId = null;
      closeEmployeeModal();
    });

    document.querySelector('#cancel-employee-modal')?.addEventListener('click', () => {
      // Reset current employee ID when closing modal
      this.currentEmployeeId = null;
      closeEmployeeModal();
    });

    // Delete modal close buttons
    document.querySelector('#close-delete-modal')?.addEventListener('click', () => {
      closeDeleteModal();
    });

    document.querySelector('#cancel-delete-modal')?.addEventListener('click', () => {
      closeDeleteModal();
    });

    // Delete confirmation button
    document.querySelector('#confirm-delete-employee')?.addEventListener('click', () => {
      const deleteInput = document.querySelector<HTMLInputElement>('#delete-employee-id');
      if (deleteInput !== null && deleteInput.value !== '') {
        void this.confirmDelete(Number.parseInt(deleteInput.value, 10));
      }
    });
  }

  /**
   * Confirm delete and execute deletion
   */
  async confirmDelete(employeeId: number): Promise<void> {
    try {
      await this.deleteEmployee(employeeId);
      closeDeleteModal();
    } catch (error) {
      console.error('[confirmDelete] Delete failed:', error);
      showErrorAlert('Fehler beim Löschen des Mitarbeiters');
    }
  }

  /**
   * Initialize event delegation for table actions (edit, delete)
   */
  private initTableActions(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const w = window as WindowWithEmployeeHandlers;

      // Handle edit employee (from table)
      const editBtn = target.closest<HTMLElement>('[data-action="edit-employee"]');
      if (editBtn) {
        const employeeId = editBtn.dataset.employeeId;
        if (employeeId !== undefined) {
          void w.editEmployee?.(Number.parseInt(employeeId, 10));
        }
      }

      // Handle edit from search results
      const searchResultItem = target.closest<HTMLElement>('[data-action="edit-from-search"]');
      if (searchResultItem) {
        const employeeId = searchResultItem.dataset.employeeId;
        if (employeeId !== undefined) {
          closeSearchResults();
          void w.editEmployee?.(Number.parseInt(employeeId, 10));
        }
      }

      // Handle delete employee
      const deleteBtn = target.closest<HTMLElement>('[data-action="delete-employee"]');
      if (deleteBtn) {
        const employeeId = deleteBtn.dataset.employeeId;
        if (employeeId !== undefined) {
          void w.deleteEmployee?.(Number.parseInt(employeeId, 10));
        }
      }
    });
  }

  /**
   * Initialize custom dropdown components (following manage-admins pattern)
   */
  private initCustomDropdowns(): void {
    // Initialize all dropdowns (position, status, availability status, department, team)
    this.initDropdown('position-dropdown', 'position-trigger', 'position-menu', 'employee-position');
    this.initDropdown('status-dropdown', 'status-trigger', 'status-menu', 'employee-status');
    this.initDropdown(
      'availability-status-dropdown',
      'availability-status-trigger',
      'availability-status-menu',
      'availability-status',
    );
    this.initDropdown('department-dropdown', 'department-trigger', 'department-menu', 'employee-department');
    this.initDropdown('team-dropdown', 'team-trigger', 'team-menu', 'employee-team');
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

      const value = option.dataset.value ?? '';
      const displayText = option.textContent.trim() !== '' ? option.textContent.trim() : value;

      // Update hidden input
      if (hiddenInput !== null) {
        hiddenInput.value = value;
      }

      // Update trigger text
      const triggerSpan = trigger.querySelector('span');
      if (triggerSpan !== null) {
        // Check if option contains a badge (for status dropdown)
        const badge = option.querySelector('.badge');
        if (badge !== null) {
          // Clone badge for status display - use setSafeHTML for internal HTML
          setSafeHTML(triggerSpan, badge.outerHTML);
        } else {
          // Plain text for position/availability
          triggerSpan.textContent = displayText;
        }
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

  private filterByStatus(employees: Employee[]): Employee[] {
    if (this.currentFilter === 'active') {
      return employees.filter((emp) => emp.is_active);
    } else if (this.currentFilter === 'inactive') {
      return employees.filter((emp) => !emp.is_active);
    }
    return employees;
  }

  private filterBySearch(employees: Employee[]): Employee[] {
    if (this.searchTerm.length === 0) return employees;

    const search = this.searchTerm.toLowerCase();
    return employees.filter(
      (emp) =>
        (emp.first_name?.toLowerCase().includes(search) ?? false) ||
        (emp.last_name?.toLowerCase().includes(search) ?? false) ||
        emp.email.toLowerCase().includes(search) ||
        (emp.position?.toLowerCase().includes(search) ?? false) ||
        (emp.employeeId?.toLowerCase().includes(search) ?? false),
    );
  }

  async loadEmployees(): Promise<void> {
    try {
      const params: Record<string, string> = {};

      if (this.currentFilter !== 'all') {
        params.status = this.currentFilter;
      }

      if (this.searchTerm.length > 0) {
        params.search = this.searchTerm;
      }

      // ApiClient adds /api/v2 or /api prefix automatically based on feature flag
      const response = await this.apiClient.request<UserAPIResponse[]>('/users', {
        method: 'GET',
      });

      // Handle empty response
      if (!Array.isArray(response)) {
        this.employees = [];
        renderEmployeesTable(this.employees);
        return;
      }

      // Map response through api-mappers for consistent field names
      const mappedUsers = mapUsers(response);

      // Map users to employees and apply security filter
      this.employees = this.mapUsersToEmployees(mappedUsers);

      // Apply filters
      this.employees = this.filterByStatus(this.employees);
      this.employees = this.filterBySearch(this.employees);

      // V2 API already provides availability data in the user objects
      // The availabilityStatus field is now included directly in the user response
      console.info('[EmployeesManager] Using availability data from v2 API');

      renderEmployeesTable(this.employees);
    } catch (error) {
      console.error('Error loading employees:', error);
      // Check if it's a 404 (no data) - in that case just show empty state
      const errorObj = error as { status?: number; message?: string };
      if (errorObj.status === 404) {
        // No employees found - this is OK, just show empty state
        this.employees = [];
        renderEmployeesTable(this.employees);
      } else {
        // Real error - show error message
        showErrorAlert('Fehler beim Laden der Mitarbeiter');
      }
    }
  }

  private deriveStatusFromAvailability(availabilityStatus?: string): Employee['status'] {
    // Map availability status to employee status
    if (availabilityStatus === undefined) {
      return 'active';
    }

    const status = availabilityStatus.toLowerCase();
    if (status.includes('vacation')) {
      return 'vacation';
    } else if (status.includes('sick')) {
      return 'sick';
    } else if (status.includes('terminated')) {
      return 'terminated';
    } else if (status === 'unavailable' || status === 'inactive') {
      return 'inactive';
    }
    return 'active';
  }

  private mapUsersToEmployees(mappedUsers: ReturnType<typeof mapUsers>): Employee[] {
    // CRITICAL SECURITY: Only show users with role='employee'
    // NEVER show admins or roots in the employees table
    // Admins cannot manage other admins or see root users
    return mappedUsers
      .filter((user) => user.role === 'employee')
      .map(
        (user): Employee => ({
          // Map basic User fields (snake_case for compatibility with Employee which extends User)
          id: user.id,
          username: user.username,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          role: user.role,
          tenant_id: user.tenantId,
          is_active: user.isActive,
          is_archived: false, // Default to false as MappedUser doesn't have this field
          created_at: user.createdAt ?? '',
          updated_at: user.updatedAt ?? '',

          // Map Employee-specific fields
          firstName: user.firstName,
          lastName: user.lastName,
          departmentId: user.departmentId ?? undefined,
          departmentName: user.departmentName,
          department_id: user.departmentId ?? undefined,
          department_name: user.departmentName,
          teamId: user.teamId ?? undefined,
          teamName: user.teamName,
          team_id: user.teamId ?? undefined,
          team_name: user.teamName,
          position: user.position,
          employeeNumber: user.employeeNumber,
          employee_number: user.employeeNumber,

          // Map availability fields
          availabilityStatus: user.availabilityStatus,
          availability_status: user.availabilityStatus,
          availabilityStart: user.availabilityStart,
          availability_start: user.availabilityStart,
          availabilityEnd: user.availabilityEnd,
          availability_end: user.availabilityEnd,
          availabilityNotes: user.availabilityNotes,
          availability_notes: user.availabilityNotes,

          // Derive status from availability
          status: this.deriveStatusFromAvailability(user.availabilityStatus),
        }),
      );
  }

  async createEmployee(data: Partial<Employee>): Promise<Employee> {
    // Clean optional fields - send undefined instead of empty strings
    const cleanedData = { ...data };

    // Store teamId separately for later assignment
    const teamId = cleanedData.teamId;
    delete cleanedData.teamId; // Remove from user creation data

    // Handle optional fields - delete empty strings
    if (cleanedData.phone === '') {
      delete cleanedData.phone;
    }
    // Handle birthday field - keep as is, DB column is 'birthday'
    if (cleanedData.birthday === '') {
      delete cleanedData.birthday;
    }
    if (cleanedData.position === '') {
      delete cleanedData.position;
    }
    if (cleanedData.employeeNumber === '' || cleanedData.employeeNumber === undefined) {
      // Generate unique employee number if not provided
      cleanedData.employeeNumber = `EMP${Date.now()}`;
    }

    // Remove availability fields for new employees
    delete cleanedData.availabilityStatus;
    delete cleanedData.availabilityStart;
    delete cleanedData.availabilityEnd;
    delete cleanedData.availabilityNotes;

    const response = await this.apiClient.request<UserAPIResponse>('/users', {
      method: 'POST',
      body: JSON.stringify(cleanedData),
    });

    // If teamId was provided, assign the user to the team
    // Only assign if teamId is a valid number (not undefined, null, 0, or empty string)
    if (teamId !== undefined && typeof teamId === 'number' && teamId > 0) {
      try {
        console.info('[createEmployee] Assigning user to team:', teamId);
        // Use the same endpoint as manage-teams
        await this.apiClient.request(`/teams/${teamId}/members`, {
          method: 'POST',
          body: JSON.stringify({ userId: response.id }),
        });
        console.info('[createEmployee] User successfully assigned to team');
      } catch (error) {
        console.error('[createEmployee] Error assigning user to team:', error);
        // Don't fail the whole operation, just show a warning
        showErrorAlert('Mitarbeiter wurde erstellt, aber die Team-Zuweisung ist fehlgeschlagen');
      }
    }

    showSuccessAlert('Mitarbeiter erfolgreich erstellt');

    // Reload employees list without page reload (like in manage-admins)
    console.info('[createEmployee] Reloading employees list...');
    await this.loadEmployees();
    console.info('[createEmployee] Employees list reloaded successfully');

    // Map single user response
    const mappedUsers = mapUsers([response]);
    return mappedUsers[0] as unknown as Employee;
  }

  private async handleTeamAssignmentChange(
    userId: number,
    newTeamIdRaw: number | undefined,
    currentTeamId: number | undefined,
  ): Promise<void> {
    const newTeamIdNum = newTeamIdRaw ?? null;
    const currentTeamIdNum = currentTeamId ?? null;

    console.info('[updateEmployee] Team comparison:', {
      newTeamId: newTeamIdNum,
      currentTeamId: currentTeamIdNum,
      willUpdate: newTeamIdNum !== currentTeamIdNum,
    });

    if (newTeamIdNum === currentTeamIdNum) {
      console.info('[updateEmployee] Team unchanged, skipping team assignment');
      return;
    }

    // Remove from old team if exists
    if (currentTeamIdNum !== null) {
      try {
        console.info('[updateEmployee] Removing user from old team:', currentTeamIdNum);
        await this.apiClient.request(`/teams/${currentTeamIdNum}/members/${userId}`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.error('[updateEmployee] Error removing from old team:', error);
      }
    }

    // Add to new team if specified
    if (newTeamIdNum !== null) {
      try {
        console.info('[updateEmployee] Assigning user to new team:', newTeamIdNum);
        await this.apiClient.request(`/teams/${newTeamIdNum}/members`, {
          method: 'POST',
          body: JSON.stringify({ userId }),
        });
        console.info('[updateEmployee] User successfully assigned to new team');
      } catch (error) {
        console.error('[updateEmployee] Error assigning to new team:', error);
        showErrorAlert('Team-Zuweisung konnte nicht aktualisiert werden');
      }
    }
  }

  async updateEmployee(id: number, data: Partial<Employee>): Promise<Employee> {
    // SECURITY: First check if user is actually an employee
    const user = await this.getEmployeeDetails(id);
    if (user === null) {
      showErrorAlert('Mitarbeiter nicht gefunden');
      throw new Error('User not found');
    }

    // CRITICAL: Never allow editing of admins or roots
    if (user.role !== 'employee') {
      showErrorAlert('Sicherheitsfehler: Diese Aktion ist nicht erlaubt');
      console.error(`SECURITY VIOLATION: Attempted to update user with role ${user.role}`);
      throw new Error('Security violation');
    }

    // Store teamId separately for later assignment
    const newTeamIdRaw = data.teamId;
    const currentTeamId = user.teamId;
    delete data.teamId; // Remove from user update data

    try {
      const response = await this.apiClient.request<UserAPIResponse>(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      // Handle team assignment changes
      await this.handleTeamAssignmentChange(id, newTeamIdRaw, currentTeamId);

      showSuccessAlert('Mitarbeiter erfolgreich aktualisiert');
      await this.loadEmployees();

      // Map single user response
      const mappedUsers = mapUsers([response]);
      return mappedUsers[0] as unknown as Employee;
    } catch (error) {
      console.error('Error updating employee:', error);
      showErrorAlert('Fehler beim Aktualisieren des Mitarbeiters');
      throw error;
    }
  }

  async deleteEmployee(id: number): Promise<void> {
    // SECURITY: First check if user is actually an employee
    const user = await this.getEmployeeDetails(id);
    if (user === null) {
      showErrorAlert('Mitarbeiter nicht gefunden');
      return;
    }

    // CRITICAL: Never allow deletion of admins or roots
    if (user.role !== 'employee') {
      showErrorAlert('Sicherheitsfehler: Diese Aktion ist nicht erlaubt');
      console.error(`SECURITY VIOLATION: Attempted to delete user with role ${user.role}`);
      return;
    }

    // Note: Confirmation is now handled by the delete modal (showDeleteModal)
    try {
      await this.apiClient.request(`/users/${id}`, {
        method: 'DELETE',
      });

      showSuccessAlert('Mitarbeiter erfolgreich gelöscht');
      await this.loadEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      showErrorAlert('Fehler beim Löschen des Mitarbeiters');
    }
  }

  async getEmployeeDetails(id: number): Promise<Employee | null> {
    try {
      const response = await this.apiClient.request<UserAPIResponse>(`/users/${id}`, {
        method: 'GET',
      });

      // Map single user response
      const mappedUsers = mapUsers([response]);
      return mappedUsers[0] as unknown as Employee;
    } catch (error) {
      console.error('Error getting employee details:', error);
      showErrorAlert('Fehler beim Laden der Mitarbeiterdetails');
      return null;
    }
  }

  async loadDepartments(): Promise<Department[]> {
    try {
      return await this.apiClient.request<Department[]>('/departments', {
        method: 'GET',
      });
    } catch (error) {
      console.error('Error loading departments:', error);
      return [];
    }
  }

  async loadTeams(): Promise<Team[]> {
    try {
      return await this.apiClient.request<Team[]>('/teams', {
        method: 'GET',
      });
    } catch (error) {
      console.error('Error loading teams:', error);
      return [];
    }
  }
}

// Export manager instance
let employeesManager: EmployeesManager | null = null;

// Setup URL change handling

function setupUrlChangeHandlers(): void {
  // Check URL and load employees if needed
  const checkAndLoadEmployees = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const currentPath = window.location.pathname;

    // Load employees if on admin dashboard employees section OR on manage-employees page
    if (urlParams.get('section') === 'employees' || currentPath.includes('manage-employees')) {
      void employeesManager?.loadEmployees();
    }
  };

  // Initial check
  checkAndLoadEmployees();

  // Listen for URL changes
  window.addEventListener('popstate', checkAndLoadEmployees);

  // Override pushState and replaceState
  const originalPushState = window.history.pushState.bind(window.history);
  window.history.pushState = function (...args: Parameters<typeof window.history.pushState>) {
    originalPushState.apply(window.history, args);
    setTimeout(checkAndLoadEmployees, 100);
  };

  const originalReplaceState = window.history.replaceState.bind(window.history);
  window.history.replaceState = function (...args: Parameters<typeof window.history.replaceState>) {
    originalReplaceState.apply(window.history, args);
    setTimeout(checkAndLoadEmployees, 100);
  };
}

// ============================================================
// Search Preview Functions
// ============================================================

/**
 * Escape special regex characters to prevent injection
 */
function escapeRegex(str: string): string {
  return str.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
}

/**
 * Highlight search term in text
 */
function highlightMatch(text: string, query: string): string {
  if (query === '' || query.trim() === '') {
    return text;
  }

  const escapedQuery = escapeRegex(query);
  // eslint-disable-next-line security/detect-non-literal-regexp -- Safe: escapedQuery is sanitized
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return text.replace(regex, '<strong>$1</strong>');
}

/**
 * Generate HTML for a single search result item
 */
function generateSearchResultItem(employee: Employee, query: string): string {
  const fullName = `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim();
  const position = employee.position ?? 'Keine Position';
  const employeeNumber = employee.employeeNumber ?? employee.employee_number ?? '';

  return `
    <div class="search-input__result-item" data-employee-id="${String(employee.id)}" data-action="edit-from-search">
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div style="font-weight: 500; color: var(--color-text-primary);">
          ${highlightMatch(fullName, query)}
        </div>
        <div style="font-size: 0.813rem; color: var(--color-text-secondary);">
          ${highlightMatch(employee.email, query)}
        </div>
        <div style="font-size: 0.75rem; color: var(--color-text-muted); display: flex; gap: 8px;">
          <span>${highlightMatch(position, query)}</span>
          ${employeeNumber !== '' ? `<span>• ${highlightMatch(employeeNumber, query)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render search results dropdown
 */
function renderSearchResults(results: Employee[], query: string): void {
  const resultsContainer = document.querySelector<HTMLElement>('#employee-search-results');
  const searchWrapper = document.querySelector<HTMLElement>('.search-input-wrapper');

  if (resultsContainer === null || searchWrapper === null) {
    return;
  }

  // If no query, hide results
  if (query === '' || query.trim() === '') {
    searchWrapper.classList.remove('search-input-wrapper--open');
    resultsContainer.innerHTML = '';
    return;
  }

  // Show results dropdown
  searchWrapper.classList.add('search-input-wrapper--open');

  // If no results
  if (results.length === 0) {
    // Use DOM methods to safely create no-results message
    const noResultsDiv = document.createElement('div');
    noResultsDiv.className = 'search-input__no-results';
    noResultsDiv.textContent = `Keine Mitarbeiter gefunden für "${query}"`;
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(noResultsDiv);
    return;
  }

  // Limit to 5 results for dropdown
  const limitedResults = results.slice(0, 5);

  const resultsHTML = limitedResults.map((emp) => generateSearchResultItem(emp, query)).join('');

  // Add "show all" if more than 5 results
  const showAllHTML =
    results.length > 5
      ? `<div class="search-input__result-item" style="font-size: 0.813rem; color: var(--color-primary); text-align: center; border-top: 1px solid rgb(255 255 255 / 5%);">
          ${String(results.length - 5)} weitere Ergebnisse in Tabelle
        </div>`
      : '';

  // Use setSafeHTML for internally-generated HTML
  setSafeHTML(resultsContainer, resultsHTML + showAllHTML);
}

/**
 * Close search results dropdown
 */
function closeSearchResults(): void {
  const searchWrapper = document.querySelector<HTMLElement>('.search-input-wrapper');
  const resultsContainer = document.querySelector<HTMLElement>('#employee-search-results');

  if (searchWrapper !== null) {
    searchWrapper.classList.remove('search-input-wrapper--open');
  }

  if (resultsContainer !== null) {
    resultsContainer.innerHTML = '';
  }
}

// ============================================================
// Initialize
// ============================================================

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize on admin dashboard or manage-employees page
  if (window.location.pathname === '/admin-dashboard' || window.location.pathname === '/manage-employees') {
    employeesManager = new EmployeesManager();

    // Make employeesManager available to data.ts and forms.ts
    setEmployeesManager(employeesManager);

    // Setup all window handlers
    setupEditEmployee();
    setupDeleteEmployee();
    setupShowEmployeeModal();
    setupHideEmployeeModal();
    setupCloseEmployeeModal();
    setupSaveEmployee();
    setupLoadEmployeesTable();
    setupLoadDropdowns();

    // Setup live email/password validation
    setupValidationListeners();

    // Setup form submit handler and URL change handlers
    setupFormSubmitHandler();
    setupUrlChangeHandlers();
  }
});

export { EmployeesManager };
