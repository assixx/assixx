/**
 * Employee Dashboard - Constants
 * @module employee-dashboard/_lib/constants
 */

/** List display limits */
export const LIST_LIMITS = {
  recentDocuments: 5,
  upcomingEvents: 3,
  blackboardEntries: 5,
} as const;

/** Calendar fetch range in months */
export const CALENDAR_MONTHS_AHEAD = 3;

/** Floating dots count for hero animation */
export const FLOATING_DOTS_COUNT = 24;

/** Org level display text (German) */
export const ORG_LEVEL_TEXT: Record<string, string> = {
  company: 'Firma',
  department: 'Abteilung',
  team: 'Team',
  area: 'Bereich',
  personal: 'Persönlich',
} as const;

/** Quick access card routes */
export const QUICK_ACCESS_ROUTES = {
  documents: '/documents-explorer',
  calendar: '/calendar',
  kvp: '/kvp',
  profile: '/employee-profile',
} as const;

/** Default placeholder text */
export const PLACEHOLDER_TEXT = {
  notAssigned: 'Nicht zugewiesen',
  noDocuments: 'Keine Dokumente vorhanden',
  noEvents: 'Keine anstehenden Termine',
  loading: 'Lade...',
  loadingEntries: 'Lade Einträge...',
  employee: 'Mitarbeiter',
} as const;

/** UI Messages (German) */
export const MESSAGES = {
  welcomeBack: 'Willkommen zurück!',
  niceToSeeYou: 'Schön, dass Sie da sind,',
  upcomingEvents: 'Nächste Termine',
  noBlackboard: 'Keine Einträge',
  noBlackboardDescription: 'Das Schwarze Brett ist derzeit leer.',
  unknownAuthor: 'Unbekannt',
  allDay: 'Ganztägig',
  unknownEvent: 'Unbenannter Termin',
  documentsCardTitle: 'Meine Dokumente',
  documentsButton: 'Dokumente öffnen',
  calendarCardTitle: 'Kalender',
  calendarButton: 'Kalender öffnen',
  kvpCardTitle: 'Verbesserungsvorschläge',
  kvpButton: 'KVP öffnen',
  kvpDescription: 'Teilen Sie Ihre Ideen zur Verbesserung',
  profileCardTitle: 'Mein Profil',
  profileButton: 'Profil bearbeiten',
  profileDescription: 'Persönliche Einstellungen verwalten',
} as const;

/** Priority labels (German) */
export const PRIORITY_LABELS: Record<string, string> = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
  urgent: 'Dringend',
} as const;

/** Blackboard org level labels (German) */
export const BLACKBOARD_ORG_LABELS: Record<string, string> = {
  company: 'Firma',
  department: 'Abteilung',
  team: 'Team',
  area: 'Bereich',
} as const;
