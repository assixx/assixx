// =============================================================================
// MANAGE EMPLOYEES - UTILITY FUNCTIONS
// =============================================================================

import { escapeHtml } from '$lib/utils/sanitize-html';

import {
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  AVAILABILITY_BADGE_CLASSES,
  AVAILABILITY_LABELS,
  AVAILABILITY_STATUS_LABELS,
  PASSWORD_STRENGTH_LABELS,
  PASSWORD_CRACK_TIMES,
  MESSAGES,
  DEFAULT_BADGE_CLASS,
  INFO_BADGE_CLASS,
} from './constants';

import type {
  Employee,
  IsActiveStatus,
  AvailabilityStatus,
  BadgeInfo,
  PasswordStrengthResult,
  FormIsActiveStatus,
} from './types';

// =============================================================================
// STATUS BADGE HELPERS
// =============================================================================

/**
 * Get status badge class based on isActive value
 * @param isActive - Status value (0, 1, 3, 4)
 * @returns CSS class for badge
 */
export function getStatusBadgeClass(isActive: IsActiveStatus): string {
  return STATUS_BADGE_CLASSES[isActive];
}

/**
 * Get status label for display
 * @param isActive - Status value (0, 1, 3, 4)
 * @returns Human-readable status label
 */
export function getStatusLabel(isActive: IsActiveStatus): string {
  return STATUS_LABELS[isActive];
}

// =============================================================================
// AVATAR HELPERS
// =============================================================================

/**
 * Get avatar color index based on user ID
 * Used for consistent color assignment per user
 * @param id - User ID
 * @returns Color index (0-9)
 */
export function getAvatarColor(id: number): number {
  return id % 10;
}

/**
 * Get initials from first and last name
 * @param firstName - First name
 * @param lastName - Last name
 * @returns Two-letter initials
 */
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// =============================================================================
// TEAM BADGE HELPERS
// =============================================================================

interface TeamData {
  count: number;
  names: string;
  firstName: string;
}

/** Check if array has items */
function hasItems<T>(arr: T[] | undefined): arr is T[] {
  return Array.isArray(arr) && arr.length > 0;
}

/** Check if string is non-empty */
function isNonEmpty(str: string | undefined): str is string {
  return str !== undefined && str !== '';
}

/** Extract from teamIds/teamNames API format */
function extractFromApiFormat(employee: Employee): TeamData | null {
  const { teamIds, teamNames } = employee;
  if (!hasItems(teamIds) || !hasItems(teamNames)) return null;

  return {
    count: teamIds.length,
    names: teamNames.join(', '),
    firstName: teamNames[0] ?? '',
  };
}

/** Extract from legacy teams array */
function extractFromTeamsArray(employee: Employee): TeamData | null {
  if (!hasItems(employee.teams)) return null;

  return {
    count: employee.teams.length,
    names: employee.teams.map((t) => t.name).join(', '),
    firstName: employee.teams[0]?.name ?? '',
  };
}

/** Extract from legacy single teamName */
function extractFromTeamName(employee: Employee): TeamData | null {
  if (!isNonEmpty(employee.teamName)) return null;

  return {
    count: 1,
    names: employee.teamName,
    firstName: employee.teamName,
  };
}

/**
 * Extract team data from employee object (handles different API formats)
 * @param employee - Employee object
 * @returns Team data or null if no teams
 */
function extractTeamData(employee: Employee): TeamData | null {
  return (
    extractFromApiFormat(employee) ??
    extractFromTeamsArray(employee) ??
    extractFromTeamName(employee)
  );
}

/**
 * Get teams badge info for display
 * Uses teamIds/teamNames from API response (flat arrays)
 * Falls back to legacy teams array if available
 * @param employee - Employee object
 * @returns Badge info with class, text, and title
 */
export function getTeamsBadge(employee: Employee): BadgeInfo {
  const teamData = extractTeamData(employee);

  if (teamData === null) {
    return {
      class: DEFAULT_BADGE_CLASS,
      text: MESSAGES.NO_TEAM,
      title: MESSAGES.NO_TEAM_TITLE,
    };
  }

  return {
    class: INFO_BADGE_CLASS,
    text: teamData.count === 1 ? teamData.firstName : `${teamData.count} Teams`,
    title: teamData.names,
  };
}

// =============================================================================
// AVAILABILITY BADGE HELPERS
// =============================================================================

/**
 * Get availability badge info for display
 * @param employee - Employee object
 * @returns Badge info with class and text
 */
export function getAvailabilityBadge(employee: Employee): BadgeInfo {
  const status = employee.availabilityStatus ?? 'available';

  return {
    class: AVAILABILITY_BADGE_CLASSES[status],
    text: AVAILABILITY_LABELS[status],
  };
}

