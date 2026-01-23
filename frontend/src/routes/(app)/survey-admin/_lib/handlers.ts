/* eslint-disable max-lines */
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

import { showConfirmDanger, showErrorAlert, showSuccessAlert } from '$lib/utils';
import { createLogger } from '$lib/utils/logger';

import { loadSurveys, loadSurveyById, createSurvey, updateSurvey, deleteSurvey } from './api';
import { ASSIGNMENT_TYPE_OPTIONS } from './constants';
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
  formAssignmentType: string;
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
  assignmentDisplayText: string;
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

export function getAssignmentLabel(type: string): string {
  const option = ASSIGNMENT_TYPE_OPTIONS.find((o) => o.value === type);
  return option?.label ?? 'Ganze Firma';
}

export function getOptionsFromQuestion(question: SurveyQuestion): string[] {
  if (question.options === undefined || question.options.length === 0) return [];
  return question.options.map((opt) => {
    if (typeof opt === 'string') return opt;
    return opt.optionText;
  });
}

/**
 * Resolves an entity name by ID with a fallback label.
 */
function resolveEntityName(
  id: number | undefined,
  finder: (id: number) => { name: string } | undefined,
  prefix: string,
  fallback: string,
): string {
  if (id === undefined) return fallback;
  const entity = finder(id);
  return entity !== undefined ? `${prefix}: ${entity.name}` : fallback;
}

/**
 * Extracts the first assignment from a survey, returns null if none exists.
 */
function getFirstAssignment(survey: Survey): SurveyAssignment | null {
  if (survey.assignments === undefined || survey.assignments.length === 0) return null;
  return survey.assignments[0] ?? null;
}

export function getAssignmentInfo(survey: Survey): string {
  const assignment = getFirstAssignment(survey);
  if (assignment === null) return '';

  const type = assignment.assignmentType ?? assignment.type;

  if (type === 'all_users') return 'Alle Mitarbeiter';
  if (type === 'team') {
    return resolveEntityName(
      assignment.teamId,
      (id) => surveyAdminState.getTeamById(id),
      'Team',
      'Team',
    );
  }
  if (type === 'department') {
    return resolveEntityName(
      assignment.departmentId,
      (id) => surveyAdminState.getDepartmentById(id),
      'Abteilung',
      'Abteilung',
    );
  }
  if (type === 'area') {
    return resolveEntityName(
      assignment.areaId,
      (id) => surveyAdminState.getAreaById(id),
      'Bereich',
      'Bereich',
    );
  }
  return '';
}

/**
 * Level 3: Get assignment info using passed data instead of state store
 */
export function getAssignmentInfoWithData(
  survey: Survey,
  departments: { id: number; name: string }[],
  teams: { id: number; name: string }[],
  areas: { id: number; name: string }[],
): string {
  const assignment = getFirstAssignment(survey);
  if (assignment === null) return '';

  const type = assignment.assignmentType ?? assignment.type;

  if (type === 'all_users') return 'Alle Mitarbeiter';
  if (type === 'team') {
    return resolveEntityName(
      assignment.teamId,
      (id) => teams.find((t) => t.id === id),
      'Team',
      'Team',
    );
  }
  if (type === 'department') {
    return resolveEntityName(
      assignment.departmentId,
      (id) => departments.find((d) => d.id === id),
      'Abteilung',
      'Abteilung',
    );
  }
  if (type === 'area') {
    return resolveEntityName(
      assignment.areaId,
      (id) => areas.find((a) => a.id === id),
      'Bereich',
      'Bereich',
    );
  }
  return '';
}

// =============================================================================
// FORM POPULATION HELPERS
// =============================================================================

function populateDates(
  survey: Survey,
): Pick<FormState, 'formStartDate' | 'formStartTime' | 'formEndDate' | 'formEndTime'> {
  const result = {
    formStartDate: '',
    formStartTime: '00:00',
    formEndDate: '',
    formEndTime: '23:59',
  };
  if (survey.startDate !== undefined) {
    const startDate = new Date(survey.startDate);
    result.formStartDate = formatDateForInput(startDate);
    result.formStartTime = formatTimeForInput(startDate);
  }
  if (survey.endDate !== undefined) {
    const endDate = new Date(survey.endDate);
    result.formEndDate = formatDateForInput(endDate);
    result.formEndTime = formatTimeForInput(endDate);
  }
  return result;
}

function extractAssignmentIds(
  assignments: SurveyAssignment[],
  type: string,
): Pick<FormState, 'formSelectedAreas' | 'formSelectedDepartments' | 'formSelectedTeams'> {
  const result = {
    formSelectedAreas: [] as number[],
    formSelectedDepartments: [] as number[],
    formSelectedTeams: [] as number[],
  };
  if (type === 'area') {
    result.formSelectedAreas = assignments
      .map((a) => a.areaId)
      .filter((id): id is number => id !== undefined);
  } else if (type === 'department') {
    result.formSelectedDepartments = assignments
      .map((a) => a.departmentId)
      .filter((id): id is number => id !== undefined);
  } else if (type === 'team') {
    result.formSelectedTeams = assignments
      .map((a) => a.teamId)
      .filter((id): id is number => id !== undefined);
  }
  return result;
}

function populateAssignments(
  survey: Survey,
): Pick<
  FormState,
  | 'formAssignmentType'
  | 'assignmentDisplayText'
  | 'formSelectedAreas'
  | 'formSelectedDepartments'
  | 'formSelectedTeams'
> {
  const defaults = {
    formAssignmentType: 'all_users',
    assignmentDisplayText: 'Ganze Firma',
    formSelectedAreas: [] as number[],
    formSelectedDepartments: [] as number[],
    formSelectedTeams: [] as number[],
  };
  const assignment = getFirstAssignment(survey);
  if (assignment === null) return defaults;

  const type = assignment.assignmentType ?? assignment.type ?? 'all_users';
  return {
    formAssignmentType: type,
    assignmentDisplayText: getAssignmentLabel(type),
    ...extractAssignmentIds(survey.assignments ?? [], type),
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

export function buildAssignments(
  formAssignmentType: string,
  formSelectedAreas: number[],
  formSelectedDepartments: number[],
  formSelectedTeams: number[],
): SurveyAssignment[] | null {
  switch (formAssignmentType) {
    case 'all_users':
      return [{ type: 'all_users' }];
    case 'area':
      if (formSelectedAreas.length === 0) {
        showErrorAlert('Bitte waehlen Sie mindestens einen Bereich aus');
        return null;
      }
      return formSelectedAreas.map((areaId) => ({ type: 'area' as const, areaId }));
    case 'department':
      if (formSelectedDepartments.length === 0) {
        showErrorAlert('Bitte waehlen Sie mindestens eine Abteilung aus');
        return null;
      }
      return formSelectedDepartments.map((departmentId) => ({
        type: 'department' as const,
        departmentId,
      }));
    case 'team':
      if (formSelectedTeams.length === 0) {
        showErrorAlert('Bitte waehlen Sie mindestens ein Team aus');
        return null;
      }
      return formSelectedTeams.map((teamId) => ({ type: 'team' as const, teamId }));
    default:
      showErrorAlert('Bitte waehlen Sie eine Zielgruppe aus');
      return null;
  }
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
    formState.formAssignmentType,
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
