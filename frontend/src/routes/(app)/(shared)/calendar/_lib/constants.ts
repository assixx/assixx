// =============================================================================
// CALENDAR - CONSTANTS
// =============================================================================

import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';

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
 * Factory: Event level info for UI display
 * Dynamic labels for department/team/area, static for company/personal.
 */
export function createEventLevelInfo(labels: HierarchyLabels): Record<OrgLevel, EventLevelInfo> {
  return {
    company: { class: 'event-level-company', text: 'Firma', color: '#3498db' },
    department: {
      class: 'event-level-department',
      text: labels.department,
      color: '#e67e22',
    },
    team: { class: 'event-level-team', text: labels.team, color: '#2ecc71' },
    area: {
      class: 'event-level-area',
      text: labels.area,
      color: '#e53935',
    },
    personal: {
      class: 'event-level-personal',
      text: 'Persönlich',
      color: '#9b59b6',
    },
  };
}

/** Default event level info — backward-compatible static export */
export const EVENT_LEVEL_INFO: Record<OrgLevel, EventLevelInfo> =
  createEventLevelInfo(DEFAULT_HIERARCHY_LABELS);

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

/** Filter option shape for organization level */
interface FilterOption {
  readonly value: string;
  readonly label: string;
  readonly icon: string;
  readonly title: string;
}

/**
 * Factory: Filter options for organization level
 * Dynamic labels for department/team/area, static for company/personal.
 */
export function createFilterOptions(labels: HierarchyLabels): readonly FilterOption[] {
  return [
    { value: 'all', label: 'Gesamt', icon: 'fa-globe', title: 'Alle Termine' },
    {
      value: 'company',
      label: 'Firma',
      icon: 'fa-building',
      title: 'Firmentermine',
    },
    {
      value: 'area',
      label: labels.area,
      icon: 'fa-map-marked-alt',
      title: `${labels.area}-Termine`,
    },
    {
      value: 'department',
      label: labels.department,
      icon: 'fa-sitemap',
      title: `${labels.department}-Termine`,
    },
    {
      value: 'team',
      label: labels.team,
      icon: 'fa-users',
      title: `${labels.team}-Termine`,
    },
    {
      value: 'personal',
      label: 'Meine',
      icon: 'fa-user',
      title: 'Persönliche Termine',
    },
  ];
}

/** Default filter options — backward-compatible static export */
export const FILTER_OPTIONS: readonly FilterOption[] =
  createFilterOptions(DEFAULT_HIERARCHY_LABELS);

/** Org level option shape for form selects */
interface OrgLevelOption {
  readonly value: string;
  readonly label: string;
  readonly icon: string;
}

/**
 * Factory: Org level options for form
 * Dynamic labels for department/team/area, static for personal/company.
 */
export function createOrgLevelOptions(labels: HierarchyLabels): readonly OrgLevelOption[] {
  return [
    { value: 'personal', label: 'Persönlich', icon: 'fa-user' },
    { value: 'company', label: 'Firma', icon: 'fa-building' },
    { value: 'department', label: labels.department, icon: 'fa-sitemap' },
    { value: 'team', label: labels.team, icon: 'fa-users' },
    { value: 'area', label: labels.area, icon: 'fa-map-marked-alt' },
  ];
}

/** Default org level options — backward-compatible static export */
export const ORG_LEVEL_OPTIONS: readonly OrgLevelOption[] =
  createOrgLevelOptions(DEFAULT_HIERARCHY_LABELS);

/**
 * Work order calendar event color — uses design-system token --color-slate (oklch)
 * Einheitlich grau für alle Aufträge, unabhängig vom Status.
 */
export const WORK_ORDER_EVENT_COLOR = 'var(--color-slate)';

/** German status labels for work order tooltips */
export const WORK_ORDER_STATUS_LABELS: Record<string, string> = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  completed: 'Abgeschlossen',
  verified: 'Verifiziert',
};

/** German priority labels for work order tooltips */
export const WORK_ORDER_PRIORITY_LABELS: Record<string, string> = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
};

/**
 * TPM calendar event color — uses design-system token --color-amber (oklch)
 * Amber/orange-gelb für TPM-Wartungstermine, gut unterscheidbar von anderen Event-Typen.
 */
export const TPM_EVENT_COLOR = 'var(--color-amber)';

/** German shift type labels for TPM tooltips */
export const TPM_SHIFT_TYPE_LABELS: Record<string, string> = {
  F: 'Frühschicht',
  S: 'Spätschicht',
  N: 'Nachtschicht',
};

/** German interval type labels for TPM tooltips */
export const TPM_INTERVAL_TYPE_LABELS: Record<string, string> = {
  daily: 'Täglich',
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  quarterly: 'Quartalsweise',
  semi_annual: 'Halbjährlich',
  annual: 'Jährlich',
  long_runner: 'Langläufer',
  custom: 'Individuell',
};

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
