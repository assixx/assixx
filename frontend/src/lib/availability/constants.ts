// =============================================================================
// SHARED AVAILABILITY CONSTANTS
// =============================================================================
// Used by manage-employees, manage-admins, manage-root
// IMPORTANT: Must match shifts/_lib/constants.ts AVAILABILITY_COLORS/ICONS!

import type { AvailabilityStatus } from '@assixx/shared';

/**
 * Availability status options for select dropdown
 */
export const AVAILABILITY_STATUS_OPTIONS: {
  value: AvailabilityStatus;
  label: string;
}[] = [
  { value: 'available', label: 'Verfügbar' },
  { value: 'vacation', label: 'Urlaub' },
  { value: 'sick', label: 'Krank' },
  { value: 'unavailable', label: 'Nicht verfügbar' },
  { value: 'training', label: 'Schulung' },
  { value: 'other', label: 'Sonstiges' },
];

/**
 * Availability status badge classes
 */
export const AVAILABILITY_BADGE_CLASSES: Record<AvailabilityStatus, string> = {
  available: 'badge--success',
  vacation: 'badge--warning',
  sick: 'badge--danger',
  unavailable: 'badge--error',
  training: 'badge--info',
  other: 'badge--dark',
};

/**
 * Availability status icons (FontAwesome classes)
 */
export const AVAILABILITY_ICONS: Record<AvailabilityStatus, string> = {
  available: 'fa-check-circle',
  vacation: 'fa-plane',
  sick: 'fa-notes-medical',
  unavailable: 'fa-ban',
  training: 'fa-graduation-cap',
  other: 'fa-clock',
};

/**
 * Availability status labels
 */
export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  available: 'Verfügbar',
  vacation: 'Urlaub',
  sick: 'Krank',
  unavailable: 'Nicht verfügbar',
  training: 'Schulung',
  other: 'Sonstiges',
};

/**
 * Availability status labels (alias for planned availability display)
 */
export const AVAILABILITY_STATUS_LABELS: Record<AvailabilityStatus, string> = {
  available: 'Verfügbar',
  vacation: 'Urlaub',
  sick: 'Krank',
  unavailable: 'Nicht verfügbar',
  training: 'Schulung',
  other: 'Sonstiges',
};
