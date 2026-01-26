// =============================================================================
// MANAGE ROOT - UTILITY FUNCTIONS
// =============================================================================

import { escapeHtml } from '$lib/utils/sanitize-html';

import {
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  PASSWORD_STRENGTH_LABELS,
  PASSWORD_CRACK_TIMES,
  FORM_DEFAULTS,
} from './constants';

import type { RootUser, IsActiveStatus, FormIsActiveStatus, PasswordStrengthResult } from './types';

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
// DATE HELPERS
// =============================================================================

/**
 * Format date for display
 * @param dateStr - ISO date string
 * @returns Formatted date string (de-DE locale)
 */
export function formatDate(dateStr: string): string {
  if (dateStr === '') return '-';
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
// PASSWORD STRENGTH
// =============================================================================

/**
 * Calculate password strength (simplified)
 * @param password - Password to evaluate
 * @returns Password strength result
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
  if (emailConfirm === '') return true;
  return email === emailConfirm;
}

/**
 * Validate password match
 * @param password - Password
 * @param passwordConfirm - Password confirmation
 * @returns True if passwords match or confirm is empty
 */
export function validatePasswordMatch(password: string, passwordConfirm: string): boolean {
  if (passwordConfirm === '') return true;
  return password === passwordConfirm;
}
