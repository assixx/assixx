/* eslint-disable max-lines */
/**
 * UI and Rendering Functions for Employee Management
 * Contains all UI rendering, availability display, and form handling helpers
 */

import type { Employee, WindowWithEmployeeHandlers } from './types';
import { $, $$, $$id, setHTML } from '../../../utils/dom-utils';

/**
 * Render empty state when no employees found
 * @param container - The container element to render into
 * @param currentFilter - Current filter state ('all', 'active', 'inactive')
 */
export function renderEmptyState(
  container: HTMLElement,
  currentFilter: 'all' | 'active' | 'inactive' | 'archived' = 'all',
): void {
  // Get appropriate message based on filter
  const emptyMessage =
    currentFilter === 'inactive'
      ? 'Keine inaktiven Mitarbeiter vorhanden'
      : currentFilter === 'archived'
        ? 'Keine archivierten Mitarbeiter vorhanden'
        : 'Erstellen Sie Ihren ersten Mitarbeiter';

  setHTML(
    container,
    `
      <div class="empty-state">
        <div class="empty-state__icon">
          <i class="fas fa-users"></i>
        </div>
        <h3 class="empty-state__title">Keine Mitarbeiter gefunden</h3>
        <p class="empty-state__description">${emptyMessage}</p>
        <button class="btn btn-primary" id="empty-state-add-btn"><i class="fa-plus fas"></i> Mitarbeiter hinzufügen</button>
      </div>
    `,
  );

  // Add event listener for the button
  const addBtn = container.querySelector('#empty-state-add-btn');
  addBtn?.addEventListener('click', () => {
    const w = window as WindowWithEmployeeHandlers;
    w.showEmployeeModal?.();
  });
}

/**
 * Get display name for an employee
 */
export function getEmployeeDisplayName(employee: Employee): string {
  const firstName = employee.firstName ?? employee.firstName ?? '';
  const lastName = employee.lastName ?? employee.lastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName !== '' ? fullName : employee.username;
}

/**
 * Get active status for an employee
 * UPDATED: Using unified isActive status (2025-12-02)
 * Status: 0=inactive, 1=active, 3=archived, 4=deleted
 */
export function getEmployeeActiveStatus(employee: Employee): boolean {
  // Return true only if isActive === 1 (active)
  return employee.isActive === 1;
}

/**
 * Check if availability dates apply to today
 */
