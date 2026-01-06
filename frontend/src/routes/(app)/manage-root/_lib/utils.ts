// =============================================================================
// MANAGE ROOT - UTILITY FUNCTIONS
// =============================================================================

import type { RootUser, IsActiveStatus, FormIsActiveStatus, PasswordStrengthResult } from './types';
import {
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  PASSWORD_STRENGTH_LABELS,
  PASSWORD_CRACK_TIMES,
  FORM_DEFAULTS,
} from './constants';

// =============================================================================
// STATUS BADGE HELPERS
// =============================================================================

/**
 * Get status badge class based on isActive value
 * @param isActive - Status value (0, 1, 3, 4)
 * @returns CSS class for badge
 */
export function getStatusBadgeClass(isActive: IsActiveStatus): string {
  return STATUS_BADGE_CLASSES[isActive] ?? 'badge--secondary';
}

/**
 * Get status label for display
 * @param isActive - Status value (0, 1, 3, 4)
 * @returns Human-readable status label
 */
export function getStatusLabel(isActive: IsActiveStatus): string {
  return STATUS_LABELS[isActive] ?? 'Unbekannt';
}

// =============================================================================
// DATE HELPERS
// =============================================================================

/**
 * Format date for display
 * @param dateStr - ISO date string
 * @returns Formatted date string (de-DE locale)
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('de-DE');
  } catch {
    return '-';
  }
}

// =============================================================================
// AVATAR HELPERS
// =============================================================================

/**
 * Get avatar color based on user ID
 * @param id - User ID
 * @returns Color index (0-9)
 */
export function getAvatarColor(id: number): number {
  return id % 10;
}

// =============================================================================
// SEARCH HELPERS
// =============================================================================

/**
 * Highlight search term in text
 * Wraps matches in <strong> tags for display
 * @param text - Text to search in
 * @param query - Search query
 * @returns HTML string with highlighted matches
 */
export function highlightMatch(text: string, query: string): string {
  if (!query?.trim()) return text;
  const escaped = query.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<strong>$1</strong>');
}

// =============================================================================
// PASSWORD STRENGTH
// =============================================================================

/**
 * Calculate password strength (simplified)
 * @param password - Password to evaluate
 * @returns Password strength result
 */
export function calculatePasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return { score: -1, label: '', time: '' };
  }

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*]/.test(password)) score++;

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

/**
 * Populate form from user data (for edit mode)
 * @param user - User to edit
 * @returns Form data object
 */
export function populateFormFromUser(user: RootUser): {
  firstName: string;
  lastName: string;
  email: string;
  emailConfirm: string;
  password: string;
  passwordConfirm: string;
  employeeNumber: string;
  position: string;
  notes: string;
  isActive: FormIsActiveStatus;
} {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    emailConfirm: user.email,
    password: '',
    passwordConfirm: '',
    employeeNumber: user.employeeNumber ?? '',
    position: user.position ?? '',
    notes: user.notes ?? '',
    isActive: (user.isActive === 4 ? 0 : user.isActive) as FormIsActiveStatus,
  };
}

/**
 * Get default form values for new user
 * @returns Default form data object
 */
export function getDefaultFormValues(): typeof FORM_DEFAULTS {
  return { ...FORM_DEFAULTS };
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate email match
 * @param email - Email address
 * @param emailConfirm - Email confirmation
 * @returns True if emails match or confirm is empty
 */
export function validateEmailMatch(email: string, emailConfirm: string): boolean {
  if (!emailConfirm) return true;
  return email === emailConfirm;
}

/**
 * Validate password match
 * @param password - Password
 * @param passwordConfirm - Password confirmation
 * @returns True if passwords match or confirm is empty
 */
export function validatePasswordMatch(password: string, passwordConfirm: string): boolean {
  if (!passwordConfirm) return true;
  return password === passwordConfirm;
}
