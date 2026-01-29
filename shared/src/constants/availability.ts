/**
 * Availability Constants
 *
 * Labels, badge classes, and icons for employee availability status.
 * Single source of truth - replaces copy-pasted definitions in manage-employees and shifts.
 */
import type { AvailabilityStatus } from '../types/availability.js';

/** German labels for availability status */
export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  available: 'Verfügbar',
  vacation: 'Urlaub',
  sick: 'Krank',
  unavailable: 'Nicht verfügbar',
  training: 'Schulung',
  other: 'Sonstiges',
};

/** CSS badge classes for availability status */
export const AVAILABILITY_BADGE_CLASSES: Record<AvailabilityStatus, string> = {
  available: 'badge--success',
  vacation: 'badge--warning',
  sick: 'badge--danger',
  unavailable: 'badge--error',
  training: 'badge--info',
  other: 'badge--dark',
};

/** FontAwesome icon classes for availability status */
export const AVAILABILITY_ICONS: Record<AvailabilityStatus, string> = {
  available: 'fa-check-circle',
  vacation: 'fa-plane',
  sick: 'fa-notes-medical',
  unavailable: 'fa-ban',
  training: 'fa-graduation-cap',
  other: 'fa-clock',
};

/** Availability options for select dropdowns */
export const AVAILABILITY_OPTIONS: readonly {
  value: AvailabilityStatus;
  label: string;
}[] = [
  { value: 'available', label: 'Verfügbar' },
  { value: 'vacation', label: 'Urlaub' },
  { value: 'sick', label: 'Krank' },
  { value: 'unavailable', label: 'Nicht verfügbar' },
  { value: 'training', label: 'Schulung' },
  { value: 'other', label: 'Sonstiges' },
] as const;
