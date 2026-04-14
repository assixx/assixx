// =============================================================================
// INVENTORY - UTILITY FUNCTIONS
// =============================================================================

import { FORM_DEFAULTS } from './constants';

import type { FormIsActiveStatus, InventoryItemStatus, InventoryList } from './types';

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
  codePrefix: string;
  codeSeparator: string;
  codeDigits: number;
  icon: string;
  isActive: FormIsActiveStatus;
  tagIds: string[];
} {
  return { ...FORM_DEFAULTS, tagIds: [] };
}

/** Populate form values from an existing list (edit mode) */
export function populateFormFromList(list: InventoryList): {
  title: string;
  description: string;
  codePrefix: string;
  codeSeparator: string;
  codeDigits: number;
  icon: string;
  isActive: FormIsActiveStatus;
  tagIds: string[];
} {
  return {
    title: list.title,
    description: list.description ?? '',
    codePrefix: list.codePrefix,
    codeSeparator: list.codeSeparator,
    codeDigits: list.codeDigits,
    icon: list.icon ?? '',
    isActive: (list.isActive === 4 ? 0 : list.isActive) as FormIsActiveStatus,
    tagIds: list.tags.map((t) => t.id),
  };
}

// ── Date Helpers ───────────────────────────────────────────────

/** Format ISO date string as "DD.MM.YYYY, HH:mm" (de-DE) — used in preview footer */
export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
