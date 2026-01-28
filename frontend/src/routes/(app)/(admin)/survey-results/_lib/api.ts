// =============================================================================
// SURVEY-RESULTS - API FUNCTIONS
// Based on: frontend/src/scripts/survey/results/data.ts
// =============================================================================

import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';

import { API_ENDPOINTS } from './constants';

import type {
  Survey,
  SurveyQuestion,
  SurveyStatistics,
  ResponsesData,
} from './types';

const log = createLogger('SurveyResultsApi');

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
  void goto(resolve('/login?session=expired', {}));
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
// SURVEY DATA
// =============================================================================

/**
 * Load survey details from API v2
 */
export async function loadSurveyDetails(
  surveyId: string,
): Promise<Survey | null> {
  try {
    return await apiClient.get<Survey>(API_ENDPOINTS.surveyById(surveyId));
  } catch (err) {
    log.error({ err, surveyId }, 'Error loading survey');
    checkSessionExpired(err);
    return null;
  }
}

/**
 * Load survey questions if not included in survey data
 */
export async function loadSurveyQuestions(
  surveyId: string,
): Promise<SurveyQuestion[]> {
  try {
    return await apiClient.get<SurveyQuestion[]>(
      API_ENDPOINTS.surveyQuestions(surveyId),
    );
  } catch (err) {
    log.error({ err, surveyId }, 'Error loading questions');
    checkSessionExpired(err);
    return [];
  }
}

/**
 * Load survey statistics from API v2
 */
export async function loadSurveyStatistics(
  surveyId: string,
): Promise<SurveyStatistics | null> {
  try {
    return await apiClient.get<SurveyStatistics>(
      API_ENDPOINTS.surveyStatistics(surveyId),
    );
  } catch (err) {
    log.error({ err, surveyId }, 'Error loading statistics');
    checkSessionExpired(err);
    return null;
  }
}

/**
 * Load individual responses (admin only)
 */
export async function loadSurveyResponses(
  surveyId: string,
): Promise<ResponsesData | null> {
  try {
    return await apiClient.get<ResponsesData>(
      API_ENDPOINTS.surveyResponses(surveyId),
    );
  } catch (err) {
    log.warn(
      { err, surveyId },
      'Could not load individual responses (might not have permission)',
    );
    return null;
  }
}

/**
 * Export survey results to Excel (triggers download)
 * NOTE: Uses raw fetch because we need blob response for file download.
 * getApiClient() returns JSON, not blobs.
 */
export async function exportToExcel(surveyId: string): Promise<boolean> {
  if (!browser) return false;

  try {
    const endpoint = API_ENDPOINTS.surveyExport(surveyId, 'excel');
    // Use accessToken (not 'token') for consistency with rest of app
    const token = localStorage.getItem('accessToken') ?? '';

    const response = await fetch(`/api/v2${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Fehler beim Excel-Export');
    }

    // Download the file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `umfrage-${surveyId}-ergebnisse.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    return true;
  } catch (err) {
    log.error({ err, surveyId }, 'Error exporting to Excel');
    return false;
  }
}
