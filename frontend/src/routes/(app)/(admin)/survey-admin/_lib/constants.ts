// =============================================================================
// SURVEY-ADMIN - CONSTANTS
// =============================================================================

import type { AssignmentType } from './types';

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  SURVEYS: '/surveys',
  surveyById: (id: string | number) => `/surveys/${id}?manage=true`,
  TEMPLATES: '/surveys/templates',
  templateCreate: (id: number) => `/surveys/templates/${id}`,
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
};

/**
 * Status badge class mapping
 */
export const STATUS_BADGE_CLASS_MAP: Record<string, string> = {
  draft: 'badge--warning',
  active: 'badge--success',
  paused: 'badge--warning',
  completed: 'badge--info',
  archived: 'badge--secondary',
};

/**
 * Assignment type → visibility badge (reuses KVP design system classes)
 */
export const ASSIGNMENT_BADGE_MAP: Partial<
  Record<AssignmentType, { badgeClass: string; icon: string; label: string }>
> = {
  all_users: {
    badgeClass: 'badge--visibility-company',
    icon: 'fa-globe',
    label: 'Firmenweit',
  },
  area: {
    badgeClass: 'badge--visibility-area',
    icon: 'fa-sitemap',
    label: 'Bereich',
  },
  department: {
    badgeClass: 'badge--visibility-department',
    icon: 'fa-building',
    label: 'Abteilung',
  },
  team: {
    badgeClass: 'badge--visibility-team',
    icon: 'fa-users',
    label: 'Team',
  },
};
