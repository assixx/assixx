/**
 * IsActive Constants
 *
 * Labels, badge classes, and options for the is_active status system.
 * Single source of truth - replaces 8+ copy-pasted definitions.
 */
import type {
  FormIsActiveStatus,
  IsActiveStatus,
  StatusFilter,
} from '../types/is-active-status.js';

/** Enum-like constants for is_active values */
export const IS_ACTIVE = {
  INACTIVE: 0,
  ACTIVE: 1,
  ARCHIVED: 3,
  DELETED: 4,
} as const satisfies Record<string, IsActiveStatus>;

/** German labels for is_active status display */
export const STATUS_LABELS: Record<IsActiveStatus, string> = {
  1: 'Aktiv',
  0: 'Inaktiv',
  3: 'Archiviert',
  4: 'Gelöscht',
};

/** CSS badge classes for is_active status */
export const STATUS_BADGE_CLASSES: Record<IsActiveStatus, string> = {
  1: 'badge--success',
  0: 'badge--warning',
  3: 'badge--secondary',
  4: 'badge--error',
};

/** Status filter options for dropdowns */
export const STATUS_FILTER_OPTIONS: readonly {
  value: StatusFilter;
  label: string;
}[] = [
  { value: 'all', label: 'Alle' },
  { value: 'active', label: 'Aktiv' },
  { value: 'inactive', label: 'Inaktiv' },
  { value: 'archived', label: 'Archiviert' },
] as const;

/** Form-safe status options (excludes "deleted") */
export const FORM_STATUS_OPTIONS: readonly {
  value: FormIsActiveStatus;
  label: string;
}[] = [
  { value: 1, label: 'Aktiv' },
  { value: 0, label: 'Inaktiv' },
  { value: 3, label: 'Archiviert' },
] as const;
