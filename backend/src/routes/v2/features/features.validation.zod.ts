/**
 * Features API v2 Validation with Zod
 * Replaces express-validator with Zod for feature management endpoints
 */
import { z } from 'zod';

import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.zod.js';
import { DateSchema } from '../../../schemas/common.schema.js';

// ============================================================
// CUSTOM SCHEMAS
// ============================================================

/**
 * Feature code validation
 * Must be lowercase letters, numbers, underscores, and hyphens only
 */
const FeatureCodeSchema = z
  .string()
  .trim()
  .min(3, 'Feature code must be at least 3 characters')
  .max(50, 'Feature code must not exceed 50 characters')
  .regex(
    /^[-0-9_a-z]+$/,
    'Feature code must contain only lowercase letters, numbers, underscores and hyphens',
  );

/**
 * Tenant ID validation (positive integer)
 */
const TenantIdSchema = z.number().int().positive('Invalid tenant ID');

// ============================================================
// QUERY SCHEMAS
// ============================================================

/**
 * Get all features query parameters
 */
export const GetAllFeaturesQuerySchema = z.object({
  includeInactive: z.preprocess(
    (val: unknown) =>
      val === 'true' ? true
      : val === 'false' ? false
      : val,
    z.boolean().optional(),
  ),
});

/**
 * Get features by category query parameters
 */
export const GetFeaturesByCategoryQuerySchema = z.object({
  includeInactive: z.preprocess(
    (val: unknown) =>
      val === 'true' ? true
      : val === 'false' ? false
      : val,
    z.boolean().optional(),
  ),
});

/**
 * Get usage stats query parameters
 */
export const GetUsageStatsQuerySchema = z
  .object({
    startDate: DateSchema,
    endDate: DateSchema,
  })
  .refine(
    (data: { startDate: string; endDate: string }) =>
      new Date(data.endDate) >= new Date(data.startDate),
    {
      message: 'End date must be after start date',
      path: ['endDate'],
    },
  );

// ============================================================
// PARAM SCHEMAS
// ============================================================

/**
 * Feature code parameter validation
 */
export const FeatureCodeParamSchema = z.object({
  code: FeatureCodeSchema,
});

/**
 * Feature code parameter for usage stats
 */
export const FeatureCodeUsageParamSchema = z.object({
  featureCode: FeatureCodeSchema,
});

/**
 * Tenant ID parameter validation
 */
export const TenantIdParamSchema = z.object({
  tenantId: z.preprocess(
    (val: unknown) => (typeof val === 'string' ? Number.parseInt(val, 10) : val),
    TenantIdSchema,
  ),
});

// ============================================================
// BODY SCHEMAS
// ============================================================

/**
 * Activate feature request body with options
 */
export const ActivateFeatureBodySchema = z.object({
  tenantId: TenantIdSchema,
  featureCode: FeatureCodeSchema,
  options: z
    .object({
      expiresAt: z
        .string()
        .refine(
          (val: string) => {
            const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
            return isoDatePattern.test(val);
          },
          { message: 'expiresAt must be a valid ISO 8601 date' },
        )
        .refine(
          (val: string) => {
            const date = new Date(val);
            return date > new Date();
          },
          { message: 'expiresAt must be in the future' },
        )
        .optional(),
      customPrice: z.number().nonnegative('customPrice must be positive').optional(),
      trialDays: z
        .number()
        .int()
        .min(1, 'trialDays must be at least 1')
        .max(365, 'trialDays must not exceed 365')
        .optional(),
      usageLimit: z.number().int().positive('usageLimit must be a positive integer').optional(),
      customConfig: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

/**
 * Deactivate feature request body
 */
export const DeactivateFeatureBodySchema = z.object({
  tenantId: TenantIdSchema,
  featureCode: FeatureCodeSchema,
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type GetAllFeaturesQuery = z.infer<typeof GetAllFeaturesQuerySchema>;
export type GetFeaturesByCategoryQuery = z.infer<typeof GetFeaturesByCategoryQuerySchema>;
export type GetUsageStatsQuery = z.infer<typeof GetUsageStatsQuerySchema>;
export type FeatureCodeParam = z.infer<typeof FeatureCodeParamSchema>;
export type FeatureCodeUsageParam = z.infer<typeof FeatureCodeUsageParamSchema>;
export type TenantIdParam = z.infer<typeof TenantIdParamSchema>;
export type ActivateFeatureBody = z.infer<typeof ActivateFeatureBodySchema>;
export type DeactivateFeatureBody = z.infer<typeof DeactivateFeatureBodySchema>;

// ============================================================
// VALIDATION MIDDLEWARE EXPORTS
// ============================================================

/**
 * Pre-configured validation middleware for feature routes
 */
export const featuresValidationZod = {
  getAllFeatures: validateQuery(GetAllFeaturesQuerySchema),
  getFeaturesByCategory: validateQuery(GetFeaturesByCategoryQuerySchema),
  getFeatureByCode: validateParams(FeatureCodeParamSchema),
  getTenantFeatures: validateParams(TenantIdParamSchema),
  getTenantFeaturesSummary: validateParams(TenantIdParamSchema),
  activateFeature: validateBody(ActivateFeatureBodySchema),
  deactivateFeature: validateBody(DeactivateFeatureBodySchema),
  getUsageStats: [
    validateParams(FeatureCodeUsageParamSchema),
    validateQuery(GetUsageStatsQuerySchema),
  ],
  testFeatureAccess: validateParams(FeatureCodeUsageParamSchema),
};
