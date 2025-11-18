/**
 * Survey Results Data Layer
 * Handles all API communication for survey results
 */

import type { Survey, SurveyQuestion, SurveyStatistics, ResponsesData } from './types';

/**
 * API v2 Response wrapper
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Loads survey details from API v2
 * @param surveyId - The survey ID to load
 * @returns Promise with survey data
 * @throws Error if survey cannot be loaded
 */
export async function loadSurveyDetails(surveyId: string): Promise<Survey> {
  try {
    const endpoint = `/api/v2/surveys/${surveyId}`;

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
      },
    });

    if (!response.ok) {
      throw new Error('Fehler beim Laden der Umfrage');
    }

    const result = (await response.json()) as ApiResponse<Survey>;
    return result.data;
  } catch (error) {
    console.error('[Survey Results] Error loading survey:', error);
    throw error;
  }
}

/**
 * Loads survey questions if not included in survey data
 * @param surveyId - The survey ID
 * @returns Promise with questions array
 */
export async function loadSurveyQuestions(surveyId: string): Promise<SurveyQuestion[]> {
  try {
    const endpoint = `/api/v2/surveys/${surveyId}/questions`;

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
      },
    });

    if (!response.ok) {
      throw new Error('Fehler beim Laden der Fragen');
    }

    const result = (await response.json()) as ApiResponse<SurveyQuestion[]>;
    return result.data;
  } catch (error) {
    console.error('[Survey Results] Error loading questions:', error);
    throw error;
  }
}

/**
 * Loads survey statistics from API v2
 * @param surveyId - The survey ID
 * @returns Promise with statistics data
 * @throws Error if statistics cannot be loaded
 */
export async function loadSurveyStatistics(surveyId: string): Promise<SurveyStatistics> {
  try {
    const endpoint = `/api/v2/surveys/${surveyId}/statistics`;

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
      },
    });

    if (!response.ok) {
      throw new Error('Fehler beim Laden der Statistiken');
    }

    const result = (await response.json()) as ApiResponse<SurveyStatistics>;
    return result.data;
  } catch (error) {
    console.error('[Survey Results] Error loading statistics:', error);
    throw error;
  }
}

/**
 * Loads individual responses (admin only)
 * @param surveyId - The survey ID
 * @returns Promise with responses data or null if not accessible
 */
export async function loadSurveyResponses(surveyId: string): Promise<ResponsesData | null> {
  try {
    const endpoint = `/api/v2/surveys/${surveyId}/responses`;

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
      },
    });

    if (!response.ok) {
      console.warn('[Survey Results] Could not load individual responses (might not have permission)');
      return null;
    }

    const result = (await response.json()) as ApiResponse<ResponsesData>;
    return result.data;
  } catch (error) {
    console.warn('[Survey Results] Could not load individual responses:', error);
    return null;
  }
}

/**
 * Exports survey results to Excel (triggers download)
 * @param surveyId - The survey ID
 * @throws Error if export fails
 */
export async function exportToExcel(surveyId: string): Promise<void> {
  try {
    const endpoint = `/api/v2/surveys/${surveyId}/export?format=excel`;

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
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
  } catch (error) {
    console.error('[Survey Results] Error exporting to Excel:', error);
    throw error;
  }
}
