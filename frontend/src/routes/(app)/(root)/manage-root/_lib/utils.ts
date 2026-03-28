// =============================================================================
// MANAGE ROOT - UTILITY FUNCTIONS
// =============================================================================

import {
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  PASSWORD_STRENGTH_LABELS,
  PASSWORD_CRACK_TIMES,
  FORM_DEFAULTS,
  AVAILABILITY_BADGE_CLASSES,
  AVAILABILITY_ICONS,
  AVAILABILITY_LABELS,
  AVAILABILITY_STATUS_LABELS,
} from './constants';

import type {
  RootUser,
  IsActiveStatus,
  FormIsActiveStatus,
  AvailabilityStatus,
  PasswordStrengthResult,
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
// DATE HELPERS
// =============================================================================

/** Format date for display (de-DE locale) */
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

/** Get avatar color index (0-9) based on user ID */
export function getAvatarColor(id: number): number {
  return id % 10;
}

// =============================================================================
// PASSWORD STRENGTH
// =============================================================================

/** Calculate password strength (simplified) */
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

/** Populate form from user data (for edit mode) */
export function populateFormFromUser(user: RootUser): {
  firstName: string;
  lastName: string;
  email: string;
  emailConfirm: string;
  password: string;
  passwordConfirm: string;
  employeeNumber: string;
  positionIds: string[];
  notes: string;
  isActive: FormIsActiveStatus;
} {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email.toLowerCase(),
    emailConfirm: user.email.toLowerCase(),
    password: '',
    passwordConfirm: '',
    employeeNumber: user.employeeNumber ?? '',
    positionIds: [],
    notes: user.notes ?? '',
    isActive: (user.isActive === 4 ? 0 : user.isActive) as FormIsActiveStatus,
  };
}

/** Get default form values for new user */
export function getDefaultFormValues(): typeof FORM_DEFAULTS {
  return { ...FORM_DEFAULTS };
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/** Validate email match (returns true if confirm is empty) */
export function validateEmailMatch(email: string, emailConfirm: string): boolean {
  if (emailConfirm === '') return true;
  return email.toLowerCase() === emailConfirm.toLowerCase();
}

/** Validate password match (both must be filled and equal) */
export function validatePasswordMatch(password: string, passwordConfirm: string): boolean {
  return password === passwordConfirm;
}

// =============================================================================
// AVAILABILITY BADGE HELPERS
// =============================================================================

/** Badge display information */
interface BadgeInfo {
  class: string;
  text: string;
  title: string;
  icon?: string;
}

/** Check if a date string is defined and non-empty */
function isValidDateString(date: string | undefined): date is string {
  return date !== undefined && date !== '';
}

/**
 * Check if today's date falls within a date range
 */
function isDateRangeActive(startDate?: string, endDate?: string): boolean {
  if (!isValidDateString(startDate) && !isValidDateString(endDate)) {
    return true;
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (isValidDateString(startDate)) {
    const start = new Date(startDate);
    start.setUTCHours(0, 0, 0, 0);
    if (today < start) return false;
  }

  if (isValidDateString(endDate)) {
    const end = new Date(endDate);
    end.setUTCHours(0, 0, 0, 0);
    if (today > end) return false;
  }

  return true;
}

/**
 * Get availability badge info for display
 */
export function getAvailabilityBadge(user: RootUser): BadgeInfo {
  const status = user.availabilityStatus ?? 'available';

  if (status === 'available') {
    return {
      class: AVAILABILITY_BADGE_CLASSES.available,
      text: AVAILABILITY_LABELS.available,
      title: '',
      icon: AVAILABILITY_ICONS.available,
    };
  }

  const isActive = isDateRangeActive(user.availabilityStart, user.availabilityEnd);

  if (isActive) {
    return {
      class: AVAILABILITY_BADGE_CLASSES[status],
      text: AVAILABILITY_LABELS[status],
      title: '',
      icon: AVAILABILITY_ICONS[status],
    };
  }

  return {
    class: AVAILABILITY_BADGE_CLASSES.available,
    text: AVAILABILITY_LABELS.available,
    title: '',
    icon: AVAILABILITY_ICONS.available,
  };
}

/**
 * Format date to German format (DD.MM.YYYY)
 */
function formatDateGerman(dateStr?: string): string {
  if (dateStr === undefined || dateStr === '') return '?';
  const date = new Date(dateStr);
  return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
}

/**
 * Get planned availability period text
 */
export function getPlannedAvailability(user: RootUser): string {
  const status = user.availabilityStatus ?? 'available';
  if (status === 'available') return '-';

  const statusText = AVAILABILITY_STATUS_LABELS[status];
  const startDate = user.availabilityStart;
  const endDate = user.availabilityEnd;

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

/**
 * Validate availability form data
 */
export function validateAvailabilityForm(data: AvailabilityFormData): AvailabilityValidationError {
  if (data.status !== 'available' && (data.start === '' || data.end === '')) {
    return 'dates_required';
  }
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

/**
 * Build availability API payload from form data
 */
export function buildAvailabilityPayload(data: AvailabilityFormData): AvailabilityPayload {
  return {
    availabilityStatus: data.status,
    availabilityStart: data.start !== '' ? data.start : undefined,
    availabilityEnd: data.end !== '' ? data.end : undefined,
    availabilityReason: data.reason !== '' ? data.reason : undefined,
    availabilityNotes: data.notes !== '' ? data.notes : undefined,
  };
}
