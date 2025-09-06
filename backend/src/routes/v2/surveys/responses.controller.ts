/**
 * Survey Responses API v2 Controller
 * Handles HTTP requests for survey responses
 */
import { Response } from 'express';

import type { AuthenticatedRequest } from '../../../types/request.types';
import { ServiceError } from '../../../utils/ServiceError';
import { errorResponse, successResponse } from '../../../utils/apiResponse';
import { SurveyAnswer, responsesService } from './responses.service';

/**
 * Submit a response to a survey
 */
export async function submitResponse(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const surveyId = Number.parseInt(req.params.id, 10);
    const { answers } = req.body as { answers: SurveyAnswer[] };

    const responseId = await responsesService.submitResponse(
      surveyId,
      req.user.id,
      req.user.tenant_id,
      answers,
    );

    res.status(201).json(
      successResponse({
        id: responseId,
        message: 'Antwort erfolgreich gespeichert',
      }),
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.message, String(error.statusCode)));
    } else {
      console.error('Error submitting survey response:', error);
      res.status(500).json(errorResponse('Fehler beim Speichern der Antwort', '500'));
    }
  }
}

/**
 * Get all responses for a survey (admin only)
 */
export async function getAllResponses(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const surveyId = Number.parseInt(req.params.id, 10);
    const { page = 1, limit = 50 } = req.query;

    const responses = await responsesService.getAllResponses(
      surveyId,
      req.user.tenant_id,
      req.user.role,
      req.user.id,
      {
        page: Number(page),
        limit: Number(limit),
      },
    );

    res.json(successResponse(responses));
  } catch (error) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.message, String(error.statusCode)));
    } else {
      console.error('Error fetching survey responses:', error);
      res.status(500).json(errorResponse('Fehler beim Abrufen der Antworten', '500'));
    }
  }
}

/**
 * Get user's own response to a survey
 */
export async function getMyResponse(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const surveyId = Number.parseInt(req.params.id, 10);

    const response = await responsesService.getUserResponse(
      surveyId,
      req.user.id,
      req.user.tenant_id,
    );

    if (!response) {
      res.json(
        successResponse({
          responded: false,
          response: null,
        }),
      );
    } else {
      res.json(
        successResponse({
          responded: true,
          response,
        }),
      );
    }
  } catch (error) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.message, String(error.statusCode)));
    } else {
      console.error('Error fetching user response:', error);
      res.status(500).json(errorResponse('Fehler beim Abrufen Ihrer Antwort', '500'));
    }
  }
}

/**
 * Get a specific response by ID
 */
export async function getResponseById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const surveyId = Number.parseInt(req.params.id, 10);
    const responseId = Number.parseInt(req.params.responseId, 10);

    const response = await responsesService.getResponseById(
      surveyId,
      responseId,
      req.user.tenant_id,
      req.user.role,
      req.user.id,
    );

    res.json(successResponse(response));
  } catch (error) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.message, String(error.statusCode)));
    } else {
      console.error('Error fetching response:', error);
      res.status(500).json(errorResponse('Fehler beim Abrufen der Antwort', '500'));
    }
  }
}

/**
 * Update a response (if allowed)
 */
export async function updateResponse(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const surveyId = Number.parseInt(req.params.id, 10);
    const responseId = Number.parseInt(req.params.responseId, 10);
    const { answers } = req.body as { answers: SurveyAnswer[] };

    await responsesService.updateResponse(
      surveyId,
      responseId,
      req.user.id,
      req.user.tenant_id,
      answers,
    );

    res.json(successResponse({ message: 'Antwort erfolgreich aktualisiert' }));
  } catch (error) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.message, String(error.statusCode)));
    } else {
      console.error('Error updating response:', error);
      res.status(500).json(errorResponse('Fehler beim Aktualisieren der Antwort', '500'));
    }
  }
}

/**
 * Export survey responses (CSV/Excel)
 */
export async function exportResponses(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const surveyId = Number.parseInt(req.params.id, 10);
    const format = (req.query.format as string) || 'csv';

    const exportData = await responsesService.exportResponses(
      surveyId,
      req.user.tenant_id,
      req.user.role,
      req.user.id,
      format as 'csv' | 'excel',
    );

    // Set appropriate headers based on format
    if (format === 'excel') {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename="survey_${surveyId}_export.xlsx"`);
    } else {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="survey_${surveyId}_export.csv"`);
    }

    res.send(exportData);
  } catch (error) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.message, String(error.statusCode)));
    } else {
      console.error('Error exporting responses:', error);
      res.status(500).json(errorResponse('Fehler beim Exportieren der Antworten', '500'));
    }
  }
}
