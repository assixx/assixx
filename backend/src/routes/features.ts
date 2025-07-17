/**
 * Features API Routes
 * Handles feature management for multi-tenant system
 */

import express, { Router } from "express";
import { security } from "../middleware/security";
import { body, param, query } from "express-validator";
import { createValidation } from "../middleware/validation";
import { successResponse, errorResponse } from "../types/response.types";
import { checkFeature } from "../middleware/features";
import { logger } from "../utils/logger";
import { getErrorMessage } from "../utils/errorHandler";
import { RowDataPacket } from "mysql2";
import { typed } from "../utils/routeHandlers";

// Import Feature model and database (now ES modules)
import Feature from "../models/feature";
import { execute } from "../database";

const router: Router = express.Router();

// Request body interfaces
interface FeatureActivationBody {
  tenantId: number;
  featureCode: string;
  options?: {
    activatedBy?: number;
    config?: Record<string, unknown>;
    expiresAt?: Date | string;
    [key: string]: unknown;
  };
}

interface FeatureDeactivationBody {
  tenantId: number;
  featureCode: string;
}

// Validation schemas
const featureActivationValidation = createValidation([
  body("tenantId").isInt({ min: 1 }).withMessage("Ungültige Tenant-ID"),
  body("featureCode")
    .notEmpty()
    .trim()
    .withMessage("Feature-Code ist erforderlich"),
  body("options").optional().isObject(),
]);

const featureDeactivationValidation = createValidation([
  body("tenantId").isInt({ min: 1 }).withMessage("Ungültige Tenant-ID"),
  body("featureCode")
    .notEmpty()
    .trim()
    .withMessage("Feature-Code ist erforderlich"),
]);

const usageStatsValidation = createValidation([
  param("featureCode")
    .notEmpty()
    .trim()
    .withMessage("Feature-Code ist erforderlich"),
  query("startDate").isISO8601().withMessage("Ungültiges Startdatum"),
  query("endDate").isISO8601().withMessage("Ungültiges Enddatum"),
]);

/* Unused interfaces - kept for future reference
interface TenantFeaturesRequest extends AuthenticatedRequest {
  params: {
    tenantId: string;
  };
}

interface FeatureActivationRequest extends AuthenticatedRequest {
  body: {
    tenantId: number;
    featureCode: string;
    options?: {
      activatedBy?: number;
      config?: Record<string, unknown>;
      expiresAt?: Date | string;
      [key: string]: unknown;
    };
  };
}

interface FeatureDeactivationRequest extends AuthenticatedRequest {
  body: {
    tenantId: number;
    featureCode: string;
  };
}

interface FeatureUsageRequest extends AuthenticatedRequest {
  params: {
    featureCode: string;
  };
  query: {
    startDate?: string;
    endDate?: string;
  };
}
*/

// Removed unused interface

// Get all available features (public)
router.get(
  "/available",
  typed.public(async (_req, res) => {
    try {
      const features = await Feature.findAll();
      res.json(successResponse(features));
    } catch (error) {
      logger.error(
        `Error fetching available features: ${getErrorMessage(error)}`
      );
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen der Features", 500));
    }
  })
);

// Get features for a specific tenant (authenticated)
router.get(
  "/tenant/:tenantId",
  ...security.user(
    createValidation([
      param("tenantId").isInt({ min: 1 }).withMessage("Ungültige Tenant-ID"),
    ])
  ),
  typed.params<{ tenantId: string }>(async (req, res) => {
    try {
      // Only Root and Admin can view other tenants
      const requestedTenantId = parseInt(req.params.tenantId, 10);
      const userTenantId = req.user.tenant_id;

      if (
        requestedTenantId !== userTenantId &&
        req.user.role !== "root" &&
        req.user.role !== "admin"
      ) {
        res.status(403).json(errorResponse("Keine Berechtigung", 403));
        return;
      }

      const features = await Feature.getTenantFeatures(requestedTenantId);
      res.json(successResponse(features));
    } catch (error) {
      logger.error(`Error fetching tenant features: ${getErrorMessage(error)}`);
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen der Tenant-Features", 500));
    }
  })
);

