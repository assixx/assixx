/**
 * Surveys API v2 Routes
 * Route definitions for survey management
 * @swagger
 * tags:
 *   - name: Surveys v2
 *     description: Survey management API v2
 */

import { Router } from "express";

import { authenticateV2 } from "../../../middleware/v2/auth.middleware.js";
import { typed } from "../../../utils/routeHandlers.js";

import * as surveysController from "./surveys.controller.js";
import { surveysValidation } from "./surveys.validation.js";

const router = Router();

// All routes require authentication

/**
 * @swagger
 * /api/v2/surveys:
 *   get:
 *     summary: List surveys based on user role and permissions
 *     description: |
 *       Returns surveys based on user role:
 *       - Root: All surveys
 *       - Admin: Surveys in their departments
 *       - Employee: Assigned surveys only
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
 *     responses:
 *       200:
 *         description: Surveys retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiPaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SurveyListItemV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/",
  authenticateV2,
  surveysValidation.listSurveys,
  typed.auth(surveysController.listSurveys),
);

/**
 * @swagger
 * /api/v2/surveys/templates:
 *   get:
 *     summary: Get available survey templates
 *     description: Retrieve all available survey templates for the tenant
 *     tags: [Surveys v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Templates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SurveyTemplateV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/templates",
  authenticateV2,
  surveysValidation.getTemplates,
  typed.auth(surveysController.getTemplates),
);

/**
 * @swagger
 * /api/v2/surveys/templates/{templateId}:
 *   post:
 *     summary: Create survey from template
 *     description: Create a new survey based on an existing template
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
 *     responses:
 *       201:
 *         description: Survey created successfully from template
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SurveyV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Template not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.post(
  "/templates/:templateId",
  authenticateV2,
  surveysValidation.createFromTemplate,
  typed.auth(surveysController.createFromTemplate),
);

/**
 * @swagger
 * /api/v2/surveys/{id}:
 *   get:
 *     summary: Get survey by ID
 *     description: Retrieve a specific survey with all questions and assignments
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
 *     responses:
 *       200:
 *         description: Survey retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SurveyV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  "/:id",
  authenticateV2,
  surveysValidation.getSurveyById,
  typed.auth(surveysController.getSurveyById),
);

/**
 * @swagger
 * /api/v2/surveys:
 *   post:
 *     summary: Create a new survey
 *     description: Create a new survey with questions and assignments (admin/root only)
 *     tags: [Surveys v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SurveyCreateRequestV2'
 *     responses:
 *       201:
 *         description: Survey created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SurveyV2'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post(
  "/",
  authenticateV2,
  surveysValidation.createSurvey,
  typed.auth(surveysController.createSurvey),
);

/**
 * @swagger
 * /api/v2/surveys/{id}:
 *   put:
 *     summary: Update a survey
 *     description: Update an existing survey (admin/root only, cannot update if responses exist)
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
 *             $ref: '#/components/schemas/SurveyUpdateRequestV2'
 *     responses:
 *       200:
 *         description: Survey updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SurveyV2'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         description: Cannot update survey with existing responses
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.put(
  "/:id",
  authenticateV2,
  surveysValidation.updateSurvey,
  typed.auth(surveysController.updateSurvey),
);

/**
 * @swagger
 * /api/v2/surveys/{id}:
 *   delete:
 *     summary: Delete a survey
 *     description: Delete a survey (admin/root only, cannot delete if responses exist)
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
 *     responses:
 *       200:
 *         description: Survey deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: null
 *                     message:
 *                       type: string
 *                       example: Survey deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         description: Cannot delete survey with existing responses
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.delete(
  "/:id",
  authenticateV2,
  surveysValidation.deleteSurvey,
  typed.auth(surveysController.deleteSurvey),
);

/**
 * @swagger
 * /api/v2/surveys/{id}/statistics:
 *   get:
 *     summary: Get survey statistics and response analytics
 *     description: Get detailed statistics and analytics for survey responses (admin/root only)
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
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SurveyStatisticsV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  "/:id/statistics",
  authenticateV2,
  surveysValidation.getStatistics,
  typed.auth(surveysController.getStatistics),
);

// TODO: Implement survey response endpoints in a separate module
// - POST /api/v2/surveys/{id}/responses - Submit a response
// - GET /api/v2/surveys/{id}/responses - Get all responses (admin only)
// - GET /api/v2/surveys/{id}/responses/{responseId} - Get specific response
// - PUT /api/v2/surveys/{id}/responses/{responseId} - Update response (if allowed)
// - GET /api/v2/surveys/{id}/responses/export - Export responses (CSV/Excel)

export default router;
