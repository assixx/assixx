/**
 * Date Helper Functions
 * Utilities for formatting dates and times in German locale
 *
 * Migrated from common.ts as part of unified-navigation refactoring
 */

/**
 * Format date to German locale (DD.MM.YYYY)
 *
 * @param dateString - ISO date string or Date object
 * @returns Formatted date string
 *
 * @example
 * formatDate('2025-11-08T10:00:00Z') // '08.11.2025'
 */
export function formatDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format datetime to German locale (DD.MM.YYYY HH:MM)
 *
 * @param dateString - ISO date string or Date object
 * @returns Formatted datetime string
 *
 * @example
 * formatDateTime('2025-11-08T10:30:00Z') // '08.11.2025 10:30'
 */
export function formatDateTime(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format time only (HH:MM)
 *
 * @param dateString - ISO date string or Date object
 * @returns Formatted time string
 *
 * @example
 * formatTime('2025-11-08T10:30:00Z') // '10:30'
 */
export function formatTime(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Helper interface for time units
 */
interface TimeUnit {
  value: number;
  singular: string;
  plural: string;
}

/**
 * Get pluralized time unit string in German
 */
function getPluralizedTimeUnit(unit: TimeUnit): string {
  return `vor ${unit.value} ${unit.value === 1 ? unit.singular : unit.plural}`;
}

/**
 * Format time difference as relative string
 */
function formatTimeDifference(diffSec: number, diffMin: number, diffHour: number, diffDay: number): string {
  // Handle seconds
  if (diffSec < 60) {
    return 'gerade eben';
  }

  // Handle minutes
  if (diffMin < 60) {
    return getPluralizedTimeUnit({ value: diffMin, singular: 'Minute', plural: 'Minuten' });
  }

  // Handle hours
  if (diffHour < 24) {
    return getPluralizedTimeUnit({ value: diffHour, singular: 'Stunde', plural: 'Stunden' });
  }

  // Handle days
  return formatDayDifference(diffDay);
}

/**
 * Format day difference as relative string
 */
function formatDayDifference(diffDay: number): string {
  // Yesterday
  if (diffDay === 1) {
    return 'gestern';
  }

  // Days (less than a week)
  if (diffDay < 7) {
    return `vor ${diffDay} Tagen`;
  }

  // Weeks (less than a month)
  if (diffDay < 30) {
    const weeks = Math.floor(diffDay / 7);
    return getPluralizedTimeUnit({ value: weeks, singular: 'Woche', plural: 'Wochen' });
  }

  // Months (less than a year)
  if (diffDay < 365) {
    const months = Math.floor(diffDay / 30);
    return getPluralizedTimeUnit({ value: months, singular: 'Monat', plural: 'Monaten' });
  }

  // Years
  const years = Math.floor(diffDay / 365);
  return getPluralizedTimeUnit({ value: years, singular: 'Jahr', plural: 'Jahren' });
}

/**
 * Format relative date (e.g., "vor 2 Stunden", "gestern")
 *
 * @param dateString - ISO date string or Date object
 * @returns Relative date string in German
 *
 * @example
 * formatRelativeDate(new Date(Date.now() - 3600000)) // 'vor 1 Stunde'
 */
export function formatRelativeDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Calculate time differences
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  return formatTimeDifference(diffSec, diffMin, diffHour, diffDay);
}

/**
 * Check if date is today
 *
 * @param dateString - ISO date string or Date object
 * @returns True if date is today
 */
export function isToday(dateString: string | Date): boolean {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if date is within last N days
 *
 * @param dateString - ISO date string or Date object
 * @param days - Number of days
 * @returns True if date is within last N days
 */
export function isWithinDays(dateString: string | Date, days: number): boolean {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays <= days && diffDays >= 0;
}
