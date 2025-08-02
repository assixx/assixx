import { Response } from "express";

import { AuthenticatedRequest } from "../../../types/request.types";
import { successResponse, errorResponse } from "../../../types/response.types";
import { getErrorMessage } from "../../../utils/errorHandler";

import { FeaturesService } from "./features.service";
import { FeatureActivationRequest, FeatureDeactivationRequest } from "./types";

export class FeaturesController {
  /**
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
  static async getAllFeatures(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const includeInactive = req.query.includeInactive === "true";
      const features = await FeaturesService.getAllFeatures(includeInactive);

      res.json(successResponse(features, "Features retrieved successfully"));
    } catch (error) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse(message, 500));
    }
  }

  // GET /api/v2/features/categories
  static async getFeaturesByCategory(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const includeInactive = req.query.includeInactive === "true";
      const categories =
        await FeaturesService.getFeaturesByCategory(includeInactive);

      res.json(
        successResponse(
          categories,
          "Features by category retrieved successfully",
        ),
      );
    } catch (error) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse(message, 500));
    }
  }

  // GET /api/v2/features/:code
  static async getFeatureByCode(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { code } = req.params;
      const feature = await FeaturesService.getFeatureByCode(code);

      if (!feature) {
        res.status(404).json(errorResponse("Feature not found", 404));
        return;
      }

      res.json(successResponse(feature, "Feature retrieved successfully"));
    } catch (error) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse(message, 500));
    }
  }

  // GET /api/v2/features/tenant/:tenantId
  static async getTenantFeatures(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const tenantId = parseInt(req.params.tenantId, 10);
      const userTenantId = req.user.tenant_id;

      // Only allow viewing own tenant unless root/admin
      if (
        tenantId !== userTenantId &&
        req.user.role !== "root" &&
        req.user.role !== "admin"
      ) {
        res.status(403).json(errorResponse("Access denied", 403));
        return;
      }

      const features = await FeaturesService.getTenantFeatures(tenantId);

      res.json(
        successResponse(features, "Tenant features retrieved successfully"),
      );
    } catch (error) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse(message, 500));
    }
  }

  // GET /api/v2/features/my-features
  static async getMyFeatures(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const tenantId = req.user.tenant_id;
      const features =
        await FeaturesService.getFeaturesWithTenantInfo(tenantId);

      res.json(successResponse(features, "My features retrieved successfully"));
    } catch (error) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse(message, 500));
    }
  }

  // GET /api/v2/features/tenant/:tenantId/summary
  static async getTenantFeaturesSummary(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const tenantId = parseInt(req.params.tenantId, 10);
      const userTenantId = req.user.tenant_id;

      // Only allow viewing own tenant unless root/admin
      if (
        tenantId !== userTenantId &&
        req.user.role !== "root" &&
        req.user.role !== "admin"
      ) {
        res.status(403).json(errorResponse("Access denied", 403));
        return;
      }

      const summary = await FeaturesService.getTenantFeaturesSummary(tenantId);

      res.json(
        successResponse(
          summary,
          "Tenant features summary retrieved successfully",
        ),
      );
    } catch (error) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse(message, 500));
    }
  }

  // POST /api/v2/features/activate
  static async activateFeature(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const activationRequest = req.body as FeatureActivationRequest;
      const activatedBy = req.user.id;

      // Only root and admin can activate features
      if (req.user.role !== "root" && req.user.role !== "admin") {
        res.status(403).json(errorResponse("Access denied", 403));
        return;
      }

      await FeaturesService.activateFeature(activationRequest, activatedBy);

      res.json(successResponse(null, "Feature activated successfully"));
    } catch (error) {
      const message = getErrorMessage(error);
      const statusCode = (error as any).statusCode || 500;
      res.status(statusCode).json(errorResponse(message, statusCode));
    }
  }

  // POST /api/v2/features/deactivate
  static async deactivateFeature(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { tenantId, featureCode } = req.body as FeatureDeactivationRequest;
      const deactivatedBy = req.user.id;

      // Only root and admin can deactivate features
      if (req.user.role !== "root" && req.user.role !== "admin") {
        res.status(403).json(errorResponse("Access denied", 403));
        return;
      }

      await FeaturesService.deactivateFeature(
        tenantId,
        featureCode,
        deactivatedBy,
      );

      res.json(successResponse(null, "Feature deactivated successfully"));
    } catch (error) {
      const message = getErrorMessage(error);
      const statusCode = (error as any).statusCode || 500;
      res.status(statusCode).json(errorResponse(message, statusCode));
    }
  }

  // GET /api/v2/features/usage/:featureCode
  static async getUsageStats(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { featureCode } = req.params;
      const { startDate, endDate } = req.query;
      const tenantId = req.user.tenant_id;

      if (!startDate || !endDate) {
        res
          .status(400)
          .json(errorResponse("Start date and end date are required", 400));
        return;
      }

      const stats = await FeaturesService.getUsageStats(
        tenantId,
        featureCode,
        startDate as string,
        endDate as string,
      );

      res.json(
        successResponse(stats, "Usage statistics retrieved successfully"),
      );
    } catch (error) {
      const message = getErrorMessage(error);
      const statusCode = (error as any).statusCode || 500;
      res.status(statusCode).json(errorResponse(message, statusCode));
    }
  }

  // GET /api/v2/features/test/:featureCode
  static async testFeatureAccess(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { featureCode } = req.params;
      const tenantId = req.user.tenant_id;

      const hasAccess = await FeaturesService.checkTenantAccess(
        tenantId,
        featureCode,
      );

      if (!hasAccess) {
        res.status(403).json(errorResponse("Feature access denied", 403));
        return;
      }

      // Log usage for testing
      await FeaturesService.logUsage(tenantId, featureCode, req.user.id, {
        action: "test_access",
      });

      res.json(
        successResponse({
          hasAccess: true,
          featureCode,
          message: `Access to feature ${featureCode} granted`,
        }),
      );
    } catch (error) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse(message, 500));
    }
  }

  // GET /api/v2/features/all-tenants
  static async getAllTenantsWithFeatures(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      // Root only
      if (req.user.role !== "root") {
        res.status(403).json(errorResponse("Access denied", 403));
        return;
      }

      const tenants = await FeaturesService.getAllTenantsWithFeatures();

      res.json(
        successResponse(
          tenants,
          "All tenants with features retrieved successfully",
        ),
      );
    } catch (error) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse(message, 500));
    }
  }
}
