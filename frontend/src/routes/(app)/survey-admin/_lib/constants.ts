// =============================================================================
// SURVEY-ADMIN - CONSTANTS
// =============================================================================

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  SURVEYS: '/surveys',
  SURVEY_BY_ID: (id: string | number) => `/surveys/${id}`,
  TEMPLATES: '/surveys/templates',
  TEMPLATE_CREATE: (id: number) => `/surveys/templates/${id}`,
  DEPARTMENTS: '/departments',
  TEAMS: '/teams',
  AREAS: '/areas',
} as const;

/**
 * Question type options for dropdown
 */
export const QUESTION_TYPE_OPTIONS = [
  { value: 'text', label: 'Textantwort' },
  { value: 'single_choice', label: 'Einzelauswahl' },
  { value: 'multiple_choice', label: 'Mehrfachauswahl' },
  { value: 'rating', label: 'Bewertung (1-5)' },
  { value: 'yes_no', label: 'Ja/Nein' },
  { value: 'number', label: 'Zahl' },
  { value: 'date', label: 'Datum' },
] as const;

/**
 * Assignment type options
 */
export const ASSIGNMENT_TYPE_OPTIONS = [
  { value: 'all_users', label: 'Ganze Firma' },
  { value: 'area', label: 'Bereich' },
  { value: 'department', label: 'Abteilung' },
  { value: 'team', label: 'Team' },
] as const;

/**
 * Status text mapping
 */
export const STATUS_TEXT_MAP: Record<string, string> = {
  draft: 'Entwurf',
  active: 'Aktiv',
  paused: 'Pausiert',
  completed: 'Abgeschlossen',
  archived: 'Archiviert',
  closed: 'Geschlossen',
};

/**
 * Status badge class mapping
 */
export const STATUS_BADGE_CLASS_MAP: Record<string, string> = {
  draft: 'badge--warning',
  active: 'badge--success',
  closed: 'badge--danger',
  archived: 'badge--secondary',
  paused: 'badge--warning',
  completed: 'badge--success',
};
