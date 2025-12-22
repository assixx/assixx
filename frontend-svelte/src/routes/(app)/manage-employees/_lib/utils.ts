// =============================================================================
// MANAGE EMPLOYEES - UTILITY FUNCTIONS
// =============================================================================

import type {
  Employee,
  IsActiveStatus,
  AvailabilityStatus,
  BadgeInfo,
  PasswordStrengthResult,
  FormIsActiveStatus,
} from './types';

import {
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  AVAILABILITY_BADGE_CLASSES,
  AVAILABILITY_LABELS,
  PASSWORD_STRENGTH_LABELS,
  PASSWORD_CRACK_TIMES,
  MESSAGES,
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

/**
 * Get teams badge info for display
 * @param employee - Employee object
 * @returns Badge info with class, text, and title
 */
export function getTeamsBadge(employee: Employee): BadgeInfo {
  if (!employee.teams || employee.teams.length === 0) {
    return {
      class: 'badge--secondary',
      text: MESSAGES.NO_TEAM,
      title: MESSAGES.NO_TEAM_TITLE,
    };
  }

  const count = employee.teams.length;
  const names = employee.teams.map((t) => t.name).join(', ');

  return {
    class: 'badge--info',
    text: count === 1 ? employee.teams[0].name : `${count} Teams`,
    title: names,
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
  const status = (employee.availabilityStatus ?? 'available') as AvailabilityStatus;
  return {
    class: AVAILABILITY_BADGE_CLASSES[status] ?? 'badge--secondary',
    text: AVAILABILITY_LABELS[status] ?? 'Sonstiges',
  };
}

/**
 * Get availability label from status value
 * @param status - Availability status
 * @returns Human-readable label
 */
export function getAvailabilityLabel(status: AvailabilityStatus): string {
  return AVAILABILITY_LABELS[status] ?? 'Sonstiges';
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
  if (!query || !query.trim()) return text;
  const escaped = query.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<strong>$1</strong>');
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
  if (!password) {
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
 * Populate form from employee data (for edit mode)
 * @param employee - Employee to edit
 * @returns Form data object
 */
export function populateFormFromEmployee(employee: Employee): {
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
    isActive: (employee.isActive === 4 ? 0 : employee.isActive) as FormIsActiveStatus,
    teamIds: employee.teamIds ?? employee.teams?.map((t) => t.id) ?? [],
    availabilityStatus: (employee.availabilityStatus ?? 'available') as AvailabilityStatus,
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
  if (!emailConfirm) return true;
  return email === emailConfirm;
}

/**
 * Validate password match
 * @param password - Primary password
 * @param passwordConfirm - Confirmation password
 * @returns True if passwords match or confirmation is empty
 */
export function validatePasswordMatch(password: string, passwordConfirm: string): boolean {
  if (!passwordConfirm) return true;
  return password === passwordConfirm;
}
