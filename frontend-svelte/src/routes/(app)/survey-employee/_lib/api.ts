// =============================================================================
// SURVEY-EMPLOYEE - API FUNCTIONS
// Based on: frontend/src/scripts/survey/employee/data.ts
// =============================================================================

import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { getApiClient } from '$lib/utils/api-client';
import { API_ENDPOINTS } from './constants';
import type { Survey, ResponseCheck, SurveyResponse, Answer } from './types';

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
  goto(`${base}/login?session=expired`);
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
 * Load all surveys (filters for active and closed only)
 */
export async function loadSurveys(): Promise<Survey[]> {
  try {
    const surveys = await apiClient.get<Survey[]>(API_ENDPOINTS.SURVEYS);
    console.info('[Survey Employee] Surveys loaded:', surveys.length);

    // Filter only active and closed surveys (not draft or archived)
    return surveys.filter((s) => s.status === 'active' || s.status === 'closed');
  } catch (err) {
    console.error('[Survey Employee] Error loading surveys:', err);
    checkSessionExpired(err);
    return [];
  }
}

/**
 * Load survey details by ID
 */
export async function loadSurveyById(surveyId: number): Promise<Survey | null> {
  try {
    const survey = await apiClient.get<Survey>(API_ENDPOINTS.SURVEY_BY_ID(surveyId));
    console.info('[Survey Employee] Survey loaded:', surveyId);
    return survey;
  } catch (err) {
    console.error('[Survey Employee] Error loading survey:', err);
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
    const result = await apiClient.get<SurveyResponse | null>(API_ENDPOINTS.MY_RESPONSE(surveyId));
    console.info(`[Survey Employee] Response check for survey ${surveyId}:`, result);

    // API returns SurveyResponse directly, not ResponseCheck wrapper
    // If result has 'id' property, user has responded
    if (result !== null && typeof result === 'object' && 'id' in result) {
      return { responded: true, response: result };
    }

    return { responded: false };
  } catch (err) {
    console.error(`[Survey Employee] Error checking response for survey ${surveyId}:`, err);
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
    const result = await apiClient.get<SurveyResponse | null>(API_ENDPOINTS.MY_RESPONSE(surveyId));

    // API returns SurveyResponse directly, not ResponseCheck wrapper
    if (result !== null && typeof result === 'object' && 'id' in result) {
      return { responded: true, response: result };
    }

    return { responded: false };
  } catch (err) {
    console.error('[Survey Employee] Error fetching user response:', err);
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
    console.info('[Survey Employee] Submitting survey answers:', {
      surveyId,
      answersCount: answers.length,
      answers,
    });

    await apiClient.post(API_ENDPOINTS.SUBMIT_RESPONSE(surveyId), { answers });
    console.info('[Survey Employee] Response submitted successfully');
    return { success: true };
  } catch (err) {
    console.error('[Survey Employee] Error submitting survey:', err);
    checkSessionExpired(err);
    const message = err instanceof Error ? err.message : 'Fehler beim Absenden der Antworten';
    return { success: false, error: message };
  }
}
