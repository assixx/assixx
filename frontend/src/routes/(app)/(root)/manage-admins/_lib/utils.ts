// =============================================================================
// MANAGE ADMINS - UTILITY FUNCTIONS
// =============================================================================

import {
  DEFAULT_HIERARCHY_LABELS,
  resolvePositionDisplay,
  type HierarchyLabels,
} from '$lib/types/hierarchy-labels';

import {
  AVAILABILITY_BADGE_CLASSES,
  AVAILABILITY_ICONS,
  AVAILABILITY_LABELS,
  AVAILABILITY_STATUS_LABELS,
  BADGE_CLASS,
  MESSAGES,
  PASSWORD_CRACK_TIMES,
  PASSWORD_STRENGTH_LABELS,
  POSITION_DISPLAY_MAP,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
} from './constants';

import type {
  Admin,
  AdminFormData,
  AvailabilityStatus,
  BadgeInfo,
  Department,
  FormIsActiveStatus,
  IsActiveStatus,
} from './types';

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
 * Get display name for position.
 * Lead keys (area_lead, department_lead) are resolved dynamically via hierarchy labels.
 * Other positions fall through to POSITION_DISPLAY_MAP or pass-through as-is.
 */
export function getPositionDisplay(
  position: string,
  labels: HierarchyLabels = DEFAULT_HIERARCHY_LABELS,
): string {
  const resolved = resolvePositionDisplay(position, labels);
  if (resolved !== position) return resolved;
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
 * Get unique area names inherited upward from departments (explicit + lead)
 * ADR-035: Department permission → READ-ONLY context on parent area
 */
function getInheritedAreaNames(admin: Admin): string[] {
  const allDepts: Department[] = [
    ...(admin.departments ?? []),
    ...(admin.leadDepartments ?? []),
  ];
  const seen = new Set<number>();
  const names: string[] = [];
  for (const dept of allDepts) {
    if (
      dept.areaName !== undefined &&
      dept.areaId !== undefined &&
      !seen.has(dept.areaId)
    ) {
      seen.add(dept.areaId);
      names.push(dept.areaName);
    }
  }
  return names;
}

/**
 * Get badge info for areas column
 * Decision tree: Full Access → Direct/Lead count → Inherited from Depts → Keine
 */
export function getAreasBadge(
  admin: Admin,
  labels: HierarchyLabels,
): BadgeInfo {
  if (hasFullAccess(admin)) {
    return {
      class: BADGE_CLASS.PRIMARY,
      text: MESSAGES.BADGE_ALL,
      title: `${MESSAGES.BADGE_FULL_ACCESS_TITLE} ${labels.area}`,
      icon: 'fa-globe',
    };
  }

  // Direct areas (explicit permissions + lead positions)
  const count = getAreaCount(admin);
  if (count > 0) {
    const names = getAreaNames(admin);
    return {
      class: BADGE_CLASS.INFO,
      text: `${count} ${labels.area}`,
      title: names,
    };
  }

  // Upward inheritance: Departments belong to areas → READ-ONLY context
  const inheritedNames = getInheritedAreaNames(admin);
  if (inheritedNames.length > 0) {
    return {
      class: BADGE_CLASS.WARNING,
      text: MESSAGES.BADGE_INHERITED,
      title: `Vererbt von: ${getDepartmentNames(admin)} → ${inheritedNames.join(', ')}`,
      icon: 'fa-sitemap',
    };
  }

  return {
    class: BADGE_CLASS.SECONDARY,
    text: MESSAGES.BADGE_NONE,
    title: `Keine ${labels.area} zugewiesen`,
  };
}

/**
 * Get total department count (explicit permissions + lead positions)
 */
function getDepartmentCount(admin: Admin): number {
  return (
    (admin.departments?.length ?? 0) + (admin.leadDepartments?.length ?? 0)
  );
}

/**
 * Get total area count (explicit permissions + lead positions)
 */
function getAreaCount(admin: Admin): number {
  return (admin.areas?.length ?? 0) + (admin.leadAreas?.length ?? 0);
}

/**
 * Get comma-separated department names (explicit + lead with suffix)
 */
function getDepartmentNames(admin: Admin): string {
  const explicit =
    admin.departments?.map((d: { name: string }) => d.name) ?? [];
  const lead =
    admin.leadDepartments?.map((d: { name: string }) => `${d.name} (Lead)`) ??
    [];
  return [...explicit, ...lead].join(', ');
}

/**
 * Get comma-separated area names (explicit + lead with suffix)
 */
function getAreaNames(admin: Admin): string {
  const explicit = admin.areas?.map((a: { name: string }) => a.name) ?? [];
  const lead =
    admin.leadAreas?.map((a: { name: string }) => `${a.name} (Lead)`) ?? [];
  return [...explicit, ...lead].join(', ');
}

/**
 * Get badge info for departments column
 */
export function getDepartmentsBadge(
  admin: Admin,
  labels: HierarchyLabels,
): BadgeInfo {
  if (hasFullAccess(admin)) {
    return {
      class: BADGE_CLASS.PRIMARY,
      text: MESSAGES.BADGE_ALL,
      title: `${MESSAGES.BADGE_FULL_ACCESS_TITLE} ${labels.department}`,
      icon: 'fa-globe',
    };
  }

  const deptCount = getDepartmentCount(admin);
  const areaCount = getAreaCount(admin);

  if (deptCount > 0 && areaCount > 0) {
    return {
      class: BADGE_CLASS.INFO,
      text: `${deptCount} + ${MESSAGES.BADGE_INHERITED}`,
      title: `Direkt: ${getDepartmentNames(admin)} + Vererbt von ${areaCount} ${labels.area}`,
    };
  }

  if (deptCount > 0) {
    return {
      class: BADGE_CLASS.INFO,
      text: `${deptCount} ${labels.department}`,
      title: getDepartmentNames(admin),
    };
  }

  if (areaCount > 0) {
    return {
      class: BADGE_CLASS.WARNING,
      text: MESSAGES.BADGE_INHERITED,
      title: `Vererbt von: ${getAreaNames(admin)}`,
      icon: 'fa-sitemap',
    };
  }

  return {
    class: BADGE_CLASS.SECONDARY,
    text: MESSAGES.BADGE_NONE,
    title: `Keine ${labels.department} zugewiesen`,
  };
}

/**
 * Build inheritance description for teams badge
 */
function buildTeamsInheritanceTitle(
  admin: Admin,
  labels: HierarchyLabels,
): string {
  const parts: string[] = [];
  const areaNames = getAreaNames(admin);
  const deptNames = getDepartmentNames(admin);

  if (areaNames !== '') {
    parts.push(`${labels.area}: ${areaNames}`);
  }
  if (deptNames !== '') {
    parts.push(`${labels.department}: ${deptNames}`);
  }

  return `${labels.team} vererbt von: ${parts.join(' | ')}`;
}

/**
 * Get badge info for teams column (inherited via Area/Department)
 */
export function getTeamsBadge(
  admin: Admin,
  labels: HierarchyLabels,
): BadgeInfo {
  if (hasFullAccess(admin)) {
    return {
      class: BADGE_CLASS.PRIMARY,
      text: MESSAGES.BADGE_ALL,
      title: `${MESSAGES.BADGE_FULL_ACCESS_TITLE} ${labels.team}`,
      icon: 'fa-globe',
    };
  }

  const hasAreas = getAreaCount(admin) > 0;
  const hasDepts = getDepartmentCount(admin) > 0;

  if (hasAreas || hasDepts) {
    return {
      class: BADGE_CLASS.WARNING,
      text: MESSAGES.BADGE_INHERITED,
      title: buildTeamsInheritanceTitle(admin, labels),
      icon: 'fa-sitemap',
    };
  }

  return {
    class: BADGE_CLASS.SECONDARY,
    text: MESSAGES.BADGE_NONE,
    title: `Keine ${labels.team} zugewiesen`,
  };
}

// =============================================================================
// PASSWORD STRENGTH HELPERS
// =============================================================================

export interface PasswordStrengthResult {
  score: number; // 0-4
  label: string;
  crackTime: string;
}

/** Calculate password strength */
export function calculatePasswordStrength(
  password: string,
): PasswordStrengthResult {
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
export function validateEmailsMatch(
  email: string,
  emailConfirm: string,
): boolean {
  return email === emailConfirm;
}

/**
 * Check if two passwords match
 */
export function validatePasswordsMatch(
  password: string,
  passwordConfirm: string,
): boolean {
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
export function buildAdminFormData(
  form: FormState,
  isEditMode: boolean,
): AdminFormData {
  const data: AdminFormData = {
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email.toLowerCase().trim(),
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
    email: admin.email.toLowerCase(),
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

// =============================================================================
// AVAILABILITY BADGE HELPERS
// =============================================================================

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
export function getAvailabilityBadge(admin: Admin): BadgeInfo {
  const status = admin.availabilityStatus ?? 'available';

  if (status === 'available') {
    return {
      class: AVAILABILITY_BADGE_CLASSES.available,
      text: AVAILABILITY_LABELS.available,
      title: '',
      icon: AVAILABILITY_ICONS.available,
    };
  }

  const isActive = isDateRangeActive(
    admin.availabilityStart,
    admin.availabilityEnd,
  );

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
 * Get availability label from status value
 */
export function getAvailabilityLabel(status: AvailabilityStatus): string {
  return AVAILABILITY_LABELS[status];
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
export function getPlannedAvailability(admin: Admin): string {
  const status = admin.availabilityStatus ?? 'available';
  if (status === 'available') return '-';

  const statusText = AVAILABILITY_STATUS_LABELS[status];
  const startDate = admin.availabilityStart;
  const endDate = admin.availabilityEnd;

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
export type AvailabilityValidationError =
  | 'dates_required'
  | 'end_before_start'
  | null;

/**
 * Validate availability form data
 */
export function validateAvailabilityForm(
  data: AvailabilityFormData,
): AvailabilityValidationError {
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
export function buildAvailabilityPayload(
  data: AvailabilityFormData,
): AvailabilityPayload {
  return {
    availabilityStatus: data.status,
    availabilityStart: data.start !== '' ? data.start : undefined,
    availabilityEnd: data.end !== '' ? data.end : undefined,
    availabilityReason: data.reason !== '' ? data.reason : undefined,
    availabilityNotes: data.notes !== '' ? data.notes : undefined,
  };
}
