/**
 * Survey Administration - Data Layer
 * API calls, data fetching, and state management
 */

import { ApiClient } from '../../../utils/api-client';
import type { Survey, SurveyTemplate, Department, Team, Area, SurveyAssignment } from './types';

// ===== GLOBAL STATE =====
export let currentSurveyId: number | null = null;
export let surveys: Survey[] = [];
export let templates: SurveyTemplate[] = [];
export let departments: Department[] = [];
export let teams: Team[] = [];
export let areas: Area[] = [];

// Functions to modify state (needed for import safety)
export function setCurrentSurveyId(id: number | null): void {
  currentSurveyId = id;
}

export function setSurveys(newSurveys: Survey[]): void {
  surveys = newSurveys;
}

export function setTemplates(newTemplates: SurveyTemplate[]): void {
  templates = newTemplates;
}

export function setDepartments(newDepartments: Department[]): void {
  departments = newDepartments;
}

export function setTeams(newTeams: Team[]): void {
  teams = newTeams;
}

export function setAreas(newAreas: Area[]): void {
  areas = newAreas;
}

// ===== API CLIENT =====
export const apiClient = ApiClient.getInstance();

// ===== API FUNCTIONS =====

/**
 * Load all surveys
 * Note: apiClient returns the unwrapped data array directly
 */
export async function loadSurveys(): Promise<Survey[]> {
  try {
    const surveysData = await apiClient.request<Survey[]>('/surveys', { method: 'GET' }, { version: 'v2' });
    setSurveys(surveysData);
    return surveysData;
  } catch (error) {
    console.error('Error loading surveys:', error);
    setSurveys([]);
    return [];
  }
}

/**
 * Load survey templates
 * Note: apiClient returns the unwrapped data array directly
 */
export async function loadTemplates(): Promise<SurveyTemplate[]> {
  try {
    const templatesData = await apiClient.request<SurveyTemplate[]>(
      '/surveys/templates',
      { method: 'GET' },
      { version: 'v2' },
    );
    setTemplates(templatesData);
    return templatesData;
  } catch (error) {
    console.error('Error loading templates:', error);
    setTemplates([]);
    return [];
  }
}

/**
 * Load user departments
 * Note: apiClient returns the unwrapped data array directly
 */
export async function loadUserDepartments(): Promise<Department[]> {
  try {
    const departmentsData = await apiClient.request<Department[]>('/departments', { method: 'GET' }, { version: 'v2' });
    setDepartments(departmentsData);
    return departmentsData;
  } catch (error) {
    console.error('Error loading departments:', error);
    setDepartments([]);
    return [];
  }
}

/**
 * Load user teams
 * Note: apiClient returns the unwrapped data array directly
 */
export async function loadUserTeams(): Promise<Team[]> {
  try {
    const teamsData = await apiClient.request<Team[]>('/teams', { method: 'GET' }, { version: 'v2' });
    setTeams(teamsData);
    return teamsData;
  } catch (error) {
    console.error('Error loading teams:', error);
    setTeams([]);
    return [];
  }
}

/**
 * Load user areas
 * Note: apiClient returns the unwrapped data array directly
 */
export async function loadUserAreas(): Promise<Area[]> {
  try {
    const areasData = await apiClient.request<Area[]>('/areas', { method: 'GET' }, { version: 'v2' });
    setAreas(areasData);
    return areasData;
  } catch (error) {
    console.error('Error loading areas:', error);
    setAreas([]);
    return [];
  }
}

/**
 * Save survey (create or update)
 * Note: apiClient.request returns the unwrapped data object directly, not the full API response
 */
export async function saveSurvey(surveyData: Survey): Promise<number | null> {
  try {
    const isUpdate = currentSurveyId !== null && currentSurveyId !== 0;
    const endpoint = isUpdate ? `/surveys/${String(currentSurveyId)}` : '/surveys';
    const method = isUpdate ? 'PUT' : 'POST';

    const survey = await apiClient.request<{ surveyId?: number; id?: number }>(
      endpoint,
      {
        method,
        body: JSON.stringify(surveyData),
      },
      { version: 'v2' },
    );

    return survey.surveyId ?? survey.id ?? currentSurveyId ?? null;
  } catch (error) {
    console.error('Error saving survey:', error);
    return null;
  }
}

/**
 * Delete survey
 * Note: apiClient throws on error, so we just need to catch exceptions
 */
export async function deleteSurvey(surveyId: number): Promise<boolean> {
  try {
    await apiClient.request(`/surveys/${String(surveyId)}`, { method: 'DELETE' }, { version: 'v2' });
    return true;
  } catch (error) {
    console.error('Error deleting survey:', error);
    return false;
  }
}

/**
 * Load survey by ID (for editing)
 * Note: apiClient returns the unwrapped data object directly
 */
export async function loadSurveyById(surveyId: number): Promise<Survey | null> {
  try {
    return await apiClient.request<Survey>(`/surveys/${String(surveyId)}`, { method: 'GET' }, { version: 'v2' });
  } catch (error) {
    console.error('Error loading survey:', error);
    return null;
  }
}

/**
 * Load template by ID (for creating from template)
 * Note: Backend has no endpoint for single template, so we find it in the already-loaded templates array
 */
export async function loadTemplateById(templateId: number): Promise<SurveyTemplate | null> {
  try {
    // If templates not loaded yet, load them
    if (templates.length === 0) {
      await loadTemplates();
    }

    // Find template in already-loaded array
    const template = templates.find((t) => t.id === templateId);

    if (template !== undefined) {
      return template;
    }

    console.error('Template not found with ID:', templateId);
    return null;
  } catch (error) {
    console.error('Error finding template:', error);
    return null;
  }
}

/**
 * Update survey assignments (participants)
 * Note: apiClient throws on error, so we just need to catch exceptions
 */
export async function updateSurveyAssignments(surveyId: number, assignments: SurveyAssignment[]): Promise<boolean> {
  try {
    await apiClient.request(
      `/surveys/${String(surveyId)}/assignments`,
      {
        method: 'PUT',
        body: JSON.stringify({ assignments }),
      },
      { version: 'v2' },
    );
    return true;
  } catch (error) {
    console.error('Error updating assignments:', error);
    return false;
  }
}
