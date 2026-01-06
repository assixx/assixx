// =============================================================================
// MANAGE ADMINS - UTILITY FUNCTIONS
// =============================================================================

import type { Admin, AdminFormData, BadgeInfo, FormIsActiveStatus, IsActiveStatus } from './types';
import {
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  POSITION_DISPLAY_MAP,
  PASSWORD_STRENGTH_LABELS,
  PASSWORD_CRACK_TIMES,
  MESSAGES,
} from './constants';

// =============================================================================
// STATUS HELPERS
// =============================================================================

/**
 * Get CSS class for status badge
 */
export function getStatusBadgeClass(isActive: IsActiveStatus): string {
  return STATUS_BADGE_CLASSES[isActive] ?? 'badge--secondary';
}

/**
 * Get localized status label
 */
export function getStatusLabel(isActive: IsActiveStatus): string {
  return STATUS_LABELS[isActive] ?? 'Unbekannt';
}

// =============================================================================
// POSITION HELPERS
// =============================================================================

/**
 * Get display name for position
 */
export function getPositionDisplay(position: string): string {
  return POSITION_DISPLAY_MAP[position.toLowerCase()] ?? position;
}

// =============================================================================
// AVATAR HELPERS
// =============================================================================

/**
 * Get avatar color index based on user ID (0-9)
 */
export function getAvatarColor(id: number): number {
  return id % 10;
}

// =============================================================================
// ADMIN PERMISSION HELPERS
// =============================================================================

/**
 * Check if admin has full access to all areas/departments
 */
export function hasFullAccess(admin: Admin): boolean {
  return admin.hasFullAccess === true || admin.hasFullAccess === 1;
}

/**
 * Get badge info for areas column
 */
export function getAreasBadge(admin: Admin): BadgeInfo {
  if (hasFullAccess(admin)) {
    return {
      class: 'badge--primary',
      text: MESSAGES.BADGE_ALL,
      title: `${MESSAGES.BADGE_FULL_ACCESS_TITLE} Bereiche`,
      icon: 'fa-globe',
    };
  }
  if (!admin.areas || admin.areas.length === 0) {
    return {
      class: 'badge--secondary',
      text: MESSAGES.BADGE_NONE,
      title: MESSAGES.BADGE_NO_AREAS,
    };
  }
  const count = admin.areas.length;
  const label = count === 1 ? 'Bereich' : 'Bereiche';
  const names = admin.areas.map((a) => a.name).join(', ');
  return {
    class: 'badge--info',
    text: `${count} ${label}`,
    title: names,
  };
}

/**
 * Get badge info for departments column
 */
export function getDepartmentsBadge(admin: Admin): BadgeInfo {
  if (hasFullAccess(admin)) {
    return {
      class: 'badge--primary',
      text: MESSAGES.BADGE_ALL,
      title: `${MESSAGES.BADGE_FULL_ACCESS_TITLE} Abteilungen`,
      icon: 'fa-globe',
    };
  }

  const deptCount = admin.departments?.length ?? 0;
  const areaCount = admin.areas?.length ?? 0;

  if (deptCount > 0 && areaCount > 0) {
    const deptNames = admin.departments?.map((d) => d.name).join(', ') ?? '';
    return {
      class: 'badge--info',
      text: `${deptCount} Abtlg. + ${MESSAGES.BADGE_INHERITED}`,
      title: `Direkt: ${deptNames} + Vererbt von ${areaCount} Bereichen`,
    };
  }

  if (deptCount > 0) {
    const deptNames = admin.departments?.map((d) => d.name).join(', ') ?? '';
    return {
      class: 'badge--info',
      text: `${deptCount} ${deptCount === 1 ? 'Abteilung' : 'Abteilungen'}`,
      title: deptNames,
    };
  }

  if (areaCount > 0) {
    const areaNames = admin.areas?.map((a) => a.name).join(', ') ?? '';
    return {
      class: 'badge--info',
      text: MESSAGES.BADGE_INHERITED,
      title: `Vererbt von: ${areaNames}`,
      icon: 'fa-sitemap',
    };
  }

  return {
    class: 'badge--secondary',
    text: MESSAGES.BADGE_NONE,
    title: MESSAGES.BADGE_NO_DEPARTMENTS,
  };
}

