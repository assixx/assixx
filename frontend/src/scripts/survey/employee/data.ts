/**
 * Survey Employee - Data Layer
 * Handles all API calls for employee surveys
 */

import type { Survey, ResponseCheck, SurveyResponse } from './types';

/**
 * API v2 Response wrapper
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Load all relevant surveys for the employee
 * Filters for active and closed surveys only
 */
export async function loadSurveys(): Promise<Survey[]> {
  try {
    const endpoint = '/api/v2/surveys';

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
      },
    });

    if (response.ok) {
      const result = (await response.json()) as ApiResponse<Survey[]>;
      const surveys = result.data;

      // Filter only active and closed surveys (not draft or archived)
      return surveys.filter((s: Survey) => s.status === 'active' || s.status === 'closed');
    }

    return [];
  } catch (error) {
    console.error('[SurveyEmployee] Error loading surveys:', error);
    return [];
  }
}

/**
 * Check if user has already responded to a survey
 * API returns SurveyResponse directly (or null if not responded)
 */
export async function checkUserResponse(surveyId: number): Promise<ResponseCheck> {
  try {
    const endpoint = `/api/v2/surveys/${surveyId}/my-response`;

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
      },
    });

    if (response.ok) {
      const result = (await response.json()) as ApiResponse<SurveyResponse | null>;
      console.info(`[SurveyEmployee] Response check for survey ${surveyId}:`, result.data);

      // API returns SurveyResponse directly, not ResponseCheck wrapper
      // If result.data has 'id' property, user has responded
      if (result.data !== null && typeof result.data === 'object' && 'id' in result.data) {
        return { responded: true, response: result.data };
      }

      return { responded: false };
    } else {
      console.error(`[SurveyEmployee] Failed to check response for survey ${surveyId}:`, response.status);
    }
  } catch (error) {
    console.error('[SurveyEmployee] Error checking response:', error);
  }

  return { responded: false };
}

/**
 * Fetch survey details by ID
 */
export async function fetchSurveyDetails(surveyId: number): Promise<Survey> {
  const endpoint = `/api/v2/surveys/${surveyId}`;

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch survey details');
  }

  const result = (await response.json()) as ApiResponse<Survey>;
  return result.data;
}

/**
 * Fetch user's response to a survey
 * API returns SurveyResponse directly (or null if not responded)
 */
export async function fetchUserResponse(surveyId: number): Promise<ResponseCheck | null> {
  const endpoint = `/api/v2/surveys/${surveyId}/my-response`;

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const result = (await response.json()) as ApiResponse<SurveyResponse | null>;

  // API returns SurveyResponse directly, not ResponseCheck wrapper
  if (result.data !== null && typeof result.data === 'object' && 'id' in result.data) {
    return { responded: true, response: result.data };
  }

  return { responded: false };
}

/**
 * Submit survey response
 */
export async function submitResponse(surveyId: number, answers: unknown[]): Promise<boolean> {
  try {
    const endpoint = `/api/v2/surveys/${surveyId}/responses`;

    console.info('[SurveyEmployee] Submitting survey answers:', {
      surveyId,
      answersCount: answers.length,
      answers,
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ answers }),
    });

    return response.ok;
  } catch (error) {
    console.error('[SurveyEmployee] Error submitting survey:', error);
    return false;
  }
}
