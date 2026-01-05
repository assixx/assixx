import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { surveyAdminState } from './state.svelte';
import { showConfirmDanger, showErrorAlert, showSuccessAlert } from '$lib/utils';
import { loadSurveys, loadSurveyById, createSurvey, updateSurvey, deleteSurvey } from './api';
import { ASSIGNMENT_TYPE_OPTIONS } from './constants';
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
  QuestionOption,
} from './types';

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
  formQuestions: Array<{
    id: string;
    text: string;
    type: QuestionType;
    isOptional: boolean;
    options: string[];
  }>;
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
    return (opt as QuestionOption).optionText;
  });
}

export function getAssignmentInfo(survey: Survey): string {
  if (survey.assignments === undefined || survey.assignments.length === 0) return '';

  const assignment = survey.assignments[0];
  if (assignment === undefined) return '';

  const type = assignment.assignmentType ?? assignment.type;

  switch (type) {
    case 'all_users':
      return 'Alle Mitarbeiter';
    case 'team':
      if (assignment.teamId !== undefined) {
        const team = surveyAdminState.getTeamById(assignment.teamId);
        return team !== undefined ? `Team: ${team.name}` : 'Team';
      }
      return 'Team';
    case 'department':
      if (assignment.departmentId !== undefined) {
        const dept = surveyAdminState.getDepartmentById(assignment.departmentId);
        return dept !== undefined ? `Abteilung: ${dept.name}` : 'Abteilung';
      }
      return 'Abteilung';
    case 'area':
      if (assignment.areaId !== undefined) {
        const area = surveyAdminState.getAreaById(assignment.areaId);
        return area !== undefined ? `Bereich: ${area.name}` : 'Bereich';
      }
      return 'Bereich';
    default:
      return '';
  }
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
  if (survey.assignments === undefined || survey.assignments.length === 0) return '';

  const assignment = survey.assignments[0];
  if (assignment === undefined) return '';

  const type = assignment.assignmentType ?? assignment.type;

  switch (type) {
    case 'all_users':
      return 'Alle Mitarbeiter';
    case 'team':
      if (assignment.teamId !== undefined) {
        const team = teams.find((t) => t.id === assignment.teamId);
        return team !== undefined ? `Team: ${team.name}` : 'Team';
      }
      return 'Team';
    case 'department':
      if (assignment.departmentId !== undefined) {
        const dept = departments.find((d) => d.id === assignment.departmentId);
        return dept !== undefined ? `Abteilung: ${dept.name}` : 'Abteilung';
      }
      return 'Abteilung';
    case 'area':
      if (assignment.areaId !== undefined) {
        const area = areas.find((a) => a.id === assignment.areaId);
        return area !== undefined ? `Bereich: ${area.name}` : 'Bereich';
      }
      return 'Bereich';
    default:
      return '';
  }
}

// =============================================================================
// FORM POPULATION
// =============================================================================

export function populateFormFromSurvey(survey: Survey): FormState {
  const state: FormState = {
    formTitle: getTextFromBuffer(survey.title),
    formDescription: getTextFromBuffer(survey.description),
    formIsAnonymous: toBool(survey.isAnonymous),
    formIsMandatory: toBool(survey.isMandatory),
    formStartDate: '',
    formStartTime: '00:00',
    formEndDate: '',
    formEndTime: '23:59',
    formAssignmentType: 'all_users',
    formSelectedAreas: [],
    formSelectedDepartments: [],
    formSelectedTeams: [],
    formQuestions: [],
    assignmentDisplayText: 'Ganze Firma',
  };

  if (survey.startDate !== undefined) {
    const startDate = new Date(survey.startDate);
    state.formStartDate = formatDateForInput(startDate);
    state.formStartTime = formatTimeForInput(startDate);
  }
  if (survey.endDate !== undefined) {
    const endDate = new Date(survey.endDate);
    state.formEndDate = formatDateForInput(endDate);
    state.formEndTime = formatTimeForInput(endDate);
  }

  if (survey.assignments !== undefined && survey.assignments.length > 0) {
    const assignment = survey.assignments[0];
    if (assignment !== undefined) {
      const type = assignment.assignmentType ?? assignment.type ?? 'all_users';
      state.formAssignmentType = type;
      state.assignmentDisplayText = getAssignmentLabel(type);

      if (type === 'area') {
        state.formSelectedAreas = survey.assignments
          .filter((a) => a.areaId !== undefined)
          .map((a) => a.areaId as number);
      } else if (type === 'department') {
        state.formSelectedDepartments = survey.assignments
          .filter((a) => a.departmentId !== undefined)
          .map((a) => a.departmentId as number);
      } else if (type === 'team') {
        state.formSelectedTeams = survey.assignments
          .filter((a) => a.teamId !== undefined)
          .map((a) => a.teamId as number);
      }
    }
  }

  if (survey.questions !== undefined && survey.questions.length > 0) {
    state.formQuestions = survey.questions.map((q) => {
      const qId = `question_${surveyAdminState.incrementQuestionCounter()}`;
      return {
        id: qId,
        text: getTextFromBuffer(q.questionText),
        type: q.questionType,
        isOptional: !toBool(q.isRequired),
        options: getOptionsFromQuestion(q),
      };
    });
  }

  return state;
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
    showErrorAlert('Bitte geben Sie einen Titel fuer die Umfrage ein');
    return false;
  }
  if (formQuestions.length === 0) {
    showErrorAlert('Bitte fuegen Sie mindestens eine Frage hinzu');
    return false;
  }

  for (let i = 0; i < formQuestions.length; i++) {
    if (formQuestions[i].text.trim() === '') {
      showErrorAlert(`Frage ${i + 1} hat keinen Text`);
      return false;
    }
    const q = formQuestions[i];
    if (questionTypeNeedsOptions(q.type) && q.options.filter((o) => o.trim() !== '').length < 2) {
      showErrorAlert(`Frage ${i + 1} benoetigt mindestens 2 Antwortoptionen`);
      return false;
    }
  }

  if (status === 'active' && formStartDate !== '' && formEndDate !== '') {
    const startDateTime = new Date(`${formStartDate}T${formStartTime}:00Z`);
    const endDateTime = new Date(`${formEndDate}T${formEndTime}:00Z`);
    if (startDateTime >= endDateTime) {
      showErrorAlert('Das Enddatum muss nach dem Startdatum liegen');
      return false;
    }
    if (endDateTime <= new Date()) {
      showErrorAlert('Das Enddatum muss in der Zukunft liegen');
      return false;
    }
  }

  return true;
}

