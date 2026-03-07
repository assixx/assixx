// =============================================================================
// SURVEY-ADMIN - API FUNCTIONS
// Based on: frontend/src/scripts/survey/admin/data.ts
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';
import { checkSessionExpired } from '$lib/utils/session-expired.js';

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

const log = createLogger('SurveyAdminApi');

const apiClient = getApiClient();

// =============================================================================
// SURVEYS
// =============================================================================

/**
 * Load all surveys
 */
export async function loadSurveys(): Promise<Survey[]> {
  try {
    return await apiClient.get<Survey[]>(API_ENDPOINTS.SURVEYS);
  } catch (err: unknown) {
    log.error({ err }, 'Error loading surveys');
    checkSessionExpired(err);
    return [];
  }
}

/**
 * Load survey by ID
 */
export async function loadSurveyById(
  surveyId: number | string,
): Promise<Survey | null> {
  try {
    return await apiClient.get<Survey>(API_ENDPOINTS.surveyById(surveyId));
  } catch (err: unknown) {
    log.error({ err, surveyId }, 'Error loading survey');
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
    const response = await apiClient.post<SurveyApiResponse>(
      API_ENDPOINTS.SURVEYS,
      data,
    );
    const surveyId = response.surveyId ?? response.id;
    return { success: true, id: surveyId };
  } catch (err: unknown) {
    log.error({ err }, 'Error creating survey');
    checkSessionExpired(err);
    const message =
      err instanceof Error ? err.message : 'Fehler beim Erstellen der Umfrage';
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
  } catch (err: unknown) {
    log.error({ err, surveyId }, 'Error updating survey');
    checkSessionExpired(err);
    const message =
      err instanceof Error ?
        err.message
      : 'Fehler beim Aktualisieren der Umfrage';
    return { success: false, error: message };
  }
}

/**
 * Complete (end) a survey by setting its status to 'completed'.
 * Uses the existing PUT endpoint with COALESCE -- only status changes.
 */
export async function completeSurvey(
  surveyId: number | string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.put(API_ENDPOINTS.surveyById(surveyId), {
      status: 'completed',
    });
    return { success: true };
  } catch (err: unknown) {
    log.error({ err, surveyId }, 'Error completing survey');
    checkSessionExpired(err);
    const message =
      err instanceof Error ? err.message : 'Fehler beim Beenden der Umfrage';
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
  } catch (err: unknown) {
    log.error({ err, surveyId }, 'Error deleting survey');
    checkSessionExpired(err);
    const message =
      err instanceof Error ? err.message : 'Fehler beim Löschen der Umfrage';
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
  } catch (err: unknown) {
    log.error({ err }, 'Error loading templates');
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
    const survey = await apiClient.post<Survey>(
      API_ENDPOINTS.templateCreate(templateId),
      {},
    );
    return { success: true, survey };
  } catch (err: unknown) {
    log.error({ err, templateId }, 'Error creating from template');
    checkSessionExpired(err);
    const message =
      err instanceof Error ? err.message : 'Fehler beim Erstellen aus Vorlage';
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
    const response = await apiClient.get<
      PaginatedResponse<Department> | Department[]
    >(API_ENDPOINTS.DEPARTMENTS);
    return Array.isArray(response) ? response : response.data;
  } catch (err: unknown) {
    log.error({ err }, 'Error loading departments');
    return [];
  }
}

/**
 * Load teams
 */
export async function loadTeams(): Promise<Team[]> {
  try {
    const response = await apiClient.get<PaginatedResponse<Team> | Team[]>(
      API_ENDPOINTS.TEAMS,
    );
    return Array.isArray(response) ? response : response.data;
  } catch (err: unknown) {
    log.error({ err }, 'Error loading teams');
    return [];
  }
}

/**
 * Load areas
 */
export async function loadAreas(): Promise<Area[]> {
  try {
    const response = await apiClient.get<PaginatedResponse<Area> | Area[]>(
      API_ENDPOINTS.AREAS,
    );
    return Array.isArray(response) ? response : response.data;
  } catch (err: unknown) {
    log.error({ err }, 'Error loading areas');
    return [];
  }
}