/**
 * Get availability label from status value
 * @param status - Availability status
 * @returns Human-readable label
 */
export function getAvailabilityLabel(status: AvailabilityStatus): string {
  return AVAILABILITY_LABELS[status];
}

// =============================================================================
// SEARCH HELPERS
// =============================================================================

/**
 * Highlight search term in text with <strong> tags
 * SECURITY: Escapes HTML BEFORE highlighting to prevent XSS
 *
 * @param text - Text to search in (potentially untrusted)
 * @param query - Search query
 * @returns Sanitized HTML string with highlighted matches
 */
export function highlightMatch(text: string, query: string): string {
  // SECURITY FIX: Escape HTML first to prevent XSS
  const safeText = escapeHtml(text);
  if (query.trim() === '') return safeText;

  // Escape all regex special characters to prevent ReDoS attacks
  const escapedQuery = query.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');

  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return safeText.replace(regex, '<strong>$1</strong>');
}

// =============================================================================
// PASSWORD HELPERS
// =============================================================================

/**
 * Calculate password strength
 * Returns score (0-4), label, and estimated crack time
 * @param password - Password to evaluate
 * @returns PasswordStrengthResult object
 */
export function calculatePasswordStrength(password: string): PasswordStrengthResult {
  if (password === '') {
    return { score: -1, label: '', time: '' };
  }

  let score = 0;

  // Length checks
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;

  // Character variety checks
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*]/.test(password)) score++;

  // Cap score at 4
  const finalScore = Math.min(score, 4);

  return {
    score: finalScore,
    label: PASSWORD_STRENGTH_LABELS[finalScore] ?? '',
    time: `Crackzeit: ${PASSWORD_CRACK_TIMES[finalScore] ?? 'unbekannt'}`,
  };
}

// =============================================================================
// FORM HELPERS
// =============================================================================

/** Convert isActive to form status (deleted=4 becomes inactive=0) */
function toFormStatus(isActive: IsActiveStatus): FormIsActiveStatus {
  return (isActive === 4 ? 0 : isActive) as FormIsActiveStatus;
}

/** Extract team IDs from employee (handles different API formats) */
function extractTeamIds(employee: Employee): number[] {
  if (hasItems(employee.teamIds)) return employee.teamIds;
  if (hasItems(employee.teams)) return employee.teams.map((t) => t.id);
  return [];
}

/** Form data structure for employee */
interface EmployeeFormData {
  firstName: string;
  lastName: string;
  email: string;
  emailConfirm: string;
  password: string;
  passwordConfirm: string;
  employeeNumber: string;
  position: string;
  phone: string;
  dateOfBirth: string;
  isActive: FormIsActiveStatus;
  teamIds: number[];
  availabilityStatus: AvailabilityStatus;
  availabilityStart: string;
  availabilityEnd: string;
  availabilityNotes: string;
}

/**
 * Populate form from employee data (for edit mode)
 * @param employee - Employee to edit
 * @returns Form data object
 */
export function populateFormFromEmployee(employee: Employee): EmployeeFormData {
  return {
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    emailConfirm: employee.email,
    password: '',
    passwordConfirm: '',
    employeeNumber: employee.employeeNumber ?? '',
    position: employee.position ?? '',
    phone: employee.phone ?? '',
    dateOfBirth: employee.dateOfBirth ?? '',
    isActive: toFormStatus(employee.isActive),
    teamIds: extractTeamIds(employee),
    availabilityStatus: employee.availabilityStatus ?? 'available',
    availabilityStart: employee.availabilityStart ?? '',
    availabilityEnd: employee.availabilityEnd ?? '',
    availabilityNotes: employee.availabilityNotes ?? '',
  };
}

/**
 * Get default form values for new employee
 * @returns Default form data object
 */
