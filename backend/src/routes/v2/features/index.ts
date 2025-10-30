import { Router } from 'express';

import { security } from '../../../middleware/security.js';
import { typed } from '../../../utils/routeHandlers.js';
import {
  activateFeature,
  deactivateFeature,
  getAllFeatures,
  getAllTenantsWithFeatures,
  getFeatureByCode,
  getFeaturesByCategory,
  getMyFeatures,
  getTenantFeatures,
  getTenantFeaturesSummary,
  getUsageStats,
  testFeatureAccess,
} from './features.controller.js';
import { featuresValidationZod } from './features.validation.zod.js';

const router = Router();

// Public endpoints
router.get(
  '/',
  ...security.public(),
  featuresValidationZod.getAllFeatures,
  typed.auth(getAllFeatures),
);

router.get(
  '/categories',
  ...security.public(),
  featuresValidationZod.getFeaturesByCategory,
  typed.auth(getFeaturesByCategory),
);

// Authenticated endpoints
router.get('/my-features', ...security.user(), typed.auth(getMyFeatures));

router.get(
  '/test/:featureCode',
  ...security.user(),
  featuresValidationZod.testFeatureAccess,
  typed.auth(testFeatureAccess),
);

router.get(
  '/usage/:featureCode',
  ...security.user(),
  featuresValidationZod.getUsageStats,
  typed.auth(getUsageStats),
);

// Admin endpoints
router.get(
  '/tenant/:tenantId',
  ...security.admin(),
  featuresValidationZod.getTenantFeatures,
  typed.auth(getTenantFeatures),
);

router.get(
  '/tenant/:tenantId/summary',
  ...security.admin(),
  featuresValidationZod.getTenantFeaturesSummary,
  typed.auth(getTenantFeaturesSummary),
);

router.post(
  '/activate',
  ...security.admin(),
  featuresValidationZod.activateFeature,
  typed.auth(activateFeature),
);

router.post(
  '/deactivate',
  ...security.admin(),
  featuresValidationZod.deactivateFeature,
  typed.auth(deactivateFeature),
);

// Root-only endpoints - MUST BE BEFORE /:code ROUTE
router.get('/all-tenants', ...security.root(), typed.auth(getAllTenantsWithFeatures));

// This route MUST BE LAST as it catches all GET requests
router.get(
  '/:code',
  ...security.user(),
  featuresValidationZod.getFeatureByCode,
  typed.auth(getFeatureByCode),
);

export default router;
