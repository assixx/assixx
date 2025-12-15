/**
 * Surveys API v2 Controller
 * Handles HTTP requests and delegates business logic to service layer
 */
import { Response } from 'express';

import type { AuthenticatedRequest } from '../../../types/request.types.js';
import { ServiceError } from '../../../utils/ServiceError.js';
import { errorResponse, paginatedResponse, successResponse } from '../../../utils/apiResponse.js';
import { SurveyCreateData, SurveyUpdateData, surveysService } from './surveys.service.js';

/**
 * @param req - The request object
 * @param res - The response object

 * /api/v2/surveys:
 *   get:
 *     summary: List surveys based on user role and permissions
 *     tags: [Surveys v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, closed]
 *         description: Filter by survey status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 */
export async function listSurveys(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const statusValue = status as 'draft' | 'active' | 'closed' | undefined;
    const parsedPage = Number.parseInt(page as string, 10);
    const pageNum = Number.isNaN(parsedPage) ? 1 : parsedPage;
    const parsedLimit = Number.parseInt(limit as string, 10);
    const limitNum = Number.isNaN(parsedLimit) ? 20 : parsedLimit;

    const filters: {
      status?: 'draft' | 'active' | 'closed';
      page?: number;
      limit?: number;
    } = {
      page: pageNum,
      limit: limitNum,
    };

    // Only set status if it's defined - avoid exactOptionalPropertyTypes violation
    if (statusValue !== undefined) {
      filters.status = statusValue;
    }

    const surveys = await surveysService.listSurveys(
      req.user.tenant_id,
      req.user.id,
      req.user.role,
      filters,
    );

    res.json(
      paginatedResponse(surveys, {
        currentPage: pageNum,
        pageSize: limitNum,
        totalItems: surveys.length,
        totalPages: Math.ceil(surveys.length / limitNum),
      }),
    );
  } catch (error: unknown) {
    console.error('Error in listSurveys:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to list surveys'));
    }
  }
}

/**
 * Helper: Check if string is a valid UUID format
 */
function isUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * @param req - The request object
 * @param res - The response object

 * /api/v2/surveys/\{id\}:
 *   get:
 *     summary: Get survey by ID or UUID
 *     tags: [Surveys v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           oneOf:
 *             - type: integer
 *             - type: string
 *         description: Survey ID (numeric) or UUID (string)
 */
export async function getSurveyById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const idParam = req.params['id'];

    if (idParam === undefined) {
      res.status(400).json(errorResponse('MISSING_ID', 'Survey ID is required'));
      return;
    }

    console.log('[DEBUG] getSurveyById called with idParam:', idParam, 'isUUID:', isUUID(idParam));

    // Check if it's a UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    if (isUUID(idParam)) {
      console.log('[DEBUG] Routing to UUID lookup');
      // UUID lookup
      const survey = await surveysService.getSurveyByUUID(
        idParam,
        req.user.tenant_id,
        req.user.id,
        req.user.role,
      );
      res.json(successResponse(survey));
      return;
    }
    console.log('[DEBUG] Routing to numeric ID lookup');

    // Numeric ID lookup (backwards compatibility)
    const surveyId = Number.parseInt(idParam, 10);
    if (Number.isNaN(surveyId)) {
      res.status(400).json(errorResponse('INVALID_ID', 'Invalid survey ID or UUID'));
      return;
    }

    const survey = await surveysService.getSurveyById(
      surveyId,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
    );

    res.json(successResponse(survey));
  } catch (error: unknown) {
    console.error('Error in getSurveyById:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to get survey'));
    }
  }
}

/**
 * @param req - The request object
 * @param res - The response object

 * /api/v2/surveys:
 *   post:
 *     summary: Create a new survey
 *     tags: [Surveys v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SurveyCreateRequest'
 */
export async function createSurvey(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // Check role - only admin and root can create surveys
    if (req.user.role === 'employee') {
      res.status(403).json(errorResponse('FORBIDDEN', 'Only admins can create surveys'));
      return;
    }

    const survey = await surveysService.createSurvey(
      req.body as SurveyCreateData,
      req.user.tenant_id,
      req.user.id,
      req.ip,
      req.get('User-Agent'),
    );

    res.status(201).json(successResponse(survey));
  } catch (error: unknown) {
    console.error('Error in createSurvey:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to create survey'));
    }
  }
}

/**
 * @param req - The request object
 * @param res - The response object

 * /api/v2/surveys/\{id\}:
 *   put:
 *     summary: Update a survey
 *     tags: [Surveys v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Survey ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SurveyUpdateRequest'
 */
export async function updateSurvey(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const idParam = req.params['id'];

    if (idParam === undefined) {
      res.status(400).json(errorResponse('MISSING_ID', 'Survey ID is required'));
      return;
    }

    let surveyId: number;

    // Check if it's a UUID - need to get numeric ID first
    if (isUUID(idParam)) {
      const survey = await surveysService.getSurveyByUUID(
        idParam,
        req.user.tenant_id,
        req.user.id,
        req.user.role,
      );
      surveyId = (survey as { id: number }).id;
    } else {
      // Numeric ID lookup (backwards compatibility)
      surveyId = Number.parseInt(idParam, 10);
      if (Number.isNaN(surveyId)) {
        res.status(400).json(errorResponse('INVALID_ID', 'Invalid survey ID or UUID'));
        return;
      }
    }

    const survey = await surveysService.updateSurvey(
      surveyId,
      req.body as SurveyUpdateData,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
      req.ip,
      req.get('User-Agent'),
    );

    res.json(successResponse(survey));
  } catch (error: unknown) {
    console.error('Error in updateSurvey:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to update survey'));
    }
  }
}