export function getDefaultFormValues(): {
  firstName: string;
  lastName: string;
  email: string;
  emailConfirm: string;
  password: string;
  passwordConfirm: string;
  employeeNumber: string;
  position: string;
  phone: string;
  dateOfBirth: string;
  isActive: FormIsActiveStatus;
  teamIds: number[];
  availabilityStatus: AvailabilityStatus;
  availabilityStart: string;
  availabilityEnd: string;
  availabilityNotes: string;
} {
  return {
    firstName: '',
    lastName: '',
    email: '',
    emailConfirm: '',
    password: '',
    passwordConfirm: '',
    employeeNumber: '',
    position: '',
    phone: '',
    dateOfBirth: '',
    isActive: 1,
    teamIds: [],
    availabilityStatus: 'available',
    availabilityStart: '',
    availabilityEnd: '',
    availabilityNotes: '',
  };
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate email match
 * @param email - Primary email
 * @param emailConfirm - Confirmation email
 * @returns True if emails match or confirmation is empty
 */
export function validateEmailMatch(email: string, emailConfirm: string): boolean {
  if (emailConfirm === '') return true;
  return email === emailConfirm;
}

/**
 * Validate password match
 * @param password - Primary password
 * @param passwordConfirm - Confirmation password
 * @returns True if passwords match or confirmation is empty
 */
export function validatePasswordMatch(password: string, passwordConfirm: string): boolean {
  if (passwordConfirm === '') return true;
  return password === passwordConfirm;
}

/**
 * Validation error types for save employee form
 */
export type SaveEmployeeValidationError = 'email' | 'password' | null;

/**
 * Validate save employee form
 * Combines email and password validation into a single check
 * @param email - Email address
 * @param emailConfirm - Email confirmation
 * @param password - Password (required for new, optional for edit)
 * @param passwordConfirm - Password confirmation
 * @param isEditMode - Whether editing existing employee
 * @returns Validation error type or null if valid
 */
export function validateSaveEmployeeForm(
  email: string,
  emailConfirm: string,
  password: string,
  passwordConfirm: string,
  isEditMode: boolean,
): SaveEmployeeValidationError {
  if (!validateEmailMatch(email, emailConfirm)) {
    return 'email';
  }

  // Password validation: required for new employees, optional for edit (only if provided)
  const needsPasswordValidation = !isEditMode || password !== '';
  if (needsPasswordValidation && !validatePasswordMatch(password, passwordConfirm)) {
    return 'password';
  }

  return null;
}

// =============================================================================
// AREAS BADGE HELPERS (BADGE-INHERITANCE-DISPLAY)
// =============================================================================

/**
 * Check if employee has full tenant access
 */
function checkEmployeeFullAccess(employee: Employee): boolean {
  return employee.hasFullAccess === true || employee.hasFullAccess === 1;
}

/**
 * Check if employee has team assignments (array or legacy single)
 */
function hasTeamAssignments(employee: Employee): { hasTeams: boolean; hasArray: boolean } {
  const hasTeamsArray = (employee.teams?.length ?? 0) > 0;
  const hasTeamIdsArray = (employee.teamIds?.length ?? 0) > 0;
  const hasLegacy = (employee.teamId ?? 0) > 0;
  const hasArray = hasTeamsArray || hasTeamIdsArray;
  return { hasTeams: hasArray || hasLegacy, hasArray };
}

/**
 * Get team names string for tooltip (from array or legacy field)
 */
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

/**
 * Build inherited badge HTML string
 * SECURITY: displayText is escaped to prevent XSS
 */
function buildInheritedBadge(displayText: string, tooltip: string): BadgeInfo {
  // SECURITY FIX: Escape user-provided text to prevent XSS
  const safeText = escapeHtml(displayText);
  return {
    class: INFO_BADGE_CLASS,
    text: `<i class="fas fa-sitemap mr-1"></i>${safeText}`,
    title: tooltip,
  };
}

/** Build badge for direct area assignments */
function buildDirectAreasBadge(areas: Employee['areas']): BadgeInfo | null {
  if (!hasItems(areas)) return null;

  const count = areas.length;
  const label = count === 1 ? 'Bereich' : 'Bereiche';
  const areaNames = areas.map((area) => area.name).join(', ');
  return {
    class: INFO_BADGE_CLASS,
    text: `${count} ${label}`,
    title: areaNames,
  };
}

/**
 * Get areas badge info for employee table
 * Shows count with tooltip listing area names
 * BADGE-INHERITANCE-DISPLAY: Areas are inherited from teams→departments→areas for employees
 */
export function getAreasBadge(employee: Employee): BadgeInfo {
  if (checkEmployeeFullAccess(employee)) {
    return {
      class: 'badge--primary',
      text: '<i class="fas fa-globe mr-1"></i>Alle',
      title: 'Voller Zugriff auf alle Bereiche',
    };
  }

  // Direct area assignments (rare for employees)
  const directBadge = buildDirectAreasBadge(employee.areas);
  if (directBadge !== null) return directBadge;

  // Inherited via teams→departments→areas
  const { hasTeams, hasArray } = hasTeamAssignments(employee);
  if (hasTeams) return buildAreaInheritedBadge(employee, hasArray);

  return {
    class: DEFAULT_BADGE_CLASS,
    text: 'Keine',
    title: 'Kein Bereich zugewiesen',
  };
}

/**
 * Build area badge showing inherited area name from team chain
 */
function buildAreaInheritedBadge(employee: Employee, hasArray: boolean): BadgeInfo {
  const { teamAreaName, teamDepartmentName } = employee;
  // Derive teamName from teamNames array if available, else use legacy teamName
  const teamName =
    (employee.teamNames?.length ?? 0) > 0 ? employee.teamNames?.[0] : employee.teamName;

  if (teamAreaName !== undefined && teamAreaName !== '') {
    const tooltip = `${teamAreaName} (vererbt von: ${teamName ?? 'Team'} → ${teamDepartmentName ?? 'Abteilung'} → ${teamAreaName})`;
    return buildInheritedBadge(teamAreaName, tooltip);
  }

  // Fallback: generic "Vererbt"
  const teamNamesStr = getTeamNamesString(employee, hasArray);
  return buildInheritedBadge('Vererbt', `Vererbt von Team: ${teamNamesStr}`);
}

// =============================================================================
// DEPARTMENTS BADGE HELPERS (BADGE-INHERITANCE-DISPLAY)
// =============================================================================

/** Build badge for direct department assignments */
function buildDirectDeptsBadge(departments: Employee['departments']): BadgeInfo | null {
  if (!hasItems(departments)) return null;

  const count = departments.length;
  const label = count === 1 ? 'Abteilung' : 'Abteilungen';
  const deptNames = departments.map((dept) => dept.name).join(', ');
  return {
    class: INFO_BADGE_CLASS,
    text: `${count} ${label}`,
    title: deptNames,
  };
}

/** Build badge for legacy departmentName */
function buildLegacyDeptBadge(departmentName: string | undefined): BadgeInfo | null {
  if (!isNonEmpty(departmentName)) return null;

  return {
    class: INFO_BADGE_CLASS,
    text: departmentName,
    title: departmentName,
  };
}

/**
 * Get departments badge info for employee table
 * Shows count with tooltip listing department names
 * BADGE-INHERITANCE-DISPLAY: Departments are inherited from teams for employees
 */
export function getDepartmentsBadge(employee: Employee): BadgeInfo {
  if (checkEmployeeFullAccess(employee)) {
    return {
      class: 'badge--primary',
      text: '<i class="fas fa-globe mr-1"></i>Alle',
      title: 'Voller Zugriff auf alle Abteilungen',
    };
  }

  // Direct department assignments (user_departments table)
  const directBadge = buildDirectDeptsBadge(employee.departments);
  if (directBadge !== null) return directBadge;

  // Inherited via teams→departments
  const { hasTeams, hasArray } = hasTeamAssignments(employee);
  if (hasTeams) return buildDeptInheritedBadge(employee, hasArray);

  // Legacy departmentName fallback
  const legacyBadge = buildLegacyDeptBadge(employee.departmentName);
  if (legacyBadge !== null) return legacyBadge;

  return {
    class: DEFAULT_BADGE_CLASS,
    text: 'Keine',
    title: 'Keine Abteilung zugewiesen',
  };
}

/**
 * Build department badge showing inherited dept name from team
 */
function buildDeptInheritedBadge(employee: Employee, hasArray: boolean): BadgeInfo {
  const { teamDepartmentName } = employee;
  // Derive teamName from teamNames array if available, else use legacy teamName
  const teamName =
    (employee.teamNames?.length ?? 0) > 0 ? employee.teamNames?.[0] : employee.teamName;

  if (teamDepartmentName !== undefined && teamDepartmentName !== '') {
    const tooltip = `${teamDepartmentName} (vererbt von Team: ${teamName ?? 'Team'})`;
    return buildInheritedBadge(teamDepartmentName, tooltip);
  }

  // Fallback: generic "Vererbt"
  const teamNamesStr = getTeamNamesString(employee, hasArray);
  return buildInheritedBadge('Vererbt', `Vererbt von Team: ${teamNamesStr}`);
}

// =============================================================================
// PLANNED AVAILABILITY HELPERS
// =============================================================================

/**
 * Format date to German format (DD.MM.YYYY)
 */
function formatDateGerman(dateStr?: string): string {
  if (dateStr === undefined || dateStr === '') return '?';
  const date = new Date(dateStr);
  return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
}

/**
 * Get the planned availability period text
 * Shows status with date range if specified
 */
export function getPlannedAvailability(employee: Employee): string {
  const status = employee.availabilityStatus ?? 'available';

  // If available, return dash
  if (status === 'available') {
    return '-';
  }

  // Get status label

  const statusText = AVAILABILITY_STATUS_LABELS[status];

  // Format dates if available
  const startDate = employee.availabilityStart;
  const endDate = employee.availabilityEnd;

  if (startDate !== undefined || endDate !== undefined) {
    const startFormatted = formatDateGerman(startDate);
    const endFormatted = formatDateGerman(endDate);
    return `${statusText}: ${startFormatted} - ${endFormatted}`;
  }

  return statusText;
}

/**
 * Get truncated notes with full text as title
 */
export function getTruncatedNotes(
  notes?: string,
  maxLength: number = 20,
): { text: string; title: string } {
  const text = notes ?? '-';
  return {
    text: text.length > maxLength ? text.substring(0, maxLength) + '...' : text,
    title: text,
  };
}
