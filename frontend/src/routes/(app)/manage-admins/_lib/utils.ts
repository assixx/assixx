// =============================================================================
// MANAGE ADMINS - UTILITY FUNCTIONS
// =============================================================================

import { escapeHtml } from '$lib/utils/sanitize-html';

import {
  BADGE_CLASS,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  POSITION_DISPLAY_MAP,
  PASSWORD_STRENGTH_LABELS,
  PASSWORD_CRACK_TIMES,
  MESSAGES,
} from './constants';

import type { Admin, AdminFormData, BadgeInfo, FormIsActiveStatus, IsActiveStatus } from './types';

// =============================================================================
// STATUS HELPERS
// =============================================================================

/**
 * Get CSS class for status badge
 */
export function getStatusBadgeClass(isActive: IsActiveStatus): string {
  return STATUS_BADGE_CLASSES[isActive];
}

/**
 * Get localized status label
 */
export function getStatusLabel(isActive: IsActiveStatus): string {
  return STATUS_LABELS[isActive];
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
      class: BADGE_CLASS.PRIMARY,
      text: MESSAGES.BADGE_ALL,
      title: `${MESSAGES.BADGE_FULL_ACCESS_TITLE} Bereiche`,
      icon: 'fa-globe',
    };
  }
  if (!admin.areas || admin.areas.length === 0) {
    return {
      class: BADGE_CLASS.SECONDARY,
      text: MESSAGES.BADGE_NONE,
      title: MESSAGES.BADGE_NO_AREAS,
    };
  }
  const count = admin.areas.length;
  const label = count === 1 ? 'Bereich' : 'Bereiche';
  const names = admin.areas.map((a) => a.name).join(', ');
  return {
    class: BADGE_CLASS.INFO,
    text: `${count} ${label}`,
    title: names,
  };
}

/**
 * Get department count safely
 */
function getDepartmentCount(admin: Admin): number {
  return admin.departments?.length ?? 0;
}

/**
 * Get area count safely
 */
function getAreaCount(admin: Admin): number {
  return admin.areas?.length ?? 0;
}

/**
 * Get comma-separated department names
 */
function getDepartmentNames(admin: Admin): string {
  return admin.departments?.map((d) => d.name).join(', ') ?? '';
}

/**
 * Get comma-separated area names
 */
function getAreaNames(admin: Admin): string {
  return admin.areas?.map((a) => a.name).join(', ') ?? '';
}

/**
 * Get singular/plural label for departments
 */
function getDepartmentLabel(count: number): string {
  return count === 1 ? 'Abteilung' : 'Abteilungen';
}

/**
 * Get badge info for departments column
 */
export function getDepartmentsBadge(admin: Admin): BadgeInfo {
  if (hasFullAccess(admin)) {
    return {
      class: BADGE_CLASS.PRIMARY,
      text: MESSAGES.BADGE_ALL,
      title: `${MESSAGES.BADGE_FULL_ACCESS_TITLE} Abteilungen`,
      icon: 'fa-globe',
    };
  }

  const deptCount = getDepartmentCount(admin);
  const areaCount = getAreaCount(admin);

  if (deptCount > 0 && areaCount > 0) {
    return {
      class: BADGE_CLASS.INFO,
      text: `${deptCount} Abtlg. + ${MESSAGES.BADGE_INHERITED}`,
      title: `Direkt: ${getDepartmentNames(admin)} + Vererbt von ${areaCount} Bereichen`,
    };
  }

  if (deptCount > 0) {
    return {
      class: BADGE_CLASS.INFO,
      text: `${deptCount} ${getDepartmentLabel(deptCount)}`,
      title: getDepartmentNames(admin),
    };
  }

  if (areaCount > 0) {
    return {
      class: BADGE_CLASS.INFO,
      text: MESSAGES.BADGE_INHERITED,
      title: `Vererbt von: ${getAreaNames(admin)}`,
      icon: 'fa-sitemap',
    };
  }

  return {
    class: BADGE_CLASS.SECONDARY,
    text: MESSAGES.BADGE_NONE,
    title: MESSAGES.BADGE_NO_DEPARTMENTS,
  };
}

/**
 * Build inheritance description for teams badge
 */
function buildTeamsInheritanceTitle(admin: Admin): string {
  const parts: string[] = [];
  const areaNames = getAreaNames(admin);
  const deptNames = getDepartmentNames(admin);

  if (areaNames !== '') {
    parts.push(`Bereiche: ${areaNames}`);
  }
  if (deptNames !== '') {
    parts.push(`Abteilungen: ${deptNames}`);
  }

  return `Teams vererbt von: ${parts.join(' | ')}`;
}

/**
 * Get badge info for teams column (inherited via Area/Department)
 */
export function getTeamsBadge(admin: Admin): BadgeInfo {
  if (hasFullAccess(admin)) {
    return {
      class: BADGE_CLASS.PRIMARY,
      text: MESSAGES.BADGE_ALL,
      title: `${MESSAGES.BADGE_FULL_ACCESS_TITLE} Teams`,
      icon: 'fa-globe',
    };
  }

  const hasAreas = getAreaCount(admin) > 0;
  const hasDepts = getDepartmentCount(admin) > 0;

  if (hasAreas || hasDepts) {
    return {
      class: BADGE_CLASS.INFO,
      text: MESSAGES.BADGE_INHERITED,
      title: buildTeamsInheritanceTitle(admin),
      icon: 'fa-sitemap',
    };
  }

  return {
    class: BADGE_CLASS.SECONDARY,
    text: MESSAGES.BADGE_NONE,
    title: MESSAGES.BADGE_NO_TEAMS,
  };
}

// =============================================================================
// SEARCH HELPERS
// =============================================================================

/**
 * Highlight search term in text with <strong> tags
 * SECURITY: Escapes HTML BEFORE highlighting to prevent XSS
 *
 * @param text - Text to highlight in (potentially untrusted)
 * @param query - Search query to highlight
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
  if (!isEditMode || form.password.length >= 8) {
    data.password = form.password;
  }

  return data;
}

/**
 * Get area IDs from admin (either direct or extracted from areas array)
 */
function extractAreaIds(admin: Admin): number[] {
  if (admin.areaIds !== undefined) return admin.areaIds;
  return admin.areas?.map((a) => a.id) ?? [];
}

/**
 * Get department IDs from admin (either direct or extracted from departments array)
 */
function extractDepartmentIds(admin: Admin): number[] {
  if (admin.departmentIds !== undefined) return admin.departmentIds;
  return admin.departments?.map((d) => d.id) ?? [];
}

/**
 * Normalize isActive status for form (convert deleted=4 to inactive=0)
 */
function normalizeIsActiveForForm(isActive: number): FormIsActiveStatus {
  return (isActive === 4 ? 0 : isActive) as FormIsActiveStatus;
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
    isActive: normalizeIsActiveForForm(admin.isActive),
    employeeNumber: admin.employeeNumber ?? '',
    hasFullAccess: hasFullAccess(admin),
    areaIds: extractAreaIds(admin),
    departmentIds: extractDepartmentIds(admin),
  };
}
