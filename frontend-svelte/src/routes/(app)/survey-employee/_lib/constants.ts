// =============================================================================
// SURVEY-EMPLOYEE - CONSTANTS
// =============================================================================

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  SURVEYS: '/surveys',
  SURVEY_BY_ID: (id: number) => `/surveys/${id}`,
  MY_RESPONSE: (id: number) => `/surveys/${id}/my-response`,
  SUBMIT_RESPONSE: (id: number) => `/surveys/${id}/responses`,
} as const;

/**
 * Status text mapping
 */
export const STATUS_TEXT_MAP: Record<string, string> = {
  active: 'Aktiv',
  closed: 'Geschlossen',
  draft: 'Entwurf',
  archived: 'Archiviert',
};

/**
 * Status badge class mapping
 */
export const STATUS_BADGE_CLASS_MAP: Record<string, string> = {
  active: 'badge--success',
  closed: 'badge--secondary',
  draft: 'badge--warning',
  archived: 'badge--secondary',
};

/**
 * Question type labels (for display)
 */
export const QUESTION_TYPE_LABELS: Record<string, string> = {
  text: 'Textantwort',
  single_choice: 'Einzelauswahl',
  multiple_choice: 'Mehrfachauswahl',
  rating: 'Bewertung (1-5)',
  yes_no: 'Ja/Nein',
  number: 'Zahl',
  date: 'Datum',
};
