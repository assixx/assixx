/**
 * Employee Dashboard - Utility Functions
 * @module employee-dashboard/_lib/utils
 */

import type { CalendarEvent, FormattedEventDate } from './types';
import {
  ORG_LEVEL_TEXT,
  PLACEHOLDER_TEXT,
  PRIORITY_LABELS,
  BLACKBOARD_ORG_LABELS,
} from './constants';

/**
 * Get display name from user data
 * @param firstName - First name
 * @param lastName - Last name
 * @param fallback - Fallback text
 */
export function getDisplayName(
  firstName?: string,
  lastName?: string,
  fallback = PLACEHOLDER_TEXT.employee,
): string {
  const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim();
  return fullName !== '' ? fullName : fallback;
}

/**
 * Get display value with fallback
 * @param value - Value to display
 * @param fallback - Fallback text
 */
export function getDisplayValue(
  value?: string,
  fallback: string = PLACEHOLDER_TEXT.notAssigned,
): string {
  return value && value !== '' ? value : fallback;
}

/**
 * Format event date for display
 * @param event - Calendar event
 */
export function formatEventDate(event: CalendarEvent): FormattedEventDate {
  const startDate = new Date(event.startTime);
  const day = startDate.getDate().toString();
  const month = startDate.toLocaleDateString('de-DE', { month: 'short' });
  const isAllDay = event.allDay === true || event.allDay === 1;
  const time = isAllDay
    ? 'Ganztägig'
    : startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return { day, month, time };
}

/**
 * Get org level display text (German)
 * @param orgLevel - Organization level key
 */
export function getOrgLevelText(orgLevel?: string): string {
  if (!orgLevel) return ORG_LEVEL_TEXT.personal;
  return ORG_LEVEL_TEXT[orgLevel] ?? ORG_LEVEL_TEXT.personal;
}

/**
 * Get org level CSS class
 * @param orgLevel - Organization level key
 */
export function getOrgLevelClass(orgLevel?: string): string {
  return `event-level-${orgLevel ?? 'personal'}`;
}

/**
 * Navigate to URL
 * @param url - Destination URL
 */
export function navigateTo(url: string): void {
  if (typeof window !== 'undefined') {
    window.location.href = url;
  }
}

/**
 * Navigate to calendar
 */
export function goToCalendar(): void {
  navigateTo('/calendar');
}

/**
 * Open blackboard entry by UUID
 * @param uuid - Entry UUID
 */
export function openBlackboardEntry(uuid: string): void {
  navigateTo(`/blackboard/${uuid}`);
}

/**
 * Get priority label (German)
 * @param priority - Priority key
 */
export function getPriorityLabel(priority: string): string {
  return PRIORITY_LABELS[priority] ?? PRIORITY_LABELS.medium;
}

/**
 * Get blackboard org level label (German)
 * @param orgLevel - Org level key
 */
export function getBlackboardOrgLabel(orgLevel: string): string {
  return BLACKBOARD_ORG_LABELS[orgLevel] ?? BLACKBOARD_ORG_LABELS.company;
}

/**
 * Parse blackboard content from JSON or string
 * @param content - Raw content (JSON, string, or unknown)
 */
export function parseContent(content: unknown): string {
  if (content === null || content === undefined) return '';

  if (typeof content === 'string') {
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(content) as { ops?: { insert?: string }[] };
      if (parsed.ops && Array.isArray(parsed.ops)) {
        return parsed.ops
          .map((op) => (typeof op.insert === 'string' ? op.insert : ''))
          .join('')
          .trim();
      }
    } catch {
      // Not JSON, return as-is
      return content;
    }
    return content;
  }

  // Handle Quill Delta format directly
  if (typeof content === 'object' && 'ops' in content) {
    const delta = content as { ops?: { insert?: string }[] };
    if (delta.ops && Array.isArray(delta.ops)) {
      return delta.ops
        .map((op) => (typeof op.insert === 'string' ? op.insert : ''))
        .join('')
        .trim();
    }
  }

  return String(content);
}

/**
 * Truncate content for preview
 * @param content - Content string
 * @param maxLength - Maximum length (default 150)
 */
export function truncateContent(content: string, maxLength = 150): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength).trim() + '...';
}

/**
 * Format blackboard date for display
 * @param dateStr - ISO date string
 */
export function formatBlackboardDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Check if event is all-day
 * @param allDay - All-day flag (boolean or number)
 */
export function isAllDay(allDay: boolean | number): boolean {
  return allDay === true || allDay === 1;
}