// Get my features
router.get(
  "/my-features",
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const features = await Feature.getTenantFeatures(tenantId);
      res.json(successResponse(features));
    } catch (error) {
      logger.error(`Error fetching my features: ${getErrorMessage(error)}`);
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen der Features", 500));
    }
  })
);

// Activate feature (Root and Admin only)
router.post(
  "/activate",
  ...security.admin(featureActivationValidation),
  typed.body<FeatureActivationBody>(async (req, res) => {
    try {
      const { tenantId, featureCode, options = {} } = req.body;

      // Set activatedBy
      options.activatedBy = req.user.id;

      await Feature.activateForTenant(tenantId, featureCode, options);

      logger.info(
        `Feature ${featureCode} activated for tenant ${tenantId} by user ${req.user.username}`
      );
      res.json(successResponse(null, "Feature erfolgreich aktiviert"));
    } catch (error) {
      logger.error(`Error activating feature: ${getErrorMessage(error)}`);
      res
        .status(500)
        .json(errorResponse("Fehler beim Aktivieren des Features", 500));
    }
  })
);

// Deactivate feature (Root and Admin only)
router.post(
  "/deactivate",
  ...security.admin(featureDeactivationValidation),
  typed.body<FeatureDeactivationBody>(async (req, res) => {
    try {
      const { tenantId, featureCode } = req.body;

      await Feature.deactivateForTenant(tenantId, featureCode);

      logger.info(
        `Feature ${featureCode} deactivated for tenant ${tenantId} by user ${req.user.username}`
      );
      res.json(successResponse(null, "Feature erfolgreich deaktiviert"));
    } catch (error) {
      logger.error(`Error deactivating feature: ${getErrorMessage(error)}`);
      res
        .status(500)
        .json(errorResponse("Fehler beim Deaktivieren des Features", 500));
    }
  })
);

// Get feature usage statistics
router.get(
  "/usage/:featureCode",
  ...security.user(usageStatsValidation),
  typed.params<{ featureCode: string }>(async (req, res) => {
    try {
      const { featureCode } = req.params;
      const { startDate, endDate } = req.query;
      const tenantId = req.user.tenant_id;

      const stats = await Feature.getUsageStats(
        tenantId,
        featureCode,
        startDate as string,
        endDate as string
      );
      res.json(successResponse(stats));
    } catch (error) {
      logger.error(`Error fetching usage stats: ${getErrorMessage(error)}`);
      res
        .status(500)
        .json(
          errorResponse("Fehler beim Abrufen der Nutzungsstatistiken", 500)
        );
    }
  })
);

// Test route to check feature access
router.get(
  "/test/:featureCode",
  ...security.user(
    createValidation([
      param("featureCode")
        .notEmpty()
        .trim()
        .withMessage("Feature-Code ist erforderlich"),
    ])
  ),
  typed.params<{ featureCode: string }>(async (req, res, next) => {
    await checkFeature(req.params.featureCode)(req, res, next);
  }),
  typed.params<{ featureCode: string }>((req, res) => {
    res.json(
      successResponse({
        message: `Zugriff auf Feature ${req.params.featureCode} gewährt`,
        feature: req.params.featureCode,
      })
    );
  })
);

// Get all tenants with features (Root only)
router.get(
  "/all-tenants",
  ...security.root(),
  typed.auth(async (_req, res) => {
    try {
      // Get all tenants
      const [tenants] = await execute<RowDataPacket[]>(
        "SELECT id, subdomain, company_name, status FROM tenants ORDER BY company_name"
      );

      // Get activated features for each tenant
      for (const tenant of tenants) {
        tenant.features = await Feature.getTenantFeatures(tenant.id);
      }

      res.json(successResponse(tenants));
    } catch (error) {
      logger.error(
        `Error fetching all tenants with features: ${getErrorMessage(error)}`
      );
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen der Tenant-Features", 500));
    }
  })
);

export default router;

// CommonJS compatibility
