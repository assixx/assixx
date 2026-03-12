/**
 * Admin Dashboard - Constants
 * @module admin-dashboard/_lib/constants
 */

import {
  DEFAULT_HIERARCHY_LABELS,
  type HierarchyLabels,
} from '$lib/types/hierarchy-labels';

import type { Priority, OrgLevel, BlackboardOrgLevel } from './types';

/** Priority labels (German) */
export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Niedrig',
  medium: 'Normal',
  high: 'Hoch',
  urgent: 'Dringend',
};

/** Default dashboard stats */
export const DEFAULT_STATS = {
  employeeCount: 0,
  documentCount: 0,
  departmentCount: 0,
  teamCount: 0,
} as const;

/** Dashboard list limits */
export const LIST_LIMITS = {
  recentEmployees: 3,
  recentDocuments: 5,
  departments: 5,
  teams: 5,
  upcomingEvents: 3,
  blackboardEntries: 5,
} as const;

/** Calendar events date range (months ahead) */
export const CALENDAR_MONTHS_AHEAD = 3;

/** Static messages that don't depend on hierarchy labels */
const STATIC_MESSAGES = {
  noEmployees: 'Keine neuen Mitarbeiter',
  noDocuments: 'Keine neuen Dokumente',
  noEvents: 'Keine anstehenden Termine',
  noBlackboard: 'Keine aktuellen Einträge',
  noBlackboardDescription:
    'Es gibt derzeit keine Neuigkeiten am Schwarzen Brett.',
  loadingEntries: 'Lade Einträge...',
  upcomingEvents: 'Nächste Termine',
  allDay: 'Ganztägig',
  unknownEvent: 'Unbenannter Termin',
  unknownAuthor: 'Unbekannt',
};

/**
 * UI Messages — factory with dynamic hierarchy labels.
 * Entity-specific strings use labels, compound words are neutralized (A4).
 */
export function createMessages(labels: HierarchyLabels) {
  return {
    ...STATIC_MESSAGES,
    noDepartments: `Keine ${labels.department} vorhanden`,
    noTeams: `Keine ${labels.team} vorhanden`,
    STAT_DEPARTMENTS: labels.department,
    STAT_TEAMS: labels.team,
    CARD_DEPARTMENTS: labels.department,
    CARD_TEAMS: labels.team,
    BTN_MANAGE_DEPARTMENTS: `${labels.department} verwalten`,
    BTN_MANAGE_TEAMS: `${labels.team} verwalten`,
    orgLevelLabels: {
      company: 'Firma',
      department: labels.department,
      team: labels.team,
      area: labels.area,
      personal: 'Persönlich',
    } satisfies Record<OrgLevel, string>,
    blackboardOrgLabels: {
      company: 'Firma',
      department: labels.department,
      team: labels.team,
      area: labels.area,
    } satisfies Record<BlackboardOrgLevel, string>,
    EVENT_AREA: labels.area,
    EVENT_DEPARTMENT: labels.department,
    EVENT_TEAM: labels.team,
  };
}

/** Message type for component props */
export type DashboardMessages = ReturnType<typeof createMessages>;

/** Default messages (used in non-Svelte contexts) */
export const MESSAGES = createMessages(DEFAULT_HIERARCHY_LABELS);
