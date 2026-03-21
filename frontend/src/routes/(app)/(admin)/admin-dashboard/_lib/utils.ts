/**
 * Admin Dashboard - Utility Functions
 * @module admin-dashboard/_lib/utils
 *
 * IMPORTANT: Use SvelteKit's goto() for navigation to enable client-side routing.
 * Never use window.location for internal navigation - it causes full page reloads!
 */

import { goto } from '$app/navigation';

import { PRIORITY_LABELS, type DashboardMessages } from './constants';

import type { User, Priority, OrgLevel, BlackboardOrgLevel, FormattedEventDate } from './types';

/** Get display name for employee */
export function getEmployeeName(user: User): string {
  const firstName = user.firstName ?? '';
  const lastName = user.lastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName !== '' ? fullName : user.email;
}

/** Get org level text with dynamic labels */
export function getOrgLevelText(
  orgLevel: string,
  orgLevelLabels: DashboardMessages['orgLevelLabels'],
): string {
  if (orgLevel in orgLevelLabels) {
    return orgLevelLabels[orgLevel as OrgLevel];
  }
  return 'Persönlich';
}

/** Get org level CSS class */
export function getOrgLevelClass(orgLevel: string): string {
  return `event-level-${orgLevel}`;
}

/** Get priority label in German */
export function getPriorityLabel(priority: Priority): string {
  return PRIORITY_LABELS[priority];
}

/** Get blackboard org level label with dynamic labels */
export function getBlackboardOrgLabel(
  orgLevel: BlackboardOrgLevel,
  blackboardOrgLabels: DashboardMessages['blackboardOrgLabels'],
): string {
  return blackboardOrgLabels[orgLevel];
}

/** Format blackboard date (German locale, date only - no time) */
export function formatBlackboardDate(dateStr: string | null | undefined): string {
  if (dateStr === null || dateStr === undefined || dateStr === '') return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Check if a date is expired (in the past) */
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

/** Type guard to check if value is a Buffer-like object from API */
function isBufferObject(value: object): value is BufferObject {
  return (
    'type' in value &&
    (value as { type: string }).type === 'Buffer' &&
    'data' in value &&
    Array.isArray((value as { data: unknown }).data)
  );
}

/** Parse content text (handles Buffer objects from API) */
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

/** Truncate content text */
export function truncateContent(text: string, maxLength = 150): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/** Format event date for display */
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

/** Check if event is all day */
export function isAllDay(allDay: boolean | number): boolean {
  return allDay === true || allDay === 1;
}

/** Navigate to blackboard entry detail via SvelteKit client-side routing */
export function openBlackboardEntry(uuid: string): void {
  void goto(`/blackboard/${uuid}`);
}

/** Navigate to URL using SvelteKit client-side routing */
export function navigateTo(url: string): void {
  void goto(url);
}

/** Navigate to calendar page via SvelteKit client-side routing */
export function goToCalendar(): void {
  void goto('/calendar');
}
