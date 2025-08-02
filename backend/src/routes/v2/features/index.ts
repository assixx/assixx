import { Router } from "express";

import { security } from "../../../middleware/security";
import { typed } from "../../../utils/routeHandlers";

import { FeaturesController } from "./features.controller";
import {
  getAllFeaturesValidation,
  getFeaturesByCategoryValidation,
  getFeatureByCodeValidation,
  getTenantFeaturesValidation,
  getTenantFeaturesSummaryValidation,
  activateFeatureValidation,
  deactivateFeatureValidation,
  getUsageStatsValidation,
  testFeatureAccessValidation,
} from "./features.validation";

const router = Router();

// Public endpoints
router.get(
  "/",
  ...security.public(),
  getAllFeaturesValidation,
  typed.auth(FeaturesController.getAllFeatures),
);

router.get(
  "/categories",
  ...security.public(),
  getFeaturesByCategoryValidation,
  typed.auth(FeaturesController.getFeaturesByCategory),
);

// Authenticated endpoints
router.get(
  "/my-features",
  ...security.user(),
  typed.auth(FeaturesController.getMyFeatures),
);

router.get(
  "/test/:featureCode",
  ...security.user(),
  testFeatureAccessValidation,
  typed.auth(FeaturesController.testFeatureAccess),
);

router.get(
  "/usage/:featureCode",
  ...security.user(),
  getUsageStatsValidation,
  typed.auth(FeaturesController.getUsageStats),
);

// Admin endpoints
router.get(
  "/tenant/:tenantId",
  ...security.admin(),
  getTenantFeaturesValidation,
  typed.auth(FeaturesController.getTenantFeatures),
);

router.get(
  "/tenant/:tenantId/summary",
  ...security.admin(),
  getTenantFeaturesSummaryValidation,
  typed.auth(FeaturesController.getTenantFeaturesSummary),
);

router.post(
  "/activate",
  ...security.admin(),
  activateFeatureValidation,
  typed.auth(FeaturesController.activateFeature),
);

router.post(
  "/deactivate",
  ...security.admin(),
  deactivateFeatureValidation,
  typed.auth(FeaturesController.deactivateFeature),
);

// Root-only endpoints - MUST BE BEFORE /:code ROUTE
router.get(
  "/all-tenants",
  ...security.root(),
  typed.auth(FeaturesController.getAllTenantsWithFeatures),
);

// This route MUST BE LAST as it catches all GET requests
router.get(
  "/:code",
  ...security.user(),
  getFeatureByCodeValidation,
  typed.auth(FeaturesController.getFeatureByCode),
);

export default router;