// =============================================================================
// SAVE SURVEY
// =============================================================================

export async function saveSurvey(
  status: SurveyStatus,
  formState: FormState,
  onSuccess: () => void,
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

  const surveyData: SurveyFormData = {
    title: formState.formTitle.trim(),
    description: formState.formDescription.trim(),
    status,
    isAnonymous: formState.formIsAnonymous,
    isMandatory: formState.formIsMandatory,
    startDate:
      formState.formStartDate !== ''
        ? `${formState.formStartDate}T${formState.formStartTime}:00Z`
        : undefined,
    endDate:
      formState.formEndDate !== ''
        ? `${formState.formEndDate}T${formState.formEndTime}:00Z`
        : undefined,
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

  surveyAdminState.setSaving(true);
  try {
    let result: { success: boolean; error?: string };
    if (surveyAdminState.currentSurveyId !== null) {
      result = await updateSurvey(surveyAdminState.currentSurveyId, surveyData);
    } else {
      result = await createSurvey(surveyData);
    }

    if (result.success) {
      const message =
        status === 'active'
          ? 'Umfrage wurde erfolgreich gestartet'
          : 'Umfrage wurde als Entwurf gespeichert';
      showSuccessAlert(message);
      onSuccess();
      await reloadSurveys();
    } else {
      showErrorAlert(result.error ?? 'Fehler beim Speichern der Umfrage');
    }
  } catch (error) {
    console.error('[Survey Admin] Error saving survey:', error);
    showErrorAlert('Fehler beim Speichern der Umfrage');
  } finally {
    surveyAdminState.setSaving(false);
  }
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

  const surveyData: SurveyFormData = {
    title: formState.formTitle.trim(),
    description: formState.formDescription.trim(),
    status,
    isAnonymous: formState.formIsAnonymous,
    isMandatory: formState.formIsMandatory,
    startDate:
      formState.formStartDate !== ''
        ? `${formState.formStartDate}T${formState.formStartTime}:00Z`
        : undefined,
    endDate:
      formState.formEndDate !== ''
        ? `${formState.formEndDate}T${formState.formEndTime}:00Z`
        : undefined,
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

  surveyAdminState.setSaving(true);
  try {
    let result: { success: boolean; error?: string };
    if (surveyAdminState.currentSurveyId !== null) {
      result = await updateSurvey(surveyAdminState.currentSurveyId, surveyData);
    } else {
      result = await createSurvey(surveyData);
    }

    if (result.success) {
      const message =
        status === 'active'
          ? 'Umfrage wurde erfolgreich gestartet'
          : 'Umfrage wurde als Entwurf gespeichert';
      showSuccessAlert(message);
      onSuccess();
      // Level 3: Trigger SSR refetch
      await invalidateAll();
    } else {
      showErrorAlert(result.error ?? 'Fehler beim Speichern der Umfrage');
    }
  } catch (error) {
    console.error('[Survey Admin] Error saving survey:', error);
    showErrorAlert('Fehler beim Speichern der Umfrage');
  } finally {
    surveyAdminState.setSaving(false);
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
  goto(`${base}/survey-results?surveyId=${surveyId}`);
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
      typeof surveyId === 'number' ? surveyId : parseInt(String(surveyId), 10),
    );
    return formState;
  } catch (error) {
    console.error('[Survey Admin] Error loading survey:', error);
    showErrorAlert('Fehler beim Laden der Umfrage');
    return null;
  } finally {
    surveyAdminState.setLoading(false);
  }
}
