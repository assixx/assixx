/**
 * Logs Page Utilities
 * Helper functions for system logs
 */

import { ACTION_LABELS, ROLE_LABELS, ROLE_BADGE_CLASSES } from './constants';

import type { LogEntry, PaginationPageItem, DropdownOption } from './types';

// ============================================================================
// Filter Helpers
// ============================================================================

/**
 * Check if filter value should be included in API call
 */
export function shouldIncludeFilter(value: string | undefined): boolean {
  return value !== undefined && value !== '' && value !== 'all';
}

/**
 * Calculate start date based on timerange selection
 */
export function calculateStartDate(timerange: string): string {
  const now = new Date();

  switch (timerange) {
    case 'today':
      return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      ).toISOString();
    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return new Date(
        yesterday.getFullYear(),
        yesterday.getMonth(),
        yesterday.getDate(),
      ).toISOString();
    }
    case 'week': {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return weekAgo.toISOString();
    }
    case 'month': {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return monthAgo.toISOString();
    }
    case '3months': {
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      return threeMonthsAgo.toISOString();
    }
    case '6months': {
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      return sixMonthsAgo.toISOString();
    }
    case 'year': {
      const yearAgo = new Date(now);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      return yearAgo.toISOString();
    }
    default:
      return '';
  }
}

// ============================================================================
// Display Helpers
// ============================================================================

/**
 * Get localized action label
 */
export function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/**
 * Get localized role label
 */
export function getRoleLabel(role: string | null | undefined): string {
  if (role === null || role === undefined || role === '') return 'Unbekannt';
  return ROLE_LABELS[role] ?? role;
}

/**
 * Get CSS class for role badge
 */
export function getRoleBadgeClass(role: string | null | undefined): string {
  if (role === null || role === undefined || role === '') return 'badge--info';
  const roleLower = role.toLowerCase();
  return ROLE_BADGE_CLASSES[roleLower] ?? 'badge--info';
}

/**
 * Format date for display (German locale)
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Get display name from log entry
 */
export function getDisplayName(entry: LogEntry): string {
  const firstName = entry.userFirstName ?? '';
  const lastName = entry.userLastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName !== '' ? fullName : entry.userName;
}

// ============================================================================
// Dropdown Helpers
// ============================================================================

/**
 * Get display text for dropdown selection
 */
export function getDropdownDisplayText(
  options: DropdownOption[],
  value: string,
  defaultText: string,
): string {
  return options.find((o) => o.value === value)?.text ?? defaultText;
}

// ============================================================================
// Pagination Helpers
// ============================================================================

/**
 * Calculate visible page numbers for pagination
 */
export function getVisiblePages(
  currentPage: number,
  totalPages: number,
): PaginationPageItem[] {
  const pages: PaginationPageItem[] = [];

  let startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, startPage + 4);
  startPage = Math.max(1, endPage - 4);

  // First page + ellipsis if needed
  if (startPage > 1) {
    pages.push({ type: 'page', value: 1 });
    if (startPage > 2) {
      pages.push({ type: 'ellipsis' });
    }
  }

  // Page numbers
  for (let i = startPage; i <= endPage; i++) {
    pages.push({ type: 'page', value: i, active: i === currentPage });
  }

  // Last page + ellipsis if needed
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pages.push({ type: 'ellipsis' });
    }
    pages.push({ type: 'page', value: totalPages });
  }

  return pages;
}

// ============================================================================
// Filter State Helpers
// ============================================================================

/**
 * Check if any filter is active (not default)
 */
export function hasActiveFilters(
  filterUser: string,
  filterAction: string,
  filterEntity: string,
  filterTimerange: string,
): boolean {
  return (
    filterUser !== '' ||
    (filterAction !== '' && filterAction !== 'all') ||
    (filterEntity !== '' && filterEntity !== 'all') ||
    (filterTimerange !== '' && filterTimerange !== 'all')
  );
}
