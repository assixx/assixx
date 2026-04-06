// =============================================================================
// INVENTORY - UTILITY FUNCTIONS
// =============================================================================

import {
  FORM_DEFAULTS,
  ITEM_STATUS_BADGE_CLASSES,
  ITEM_STATUS_LABELS,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
} from './constants';

import type {
  FormIsActiveStatus,
  InventoryItemStatus,
  InventoryList,
  IsActiveStatus,
} from './types';

// ── is_active Badge Helpers ────────────────────────────────────

/** Get badge CSS class for is_active status */
export function getStatusBadgeClass(isActive: IsActiveStatus): string {
  return STATUS_BADGE_CLASSES[isActive];
}

/** Get German label for is_active status */
export function getStatusLabel(isActive: IsActiveStatus): string {
  return STATUS_LABELS[isActive];
}

// ── Item Status Badge Helpers ──────────────────────────────────

/** Get badge CSS class for inventory item status */
export function getItemStatusBadgeClass(status: InventoryItemStatus): string {
  return ITEM_STATUS_BADGE_CLASSES[status];
}

/** Get German label for inventory item status */
export function getItemStatusLabel(status: InventoryItemStatus): string {
  return ITEM_STATUS_LABELS[status];
}

// ── Date Helpers ───────────────────────────────────────────────

/** Format ISO date string for display (de-DE locale) */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('de-DE');
  } catch {
    return '-';
  }
}

// ── Code Preview ───────────────────────────────────────────────

/** Generate a preview of what the item code will look like */
export function getCodePreview(prefix: string, separator: string, digits: number): string {
  if (prefix.length === 0) return '';
  const padded = '1'.padStart(digits, '0');
  return `${prefix}${separator}${padded}`;
}

// ── Form Helpers ───────────────────────────────────────────────

/** Default form values for a new list */
export function getDefaultFormValues(): {
  title: string;
  description: string;
  category: string;
  codePrefix: string;
  codeSeparator: string;
  codeDigits: number;
  icon: string;
  isActive: FormIsActiveStatus;
} {
  return { ...FORM_DEFAULTS };
}

/** Populate form values from an existing list (edit mode) */
export function populateFormFromList(list: InventoryList): {
  title: string;
  description: string;
  category: string;
  codePrefix: string;
  codeSeparator: string;
  codeDigits: number;
  icon: string;
  isActive: FormIsActiveStatus;
} {
  return {
    title: list.title,
    description: list.description ?? '',
    category: list.category ?? '',
    codePrefix: list.codePrefix,
    codeSeparator: list.codeSeparator,
    codeDigits: list.codeDigits,
    icon: list.icon ?? '',
    isActive: (list.isActive === 4 ? 0 : list.isActive) as FormIsActiveStatus,
  };
}

// ── Status Count Helpers ───────────────────────────────────────

/** Get non-zero status counts sorted by count descending */
export function getNonZeroStatusCounts(
  list: InventoryList,
): { status: InventoryItemStatus; count: number }[] {
  return Object.entries(list.statusCounts)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => ({
      status: status as InventoryItemStatus,
      count: count,
    }))
    .sort((a, b) => b.count - a.count);
}
