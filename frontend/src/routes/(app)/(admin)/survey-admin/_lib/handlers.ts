/* eslint-disable max-lines */
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

import { notificationStore } from '$lib/stores/notification.store.svelte';
import { showConfirmDanger, showErrorAlert, showSuccessAlert } from '$lib/utils';
import { createLogger } from '$lib/utils/logger';

import {
  loadSurveys,
  loadSurveyById,
  createSurvey,
  updateSurvey,
  deleteSurvey,
  completeSurvey,
} from './api';
import { ASSIGNMENT_BADGE_MAP } from './constants';
import { surveyAdminState } from './state.svelte';
import {
  getTextFromBuffer,
  toBool,
  formatDateForInput,
  formatTimeForInput,
  questionTypeNeedsOptions,
} from './utils';

import type {
  Survey,
  SurveyQuestion,
  SurveyAssignment,
  SurveyFormData,
  SurveyStatus,
  QuestionType,
} from './types';

const log = createLogger('SurveyAdminHandlers');

// =============================================================================
// TYPES
// =============================================================================

export interface FormState {
  formTitle: string;
  formDescription: string;
  formIsAnonymous: boolean;
  formIsMandatory: boolean;
  formStartDate: string;
  formStartTime: string;
  formEndDate: string;
  formEndTime: string;
  formCompanyWide: boolean;
  formSelectedAreas: number[];
  formSelectedDepartments: number[];
  formSelectedTeams: number[];
  formQuestions: {
    id: string;
    text: string;
    type: QuestionType;
    isOptional: boolean;
    options: string[];
  }[];
}

// =============================================================================
// DATA LOADING
// =============================================================================

export async function reloadSurveys(): Promise<void> {
  const surveys = await loadSurveys();
  surveyAdminState.setSurveys(surveys);
}

// =============================================================================
// HELPERS
// =============================================================================

export function getSurveyId(survey: Survey): string {
  return survey.uuid ?? survey.id?.toString() ?? '';
}

export function getOptionsFromQuestion(question: SurveyQuestion): string[] {
  if (question.options === undefined || question.options.length === 0) return [];
  return question.options.map((opt) => {
    if (typeof opt === 'string') return opt;
    return opt.optionText;
  });
}

/**
 * Structured assignment badge info (mirrors KVP visibility badges)
 */
export interface AssignmentBadgeInfo {
  badgeClass: string;
  icon: string;
  text: string;
}

/**
 * Resolves an entity name by ID, returns just the name or a fallback label.
 */
function resolveEntityText(
  id: number | undefined,
  finder: (id: number) => { name: string } | undefined,
  fallback: string,
): string {
  if (id === undefined) return fallback;
  const entity = finder(id);
  return entity !== undefined ? entity.name : fallback;
}

/**
 * Build a single badge from one assignment + lookup arrays.
 */
function buildBadgeFromAssignment(
  assignment: SurveyAssignment,
  departments: { id: number; name: string }[],
  teams: { id: number; name: string }[],
  areas: { id: number; name: string }[],
): AssignmentBadgeInfo | null {
  const type = assignment.assignmentType ?? assignment.type;
  if (type === undefined) return null;

  const badge = ASSIGNMENT_BADGE_MAP[type];
  if (badge === undefined) return null;

  // Prefer inline name from backend, fall back to lookup arrays
  let text = badge.label;

  if (type === 'team') {
    text =
      assignment.teamName ??
      resolveEntityText(assignment.teamId, (id) => teams.find((t) => t.id === id), badge.label);
  } else if (type === 'department') {
    text =
      assignment.departmentName ??
      resolveEntityText(
        assignment.departmentId,
        (id) => departments.find((d) => d.id === id),
        badge.label,
      );
  } else if (type === 'area') {
    text =
      assignment.areaName ??
      resolveEntityText(assignment.areaId, (id) => areas.find((a) => a.id === id), badge.label);
  }

  return { badgeClass: badge.badgeClass, icon: badge.icon, text };
}

/**
 * Get assignment badges for a survey (Level 3 SSR).
 * Returns ALL assignment badges (surveys can target multiple groups).
 */
export function getAssignmentBadges(
  survey: Survey,
  departments: { id: number; name: string }[],
  teams: { id: number; name: string }[],
  areas: { id: number; name: string }[],
): AssignmentBadgeInfo[] {
  if (survey.assignments === undefined || survey.assignments.length === 0) return [];

  const badges: AssignmentBadgeInfo[] = [];
  for (const assignment of survey.assignments) {
    const badge = buildBadgeFromAssignment(assignment, departments, teams, areas);
    if (badge !== null) {
      badges.push(badge);
    }
  }
  return badges;
}

