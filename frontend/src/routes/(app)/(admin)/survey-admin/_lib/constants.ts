// =============================================================================
// SURVEY-ADMIN - CONSTANTS
// =============================================================================

import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';

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
export type AssignmentBadgeMap = ReturnType<typeof createAssignmentBadgeMap>;

/** Default badge map (used in non-Svelte contexts) */
export const ASSIGNMENT_BADGE_MAP = createAssignmentBadgeMap(DEFAULT_HIERARCHY_LABELS);

/**
 * UI Messages — factory with dynamic hierarchy labels for SurveyFormModal.
 */
export function createSurveyMessages(labels: HierarchyLabels) {
  return {
    AREA_LABEL: labels.area,
    DEPARTMENT_LABEL: labels.department,
    TEAM_LABEL: labels.team,
    AREA_INHERIT_HINT: `Strg/Cmd + Klick für Mehrfachauswahl. ${labels.area} vererben Zugriff auf zugehörige ${labels.department}.`,
    ADDITIONAL_DEPARTMENTS: `Zusätzliche ${labels.department}`,
    DEPT_FILTER_HINT: `Strg/Cmd + Klick für Mehrfachauswahl. Nur ${labels.department} die nicht bereits durch ${labels.area} abgedeckt sind.`,
    TEAM_INHERIT_HINT: `${labels.area}-/${labels.department}-Auswahl blendet zugehörige ${labels.team} aus.`,
    assignmentTypeOptions: [
      { value: 'all_users' as const, label: 'Ganze Firma' },
      { value: 'area' as const, label: labels.area },
      { value: 'department' as const, label: labels.department },
      { value: 'team' as const, label: labels.team },
    ],
  };
}

/** Message type for component props */
export type SurveyMessages = ReturnType<typeof createSurveyMessages>;
