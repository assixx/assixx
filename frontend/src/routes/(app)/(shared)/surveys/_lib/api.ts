// =============================================================================
// SURVEY-EMPLOYEE - API FUNCTIONS
// Based on: frontend/src/scripts/survey/employee/data.ts
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';
import { checkSessionExpired } from '$lib/utils/session-expired.js';

import { API_ENDPOINTS } from './constants';

import type { Survey, ResponseCheck, SurveyResponse, Answer } from './types';

const log = createLogger('SurveyEmployeeApi');

const apiClient = getApiClient();

// =============================================================================
// SURVEYS
// =============================================================================

/**
 * Load all surveys (filters for active and closed only)
 */
export async function loadSurveys(): Promise<Survey[]> {
  try {
    const surveys = await apiClient.get<Survey[]>(API_ENDPOINTS.SURVEYS);

    // Filter only active and completed surveys (not draft, paused, or archived)
    return surveys.filter(
      (s: Survey): boolean => s.status === 'active' || s.status === 'completed',
    );
  } catch (err: unknown) {
    log.error({ err }, 'Error loading surveys');
    checkSessionExpired(err);
    return [];
  }
}

/**
 * Load survey details by ID
 */
export async function loadSurveyById(surveyId: number): Promise<Survey | null> {
  try {
    return await apiClient.get<Survey>(API_ENDPOINTS.surveyById(surveyId));
  } catch (err: unknown) {
    log.error({ err, surveyId }, 'Error loading survey');
    checkSessionExpired(err);
    return null;
  }
}

/**
 * Check if user has already responded to a survey
 * API returns SurveyResponse directly (or null if not responded)
 */
export async function checkUserResponse(surveyId: number): Promise<ResponseCheck> {
  try {
    const result = await apiClient.get<SurveyResponse | null>(API_ENDPOINTS.myResponse(surveyId));

    // API returns SurveyResponse directly, not ResponseCheck wrapper
    // If result has 'id' property, user has responded
    if (result !== null && typeof result === 'object' && 'id' in result) {
      return { responded: true, response: result };
    }

    return { responded: false };
  } catch (err: unknown) {
    log.error({ err, surveyId }, 'Error checking response for survey');
    checkSessionExpired(err);
    return { responded: false };
  }
}

/**
 * Fetch user's response to a survey
 * API returns SurveyResponse directly (or null if not responded)
 */
export async function fetchUserResponse(surveyId: number): Promise<ResponseCheck | null> {
  try {
    const result = await apiClient.get<SurveyResponse | null>(API_ENDPOINTS.myResponse(surveyId));

    // API returns SurveyResponse directly, not ResponseCheck wrapper
    if (result !== null && typeof result === 'object' && 'id' in result) {
      return { responded: true, response: result };
    }

    return { responded: false };
  } catch (err: unknown) {
    log.error({ err }, 'Error fetching user response');
    checkSessionExpired(err);
    return null;
  }
}

/**
 * Submit survey response
 */
export async function submitResponse(
  surveyId: number,
  answers: Answer[],
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.post(API_ENDPOINTS.submitResponse(surveyId), { answers });
    return { success: true };
  } catch (err: unknown) {
    log.error({ err, surveyId }, 'Error submitting survey');
    checkSessionExpired(err);
    const message = err instanceof Error ? err.message : 'Fehler beim Absenden der Antworten';
    return { success: false, error: message };
  }
}