/**
 * Get badge info for teams column (inherited via Area/Department)
 */
export function getTeamsBadge(admin: Admin): BadgeInfo {
  if (hasFullAccess(admin)) {
    return {
      class: 'badge--primary',
      text: MESSAGES.BADGE_ALL,
      title: `${MESSAGES.BADGE_FULL_ACCESS_TITLE} Teams`,
      icon: 'fa-globe',
    };
  }

  const hasAreas = (admin.areas?.length ?? 0) > 0;
  const hasDepts = (admin.departments?.length ?? 0) > 0;

  if (hasAreas || hasDepts) {
    const parts: string[] = [];
    if (hasAreas) parts.push(`Bereiche: ${admin.areas?.map((a) => a.name).join(', ')}`);
    if (hasDepts) parts.push(`Abteilungen: ${admin.departments?.map((d) => d.name).join(', ')}`);
    return {
      class: 'badge--info',
      text: MESSAGES.BADGE_INHERITED,
      title: `Teams vererbt von: ${parts.join(' | ')}`,
      icon: 'fa-sitemap',
    };
  }

  return {
    class: 'badge--secondary',
    text: MESSAGES.BADGE_NONE,
    title: MESSAGES.BADGE_NO_TEAMS,
  };
}

// =============================================================================
// SEARCH HELPERS
// =============================================================================

/**
 * Highlight search term in text with <strong> tags
 * @param text - Text to highlight in
 * @param query - Search query to highlight
 * @returns HTML string with highlighted matches
 */
export function highlightMatch(text: string, query: string): string {
  if (!query?.trim()) return text;
  const escaped = query.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<strong>$1</strong>');
}

// =============================================================================
// PASSWORD STRENGTH HELPERS
// =============================================================================

export interface PasswordStrengthResult {
  score: number; // 0-4
  label: string;
  crackTime: string;
}

/**
 * Calculate password strength
 * @param password - Password to evaluate
 * @returns Score (0-4), label, and crack time estimate
 */
export function calculatePasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return { score: -1, label: '', crackTime: '' };
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
    crackTime: `Crackzeit: ${PASSWORD_CRACK_TIMES[finalScore] ?? 'unbekannt'}`,
  };
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Check if two email addresses match
 */
export function validateEmailsMatch(email: string, emailConfirm: string): boolean {
  return email === emailConfirm;
}

/**
 * Check if two passwords match
 */
export function validatePasswordsMatch(password: string, passwordConfirm: string): boolean {
  return password === passwordConfirm;
}

// =============================================================================
// FORM DATA BUILDER
// =============================================================================

export interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  position: string;
  notes: string;
  isActive: FormIsActiveStatus;
  employeeNumber: string;
  hasFullAccess: boolean;
  areaIds: number[];
  departmentIds: number[];
}

/**
 * Build AdminFormData from form state
 */
export function buildAdminFormData(form: FormState, isEditMode: boolean): AdminFormData {
  const data: AdminFormData = {
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email,
    username: form.email.toLowerCase().trim(),
    position: form.position,
    notes: form.notes,
    isActive: form.isActive,
    employeeNumber: form.employeeNumber,
    role: 'admin',
    hasFullAccess: form.hasFullAccess,
    areaIds: form.hasFullAccess ? [] : form.areaIds,
    departmentIds: form.hasFullAccess ? [] : form.departmentIds,
  };

  // Add password only if creating new admin or updating password
  if (!isEditMode) {
    data.password = form.password;
  } else if (form.password && form.password.length >= 8) {
    data.password = form.password;
  }

  return data;
}

/**
 * Populate form state from existing admin
 */
export function populateFormFromAdmin(admin: Admin): FormState {
  return {
    firstName: admin.firstName,
    lastName: admin.lastName,
    email: admin.email,
    password: '',
    position: admin.position ?? '',
    notes: admin.notes ?? '',
    isActive: (admin.isActive === 4 ? 0 : admin.isActive) as FormIsActiveStatus,
    employeeNumber: admin.employeeNumber ?? '',
    hasFullAccess: hasFullAccess(admin),
    areaIds: admin.areaIds ?? admin.areas?.map((a) => a.id) ?? [],
    departmentIds: admin.departmentIds ?? admin.departments?.map((d) => d.id) ?? [],
  };
}
