/**
 * UI and Rendering Functions for Employee Management
 * Contains all UI rendering, availability display, and form handling helpers
 */

import type { Employee, WindowWithEmployeeHandlers } from './types';
import { $, $$, $$id, setHTML } from '../../../utils/dom-utils';

/**
 * Render empty state when no employees found
 */
export function renderEmptyState(container: HTMLElement): void {
  setHTML(
    container,
    `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <div class="empty-state-text">Keine Mitarbeiter gefunden</div>
        <div class="empty-state-subtext">Fügen Sie Ihren ersten Mitarbeiter hinzu</div>
      </div>
    `,
  );
}

/**
 * Get display name for an employee
 */
export function getEmployeeDisplayName(employee: Employee): string {
  const firstName = employee.first_name ?? employee.firstName ?? '';
  const lastName = employee.last_name ?? employee.lastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName !== '' ? fullName : employee.username;
}

/**
 * Get active status for an employee
 */
export function getEmployeeActiveStatus(employee: Employee): boolean {
  // Check both snake_case and camelCase fields (API v1 vs v2)
  // Priority: Check isActive first (API v2), then is_active (API v1/DB)
  if ('isActive' in employee && employee.isActive !== undefined) {
    // isActive can be boolean or number (0/1)
    return employee.isActive === true || employee.isActive === 1;
  } else if ('is_active' in employee) {
    // is_active is always boolean
    return employee.is_active;
  }
  return true; // Default to active
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
  const rawStatus = employee.availabilityStatus ?? employee.availability_status ?? 'available';

  // Parse the status (handle both single and combined format for compatibility)
  let status = 'available';
  if (typeof rawStatus === 'string') {
    const parts = rawStatus.trim().split(/\s+/);
    if (parts.length > 1) {
      // Combined format like "available vacation" from v2 API
      status = parts[1];
    } else {
      // Single status from DB
      status = parts[0] !== '' ? parts[0] : 'available';
    }
  }

  // If status is already "available", no need to check dates
  if (status === 'available') {
    return 'available';
  }

  // Check if the special status applies to today
  const startDate = employee.availability_start ?? employee.availabilityStart;
  const endDate = employee.availability_end ?? employee.availabilityEnd;

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
  const rawStatus = employee.availabilityStatus ?? employee.availability_status ?? 'available';

  // Parse the status (handle both single and combined format for compatibility)
  let status = 'available';
  if (typeof rawStatus === 'string') {
    const parts = rawStatus.trim().split(/\s+/);
    if (parts.length > 1) {
      // Combined format like "available vacation" from v2 API
      status = parts[1];
    } else {
      // Single status from DB
      status = parts[0] !== '' ? parts[0] : 'available';
    }
  }

  // If available, return dash
  if (status === 'available') {
    return '-';
  }

  // Get dates
  const startDate = employee.availability_start ?? employee.availabilityStart;
  const endDate = employee.availability_end ?? employee.availabilityEnd;

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
    availability_status: employee.availability_status,
    currentStatus: status,
    start: employee.availability_start ?? employee.availabilityStart,
    end: employee.availability_end ?? employee.availabilityEnd,
  });

  // Farben basierend auf design-standards
  // Grün = Verfügbar, Orange = Urlaub, Rot = Krank, Cyan = Schulung, Grau = Nicht verfügbar/Sonstiges
  let badgeClass = 'badge-success';
  let badgeText = 'Verfügbar';

  switch (status) {
    case 'vacation':
      badgeClass = 'badge-warning';
      badgeText = 'Urlaub';
      break;
    case 'sick':
      badgeClass = 'badge-danger';
      badgeText = 'Krank';
      break;
    case 'unavailable':
      badgeClass = 'badge-secondary';
      badgeText = 'Nicht verfügbar';
      break;
    case 'training':
      badgeClass = 'badge-info';
      badgeText = 'Schulung';
      break;
    case 'other':
      badgeClass = 'badge-dark';
      badgeText = 'Sonstiges';
      break;
    case 'available':
    default:
      badgeClass = 'badge-success';
      badgeText = 'Verfügbar';
      break;
  }

  return `<span class="badge ${badgeClass}">${badgeText}</span>`;
}

/**
 * Render a single employee row
 */