// =============================================================================
// FORM POPULATION HELPERS
// =============================================================================

/** Check if a date value from the API is usable (not null, undefined, or empty) */
function isValidDateValue(value: string | Date | null | undefined): value is string | Date {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value === '') return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function populateDates(
  survey: Survey,
): Pick<FormState, 'formStartDate' | 'formStartTime' | 'formEndDate' | 'formEndTime'> {
  const result = {
    formStartDate: '',
    formStartTime: '00:00',
    formEndDate: '',
    formEndTime: '23:59',
  };
  if (isValidDateValue(survey.startDate)) {
    const startDate = new Date(survey.startDate);
    result.formStartDate = formatDateForInput(startDate);
    result.formStartTime = formatTimeForInput(startDate);
  }
  if (isValidDateValue(survey.endDate)) {
    const endDate = new Date(survey.endDate);
    result.formEndDate = formatDateForInput(endDate);
    result.formEndTime = formatTimeForInput(endDate);
  }
  return result;
}

/**
 * Extract area/department/team IDs from all assignments simultaneously.
 * Reads the type from each individual assignment record (supports mixed types).
 */
function extractAssignmentIds(
  assignments: SurveyAssignment[],
): Pick<FormState, 'formSelectedAreas' | 'formSelectedDepartments' | 'formSelectedTeams'> {
  const formSelectedAreas: number[] = [];
  const formSelectedDepartments: number[] = [];
  const formSelectedTeams: number[] = [];

  for (const assignment of assignments) {
    const type = assignment.assignmentType ?? assignment.type;
    if (type === 'area' && assignment.areaId !== undefined) {
      formSelectedAreas.push(assignment.areaId);
    } else if (type === 'department' && assignment.departmentId !== undefined) {
      formSelectedDepartments.push(assignment.departmentId);
    } else if (type === 'team' && assignment.teamId !== undefined) {
      formSelectedTeams.push(assignment.teamId);
    }
  }

  return { formSelectedAreas, formSelectedDepartments, formSelectedTeams };
}

function populateAssignments(
  survey: Survey,
): Pick<
  FormState,
  'formCompanyWide' | 'formSelectedAreas' | 'formSelectedDepartments' | 'formSelectedTeams'
> {
  const defaults = {
    formCompanyWide: false,
    formSelectedAreas: [] as number[],
    formSelectedDepartments: [] as number[],
    formSelectedTeams: [] as number[],
  };

  const assignments = survey.assignments;
  if (assignments === undefined || assignments.length === 0) return defaults;

  // Check if any assignment is company-wide
  const hasCompanyWide = assignments.some((a) => {
    const type = a.assignmentType ?? a.type;
    return type === 'all_users';
  });

  if (hasCompanyWide) return { ...defaults, formCompanyWide: true };

  return {
    formCompanyWide: false,
    ...extractAssignmentIds(assignments),
  };
}

function populateQuestions(survey: Survey): FormState['formQuestions'] {
  if (survey.questions === undefined || survey.questions.length === 0) return [];
  return survey.questions.map((q) => ({
    id: `question_${surveyAdminState.incrementQuestionCounter()}`,
    text: getTextFromBuffer(q.questionText),
    type: q.questionType,
    isOptional: !toBool(q.isRequired),
    options: getOptionsFromQuestion(q),
  }));
}

// =============================================================================
// FORM POPULATION
// =============================================================================

export function populateFormFromSurvey(survey: Survey): FormState {
  return {
    formTitle: getTextFromBuffer(survey.title),
    formDescription: getTextFromBuffer(survey.description),
    formIsAnonymous: toBool(survey.isAnonymous),
    formIsMandatory: toBool(survey.isMandatory),
    ...populateDates(survey),
    ...populateAssignments(survey),
    formQuestions: populateQuestions(survey),
  };
}

// =============================================================================
// ASSIGNMENT BUILDER
// =============================================================================

/**
 * Build assignments from combined selections.
 * Supports mixed types: areas + departments + teams simultaneously.
 */
export function buildAssignments(
  formCompanyWide: boolean,
  formSelectedAreas: number[],
  formSelectedDepartments: number[],
  formSelectedTeams: number[],
): SurveyAssignment[] | null {
  if (formCompanyWide) {
    return [{ type: 'all_users' }];
  }

  const assignments: SurveyAssignment[] = [
    ...formSelectedAreas.map((areaId) => ({ type: 'area' as const, areaId })),
    ...formSelectedDepartments.map((departmentId) => ({
      type: 'department' as const,
      departmentId,
    })),
    ...formSelectedTeams.map((teamId) => ({ type: 'team' as const, teamId })),
  ];

  if (assignments.length === 0) {
    showErrorAlert('Bitte waehlen Sie mindestens eine Zielgruppe aus');
    return null;
  }

  return assignments;
}

