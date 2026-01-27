/**
 * Admin Dashboard - Utility Functions
 * @module admin-dashboard/_lib/utils
 *
 * IMPORTANT: Use SvelteKit's goto() for navigation to enable client-side routing.
 * Never use window.location for internal navigation - it causes full page reloads!
 */

import { goto } from '$app/navigation';

import {
  ORG_LEVEL_LABELS,
  BLACKBOARD_ORG_LABELS,
  PRIORITY_LABELS,
} from './constants';

import type {
  User,
  Priority,
  OrgLevel,
  BlackboardOrgLevel,
  FormattedEventDate,
} from './types';

/**
 * Get display name for employee
 * @param user - User object
 */
export function getEmployeeName(user: User): string {
  const firstName = user.firstName ?? '';
  const lastName = user.lastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName !== '' ? fullName : user.email;
}

/**
 * Get org level text in German
 * @param orgLevel - Organization level
 */
export function getOrgLevelText(orgLevel: string): string {
  if (orgLevel in ORG_LEVEL_LABELS) {
    return ORG_LEVEL_LABELS[orgLevel as OrgLevel];
  }
  return 'Persönlich';
}

/**
 * Get org level CSS class
 * @param orgLevel - Organization level
 */
export function getOrgLevelClass(orgLevel: string): string {
  return `event-level-${orgLevel}`;
}

/**
 * Get priority label in German
 * @param priority - Priority level
 */
export function getPriorityLabel(priority: Priority): string {
  return PRIORITY_LABELS[priority];
}

/**
 * Get blackboard org level label
 * @param orgLevel - Blackboard organization level
 */
export function getBlackboardOrgLabel(orgLevel: BlackboardOrgLevel): string {
  return BLACKBOARD_ORG_LABELS[orgLevel];
}

/**
 * Format blackboard date (German locale, date only - no time)
 * @param dateStr - ISO date string
 */
export function formatBlackboardDate(
  dateStr: string | null | undefined,
): string {
  if (dateStr === null || dateStr === undefined || dateStr === '') return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Check if a date is expired (in the past)
 * @param dateStr - ISO date string
 */
export function isExpired(dateStr: string | null | undefined): boolean {
  if (dateStr === null || dateStr === undefined || dateStr === '') return false;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
}

/** Buffer-like object structure from API responses */
interface BufferObject {
  type: 'Buffer';
  data: number[];
}

/**
 * Type guard to check if value is a Buffer-like object from API
 */
function isBufferObject(value: object): value is BufferObject {
  return (
    'type' in value &&
    (value as { type: string }).type === 'Buffer' &&
    'data' in value &&
    Array.isArray((value as { data: unknown }).data)
  );
}

/**
 * Parse content text (handles Buffer objects from API)
 * @param contentText - Content which may be string or Buffer object
 */
export function parseContent(contentText: unknown): string {
  if (contentText === null || contentText === undefined) {
    return '';
  }

  if (typeof contentText === 'string') {
    return contentText;
  }

  if (typeof contentText === 'number' || typeof contentText === 'boolean') {
    return String(contentText);
  }

  if (typeof contentText === 'object' && isBufferObject(contentText)) {
    return String.fromCharCode(...contentText.data);
  }

  return JSON.stringify(contentText);
}

/**
 * Truncate content text
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default 150)
 */
export function truncateContent(text: string, maxLength = 150): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Format event date for display
 * @param dateStr - ISO date string
 */
export function formatEventDate(dateStr: string): FormattedEventDate {
  const date = new Date(dateStr);
  return {
    day: date.getDate().toString(),
    month: date.toLocaleDateString('de-DE', { month: 'short' }),
    time: date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

/**
 * Check if event is all day
 * @param allDay - All day flag (boolean or number)
 */
export function isAllDay(allDay: boolean | number): boolean {
  return allDay === true || allDay === 1;
}

/**
 * Navigate to blackboard entry detail
 * Uses SvelteKit's goto() for client-side navigation (no full page reload)
 * @param uuid - Entry UUID
 */
export function openBlackboardEntry(uuid: string): void {
  void goto(`/blackboard/${uuid}`);
}

/**
 * Navigate to URL using SvelteKit client-side routing
 * @param url - Target URL (internal routes only)
 */
export function navigateTo(url: string): void {
  void goto(url);
}

/**
 * Navigate to calendar page
 * Uses SvelteKit's goto() for client-side navigation
 */
export function goToCalendar(): void {
  void goto('/calendar');
}
