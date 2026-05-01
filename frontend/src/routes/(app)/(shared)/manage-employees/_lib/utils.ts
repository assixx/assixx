// =============================================================================
// MANAGE EMPLOYEES - UTILITY FUNCTIONS
// =============================================================================

import { escapeHtml } from '$lib/utils/sanitize-html';

import {
  AVAILABILITY_BADGE_CLASSES,
  AVAILABILITY_ICONS,
  AVAILABILITY_LABELS,
  DEFAULT_BADGE_CLASS,
  INFO_BADGE_CLASS,
  INHERITED_BADGE_CLASS,
  PASSWORD_CRACK_TIMES,
  PASSWORD_STRENGTH_LABELS,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
} from './constants';

import type { HierarchyLabels } from '$lib/types/hierarchy-labels';
import type {
  Employee,
  IsActiveStatus,
  AvailabilityStatus,
  BadgeInfo,
  PaginationPageItem,
  PasswordStrengthResult,
  FormIsActiveStatus,
} from './types';

// =============================================================================
// STATUS BADGE HELPERS
// =============================================================================

/** Get status badge class based on isActive value */
export function getStatusBadgeClass(isActive: IsActiveStatus): string {
  return STATUS_BADGE_CLASSES[isActive];
}

/** Get status label for display */
export function getStatusLabel(isActive: IsActiveStatus): string {
  return STATUS_LABELS[isActive];
}

// =============================================================================
// AVATAR HELPERS
// =============================================================================

/**
 * Get avatar color index based on user ID
 * Used for consistent color assignment per user
 */
export function getAvatarColor(id: number): number {
  return id % 10;
}

/** Get initials from first and last name */
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

/** Extract team data from employee object (handles different API formats) */
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
 */
export function getTeamsBadge(employee: Employee, labels: HierarchyLabels): BadgeInfo {
  const teamData = extractTeamData(employee);

  if (teamData === null) {
    return {
      class: DEFAULT_BADGE_CLASS,
      text: 'Nicht zugewiesen',
      title: 'Nicht zugewiesen',
    };
  }

  return {
    class: INFO_BADGE_CLASS,
    text: teamData.count === 1 ? teamData.firstName : `${teamData.count} ${labels.team}`,
    title: teamData.names,
  };
}

// =============================================================================
// AVAILABILITY BADGE HELPERS
// =============================================================================

/** Check if a date string is defined and non-empty */
function isValidDateString(date: string | undefined): date is string {
  return date !== undefined && date !== '';
}

/** Check if today's date falls within a date range (inclusive, ISO format) */
function isDateRangeActive(startDate?: string, endDate?: string): boolean {
  // No dates specified → considered always active (indefinite status)
  if (!isValidDateString(startDate) && !isValidDateString(endDate)) {
    return true;
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Check start date - if today is before start, not active yet
  if (isValidDateString(startDate)) {
    const start = new Date(startDate);
    start.setUTCHours(0, 0, 0, 0);
    if (today < start) return false;
  }

  // Check end date - if today is after end, no longer active
  if (isValidDateString(endDate)) {
    const end = new Date(endDate);
    end.setUTCHours(0, 0, 0, 0);
    if (today > end) return false;
  }

  return true;
}

/**
 * Get availability badge info for display
 * Shows current availability status based on date range
 * - If status is 'available' → always show "Verfügbar"
 * - If status is not 'available' (vacation, sick, etc.):
 *   - If today is BEFORE availabilityStart → show "Verfügbar"
 *   - If today is WITHIN availabilityStart-availabilityEnd → show actual status
 *   - If today is AFTER availabilityEnd → show "Verfügbar"
 */
export function getAvailabilityBadge(employee: Employee): BadgeInfo {
  const status = employee.availabilityStatus ?? 'available';

  // If status is 'available', always show available
  if (status === 'available') {
    return {
      class: AVAILABILITY_BADGE_CLASSES.available,
      text: AVAILABILITY_LABELS.available,
      icon: AVAILABILITY_ICONS.available,
    };
  }

  // For non-available statuses, check if date range is currently active
  const isActive = isDateRangeActive(employee.availabilityStart, employee.availabilityEnd);

  if (isActive) {
    // Date range is active → show the actual status
    return {
      class: AVAILABILITY_BADGE_CLASSES[status],
      text: AVAILABILITY_LABELS[status],
      icon: AVAILABILITY_ICONS[status],
    };
  }

  // Date range is not active (future or past) → show as available
  return {
    class: AVAILABILITY_BADGE_CLASSES.available,
    text: AVAILABILITY_LABELS.available,
    icon: AVAILABILITY_ICONS.available,
  };
}

/** Get availability label from status value */
export function getAvailabilityLabel(status: AvailabilityStatus): string {
  return AVAILABILITY_LABELS[status];
}

// =============================================================================
// PASSWORD HELPERS
// =============================================================================

/** Calculate password strength with score (0-4), label, and estimated crack time */
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
  return isActive === 4 ? 0 : isActive;
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
  notes: string;
  isActive: FormIsActiveStatus;
  teamIds: number[];
  availabilityStatus: AvailabilityStatus;
  availabilityStart: string;
  availabilityEnd: string;
  availabilityNotes: string;
}