// =============================================================================
// FORM VALIDATION HELPERS
// =============================================================================

function validateQuestions(formQuestions: FormState['formQuestions']): string | null {
  for (const [index, question] of formQuestions.entries()) {
    if (question.text.trim() === '') {
      return `Frage ${index + 1} hat keinen Text`;
    }
    const needsOptions = questionTypeNeedsOptions(question.type);
    const validOptions = question.options.filter((o) => o.trim() !== '').length;
    if (needsOptions && validOptions < 2) {
      return `Frage ${index + 1} benoetigt mindestens 2 Antwortoptionen`;
    }
  }
  return null;
}

function validateDateRange(
  formStartDate: string,
  formStartTime: string,
  formEndDate: string,
  formEndTime: string,
): string | null {
  if (formStartDate === '' || formEndDate === '') return null;

  const startDateTime = new Date(`${formStartDate}T${formStartTime}:00Z`);
  const endDateTime = new Date(`${formEndDate}T${formEndTime}:00Z`);

  if (startDateTime >= endDateTime) return 'Das Enddatum muss nach dem Startdatum liegen';
  if (endDateTime <= new Date()) return 'Das Enddatum muss in der Zukunft liegen';
  return null;
}

// =============================================================================
// FORM VALIDATION
// =============================================================================

export function validateSurveyForm(
  formTitle: string,
  formQuestions: FormState['formQuestions'],
  status: SurveyStatus,
  formStartDate: string,
  formStartTime: string,
  formEndDate: string,
  formEndTime: string,
): boolean {
  if (formTitle.trim() === '') {
    showErrorAlert('Bitte geben Sie einen Titel für die Umfrage ein');
    return false;
  }
  if (formQuestions.length === 0) {
    showErrorAlert('Bitte fuegen Sie mindestens eine Frage hinzu');
    return false;
  }

  const questionError = validateQuestions(formQuestions);
  if (questionError !== null) {
    showErrorAlert(questionError);
    return false;
  }

  if (status === 'active') {
    const dateError = validateDateRange(formStartDate, formStartTime, formEndDate, formEndTime);
    if (dateError !== null) {
      showErrorAlert(dateError);
      return false;
    }
  }

  return true;
}

// =============================================================================
// SAVE SURVEY HELPERS
// =============================================================================

function formatDateTime(date: string, time: string): string | undefined {
  return date !== '' ? `${date}T${time}:00Z` : undefined;
}

function buildSurveyData(
  status: SurveyStatus,
  formState: FormState,
  assignments: SurveyAssignment[],
): SurveyFormData {
  return {
    title: formState.formTitle.trim(),
    description: formState.formDescription.trim(),
    status,
    isAnonymous: formState.formIsAnonymous,
    isMandatory: formState.formIsMandatory,
    startDate: formatDateTime(formState.formStartDate, formState.formStartTime),
    endDate: formatDateTime(formState.formEndDate, formState.formEndTime),
    questions: formState.formQuestions.map((q, index) => ({
      questionText: q.text,
      questionType: q.type,
      isRequired: q.isOptional ? 0 : 1,
      orderIndex: index + 1,
      options: questionTypeNeedsOptions(q.type)
        ? q.options.filter((o) => o.trim() !== '')
        : undefined,
    })),
    assignments,
  };
}

function getSaveSuccessMessage(status: SurveyStatus): string {
  return status === 'active'
    ? 'Umfrage wurde erfolgreich gestartet'
    : 'Umfrage wurde als Entwurf gespeichert';
}

async function executeSurveyApiCall(
  surveyData: SurveyFormData,
): Promise<{ success: boolean; error?: string }> {
  if (surveyAdminState.currentSurveyId !== null) {
    return await updateSurvey(surveyAdminState.currentSurveyId, surveyData);
  }
  return await createSurvey(surveyData);
}

// =============================================================================
// SAVE SURVEY
// =============================================================================

