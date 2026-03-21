// =============================================================================
// SURVEY-EMPLOYEE - CONSTANTS
// =============================================================================

import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';

import type { AssignmentType } from './types';

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  SURVEYS: '/surveys',
  surveyById: (id: number) => `/surveys/${id}`,
  myResponse: (id: number) => `/surveys/${id}/my-response`,
  submitResponse: (id: number) => `/surveys/${id}/responses`,
} as const;

/**
 * Status text mapping
 */
export const STATUS_TEXT_MAP: Record<string, string> = {
  active: 'Aktiv',
  completed: 'Beendet',
  paused: 'Pausiert',
  draft: 'Entwurf',
  archived: 'Archiviert',
};

/**
 * Status badge class mapping
 */
export const STATUS_BADGE_CLASS_MAP: Record<string, string> = {
  active: 'badge--success',
  completed: 'badge--warning',
  paused: 'badge--warning',
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

/** Build assignment badge map with dynamic hierarchy labels */
export function createAssignmentBadgeMap(
  labels: HierarchyLabels,
): Partial<Record<AssignmentType, { badgeClass: string; icon: string; label: string }>> {
  return {
    all_users: {
      badgeClass: 'badge--visibility-company',
      icon: 'fa-globe',
      label: 'Firmenweit',
    },
    area: {
      badgeClass: 'badge--visibility-area',
      icon: 'fa-sitemap',
      label: labels.area,
    },
    department: {
      badgeClass: 'badge--visibility-department',
      icon: 'fa-building',
      label: labels.department,
    },
    team: {
      badgeClass: 'badge--visibility-team',
      icon: 'fa-users',
      label: labels.team,
    },
  };
}

/** Badge map type for parameter passing */
export type EmployeeBadgeMap = ReturnType<typeof createAssignmentBadgeMap>;

/** Default badge map (used in non-Svelte contexts) */
export const ASSIGNMENT_BADGE_MAP = createAssignmentBadgeMap(DEFAULT_HIERARCHY_LABELS);