/** Populate form from employee data (for edit mode) */
export function populateFormFromEmployee(employee: Employee): EmployeeFormData {
  return {
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email.toLowerCase(),
    emailConfirm: employee.email.toLowerCase(),
    password: '',
    passwordConfirm: '',
    employeeNumber: employee.employeeNumber ?? '',
    position: employee.position ?? '',
    phone: employee.phone ?? '',
    dateOfBirth: employee.dateOfBirth ?? '',
    notes: employee.notes ?? '',
    isActive: toFormStatus(employee.isActive),
    teamIds: extractTeamIds(employee),
    availabilityStatus: employee.availabilityStatus ?? 'available',
    availabilityStart: employee.availabilityStart ?? '',
    availabilityEnd: employee.availabilityEnd ?? '',
    availabilityNotes: employee.availabilityNotes ?? '',
  };
}

/** Get default form values for new employee */
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
  notes: string;
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
    notes: '',
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

/** Validate email match (true if emails match or confirmation is empty) */
export function validateEmailMatch(email: string, emailConfirm: string): boolean {
  if (emailConfirm === '') return true;
  return email.toLowerCase() === emailConfirm.toLowerCase();
}

/** Validate password match (both must be filled and equal) */
export function validatePasswordMatch(password: string, passwordConfirm: string): boolean {
  return password === passwordConfirm;
}

/**
 * Validation error types for save employee form
 */
export type SaveEmployeeValidationError = 'email' | 'password' | null;

/** Check password fields: required for new, both-or-none + must match for edit */
function hasPasswordError(password: string, passwordConfirm: string, isEditMode: boolean): boolean {
  if (!isEditMode) {
    return password === '' || passwordConfirm === '' || password !== passwordConfirm;
  }
  // Edit mode: if either field is filled, both must be filled and match
  const eitherFilled = password !== '' || passwordConfirm !== '';
  return eitherFilled && password !== passwordConfirm;
}

/** Validate save employee form - combines email and password validation */
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

  if (hasPasswordError(password, passwordConfirm, isEditMode)) {
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
function hasTeamAssignments(employee: Employee): {
  hasTeams: boolean;
  hasArray: boolean;
} {
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
    class: INHERITED_BADGE_CLASS,
    text: `<i class="fas fa-sitemap mr-1"></i>${safeText}`,
    title: tooltip,
  };
}

/** Build badge for direct area assignments */
function buildDirectAreasBadge(
  areas: Employee['areas'],
  labels: HierarchyLabels,
): BadgeInfo | null {
  if (!hasItems(areas)) return null;

  const count = areas.length;
  const areaNames = areas.map((area) => area.name).join(', ');
  return {
    class: INFO_BADGE_CLASS,
    text: `${count} ${labels.area}`,
    title: areaNames,
  };
}

/**
 * Get areas badge info for employee table
 * Shows count with tooltip listing area names
 * BADGE-INHERITANCE-DISPLAY: Areas are inherited from teams→departments→areas for employees
 */
