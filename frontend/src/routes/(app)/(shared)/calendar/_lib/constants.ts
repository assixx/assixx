// =============================================================================
// CALENDAR - CONSTANTS
// =============================================================================

import type { OrgLevel, EventLevelInfo } from './types';

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  EVENTS: '/calendar/events',
  event: (id: number) => `/calendar/events/${id}`,
  DASHBOARD: '/calendar/dashboard',
  DEPARTMENTS: '/departments',
  TEAMS: '/teams',
  AREAS: '/areas',
  USERS: '/users',
  USER_ME: '/users/me',
} as const;

/**
 * Event colors by organization level
 * MUST match legacy calendar.css exactly!
 */
export const ORG_LEVEL_COLORS: Record<OrgLevel, string> = {
  company: '#3498db',
  department: '#e67e22',
  team: '#2ecc71',
  area: '#e53935', // Red
  personal: '#9b59b6',
} as const;

/**
 * Event level info for UI display
 * MUST match legacy calendar.css exactly!
 */
export const EVENT_LEVEL_INFO: Record<OrgLevel, EventLevelInfo> = {
  company: { class: 'event-level-company', text: 'Firma', color: '#3498db' },
  department: {
    class: 'event-level-department',
    text: 'Abteilung',
    color: '#e67e22',
  },
  team: { class: 'event-level-team', text: 'Team', color: '#2ecc71' },
  area: { class: 'event-level-area', text: 'Bereich', color: '#e53935' }, // Red
  personal: {
    class: 'event-level-personal',
    text: 'Persoenlich',
    color: '#9b59b6',
  },
} as const;

/**
 * German locale for EventCalendar
 */
export const DE_LOCALE = {
  code: 'de',
  week: {
    dow: 1, // Monday is first day of week
    doy: 4, // First week contains Jan 4th
  },
  buttonText: {
    today: 'Heute',
    dayGridMonth: 'Monat',
    timeGridWeek: 'Woche',
    timeGridDay: 'Tag',
    listWeek: 'Liste',
  },
  weekText: 'KW',
  allDayText: 'Ganztaegig',
  moreLinkText: (n: number) => `+${n} mehr`,
  noEventsText: 'Keine Ereignisse',
} as const;

/**
 * Filter options for organization level
 * MUST match legacy calendar.html exactly!
 */
export const FILTER_OPTIONS = [
  { value: 'all', label: 'Gesamt', icon: 'fa-globe', title: 'Alle Termine' },
  {
    value: 'company',
    label: 'Firma',
    icon: 'fa-building',
    title: 'Firmentermine',
  },
  {
    value: 'area',
    label: 'Bereich',
    icon: 'fa-map-marked-alt',
    title: 'Bereichstermine',
  },
  {
    value: 'department',
    label: 'Abteilung',
    icon: 'fa-sitemap',
    title: 'Abteilungstermine',
  },
  { value: 'team', label: 'Team', icon: 'fa-users', title: 'Teamtermine' },
  {
    value: 'personal',
    label: 'Meine',
    icon: 'fa-user',
    title: 'Persoenliche Termine',
  },
] as const;

/**
 * Org level options for form
 */
export const ORG_LEVEL_OPTIONS = [
  { value: 'personal', label: 'Persoenlich', icon: 'fa-user' },
  { value: 'company', label: 'Firma', icon: 'fa-building' },
  { value: 'department', label: 'Abteilung', icon: 'fa-sitemap' },
  { value: 'team', label: 'Team', icon: 'fa-users' },
  { value: 'area', label: 'Bereich', icon: 'fa-map-marked-alt' },
] as const;

/**
 * Recurrence dropdown options
 */
export const RECURRENCE_OPTIONS = [
  { value: undefined, label: 'Keine Wiederholung' },
  { value: 'daily', label: 'Täglich' },
  { value: 'weekly', label: 'Wöchentlich' },
  { value: 'monthly', label: 'Monatlich' },
  { value: 'yearly', label: 'Jährlich' },
] as const;

/**
 * Recurrence end dropdown options
 */
export const RECURRENCE_END_OPTIONS = [
  { value: 'never', label: 'Nie' },
  { value: 'after', label: 'Nach Anzahl' },
  { value: 'until', label: 'An Datum' },
] as const;
