/**
 * Employee Dashboard - API Functions
 * @module employee-dashboard/_lib/api
 *
 * Client-side API functions for dynamic data loading
 */

import { getApiClient } from '$lib/utils/api-client';
import type { Document, CalendarEvent, BlackboardEntry } from './types';
import { LIST_LIMITS, CALENDAR_MONTHS_AHEAD } from './constants';

const apiClient = getApiClient();

/**
 * Load recent documents
 * @returns Recent documents list
 */
export async function loadDocuments(): Promise<Document[]> {
  try {
    const result = (await apiClient.get('/documents')) as { documents?: Document[] } | Document[];

    const docs = 'documents' in result ? (result.documents ?? []) : result;
    return Array.isArray(docs) ? docs.slice(0, LIST_LIMITS.recentDocuments) : [];
  } catch (err) {
    console.error('[EmployeeDashboard] Error loading documents:', err);
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

    const result = (await apiClient.get(
      `/calendar/events?startDate=${encodeURIComponent(startISO)}&endDate=${encodeURIComponent(endISO)}&filter=all&limit=10`,
    )) as { events?: CalendarEvent[] } | CalendarEvent[];

    const events = 'events' in result ? (result.events ?? []) : result;
    if (!Array.isArray(events)) {
      return [];
    }

    // Filter future events and sort by startTime
    return events
      .filter((event) => {
        if (!event.startTime) return false;
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
    console.error('[EmployeeDashboard] Error loading events:', err);
    return [];
  }
}

/**
 * Load blackboard widget entries
 * @returns Recent blackboard entries
 */
export async function loadBlackboard(): Promise<BlackboardEntry[]> {
  try {
    const result = (await apiClient.get(
      `/blackboard/dashboard?limit=${LIST_LIMITS.blackboardEntries}`,
    )) as BlackboardEntry[];
    return Array.isArray(result) ? result : [];
  } catch (err) {
    console.error('[EmployeeDashboard] Error loading blackboard:', err);
    return [];
  }
}
