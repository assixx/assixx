// =============================================================================
// SURVEY-RESULTS - CONSTANTS
// =============================================================================

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  SURVEY_BY_ID: (id: string) => `/surveys/${id}`,
  SURVEY_QUESTIONS: (id: string) => `/surveys/${id}/questions`,
  SURVEY_STATISTICS: (id: string) => `/surveys/${id}/statistics`,
  SURVEY_RESPONSES: (id: string) => `/surveys/${id}/responses`,
  SURVEY_EXPORT: (id: string, format: string) => `/surveys/${id}/export?format=${format}`,
} as const;

/**
 * Question type labels
 */
export const QUESTION_TYPE_LABELS: Record<string, string> = {
  text: 'Textantwort',
  single_choice: 'Einzelauswahl',
  multiple_choice: 'Mehrfachauswahl',
  rating: 'Bewertung',
  yes_no: 'Ja/Nein',
  number: 'Zahl',
  date: 'Datum',
};

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
