/**
 * Constants for the My-Team page
 */

export const MESSAGES = {
  NO_TEAM: 'Keine Zuordnung vorhanden.',
  NO_MEMBERS: 'Keine Mitglieder gefunden.',
  SEARCH_PLACEHOLDER: 'Name, E-Mail oder Position suchen...',
  LOADING_ERROR: 'Mitglieder konnten nicht geladen werden.',
  ROLE_MEMBER: 'Mitglied',
} as const;

export const AVAILABILITY_LABELS: Record<string, { label: string; badgeClass: string }> = {
  available: { label: 'Verfügbar', badgeClass: 'badge--success' },
  unavailable: { label: 'Nicht verfügbar', badgeClass: 'badge--danger' },
  vacation: { label: 'Urlaub', badgeClass: 'badge--warning' },
  sick: { label: 'Krank', badgeClass: 'badge--danger' },
  training: { label: 'Schulung', badgeClass: 'badge--info' },
  other: { label: 'Sonstiges', badgeClass: 'badge--secondary' },
} as const;
