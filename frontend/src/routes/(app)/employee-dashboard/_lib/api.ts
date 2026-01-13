/**
 * Employee Dashboard - API Functions
 * @module employee-dashboard/_lib/api
 *
 * Client-side API functions for dynamic data loading
 */

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';

import { LIST_LIMITS, CALENDAR_MONTHS_AHEAD } from './constants';

import type { Document, CalendarEvent, BlackboardEntry } from './types';

const log = createLogger('EmployeeDashboardApi');

const apiClient = getApiClient();

/**
 * Load recent documents
 * @returns Recent documents list
 */
export async function loadDocuments(): Promise<Document[]> {
  try {
    const result = await apiClient.get('/documents');

    // Handle different response formats
    if (Array.isArray(result)) {
      return (result as Document[]).slice(0, LIST_LIMITS.recentDocuments);
    }
    if (result !== null && typeof result === 'object') {
      const obj = result as Record<string, unknown>;
      if ('documents' in obj && Array.isArray(obj.documents)) {
        return (obj.documents as Document[]).slice(0, LIST_LIMITS.recentDocuments);
      }
    }
    return [];
  } catch (err) {
    log.error({ err }, 'Error loading documents');
    return [];
  }
}

/**
 * Load upcoming calendar events
 * @returns Next upcoming events
 */
export async function loadUpcomingEvents(): Promise<CalendarEvent[]> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureDate = new Date(today);
    futureDate.setMonth(futureDate.getMonth() + CALENDAR_MONTHS_AHEAD);

    const startISO = today.toISOString();
    const endISO = futureDate.toISOString();

    const result = await apiClient.get(
      `/calendar/events?startDate=${encodeURIComponent(startISO)}&endDate=${encodeURIComponent(endISO)}&filter=all&limit=10`,
    );

    // Handle different response formats
    let events: CalendarEvent[] = [];
    if (Array.isArray(result)) {
      events = result as CalendarEvent[];
    } else if (result !== null && typeof result === 'object') {
      const obj = result as Record<string, unknown>;
      if ('events' in obj && Array.isArray(obj.events)) {
        events = obj.events as CalendarEvent[];
      }
    }

    // Filter future events and sort by startTime
    return events
      .filter((event) => {
        if (event.startTime === '') return false;
        try {
          const eventDate = new Date(event.startTime);
          return !Number.isNaN(eventDate.getTime()) && eventDate >= today;
        } catch {
          return false;
        }
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, LIST_LIMITS.upcomingEvents);
  } catch (err) {
    log.error({ err }, 'Error loading events');
    return [];
  }
}

/**
 * Load blackboard widget entries
 * @returns Recent blackboard entries
 */
export async function loadBlackboard(): Promise<BlackboardEntry[]> {
  try {
    const result = await apiClient.get(
      `/blackboard/dashboard?limit=${LIST_LIMITS.blackboardEntries}`,
    );
    return Array.isArray(result) ? (result as BlackboardEntry[]) : [];
  } catch (err) {
    log.error({ err }, 'Error loading blackboard');
    return [];
  }
}
