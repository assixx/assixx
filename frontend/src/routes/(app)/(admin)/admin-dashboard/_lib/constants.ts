/**
 * Admin Dashboard - Constants
 * @module admin-dashboard/_lib/constants
 */

import type { Priority, OrgLevel, BlackboardOrgLevel } from './types';

/** Org level labels (German) */
export const ORG_LEVEL_LABELS: Record<OrgLevel, string> = {
  company: 'Firma',
  department: 'Abteilung',
  team: 'Team',
  area: 'Bereich',
  personal: 'Persönlich',
};

/** Blackboard org level labels (German) */
export const BLACKBOARD_ORG_LABELS: Record<BlackboardOrgLevel, string> = {
  company: 'Firma',
  department: 'Abteilung',
  team: 'Team',
  area: 'Bereich',
};

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

/** UI Messages (German) */
export const MESSAGES = {
  noEmployees: 'Keine neuen Mitarbeiter',
  noDocuments: 'Keine neuen Dokumente',
  noDepartments: 'Keine Abteilungen vorhanden',
  noTeams: 'Keine Teams vorhanden',
  noEvents: 'Keine anstehenden Termine',
  noBlackboard: 'Keine aktuellen Einträge',
  noBlackboardDescription:
    'Es gibt derzeit keine Neuigkeiten am Schwarzen Brett.',
  loadingEntries: 'Lade Einträge...',
  upcomingEvents: 'Nächste Termine',
  allDay: 'Ganztägig',
  unknownEvent: 'Unbenannter Termin',
  unknownAuthor: 'Unbekannt',
} as const;