export function checkAvailabilityAppliesToday(startDate?: string, endDate?: string): boolean {
  if (startDate === undefined && endDate === undefined) {
    // If no dates specified, assume it always applies
    return true;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to start of day for comparison

  const start = startDate !== undefined ? new Date(startDate) : null;
  const end = endDate !== undefined ? new Date(endDate) : null;

  if (start !== null) {
    start.setHours(0, 0, 0, 0);
  }
  if (end !== null) {
    end.setHours(23, 59, 59, 999); // End of day
  }

  // Check if today falls within the range
  const afterStart = start === null || today >= start;
  const beforeEnd = end === null || today <= end;

  return afterStart && beforeEnd;
}

/**
 * Get the current availability status (considering dates)
 */
export function getCurrentAvailabilityStatus(employee: Employee): string {
  // Handle both snake_case and camelCase from API
  const rawStatus = employee.availabilityStatus ?? employee.availabilityStatus ?? 'available';

  // Parse the status (handle both single and combined format for compatibility)
  let status = 'available';
  if (typeof rawStatus === 'string') {
    const parts = rawStatus.trim().split(/\s+/);
    if (parts.length > 1) {
      // Combined format like "available vacation" from v2 API
      status = parts[1] ?? 'available';
    } else {
      // Single status from DB
      status = (parts[0] ?? '') !== '' ? (parts[0] ?? 'available') : 'available';
    }
  }

  // If status is already "available", no need to check dates
  if (status === 'available') {
    return 'available';
  }

  // Check if the special status applies to today
  const startDate = employee.availabilityStart ?? employee.availabilityStart;
  const endDate = employee.availabilityEnd ?? employee.availabilityEnd;

  if (checkAvailabilityAppliesToday(startDate, endDate)) {
    return status;
  }

  // Status doesn't apply to today, return available
  return 'available';
}

/**
 * Format the planned availability period
 */
export function getPlannedAvailability(employee: Employee): string {
  const rawStatus = employee.availabilityStatus ?? employee.availabilityStatus ?? 'available';

  // Parse the status (handle both single and combined format for compatibility)
  let status = 'available';
  if (typeof rawStatus === 'string') {
    const parts = rawStatus.trim().split(/\s+/);
    if (parts.length > 1) {
      // Combined format like "available vacation" from v2 API
      status = parts[1] ?? 'available';
    } else {
      // Single status from DB
      status = (parts[0] ?? '') !== '' ? (parts[0] ?? 'available') : 'available';
    }
  }

  // If available, return dash
  if (status === 'available') {
    return '-';
  }

  // Get dates
  const startDate = employee.availabilityStart ?? employee.availabilityStart;
  const endDate = employee.availabilityEnd ?? employee.availabilityEnd;

  // Format the status text
  let statusText = '';
  switch (status) {
    case 'vacation':
      statusText = 'Urlaub';
      break;
    case 'sick':
      statusText = 'Krank';
      break;
    case 'training':
      statusText = 'Schulung';
      break;
    case 'unavailable':
      statusText = 'Nicht verfügbar';
      break;
    case 'other':
      statusText = 'Sonstiges';
      break;
    default:
      statusText = status;
  }

  // Format dates if available
  if (startDate !== undefined || endDate !== undefined) {
    const formatDate = (dateStr?: string): string => {
      if (dateStr === undefined) return '?';
      const date = new Date(dateStr);
      return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
    };

    const startFormatted = formatDate(startDate);
    const endFormatted = formatDate(endDate);

    return `${statusText}: ${startFormatted} - ${endFormatted}`;
  }

  return statusText;
}

/**
 * Get availability badge HTML
 */
export function getAvailabilityBadge(employee: Employee): string {
  // Get the current (today-aware) status
  const status = getCurrentAvailabilityStatus(employee);

  console.info('[EmployeesManager] Availability status for', employee.email, ':', {
    availabilityStatus: employee.availabilityStatus,
    currentStatus: status,
    start: employee.availabilityStart,
    end: employee.availabilityEnd,
  });

  // Farben basierend auf design-standards (BEM notation)
  // Grün = Verfügbar, Orange = Urlaub, Rot = Krank, Cyan = Schulung, Grau = Nicht verfügbar/Sonstiges
  let badgeClass = 'badge badge--success';
  let badgeText = 'Verfügbar';

  switch (status) {
    case 'vacation':
      badgeClass = 'badge badge--warning';
      badgeText = 'Urlaub';
      break;
    case 'sick':
      badgeClass = 'badge badge--danger';
      badgeText = 'Krank';
      break;
    case 'unavailable':
      badgeClass = 'badge badge--error';
      badgeText = 'Nicht verfügbar';
      break;
    case 'training':
      badgeClass = 'badge badge--info';
      badgeText = 'Schulung';
      break;
    case 'other':
      badgeClass = 'badge badge--error';
      badgeText = 'Sonstiges';
      break;
    case 'available':
    default:
      badgeClass = 'badge badge--success';
      badgeText = 'Verfügbar';
      break;
  }

  return `<span class="${badgeClass}">${badgeText}</span>`;
}

// ===== BADGE HELPER FUNCTIONS (Complexity Reduction) =====

/** Check if employee has full tenant access */
function checkEmployeeFullAccess(employee: Employee): boolean {
  return employee.hasFullAccess === true || employee.hasFullAccess === 1;
}

/** Check if employee has team assignments (array or legacy single) */
function hasTeamAssignments(employee: Employee): { hasTeams: boolean; hasArray: boolean } {
  const hasTeamsArray = (employee.teams?.length ?? 0) > 0;
  const hasTeamIdsArray = (employee.teamIds?.length ?? 0) > 0;
  const hasLegacy = employee.teamId != null && employee.teamId > 0;
  const hasArray = hasTeamsArray || hasTeamIdsArray;
  return { hasTeams: hasArray || hasLegacy, hasArray };
}

/** Get team names string for tooltip (from array or legacy field) */
function getTeamNamesString(employee: Employee, hasArray: boolean): string {
  if (hasArray) {
    // Prefer teamNames array (new API format: teamIds + teamNames)
    if ((employee.teamNames?.length ?? 0) > 0) {
      return employee.teamNames?.join(', ') ?? '';
    }
    // Fallback to teams array of objects
    return employee.teams?.map((team) => team.name).join(', ') ?? '';
  }
  return employee.teamName ?? '';
}

/** Build inherited badge with sitemap icon */
function buildInheritedBadge(displayText: string, tooltip: string): string {
  return `<span class="badge badge--info" title="${tooltip}"><i class="fas fa-sitemap mr-1"></i>${displayText}</span>`;
}

/**
 * Get areas badge HTML for employee table
 * Shows count with tooltip listing area names
 * BADGE-INHERITANCE-DISPLAY: Areas are inherited from teams→departments→areas for employees
 */
export function getAreasBadge(employee: Employee): string {
  if (checkEmployeeFullAccess(employee)) {
    return '<span class="badge badge--primary" title="Voller Zugriff auf alle Bereiche"><i class="fas fa-globe mr-1"></i>Alle</span>';
  }

  // Direct area assignments (rare for employees)
  if ((employee.areas?.length ?? 0) > 0) {
    const count = employee.areas?.length ?? 0;
    const label = count === 1 ? 'Bereich' : 'Bereiche';
    const areaNames = employee.areas?.map((area) => area.name).join(', ') ?? '';
    return `<span class="badge badge--info" title="${areaNames}">${String(count)} ${label}</span>`;
  }

  // Inherited via teams→departments→areas
  const { hasTeams, hasArray } = hasTeamAssignments(employee);
  if (hasTeams) {
    return buildAreaInheritedBadge(employee, hasArray);
  }

  return '<span class="badge badge--secondary" title="Kein Bereich zugewiesen">Keine</span>';
}

/** Build area badge showing inherited area name from team chain */
function buildAreaInheritedBadge(employee: Employee, hasArray: boolean): string {
  const { teamAreaName, teamDepartmentName } = employee;
  // Derive teamName from teamNames array if available, else use legacy teamName
  const teamName = (employee.teamNames?.length ?? 0) > 0 ? employee.teamNames?.[0] : employee.teamName;

  if (teamAreaName != null && teamAreaName !== '') {
    const tooltip = `${teamAreaName} (vererbt von: ${teamName ?? 'Team'} → ${teamDepartmentName ?? 'Abteilung'} → ${teamAreaName})`;
    return buildInheritedBadge(teamAreaName, tooltip);
  }

  // Fallback: generic "Vererbt"
  const teamNamesStr = getTeamNamesString(employee, hasArray);
  return buildInheritedBadge('Vererbt', `Vererbt von Team: ${teamNamesStr}`);
}

/**
 * Get departments badge HTML for employee table
 * Shows count with tooltip listing department names
 * BADGE-INHERITANCE-DISPLAY: Departments are inherited from teams for employees
 */
export function getDepartmentsBadge(employee: Employee): string {
  if (checkEmployeeFullAccess(employee)) {
    return '<span class="badge badge--primary" title="Voller Zugriff auf alle Abteilungen"><i class="fas fa-globe mr-1"></i>Alle</span>';
  }

  // Direct department assignments (user_departments table)
  if ((employee.departments?.length ?? 0) > 0) {
    const count = employee.departments?.length ?? 0;
    const label = count === 1 ? 'Abteilung' : 'Abteilungen';
    const deptNames = employee.departments?.map((dept) => dept.name).join(', ') ?? '';
    return `<span class="badge badge--info" title="${deptNames}">${String(count)} ${label}</span>`;
  }

  // Inherited via teams→departments
  const { hasTeams, hasArray } = hasTeamAssignments(employee);
  if (hasTeams) {
    return buildDeptInheritedBadge(employee, hasArray);
  }

  // Legacy departmentName fallback
  if (employee.departmentName != null && employee.departmentName !== '') {
    return `<span class="badge badge--info" title="${employee.departmentName}">${employee.departmentName}</span>`;
  }

  return '<span class="badge badge--secondary" title="Keine Abteilung zugewiesen">Keine</span>';
}

/** Build department badge showing inherited dept name from team */
function buildDeptInheritedBadge(employee: Employee, hasArray: boolean): string {
  const { teamDepartmentName } = employee;
  // Derive teamName from teamNames array if available, else use legacy teamName
  const teamName = (employee.teamNames?.length ?? 0) > 0 ? employee.teamNames?.[0] : employee.teamName;

  if (teamDepartmentName != null && teamDepartmentName !== '') {
    const tooltip = `${teamDepartmentName} (vererbt von Team: ${teamName ?? 'Team'})`;
    return buildInheritedBadge(teamDepartmentName, tooltip);
  }

  // Fallback: generic "Vererbt"
  const teamNamesStr = getTeamNamesString(employee, hasArray);
  return buildInheritedBadge('Vererbt', `Vererbt von Team: ${teamNamesStr}`);
}

/**
 * Check if employee has valid team arrays (teamIds + teamNames)
 */
function hasValidTeamArrays(teamIds: number[] | undefined, teamNames: string[] | undefined): teamNames is string[] {
  return Array.isArray(teamIds) && teamIds.length > 0 && Array.isArray(teamNames) && teamNames.length > 0;
}

/**
 * Build badge from team arrays
 */
function buildTeamArrayBadge(teamNames: string[]): string {
  const count = teamNames.length;
  const names = teamNames.join(', ');
  const displayText = count === 1 ? (teamNames[0] ?? '') : `${count} Teams`;
  return `<span class="badge badge--info" title="${names}">${displayText}</span>`;
}

/**
 * Get teams badge HTML for employee table
 * Shows count with tooltip listing team names
 */
export function getTeamsBadge(employee: Employee): string {
  const hasFullAccess = employee.hasFullAccess === true || employee.hasFullAccess === 1;

  if (hasFullAccess) {
    return '<span class="badge badge--primary" title="Voller Zugriff auf alle Teams"><i class="fas fa-globe mr-1"></i>Alle</span>';
  }

  if (hasValidTeamArrays(employee.teamIds, employee.teamNames)) {
    return buildTeamArrayBadge(employee.teamNames);
  }

  if (Array.isArray(employee.teams) && employee.teams.length > 0) {
    const count = employee.teams.length;
    const label = count === 1 ? 'Team' : 'Teams';
    const names = employee.teams.map((team) => team.name).join(', ');
    return `<span class="badge badge--info" title="${names}">${String(count)} ${label}</span>`;
  }

  if (employee.teamName !== undefined && employee.teamName !== '') {
    return `<span class="badge badge--info" title="${employee.teamName}">${employee.teamName}</span>`;
  }

  return '<span class="badge badge--secondary" title="Kein Team zugewiesen">Keine</span>';
}

/**
 * Get avatar HTML for employee
 */
function getEmployeeAvatar(employee: Employee): string {
  const firstName = employee.firstName ?? employee.firstName ?? '';
  const lastName = employee.lastName ?? employee.lastName ?? '';
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const avatarColor = employee.id % 10;

  return `
    <div class="avatar avatar--sm avatar--color-${avatarColor}">
      <span>${initials}</span>
    </div>
  `;
}

/**
 * Render a single employee row
 */
export function renderEmployeeRow(employee: Employee): string {
  const displayName = getEmployeeDisplayName(employee);
  const isActive = getEmployeeActiveStatus(employee);
  const notes = employee.availabilityNotes ?? employee.availabilityNotes ?? '-';

  return `
    <tr>
      <td>
        <div class="flex items-center gap-2">
          ${getEmployeeAvatar(employee)}
          <span>${displayName}</span>
        </div>
      </td>
      <td>${employee.email}</td>
      <td>${employee.position ?? '-'}</td>
      <td>${employee.employeeNumber ?? employee.employeeNumber ?? employee.employeeId ?? employee.employeeId ?? '-'}</td>
      <td>
        <span class="${isActive ? 'badge badge--success' : 'badge badge--error'}">
          ${isActive ? 'Aktiv' : 'Inaktiv'}
        </span>
      </td>
      <td>${getAreasBadge(employee)}</td>
      <td>${getDepartmentsBadge(employee)}</td>
      <td>${getTeamsBadge(employee)}</td>
      <td>
        ${getAvailabilityBadge(employee)}
      </td>
      <td>
        ${getPlannedAvailability(employee)}
      </td>
      <td title="${notes}">
        ${notes.length > 20 ? notes.substring(0, 20) + '...' : notes}
      </td>
      <td>
        <div class="flex gap-2">
          <button
            class="action-icon action-icon--edit"
            data-action="edit-employee"
            data-employee-id="${employee.id}"
            title="Bearbeiten"
            aria-label="Mitarbeiter bearbeiten"
          >
            <i class="fas fa-edit"></i>
          </button>
          <button
            class="action-icon action-icon--delete"
            data-action="delete-employee"
            data-employee-id="${employee.id}"
            title="Löschen"
            aria-label="Mitarbeiter löschen"
          >
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
}

/**
 * Render the employees table
 * @param employees - Array of employees to render
 * @param currentFilter - Current filter state for empty state display
 */
export function renderEmployeesTable(
  employees: Employee[],
  currentFilter: 'all' | 'active' | 'inactive' | 'archived' = 'all',
): void {
  const container = $$id('employeeTableContent');
  if (container === null) {
    console.error('[renderEmployeesTable] Container #employeeTableContent not found!');
    return;
  }
  console.info('[renderEmployeesTable] Rendering table with', employees.length, 'employees');

  if (employees.length === 0) {
    renderEmptyState(container, currentFilter);
    return;
  }

  const tableHTML = `
    <div class="table-responsive">
      <table class="data-table data-table--hover data-table--striped">
        <thead>
          <tr>
            <th>Name</th>
            <th>E-Mail</th>
            <th>Position</th>
            <th>Personalnummer</th>
            <th>Status</th>
            <th>Bereiche</th>
            <th>Abteilungen</th>
            <th>Teams</th>
            <th>Verfügbarkeit</th>
            <th>Geplant</th>
            <th>Notizen</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          ${employees.map((employee) => renderEmployeeRow(employee)).join('')}
        </tbody>
      </table>
    </div>
  `;

  setHTML(container, tableHTML);
}

// Form Helper Functions

/**
 * Fill basic form fields
 */
export function fillBasicFormFields(employee: Employee): void {
  ($('input[name="firstName"]') as HTMLInputElement).value = employee.firstName ?? '';
  ($('input[name="lastName"]') as HTMLInputElement).value = employee.lastName ?? '';
  ($('input[name="email"]') as HTMLInputElement).value = employee.email;
  ($('input[name="emailConfirm"]') as HTMLInputElement).value = employee.email;
}

/**
 * Fill optional form fields
 */
export function fillOptionalFormFields(employee: Employee): void {
  const phone = $$('input[name="phone"]') as HTMLInputElement | null;
  if (phone) phone.value = employee.phone ?? '';

  const position = $$('input[name="position"]') as HTMLInputElement | null;
  if (position) position.value = employee.position ?? '';

  const employeeNumber = $$('input[name="employeeNumber"]') as HTMLInputElement | null;
  if (employeeNumber) {
    console.info('Setting employeeNumber field to:', employee.employeeNumber);
    employeeNumber.value = employee.employeeNumber ?? '';
  }

  const dateOfBirth = $$('input[name="dateOfBirth"]') as HTMLInputElement | null;
  if (dateOfBirth && employee.dateOfBirth !== undefined && employee.dateOfBirth !== '') {
    const date = new Date(employee.dateOfBirth);
    dateOfBirth.value = date.toISOString().split('T')[0] ?? '';
  }
}

/**
 * Fill availability fields
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export function fillAvailabilityFields(employee: Employee): void {
  // Update custom dropdown for availability status
  const availabilityStatusInput = $$('#availability-status') as HTMLInputElement | null;
  const availabilityStatusTrigger = $$('#availability-status-trigger');

  if (availabilityStatusInput !== null && availabilityStatusTrigger !== null) {
    const status = employee.availabilityStatus ?? 'available';
    availabilityStatusInput.value = status;

    // Update trigger text based on status
    const statusLabels = new Map<string, string>([
      ['available', 'Verfügbar'],
      ['vacation', 'Urlaub'],
      ['sick', 'Krank'],
      ['unavailable', 'Nicht verfügbar'],
      ['training', 'Schulung'],
      ['other', 'Sonstiges'],
    ]);

    const triggerSpan = availabilityStatusTrigger.querySelector('span');
    if (triggerSpan !== null) {
      triggerSpan.textContent = statusLabels.get(status) ?? 'Verfügbar';
    }
  }

  const availabilityStart = $$('input[name="availabilityStart"]') as HTMLInputElement | null;
  if (availabilityStart) {
    const startDate = employee.availabilityStart ?? '';
    // Convert ISO date (2025-12-01T00:00:00.000Z) to YYYY-MM-DD for date input
    availabilityStart.value = startDate !== '' ? (startDate.split('T')[0] ?? '') : '';
  }

  const availabilityEnd = $$('input[name="availabilityEnd"]') as HTMLInputElement | null;
  if (availabilityEnd) {
    const endDate = employee.availabilityEnd ?? '';
    // Convert ISO date (2025-12-01T00:00:00.000Z) to YYYY-MM-DD for date input
    availabilityEnd.value = endDate !== '' ? (endDate.split('T')[0] ?? '') : '';
  }

  const availabilityNotes = $$('textarea[name="availabilityNotes"]') as HTMLTextAreaElement | null;
  if (availabilityNotes) {
    availabilityNotes.value = employee.availabilityNotes ?? '';
  }
}

/**
 * Set active status and clear passwords
 * Status: 0=inactive, 1=active, 3=archived, 4=deleted
 */
export function setStatusAndClearPasswords(employee: Employee): void {
  const isActiveSelect = $$('select[name="isActive"]') as HTMLSelectElement | null;
  if (isActiveSelect) {
    const isActive = employee.isActive === 1;
    console.info('Setting isActive to:', employee.isActive, '-> select value:', isActive ? '1' : '0');
    isActiveSelect.value = isActive ? '1' : '0';
  }

  const passwordField = $$('input[name="password"]') as HTMLInputElement | null;
  const passwordConfirmField = $$('input[name="passwordConfirm"]') as HTMLInputElement | null;
  if (passwordField) passwordField.value = '';
  if (passwordConfirmField) passwordConfirmField.value = '';
}

/**
 * Process form field
 * N:M REFACTORING: Added support for departmentIds, teamIds arrays and hasFullAccess
 */
export function processFormField(data: Record<string, unknown>, key: string, value: string, isUpdate: boolean): void {
  switch (key) {
    // N:M REFACTORING: Legacy single IDs no longer used
    case 'departmentId':
    case 'teamId':
      // Skip - replaced by departmentIds/teamIds arrays
      break;
    // N:M REFACTORING: Array fields handled separately in extractFormDataWithMultiSelect
    case 'departmentIds':
    case 'teamIds':
      // Skip - these are handled as arrays from multi-select
      break;
    case 'hasFullAccess':
      // Checkbox value - only present if checked
      data['hasFullAccess'] = value === 'on' || value === 'true' || value === '1';
      break;
    case 'email':
    case 'firstName':
    case 'lastName':
    case 'position':
    case 'employeeNumber':
    case 'phone':
    case 'dateOfBirth':
    case 'isActive':
    case 'availabilityStatus':
      if (value.length > 0) {
        // eslint-disable-next-line security/detect-object-injection
        data[key] = value;
      }
      break;
    case 'availabilityStart':
    case 'availabilityEnd':
      // eslint-disable-next-line security/detect-object-injection
      data[key] = value.length > 0 ? value : null;
      break;
    case 'availabilityNotes':
      // eslint-disable-next-line security/detect-object-injection
      data[key] = value;
      break;
    case 'password':
      if (!isUpdate || value.length > 0) {
        // eslint-disable-next-line security/detect-object-injection
        data[key] = value;
      }
      break;
    case 'passwordConfirm':
    case 'emailConfirm':
      // Skip validation-only fields
      break;
    default:
      console.warn(`[SECURITY] Unexpected form field detected: ${key}`);
      break;
  }
}

/**
 * Extract multi-select values as arrays
 * N:M REFACTORING: Helper to get selected values from multi-select elements
 */
export function getMultiSelectValues(selectId: string): number[] {
  const select = document.getElementById(selectId) as HTMLSelectElement | null;
  if (select === null) return [];

  return Array.from(select.selectedOptions).map((opt) => Number.parseInt(opt.value, 10));
}

/**
 * Set multi-select values from array
 * N:M REFACTORING: Helper to restore selected values in multi-select
 */
export function setMultiSelectValues(selectId: string, values: number[]): void {
  const select = document.getElementById(selectId) as HTMLSelectElement | null;
  if (select === null) return;

  Array.from(select.options).forEach((opt) => {
    opt.selected = values.includes(Number.parseInt(opt.value, 10));
  });
}

/**
 * Setup form submit handler
 */
export function setupFormSubmitHandler(): void {
  const w = window as WindowWithEmployeeHandlers;
  setTimeout(() => {
    const employeeForm = document.querySelector('#employee-form');
    console.info('[EmployeesManager] Looking for form element...');
    if (employeeForm !== null) {
      console.info('[EmployeesManager] Form found, adding submit handler');
      employeeForm.addEventListener('submit', (e) => {
        console.info('[EmployeesManager] Form submit triggered');
        e.preventDefault();
        e.stopPropagation();
        void w.saveEmployee?.();
        return false;
      });
    } else {
      console.error('[EmployeesManager] Form element not found!');
    }
  }, 100);
}