/**
 * @param req - The request object
 * @param res - The response object

 * /api/v2/surveys/\{id\}:
 *   delete:
 *     summary: Delete a survey
 *     tags: [Surveys v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Survey ID
 */
export async function deleteSurvey(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const idParam = req.params['id'];

    if (idParam === undefined) {
      res.status(400).json(errorResponse('MISSING_ID', 'Survey ID is required'));
      return;
    }

    let surveyId: number;

    // Check if it's a UUID - need to get numeric ID first
    if (isUUID(idParam)) {
      const survey = await surveysService.getSurveyByUUID(
        idParam,
        req.user.tenant_id,
        req.user.id,
        req.user.role,
      );
      surveyId = (survey as { id: number }).id;
    } else {
      // Numeric ID lookup (backwards compatibility)
      surveyId = Number.parseInt(idParam, 10);
      if (Number.isNaN(surveyId)) {
        res.status(400).json(errorResponse('INVALID_ID', 'Invalid survey ID or UUID'));
        return;
      }
    }

    const result = await surveysService.deleteSurvey(
      surveyId,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
      req.ip,
      req.get('User-Agent'),
    );

    res.json(successResponse(result));
  } catch (error: unknown) {
    console.error('Error in deleteSurvey:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to delete survey'));
    }
  }
}

/**
 * @param req - The request object
 * @param res - The response object

 * /api/v2/surveys/templates:
 *   get:
 *     summary: Get available survey templates
 *     tags: [Surveys v2]
 *     security:
 *       - bearerAuth: []
 */
export async function getTemplates(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const templates = await surveysService.getSurveyTemplates(req.user.tenant_id);
    res.json(successResponse(templates));
  } catch (error: unknown) {
    console.error('Error in getTemplates:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to get templates'));
    }
  }
}

/**
 * @param req - The request object
 * @param res - The response object

 * /api/v2/surveys/templates/\{templateId\}:
 *   post:
 *     summary: Create survey from template
 *     tags: [Surveys v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Template ID
 */
export async function createFromTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const templateIdParam = req.params['templateId'];

    if (templateIdParam === undefined) {
      res.status(400).json(errorResponse('MISSING_ID', 'Template ID is required'));
      return;
    }

    const templateId = Number.parseInt(templateIdParam, 10);

    if (Number.isNaN(templateId)) {
      res.status(400).json(errorResponse('INVALID_ID', 'Invalid template ID'));
      return;
    }

    const survey = await surveysService.createFromTemplate(
      templateId,
      req.user.tenant_id,
      req.user.id,
      req.ip,
      req.get('User-Agent'),
    );

    res.status(201).json(successResponse(survey));
  } catch (error: unknown) {
    console.error('Error in createFromTemplate:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to create from template'));
    }
  }
}

/**
 * @param req - The request object
 * @param res - The response object

 * /api/v2/surveys/\{id\}/statistics:
 *   get:
 *     summary: Get survey statistics and response analytics
 *     tags: [Surveys v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Survey ID
 */
export async function getStatistics(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const idParam = req.params['id'];

    if (idParam === undefined) {
      res.status(400).json(errorResponse('MISSING_ID', 'Survey ID is required'));
      return;
    }

    let surveyId: number;

    // Check if it's a UUID - need to get numeric ID first
    if (isUUID(idParam)) {
      const survey = await surveysService.getSurveyByUUID(
        idParam,
        req.user.tenant_id,
        req.user.id,
        req.user.role,
      );
      surveyId = (survey as { id: number }).id;
    } else {
      // Numeric ID lookup (backwards compatibility)
      surveyId = Number.parseInt(idParam, 10);
      if (Number.isNaN(surveyId)) {
        res.status(400).json(errorResponse('INVALID_ID', 'Invalid survey ID or UUID'));
        return;
      }
    }

    const statistics = await surveysService.getSurveyStatistics(
      surveyId,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
    );

    res.json(successResponse(statistics));
  } catch (error: unknown) {
    console.error('Error in getStatistics:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to get statistics'));
    }
  }
}

/**
 * Survey Responses API
 * All response endpoints are fully implemented in responses.controller.ts
 *
 * Available endpoints (see index.ts for routes):
 * - POST   /api/v2/surveys/:id/responses          - Submit a response
 * - GET    /api/v2/surveys/:id/responses          - Get all responses (admin only)
 * - GET    /api/v2/surveys/:id/my-response        - Get user's own response
 * - GET    /api/v2/surveys/:id/export             - Export responses (CSV/Excel)
 * - GET    /api/v2/surveys/:id/responses/:id      - Get specific response
 * - PUT    /api/v2/surveys/:id/responses/:id      - Update response (if allowed)
 */