async function saveSurveyCore(
  status: SurveyStatus,
  formState: FormState,
  onSuccess: () => void,
  postSaveAction: () => Promise<void>,
): Promise<void> {
  const isValid = validateSurveyForm(
    formState.formTitle,
    formState.formQuestions,
    status,
    formState.formStartDate,
    formState.formStartTime,
    formState.formEndDate,
    formState.formEndTime,
  );
  if (!isValid) return;

  const assignments = buildAssignments(
    formState.formCompanyWide,
    formState.formSelectedAreas,
    formState.formSelectedDepartments,
    formState.formSelectedTeams,
  );
  if (assignments === null) return;

  const surveyData = buildSurveyData(status, formState, assignments);

  surveyAdminState.setSaving(true);
  try {
    const result = await executeSurveyApiCall(surveyData);
    if (result.success) {
      showSuccessAlert(getSaveSuccessMessage(status));
      onSuccess();

      // Refresh notification badge counts (survey pending count changed)
      if (status === 'active') {
        void notificationStore.loadInitialCounts();
      }

      await postSaveAction();
    } else {
      showErrorAlert(result.error ?? 'Fehler beim Speichern der Umfrage');
    }
  } catch (err) {
    log.error({ err }, 'Error saving survey');
    showErrorAlert('Fehler beim Speichern der Umfrage');
  } finally {
    surveyAdminState.setSaving(false);
  }
}

export async function saveSurvey(
  status: SurveyStatus,
  formState: FormState,
  onSuccess: () => void,
): Promise<void> {
  await saveSurveyCore(status, formState, onSuccess, reloadSurveys);
}

/**
 * Level 3: Save survey and trigger invalidateAll for SSR refresh
 */
export async function saveSurveyWithInvalidate(
  status: SurveyStatus,
  formState: FormState,
  onSuccess: () => void,
  invalidateAll: () => Promise<void>,
): Promise<void> {
  await saveSurveyCore(status, formState, onSuccess, invalidateAll);
}

// =============================================================================
// COMPLETE SURVEY (manually end an open-ended survey)
// =============================================================================

export async function handleCompleteSurveyWithInvalidate(
  surveyId: number | string,
  invalidateAll: () => Promise<void>,
): Promise<void> {
  const confirmed = await showConfirmDanger(
    'Die Umfrage wird fuer alle Mitarbeiter beendet. Neue Antworten sind danach nicht mehr moeglich.',
    'Umfrage beenden?',
  );
  if (!confirmed) return;

  const result = await completeSurvey(surveyId);
  if (result.success) {
    showSuccessAlert('Umfrage erfolgreich beendet');
    // Refresh notification badge counts (survey no longer active → pending count changed)
    void notificationStore.loadInitialCounts();
    await invalidateAll();
  } else {
    showErrorAlert(result.error ?? 'Fehler beim Beenden der Umfrage');
  }
}

// =============================================================================
// DELETE SURVEY
// =============================================================================

export async function handleDeleteSurvey(surveyId: number | string): Promise<void> {
  const confirmed = await showConfirmDanger(
    'Diese Aktion kann nicht rückgängig gemacht werden. Alle Antworten werden ebenfalls gelöscht.',
    'Umfrage löschen?',
  );
  if (!confirmed) return;

  const result = await deleteSurvey(surveyId);
  if (result.success) {
    showSuccessAlert('Umfrage erfolgreich geloescht');
    await reloadSurveys();
  } else {
    showErrorAlert(result.error ?? 'Fehler beim Löschen der Umfrage');
  }
}

/**
 * Level 3: Delete survey and trigger invalidateAll for SSR refresh
 */
export async function handleDeleteSurveyWithInvalidate(
  surveyId: number | string,
  invalidateAll: () => Promise<void>,
): Promise<void> {
  const confirmed = await showConfirmDanger(
    'Diese Aktion kann nicht rückgängig gemacht werden. Alle Antworten werden ebenfalls gelöscht.',
    'Umfrage löschen?',
  );
  if (!confirmed) return;

  const result = await deleteSurvey(surveyId);
  if (result.success) {
    showSuccessAlert('Umfrage erfolgreich geloescht');
    // Level 3: Trigger SSR refetch
    await invalidateAll();
  } else {
    showErrorAlert(result.error ?? 'Fehler beim Löschen der Umfrage');
  }
}

// =============================================================================
// NAVIGATION
// =============================================================================

export function handleViewResults(surveyId: string): void {
  void goto(`${resolve('/survey-results', {})}?surveyId=${surveyId}`);
}

// =============================================================================
// EDIT SURVEY
// =============================================================================

export async function loadSurveyForEdit(surveyId: number | string): Promise<FormState | null> {
  surveyAdminState.setLoading(true);
  try {
    const survey = await loadSurveyById(surveyId);
    if (survey === null) {
      showErrorAlert('Umfrage konnte nicht geladen werden');
      return null;
    }
    const formState = populateFormFromSurvey(survey);
    surveyAdminState.openModal(
      typeof surveyId === 'number' ? surveyId : Number.parseInt(surveyId, 10),
    );
    return formState;
  } catch (err) {
    log.error({ err, surveyId }, 'Error loading survey');
    showErrorAlert('Fehler beim Laden der Umfrage');
    return null;
  } finally {
    surveyAdminState.setLoading(false);
  }
}
