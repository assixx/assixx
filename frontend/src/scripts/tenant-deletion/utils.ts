/**
 * Utility functions for Tenant Deletion Status
 *
 * Helper functions for calculations, token parsing, and text mapping
 * API v2 only - uses camelCase field names
 */

import type { DeletionStatus, DeletionStatusItem } from './types';
import { STATUS_TEXT_MAP } from './types';

/**
 * Get German status text for a deletion status
 *
 * @param status - The deletion status value
 * @returns German text representation of the status
 */
export function getStatusText(status: DeletionStatus): string {
  // eslint-disable-next-line security/detect-object-injection -- status is from controlled DeletionStatus enum
  return STATUS_TEXT_MAP[status];
}

/**
 * Calculate remaining cooling-off hours for a deletion request
 *
 * The cooling-off period is a mandatory waiting time before approval
 * can be granted (typically 24 hours, can be 0 for development).
 *
 * @param item - The deletion status item
 * @returns Remaining hours (0 if cooling-off period has passed)
 */
export function calculateCoolingOff(item: DeletionStatusItem): number {
  const requestedAt = new Date(item.requestedAt);
  const hoursSince = (Date.now() - requestedAt.getTime()) / (1000 * 60 * 60);

  return Math.max(0, item.coolingOffHours - hoursSince);
}

/**
 * Get the current user's ID from the JWT token in localStorage
 *
 * @returns User ID or null if not authenticated
 */
export function getCurrentUserId(): number | null {
  const token = localStorage.getItem('token');

  if (token === null || token === '') {
    return null;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payloadPart = parts[1];
    if (payloadPart === undefined || payloadPart === '') {
      return null;
    }

    const payload = JSON.parse(atob(payloadPart)) as { id?: unknown };
    return typeof payload.id === 'number' ? payload.id : null;
  } catch {
    return null;
  }
}

/**
 * Get the requester name from a deletion status item
 *
 * @param item - The deletion status item
 * @returns Requester name or fallback ID string
 */
export function getRequesterName(item: DeletionStatusItem): string {
  return item.requestedByName ?? `ID: ${String(item.requestedBy)}`;
}

/**
 * Check if the current user is the creator of the deletion request
 *
 * @param item - The deletion status item
 * @returns True if current user created the request
 */
export function isCurrentUserCreator(item: DeletionStatusItem): boolean {
  const currentUserId = getCurrentUserId();

  if (currentUserId === null) {
    return false;
  }

  return currentUserId === item.requestedBy;
}

/**
 * Format a date for German locale display
 *
 * @param date - Date object or null
 * @returns Formatted date string or 'Ausstehend'
 */
export function formatDate(date: Date | null): string {
  if (date === null) {
    return 'Ausstehend';
  }

  return date.toLocaleString('de-DE');
}

/**
 * Format a date string for German locale (date only, no time)
 *
 * @param dateString - ISO date string or undefined
 * @returns Formatted date string
 */
export function formatDateOnly(dateString: string | undefined): string {
  if (dateString === undefined || dateString === '') {
    return '30 Tage ab Genehmigung';
  }

  return new Date(dateString).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}
