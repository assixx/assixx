// =============================================================================
// SURVEY-ADMIN - API FUNCTIONS
// Based on: frontend/src/scripts/survey/admin/data.ts
// =============================================================================

import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

import { getApiClient } from '$lib/utils/api-client';

import { API_ENDPOINTS } from './constants';

import type {
  Survey,
  SurveyTemplate,
  Department,
  Team,
  Area,
  SurveyFormData,
  SurveyApiResponse,
  PaginatedResponse,
} from './types';

const apiClient = getApiClient();

// =============================================================================
// SESSION HANDLING
// =============================================================================

/**
 * Check if error is a session expired error
 */
function isSessionExpiredError(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === 'SESSION_EXPIRED'
  );
}

/**
 * Handle session expired error
 */
export function handleSessionExpired(): void {
  void goto(`${resolve('/login', {})}?session=expired`);
}

/**
 * Check for session expired and redirect
 */
export function checkSessionExpired(err: unknown): boolean {
  if (isSessionExpiredError(err)) {
    handleSessionExpired();
    return true;
  }
  return false;
}

// =============================================================================
// SURVEYS
// =============================================================================

/**
 * Load all surveys
 */
export async function loadSurveys(): Promise<Survey[]> {
  try {
    return await apiClient.get<Survey[]>(API_ENDPOINTS.SURVEYS);
  } catch (err) {
    console.error('[Survey API] Error loading surveys:', err);
    checkSessionExpired(err);
    return [];
  }
}

/**
 * Load survey by ID
 */
export async function loadSurveyById(surveyId: number | string): Promise<Survey | null> {
  try {
    return await apiClient.get<Survey>(API_ENDPOINTS.surveyById(surveyId));
  } catch (err) {
    console.error('[Survey API] Error loading survey:', err);
    checkSessionExpired(err);
    return null;
  }
}

/**
 * Create survey
 */
export async function createSurvey(
  data: SurveyFormData,
): Promise<{ success: boolean; id?: number; error?: string }> {
  try {
    const response = await apiClient.post<SurveyApiResponse>(API_ENDPOINTS.SURVEYS, data);
    const surveyId = response.surveyId ?? response.id;
    return { success: true, id: surveyId };
  } catch (err) {
    console.error('[Survey API] Error creating survey:', err);
    checkSessionExpired(err);
    const message = err instanceof Error ? err.message : 'Fehler beim Erstellen der Umfrage';
    return { success: false, error: message };
  }
}

/**
 * Update survey
 */
export async function updateSurvey(
  surveyId: number | string,
  data: SurveyFormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.put(API_ENDPOINTS.surveyById(surveyId), data);
    return { success: true };
  } catch (err) {
    console.error('[Survey API] Error updating survey:', err);
    checkSessionExpired(err);
    const message = err instanceof Error ? err.message : 'Fehler beim Aktualisieren der Umfrage';
    return { success: false, error: message };
  }
}

/**
 * Delete survey
 */
export async function deleteSurvey(
  surveyId: number | string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.delete(API_ENDPOINTS.surveyById(surveyId));
    return { success: true };
  } catch (err) {
    console.error('[Survey API] Error deleting survey:', err);
    checkSessionExpired(err);
    const message = err instanceof Error ? err.message : 'Fehler beim Löschen der Umfrage';
    return { success: false, error: message };
  }
}

// =============================================================================
// TEMPLATES
// =============================================================================

/**
 * Load survey templates
 */
export async function loadTemplates(): Promise<SurveyTemplate[]> {
  try {
    return await apiClient.get<SurveyTemplate[]>(API_ENDPOINTS.TEMPLATES);
  } catch (err) {
    console.error('[Survey API] Error loading templates:', err);
    return [];
  }
}

/**
 * Create survey from template
 */
export async function createFromTemplate(
  templateId: number,
): Promise<{ success: boolean; survey?: Survey; error?: string }> {
  try {
    const survey = await apiClient.post<Survey>(API_ENDPOINTS.templateCreate(templateId), {});
    return { success: true, survey };
  } catch (err) {
    console.error('[Survey API] Error creating from template:', err);
    checkSessionExpired(err);
    const message = err instanceof Error ? err.message : 'Fehler beim Erstellen aus Vorlage';
    return { success: false, error: message };
  }
}

// =============================================================================
// ORGANIZATION DATA
// =============================================================================

/**
 * Load departments
 */
export async function loadDepartments(): Promise<Department[]> {
  try {
    const response = await apiClient.get<PaginatedResponse<Department> | Department[]>(
      API_ENDPOINTS.DEPARTMENTS,
    );
    return Array.isArray(response) ? response : response.data;
  } catch (err) {
    console.error('[Survey API] Error loading departments:', err);
    return [];
  }
}

/**
 * Load teams
 */
export async function loadTeams(): Promise<Team[]> {
  try {
    const response = await apiClient.get<PaginatedResponse<Team> | Team[]>(API_ENDPOINTS.TEAMS);
    return Array.isArray(response) ? response : response.data;
  } catch (err) {
    console.error('[Survey API] Error loading teams:', err);
    return [];
  }
}

/**
 * Load areas
 */
export async function loadAreas(): Promise<Area[]> {
  try {
    const response = await apiClient.get<PaginatedResponse<Area> | Area[]>(API_ENDPOINTS.AREAS);
    return Array.isArray(response) ? response : response.data;
  } catch (err) {
    console.error('[Survey API] Error loading areas:', err);
    return [];
  }
}
