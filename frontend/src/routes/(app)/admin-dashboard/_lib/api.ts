/**
 * Admin Dashboard - API Functions
 * @module admin-dashboard/_lib/api
 *
 * PERFORMANCE: Uses centralized apiClient with caching
 */

import { getApiClient } from '$lib/utils/api-client';

import { LIST_LIMITS, CALENDAR_MONTHS_AHEAD } from './constants';

import type { User, Document, Department, Team, CalendarEvent, BlackboardEntry } from './types';

/** Get auth token from localStorage */
export function getAuthToken(): string | null {
  return localStorage.getItem('accessToken');
}

/**
 * Make authenticated API request
 * PERFORMANCE: Uses apiClient with built-in caching
 * @param endpoint - API endpoint (without /api/v2 prefix)
 * @returns API response data
 */
export async function apiGet<T>(endpoint: string): Promise<T> {
  const apiClient = getApiClient();
  return await apiClient.get<T>(endpoint);
}

/**
 * Load employees (for recent list + count)
 * @returns Recent employees and total count
 */
export async function loadEmployees(): Promise<{
  recent: User[];
  count: number;
}> {
  try {
    const employees = await apiGet<User[]>('/users?role=employee');
    const list = Array.isArray(employees) ? employees : [];
    return {
      recent: list.slice(0, LIST_LIMITS.recentEmployees),
      count: list.length,
    };
  } catch (err) {
    console.error('Error loading employees:', err);
    return { recent: [], count: 0 };
  }
}

/**
 * Load documents (for recent list + count)
 * @returns Recent documents and total count
 */
export async function loadDocuments(): Promise<{
  recent: Document[];
  count: number;
}> {
  try {
    const result = await apiGet<{ documents?: Document[] } | Document[]>('/documents');
    const docs = 'documents' in result ? (result.documents ?? []) : result;
    const list = Array.isArray(docs) ? docs : [];
    return {
      recent: list.slice(0, LIST_LIMITS.recentDocuments),
      count: list.length,
    };
  } catch (err) {
    console.error('Error loading documents:', err);
    return { recent: [], count: 0 };
  }
}

/**
 * Load departments
 * @returns Departments list and total count
 */
export async function loadDepartments(): Promise<{
  list: Department[];
  count: number;
}> {
  try {
    const result = await apiGet<Department[]>('/departments');
    const list = Array.isArray(result) ? result : [];
    return {
      list: list.slice(0, LIST_LIMITS.departments),
      count: list.length,
    };
  } catch (err) {
    console.error('Error loading departments:', err);
    return { list: [], count: 0 };
  }
}

/**
 * Load teams
 * @returns Teams list and total count
 */
export async function loadTeams(): Promise<{
  list: Team[];
  count: number;
}> {
  try {
    const result = await apiGet<Team[]>('/teams');
    const list = Array.isArray(result) ? result : [];
    return {
      list: list.slice(0, LIST_LIMITS.teams),
      count: list.length,
    };
  } catch (err) {
    console.error('Error loading teams:', err);
    return { list: [], count: 0 };
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

    const result = await apiGet<{ events?: CalendarEvent[] } | CalendarEvent[]>(
      `/calendar/events?startDate=${encodeURIComponent(startISO)}&endDate=${encodeURIComponent(endISO)}&filter=all&limit=10`,
    );

    const events = 'events' in result ? (result.events ?? []) : result;
    if (!Array.isArray(events)) {
      return [];
    }

    // Filter future events and take next few
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
    console.error('Error loading events:', err);
    return [];
  }
}

/**
 * Load blackboard widget entries
 * @returns Recent blackboard entries
 */
export async function loadBlackboard(): Promise<BlackboardEntry[]> {
  try {
    const result = await apiGet<BlackboardEntry[]>(
      `/blackboard/dashboard?limit=${LIST_LIMITS.blackboardEntries}`,
    );
    return Array.isArray(result) ? result : [];
  } catch (err) {
    console.error('Error loading blackboard:', err);
    return [];
  }
}