export function renderEmployeeRow(employee: Employee): string {
  const displayName = getEmployeeDisplayName(employee);
  const isActive = getEmployeeActiveStatus(employee);
  const notes = employee.availability_notes ?? employee.availabilityNotes ?? '-';

  return `
    <tr>
      <td>${displayName}</td>
      <td>${employee.email}</td>
      <td>${employee.position ?? '-'}</td>
      <td>${employee.employee_number ?? employee.employeeNumber ?? employee.employee_id ?? employee.employeeId ?? '-'}</td>
      <td>${employee.department_name ?? employee.departmentName ?? '-'}</td>
      <td>${employee.team_name ?? employee.teamName ?? '-'}</td>
      <td>
        <span class="badge ${isActive ? 'badge-success' : 'badge-secondary'}">
          ${isActive ? 'Aktiv' : 'Inaktiv'}
        </span>
      </td>
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
        <button class="action-btn edit" data-action="edit-employee" data-employee-id="${employee.id}">Bearbeiten</button>
        <button class="action-btn delete" data-action="delete-employee" data-employee-id="${employee.id}">Löschen</button>
      </td>
    </tr>
  `;
}

/**
 * Render the employees table
 */
export function renderEmployeesTable(employees: Employee[]): void {
  const container = $$id('employeeTableContent');
  if (container === null) {
    console.error('[renderEmployeesTable] Container #employeeTableContent not found!');
    return;
  }
  console.info('[renderEmployeesTable] Rendering table with', employees.length, 'employees');

  if (employees.length === 0) {
    renderEmptyState(container);
    return;
  }

  const tableHTML = `
    <table class="employee-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>E-Mail</th>
          <th>Position</th>
          <th>Personalnummer</th>
          <th>Abteilung</th>
          <th>Team</th>
          <th>Status</th>
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

  const birthday = $$('input[name="birthday"]') as HTMLInputElement | null;
  if (birthday && employee.birthdate !== undefined && employee.birthdate !== '') {
    const date = new Date(employee.birthdate);
    birthday.value = date.toISOString().split('T')[0];
  }
}

/**
 * Fill availability fields
 */
export function fillAvailabilityFields(employee: Employee): void {
  const availabilityStatus = $$('#availability-status-select') as HTMLSelectElement | null;
  if (availabilityStatus) {
    const status = employee.availabilityStatus ?? employee.availability_status ?? 'available';
    availabilityStatus.value = status;
  }

  const availabilityStart = $$('input[name="availabilityStart"]') as HTMLInputElement | null;
  if (availabilityStart) {
    const startDate = employee.availabilityStart ?? employee.availability_start ?? '';
    availabilityStart.value = startDate;
  }

  const availabilityEnd = $$('input[name="availabilityEnd"]') as HTMLInputElement | null;
  if (availabilityEnd) {
    const endDate = employee.availabilityEnd ?? employee.availability_end ?? '';
    availabilityEnd.value = endDate;
  }

  const availabilityNotes = $$('textarea[name="availabilityNotes"]') as HTMLTextAreaElement | null;
  if (availabilityNotes) {
    const notes = employee.availabilityNotes ?? employee.availability_notes ?? '';
    availabilityNotes.value = notes;
  }
}

/**
 * Set active status and clear passwords
 */
export function setStatusAndClearPasswords(employee: Employee): void {
  const isActiveSelect = $$('select[name="isActive"]') as HTMLSelectElement | null;
  if (isActiveSelect) {
    console.info('Setting isActive to:', employee.isActive, '-> select value:', employee.isActive === true ? '1' : '0');
    isActiveSelect.value = employee.isActive === true ? '1' : '0';
  }

  const passwordField = $$('input[name="password"]') as HTMLInputElement | null;
  const passwordConfirmField = $$('input[name="passwordConfirm"]') as HTMLInputElement | null;
  if (passwordField) passwordField.value = '';
  if (passwordConfirmField) passwordConfirmField.value = '';
}

/**
 * Process form field
 */
export function processFormField(data: Record<string, unknown>, key: string, value: string, isUpdate: boolean): void {
  switch (key) {
    case 'departmentId':
    case 'teamId':
      // eslint-disable-next-line security/detect-object-injection
      data[key] = value.length > 0 ? Number.parseInt(value, 10) : null;
      break;
    case 'email':
    case 'firstName':
    case 'lastName':
    case 'position':
    case 'employeeNumber':
    case 'phone':
    case 'birthday':
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
