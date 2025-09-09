import { Router } from 'express';

import { security } from '../../../middleware/security';
import { typed } from '../../../utils/routeHandlers';
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
} from './features.controller';
import {
  activateFeatureValidation,
  deactivateFeatureValidation,
  getAllFeaturesValidation,
  getFeatureByCodeValidation,
  getFeaturesByCategoryValidation,
  getTenantFeaturesSummaryValidation,
  getTenantFeaturesValidation,
  getUsageStatsValidation,
  testFeatureAccessValidation,
} from './features.validation';

const router = Router();

// Public endpoints
router.get('/', ...security.public(), getAllFeaturesValidation, typed.auth(getAllFeatures));

router.get(
  '/categories',
  ...security.public(),
  getFeaturesByCategoryValidation,
  typed.auth(getFeaturesByCategory),
);

// Authenticated endpoints
router.get('/my-features', ...security.user(), typed.auth(getMyFeatures));

router.get(
  '/test/:featureCode',
  ...security.user(),
  testFeatureAccessValidation,
  typed.auth(testFeatureAccess),
);

router.get(
  '/usage/:featureCode',
  ...security.user(),
  getUsageStatsValidation,
  typed.auth(getUsageStats),
);

// Admin endpoints
router.get(
  '/tenant/:tenantId',
  ...security.admin(),
  getTenantFeaturesValidation,
  typed.auth(getTenantFeatures),
);

router.get(
  '/tenant/:tenantId/summary',
  ...security.admin(),
  getTenantFeaturesSummaryValidation,
  typed.auth(getTenantFeaturesSummary),
);

router.post(
  '/activate',
  ...security.admin(),
  activateFeatureValidation,
  typed.auth(activateFeature),
);

router.post(
  '/deactivate',
  ...security.admin(),
  deactivateFeatureValidation,
  typed.auth(deactivateFeature),
);

// Root-only endpoints - MUST BE BEFORE /:code ROUTE
router.get('/all-tenants', ...security.root(), typed.auth(getAllTenantsWithFeatures));

// This route MUST BE LAST as it catches all GET requests
router.get('/:code', ...security.user(), getFeatureByCodeValidation, typed.auth(getFeatureByCode));

export default router;
