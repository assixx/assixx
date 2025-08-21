import { Response } from 'express';

import type { AuthenticatedRequest } from '../../../types/request.types';
import { errorResponse, successResponse } from '../../../types/response.types';
import { ServiceError } from '../../../utils/ServiceError.js';
import { getErrorMessage } from '../../../utils/errorHandler';
import { FeaturesService } from './features.service';
import type { FeatureActivationRequest, FeatureDeactivationRequest } from './types';

/**
 *
 */
export class FeaturesController {
  /**
   * @param req - The request object
   * @param res - The response object
   * @swagger
   * /api/v2/features:
   *   get:
   *     summary: Get all available features
   *     description: Retrieve all features available in the system. Public endpoint - no authentication required.
   *     tags: [Features v2]
   *     parameters:
   *       - in: query
   *         name: includeInactive
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Include inactive features in the response
   *     responses:
   *       200:
   *         description: Features retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/FeatureV2'
   *                 meta:
   *                   type: object
   *                   properties:
   *                     message:
   *                       type: string
   *                       example: Features retrieved successfully
   *                     count:
   *                       type: integer
   *                       example: 15
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  // GET /api/v2/features
  static async getAllFeatures(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const features = await FeaturesService.getAllFeatures(includeInactive);

      res.json(successResponse(features, 'Features retrieved successfully'));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse(message, 500));
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object
   * @swagger
   * /api/v2/features/categories:
   *   get:
   *     summary: Get features grouped by category
   *     description: Retrieve all features organized by their categories. Public endpoint.
   *     tags: [Features v2]
   *     parameters:
   *       - in: query
   *         name: includeInactive
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Include inactive features in the response
   *     responses:
   *       200:
   *         description: Features by category retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/FeaturesByCategoryResponse'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  // GET /api/v2/features/categories
  static async getFeaturesByCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const categories = await FeaturesService.getFeaturesByCategory(includeInactive);

      res.json(successResponse(categories, 'Features by category retrieved successfully'));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse(message, 500));
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object
   * @swagger
   * /api/v2/features/{code}:
   *   get:
   *     summary: Get feature by code
   *     description: Retrieve a specific feature by its unique code
   *     tags: [Features v2]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: code
   *         required: true
   *         schema:
   *           type: string
   *         description: Unique feature code
   *         example: "CHAT_MESSAGING"
   *     responses:
   *       200:
   *         description: Feature retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/FeatureResponse'
   *       404:
   *         description: Feature not found
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  // GET /api/v2/features/:code
  static async getFeatureByCode(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { code } = req.params;
      const feature = await FeaturesService.getFeatureByCode(code);

      if (!feature) {
        res.status(404).json(errorResponse('Feature not found', 404));
        return;
      }

      res.json(successResponse(feature, 'Feature retrieved successfully'));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse(message, 500));
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object
   * @swagger
   * /api/v2/features/tenant/{tenantId}:
   *   get:
   *     summary: Get features for a specific tenant
   *     description: Retrieve all features activated for a specific tenant. Admin only.
   *     tags: [Features v2]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: tenantId
   *         required: true
   *         schema:
   *           type: integer
   *         description: Tenant ID
   *         example: 1
   *     responses:
   *       200:
   *         description: Tenant features retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TenantFeaturesResponse'
   *       403:
   *         description: Access denied
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  // GET /api/v2/features/tenant/:tenantId
  static async getTenantFeatures(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tenantId = Number.parseInt(req.params.tenantId, 10);
      const userTenantId = req.user.tenant_id;

      // Only allow viewing own tenant unless root/admin
      if (tenantId !== userTenantId && req.user.role !== 'root' && req.user.role !== 'admin') {
        res.status(403).json(errorResponse('Access denied', 403));
        return;
      }

      const features = await FeaturesService.getTenantFeatures(tenantId);

      res.json(successResponse(features, 'Tenant features retrieved successfully'));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse(message, 500));
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object
   * @swagger
   * /api/v2/features/my-features:
   *   get:
   *     summary: Get features for authenticated user's tenant
   *     description: Retrieve all features available for the current user's tenant
   *     tags: [Features v2]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: My features retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/MyFeaturesResponse'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  // GET /api/v2/features/my-features
  static async getMyFeatures(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user.tenant_id;
      const features = await FeaturesService.getFeaturesWithTenantInfo(tenantId);

      res.json(successResponse(features, 'My features retrieved successfully'));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse(message, 500));
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object
   * @swagger
   * /api/v2/features/tenant/{tenantId}/summary:
   *   get:
   *     summary: Get tenant features summary
   *     description: Get a summary of activated features for a tenant including counts by category
   *     tags: [Features v2]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: tenantId
   *         required: true
   *         schema:
   *           type: integer
   *         description: Tenant ID
   *         example: 1
   *     responses:
   *       200:
   *         description: Tenant features summary retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TenantFeaturesSummaryResponse'
   *       403:
   *         description: Access denied
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  // GET /api/v2/features/tenant/:tenantId/summary
  static async getTenantFeaturesSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tenantId = Number.parseInt(req.params.tenantId, 10);
      const userTenantId = req.user.tenant_id;

      // Only allow viewing own tenant unless root/admin
      if (tenantId !== userTenantId && req.user.role !== 'root' && req.user.role !== 'admin') {
        res.status(403).json(errorResponse('Access denied', 403));
        return;
      }

      const summary = await FeaturesService.getTenantFeaturesSummary(tenantId);

      res.json(successResponse(summary, 'Tenant features summary retrieved successfully'));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse(message, 500));
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object
   * @swagger
   * /api/v2/features/activate:
   *   post:
   *     summary: Activate a feature for a tenant
   *     description: Activate a specific feature for a tenant. Admin/Root only.
   *     tags: [Features v2]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/FeatureActivationRequest'
   *     responses:
   *       200:
   *         description: Feature activated successfully
   *       400:
   *         description: Invalid request or feature already active
   *       403:
   *         description: Access denied
   *       404:
   *         description: Feature not found
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  // POST /api/v2/features/activate
  static async activateFeature(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const activationRequest = req.body as FeatureActivationRequest;
      const activatedBy = req.user.id;

      // Only root and admin can activate features
      if (req.user.role !== 'root' && req.user.role !== 'admin') {
        res.status(403).json(errorResponse('Access denied', 403));
        return;
      }

      await FeaturesService.activateFeature(activationRequest, activatedBy);

      res.json(successResponse(null, 'Feature activated successfully'));
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.message, error.statusCode));
      } else {
        const message = getErrorMessage(error);
        res.status(500).json(errorResponse(message, 500));
      }
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object
   * @swagger
   * /api/v2/features/deactivate:
   *   post:
   *     summary: Deactivate a feature for a tenant
   *     description: Deactivate a specific feature for a tenant. Admin/Root only.
   *     tags: [Features v2]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/FeatureDeactivationRequest'
   *     responses:
   *       200:
   *         description: Feature deactivated successfully
   *       403:
   *         description: Access denied
   *       404:
   *         description: Feature not found or not active
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  // POST /api/v2/features/deactivate
  static async deactivateFeature(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { tenantId, featureCode } = req.body as FeatureDeactivationRequest;
      const deactivatedBy = req.user.id;

      // Only root and admin can deactivate features
      if (req.user.role !== 'root' && req.user.role !== 'admin') {
        res.status(403).json(errorResponse('Access denied', 403));
        return;
      }

      await FeaturesService.deactivateFeature(tenantId, featureCode, deactivatedBy);

      res.json(successResponse(null, 'Feature deactivated successfully'));
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.message, error.statusCode));
      } else {
        const message = getErrorMessage(error);
        res.status(500).json(errorResponse(message, 500));
      }
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object
   * @swagger
   * /api/v2/features/usage/{featureCode}:
   *   get:
   *     summary: Get feature usage statistics
   *     description: Get usage statistics for a specific feature within a date range
   *     tags: [Features v2]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: featureCode
   *         required: true
   *         schema:
   *           type: string
   *         description: Feature code
   *         example: "CHAT_MESSAGING"
   *       - in: query
   *         name: startDate
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *         description: Start date for usage stats
   *         example: "2025-01-01"
   *       - in: query
   *         name: endDate
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *         description: End date for usage stats
   *         example: "2025-01-31"
   *     responses:
   *       200:
   *         description: Usage statistics retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/UsageStatsResponse'
   *       400:
   *         description: Missing required parameters
   *       404:
   *         description: Feature not found
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  // GET /api/v2/features/usage/:featureCode
  static async getUsageStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { featureCode } = req.params;
      const { startDate, endDate } = req.query;
      const tenantId = req.user.tenant_id;

      if (!startDate || !endDate) {
        res.status(400).json(errorResponse('Start date and end date are required', 400));
        return;
      }

      const stats = await FeaturesService.getUsageStats(
        tenantId,
        featureCode,
        startDate as string,
        endDate as string,
      );

      res.json(successResponse(stats, 'Usage statistics retrieved successfully'));
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.message, error.statusCode));
      } else {
        const message = getErrorMessage(error);
        res.status(500).json(errorResponse(message, 500));
      }
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object
   * @swagger
   * /api/v2/features/test/{featureCode}:
   *   get:
   *     summary: Test feature access
   *     description: Test if the current user's tenant has access to a specific feature
   *     tags: [Features v2]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: featureCode
   *         required: true
   *         schema:
   *           type: string
   *         description: Feature code to test
   *         example: "CHAT_MESSAGING"
   *     responses:
   *       200:
   *         description: Access granted
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/FeatureAccessResponse'
   *       403:
   *         description: Feature access denied
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  // GET /api/v2/features/test/:featureCode
  static async testFeatureAccess(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { featureCode } = req.params;
      const tenantId = req.user.tenant_id;

      const hasAccess = await FeaturesService.checkTenantAccess(tenantId, featureCode);

      if (!hasAccess) {
        res.status(403).json(errorResponse('Feature access denied', 403));
        return;
      }

      // Log usage for testing
      await FeaturesService.logUsage(tenantId, featureCode, req.user.id, {
        action: 'test_access',
      });

      res.json(
        successResponse({
          hasAccess: true,
          featureCode,
          message: `Access to feature ${featureCode} granted`,
        }),
      );
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse(message, 500));
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object
   * @swagger
   * /api/v2/features/all-tenants:
   *   get:
   *     summary: Get all tenants with their features
   *     description: Get a complete list of all tenants and their activated features. Root only.
   *     tags: [Features v2]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: All tenants with features retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AllTenantsWithFeaturesResponse'
   *       403:
   *         description: Access denied - Root only
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  // GET /api/v2/features/all-tenants
  static async getAllTenantsWithFeatures(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Root only
      if (req.user.role !== 'root') {
        res.status(403).json(errorResponse('Access denied', 403));
        return;
      }

      const tenants = await FeaturesService.getAllTenantsWithFeatures();

      res.json(successResponse(tenants, 'All tenants with features retrieved successfully'));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse(message, 500));
    }
  }
}
