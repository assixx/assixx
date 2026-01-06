/**
 * Root Dashboard - Utility Functions
 * @module root-dashboard/_lib/utils
 */

import type { ActivityLog } from './types';
import {
  ACTION_LABELS,
  ACTION_BADGE_CLASSES,
  ROLE_LABELS,
  ROLE_BADGE_CLASSES,
  EMPLOYEE_NUMBER,
} from './constants';

/**
 * Get readable action label
 * @param action - Action type
 */
export function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/**
 * Get badge CSS class for action
 * @param action - Action type
 */
export function getActionBadgeClass(action: string): string {
  return ACTION_BADGE_CLASSES[action] ?? 'info';
}

/**
 * Get readable role label
 * @param role - User role
 */
export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/**
 * Get badge CSS class for role
 * @param role - User role
 */
export function getRoleBadgeClass(role: string): string {
  return ROLE_BADGE_CLASSES[role.toLowerCase()] ?? 'info';
}

/**
 * Get display name from log entry
 * @param log - Activity log entry
 */
export function getDisplayName(
  log: Pick<ActivityLog, 'userFirstName' | 'userLastName' | 'userName'>,
): string {
  const firstName = log.userFirstName ?? '';
  const lastName = log.userLastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName !== '' ? fullName : (log.userName ?? '-');
}

/**
 * Check if employee number is temporary
 * @param employeeNumber - Employee number to check
 */
export function isTemporaryEmployeeNumber(employeeNumber: string): boolean {
  if (employeeNumber === '') return true;

  return EMPLOYEE_NUMBER.tempPrefixes.some((prefix) => employeeNumber.startsWith(prefix));
}

/**
 * Filter invalid characters from employee number input
 * @param value - Input value
 * @returns Filtered value
 */
export function filterEmployeeNumberInput(value: string): string {
  return value.replace(EMPLOYEE_NUMBER.validCharsRegex, '');
}

/**
 * Validate employee number
 * @param value - Employee number to validate
 */
export function isValidEmployeeNumber(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '') return false;
  if (trimmed.length > EMPLOYEE_NUMBER.maxLength) return false;

  // Check if only valid characters
  const filtered = filterEmployeeNumberInput(trimmed);
  return filtered === trimmed;
}
