/**
 * Root Dashboard - Utility Functions
 * @module root-dashboard/_lib/utils
 */

import {
  ACTION_LABELS,
  ACTION_BADGE_CLASSES,
  ROLE_LABELS,
  ROLE_BADGE_CLASSES,
  EMPLOYEE_NUMBER,
} from './constants';

import type { ActivityLog } from './types';

/** Get readable action label */
export function getActionLabel(action: string): string {
  return Object.hasOwn(ACTION_LABELS, action) ? ACTION_LABELS[action] : action;
}

/** Get badge CSS class for action */
export function getActionBadgeClass(action: string): string {
  return Object.hasOwn(ACTION_BADGE_CLASSES, action) ?
      ACTION_BADGE_CLASSES[action]
    : 'info';
}

/** Get readable role label */
export function getRoleLabel(role: string): string {
  return Object.hasOwn(ROLE_LABELS, role) ? ROLE_LABELS[role] : role;
}

/** Get badge CSS class for role */
export function getRoleBadgeClass(role: string | null | undefined): string {
  if (role === null || role === undefined || role === '') return 'info';
  const normalizedRole = role.toLowerCase();
  return Object.hasOwn(ROLE_BADGE_CLASSES, normalizedRole) ?
      ROLE_BADGE_CLASSES[normalizedRole]
    : 'info';
}

/** Get display name from log entry */
export function getDisplayName(
  log: Pick<ActivityLog, 'userFirstName' | 'userLastName' | 'userName'>,
): string {
  const firstName = log.userFirstName ?? '';
  const lastName = log.userLastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName !== '' ? fullName : (log.userName ?? '-');
}

/** Check if employee number is temporary */
export function isTemporaryEmployeeNumber(employeeNumber: string): boolean {
  if (employeeNumber === '') return true;

  return EMPLOYEE_NUMBER.tempPrefixes.some((prefix) =>
    employeeNumber.startsWith(prefix),
  );
}

/** Filter invalid characters from employee number input */
export function filterEmployeeNumberInput(value: string): string {
  return value.replace(EMPLOYEE_NUMBER.validCharsRegex, '');
}

/** Validate employee number */
export function isValidEmployeeNumber(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '') return false;
  if (trimmed.length > EMPLOYEE_NUMBER.maxLength) return false;

  // Check if only valid characters
  const filtered = filterEmployeeNumberInput(trimmed);
  return filtered === trimmed;
}
