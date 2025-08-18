/**
 * Surveys API v2 Controller
 * Handles HTTP requests and delegates business logic to service layer
 */

import { Response } from "express";

import type { AuthenticatedRequest } from "../../../types/request.types";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
} from "../../../utils/apiResponse";
import { ServiceError } from "../../../utils/ServiceError";

import {
  surveysService,
  SurveyCreateData,
  SurveyUpdateData,
} from "./surveys.service";

/**
 * @param req
 * @param res
 * @swagger
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
export async function listSurveys(req: AuthenticatedRequest, res: Response) {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const filters = {
      status: status as "draft" | "active" | "closed" | undefined,
      page: Number.parseInt(page as string, 10) ?? 1,
      limit: Number.parseInt(limit as string, 10) ?? 20,
    };

    const surveys = await surveysService.listSurveys(
      req.user.tenant_id,
      req.user.id,
      req.user.role,
      filters,
    );

    // TODO: Add proper pagination metadata
    res.json(
      paginatedResponse(surveys, {
        currentPage: filters.page,
        pageSize: filters.limit,
        totalItems: surveys.length,
        totalPages: Math.ceil(surveys.length / filters.limit),
      }),
    );
  } catch (error: unknown) {
    console.error("Error in listSurveys:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to list surveys"));
    }
  }
}

/**
 * @param req
 * @param res
 * @swagger
 * /api/v2/surveys/{id}:
 *   get:
 *     summary: Get survey by ID
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
export async function getSurveyById(req: AuthenticatedRequest, res: Response) {
  try {
    const surveyId = Number.parseInt(req.params.id, 10);

    if (isNaN(surveyId)) {
      res.status(400).json(errorResponse("INVALID_ID", "Invalid survey ID"));
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
    console.error("Error in getSurveyById:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to get survey"));
    }
  }
}

/**
 * @param req
 * @param res
 * @swagger
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
export async function createSurvey(req: AuthenticatedRequest, res: Response) {
  try {
    // Check role - only admin and root can create surveys
    if (req.user.role === "employee") {
      res
        .status(403)
        .json(errorResponse("FORBIDDEN", "Only admins can create surveys"));
      return;
    }

    const survey = await surveysService.createSurvey(
      req.body as SurveyCreateData,
      req.user.tenant_id,
      req.user.id,
      req.ip,
      req.get("User-Agent"),
    );

    res.status(201).json(successResponse(survey));
  } catch (error: unknown) {
    console.error("Error in createSurvey:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to create survey"));
    }
  }
}

/**
 * @param req
 * @param res
 * @swagger
 * /api/v2/surveys/{id}:
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
export async function updateSurvey(req: AuthenticatedRequest, res: Response) {
  try {
    const surveyId = Number.parseInt(req.params.id, 10);

    if (isNaN(surveyId)) {
      res.status(400).json(errorResponse("INVALID_ID", "Invalid survey ID"));
      return;
    }

    const survey = await surveysService.updateSurvey(
      surveyId,
      req.body as SurveyUpdateData,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
      req.ip,
      req.get("User-Agent"),
    );

    res.json(successResponse(survey));
  } catch (error: unknown) {
    console.error("Error in updateSurvey:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to update survey"));
    }
  }
}

/**
 * @param req
 * @param res
 * @swagger
 * /api/v2/surveys/{id}:
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
export async function deleteSurvey(req: AuthenticatedRequest, res: Response) {
  try {
    const surveyId = Number.parseInt(req.params.id, 10);

    if (isNaN(surveyId)) {
      res.status(400).json(errorResponse("INVALID_ID", "Invalid survey ID"));
      return;
    }

    const result = await surveysService.deleteSurvey(
      surveyId,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
      req.ip,
      req.get("User-Agent"),
    );

    res.json(successResponse(result));
  } catch (error: unknown) {
    console.error("Error in deleteSurvey:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to delete survey"));
    }
  }
}

/**
 * @param req
 * @param res
 * @swagger
 * /api/v2/surveys/templates:
 *   get:
 *     summary: Get available survey templates
 *     tags: [Surveys v2]
 *     security:
 *       - bearerAuth: []
 */
export async function getTemplates(req: AuthenticatedRequest, res: Response) {
  try {
    const templates = await surveysService.getSurveyTemplates(
      req.user.tenant_id,
    );
    res.json(successResponse(templates));
  } catch (error: unknown) {
    console.error("Error in getTemplates:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to get templates"));
    }
  }
}

/**
 * @param req
 * @param res
 * @swagger
 * /api/v2/surveys/templates/{templateId}:
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
export async function createFromTemplate(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const templateId = Number.parseInt(req.params.templateId, 10);

    if (isNaN(templateId)) {
      res.status(400).json(errorResponse("INVALID_ID", "Invalid template ID"));
      return;
    }

    const survey = await surveysService.createFromTemplate(
      templateId,
      req.user.tenant_id,
      req.user.id,
      req.ip,
      req.get("User-Agent"),
    );

    res.status(201).json(successResponse(survey));
  } catch (error: unknown) {
    console.error("Error in createFromTemplate:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to create from template"));
    }
  }
}

/**
 * @param req
 * @param res
 * @swagger
 * /api/v2/surveys/{id}/statistics:
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
export async function getStatistics(req: AuthenticatedRequest, res: Response) {
  try {
    const surveyId = Number.parseInt(req.params.id, 10);

    if (isNaN(surveyId)) {
      res.status(400).json(errorResponse("INVALID_ID", "Invalid survey ID"));
      return;
    }

    const statistics = await surveysService.getSurveyStatistics(
      surveyId,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
    );

    res.json(successResponse(statistics));
  } catch (error: unknown) {
    console.error("Error in getStatistics:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to get statistics"));
    }
  }
}

// Note: Survey responses are handled by a separate API endpoint
// TODO: Implement these in a separate responses controller
// - POST /api/v2/surveys/{id}/responses - Submit a response
// - GET /api/v2/surveys/{id}/responses - Get responses (admin only)
// - GET /api/v2/surveys/{id}/responses/{responseId} - Get specific response
// - PUT /api/v2/surveys/{id}/responses/{responseId} - Update response (if allowed)
