/**
 * Constants for the User Profile page
 */

export const MESSAGES = {
  PAGE_TITLE: 'Benutzerprofil',
  NO_PERMISSION: 'Du hast keine Berechtigung, Benutzerprofile anzusehen.',
  USER_NOT_FOUND: 'Benutzer nicht gefunden.',
  INVALID_URL: 'Ungültiger Profil-Link.',
  SECTION_PERSONAL: 'Persönliche Informationen',
  SECTION_ORG: 'Organisation',
  SECTION_AVAILABILITY: 'Verfügbarkeit',
  LABEL_NAME: 'Name',
  LABEL_EMAIL: 'E-Mail',
  LABEL_POSITION: 'Position',
  LABEL_EMPLOYEE_NR: 'Personalnummer',
  LABEL_PHONE: 'Telefon',
  LABEL_ROLE: 'Rolle',
  LABEL_STATUS: 'Status',
  LABEL_PERIOD: 'Zeitraum',
  LABEL_NOTES: 'Notiz',
} as const;

export const ROLE_LABELS: Record<string, string> = {
  root: 'Root',
  admin: 'Administrator',
  employee: 'Mitarbeiter',
} as const;

/** Regex to extract UUIDv7 from the end of a slug */
export const UUID_REGEX = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