export function getAreasBadge(employee: Employee, labels: HierarchyLabels): BadgeInfo {
  if (checkEmployeeFullAccess(employee)) {
    return {
      class: 'badge--primary',
      text: '<i class="fas fa-globe mr-1"></i>Alle',
      title: `Voller Zugriff auf alle ${labels.area}`,
    };
  }

  // Direct area assignments (rare for employees)
  const directBadge = buildDirectAreasBadge(employee.areas, labels);
  if (directBadge !== null) return directBadge;

  // Inherited via teams→departments→areas
  const { hasTeams, hasArray } = hasTeamAssignments(employee);
  if (hasTeams) return buildAreaInheritedBadge(employee, hasArray);

  return {
    class: DEFAULT_BADGE_CLASS,
    text: 'Keine',
    title: 'Nicht zugewiesen',
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
function buildDirectDeptsBadge(
  departments: Employee['departments'],
  labels: HierarchyLabels,
): BadgeInfo | null {
  if (!hasItems(departments)) return null;

  const count = departments.length;
  const deptNames = departments.map((dept) => dept.name).join(', ');
  return {
    class: INFO_BADGE_CLASS,
    text: `${count} ${labels.department}`,
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
export function getDepartmentsBadge(employee: Employee, labels: HierarchyLabels): BadgeInfo {
  if (checkEmployeeFullAccess(employee)) {
    return {
      class: 'badge--primary',
      text: '<i class="fas fa-globe mr-1"></i>Alle',
      title: `Voller Zugriff auf alle ${labels.department}`,
    };
  }

  // Direct department assignments (user_departments table)
  const directBadge = buildDirectDeptsBadge(employee.departments, labels);
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
    title: 'Nicht zugewiesen',
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

  const statusText = AVAILABILITY_LABELS[status];

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

// =============================================================================
// AVAILABILITY MODAL HELPERS
// =============================================================================

/** Availability form data for validation */
export interface AvailabilityFormData {
  status: AvailabilityStatus;
  start: string;
  end: string;
  reason: string;
  notes: string;
}

/** Availability validation error types */
export type AvailabilityValidationError = 'dates_required' | 'end_before_start' | null;

/** Validate availability form data */
export function validateAvailabilityForm(data: AvailabilityFormData): AvailabilityValidationError {
  // Dates required for non-available status
  if (data.status !== 'available' && (data.start === '' || data.end === '')) {
    return 'dates_required';
  }

  // End date must be on or after start date
  if (data.start !== '' && data.end !== '' && data.end < data.start) {
    return 'end_before_start';
  }

  return null;
}

/** Availability API payload */
export interface AvailabilityPayload {
  availabilityStatus: AvailabilityStatus;
  availabilityStart?: string;
  availabilityEnd?: string;
  availabilityReason?: string;
  availabilityNotes?: string;
}

/** Build availability API payload from form data (converts empty strings to undefined) */
export function buildAvailabilityPayload(data: AvailabilityFormData): AvailabilityPayload {
  return {
    availabilityStatus: data.status,
    availabilityStart: data.start !== '' ? data.start : undefined,
    availabilityEnd: data.end !== '' ? data.end : undefined,
    availabilityReason: data.reason !== '' ? data.reason : undefined,
    availabilityNotes: data.notes !== '' ? data.notes : undefined,
  };
}

// =============================================================================
// PAGINATION
// =============================================================================

/**
 * Page size for client-side pagination of employees.
 *
 * 25 = good UX trade-off between scroll-length and page-button-count for
 * tenants up to ~100 employees (4 pages). Backend cap is 100
 * (PaginationSchema.max in common.schema.ts) — for larger tenants we will
 * need server-driven pagination (TODO Phase 2).
 */
export const EMPLOYEES_PER_PAGE = 25;

/**
 * Compute visible page-button slots with ellipsis gaps.
 *
 * Window of 5 pages around the current page; renders "1 … N-2 N-1 N N+1 N+2 … TOTAL"
 * at the edges. Mirrors the helper used by the /logs page so the design-system
 * pagination markup stays identical across the app.
 *
 * @see frontend/src/design-system/primitives/navigation/pagination.css
 */
export function getVisiblePages(currentPage: number, totalPages: number): PaginationPageItem[] {
  const pages: PaginationPageItem[] = [];

  let startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, startPage + 4);
  startPage = Math.max(1, endPage - 4);

  if (startPage > 1) {
    pages.push({ type: 'page', value: 1 });
    if (startPage > 2) {
      pages.push({ type: 'ellipsis' });
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push({ type: 'page', value: i, active: i === currentPage });
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pages.push({ type: 'ellipsis' });
    }
    pages.push({ type: 'page', value: totalPages });
  }

  return pages;
}
