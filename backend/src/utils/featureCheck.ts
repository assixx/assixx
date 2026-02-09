/**
 * Feature Check Utility — DEPRECATED STUB
 *
 * This file exists only for backward compatibility with emailService.ts.
 * The canonical implementation is: nest/feature-check/feature-check.service.ts
 *
 * All methods return safe defaults (false for checks, false for logging).
 * Use FeatureCheckService via NestJS DI for real feature checks.
 *
 * @deprecated Use FeatureCheckService from nest/feature-check/ instead
 */
import { logger } from './logger.js';

function checkTenantFeatureAccess(
  _tenantId: number,
  _featureCode: string,
): Promise<boolean> {
  logger.warn(
    'Legacy FeatureCheck.checkTenantAccess called — use FeatureCheckService instead',
  );
  return Promise.resolve(false);
}

function logFeatureUsage(
  _tenantId: number,
  _featureCode: string,
  _userId: number | null = null,
  _metadata: Record<string, unknown> = {},
): Promise<boolean> {
  logger.warn(
    'Legacy FeatureCheck.logUsage called — use FeatureCheckService instead',
  );
  return Promise.resolve(false);
}

export const FeatureCheck = {
  checkTenantAccess: checkTenantFeatureAccess,
  logUsage: logFeatureUsage,
};

export default FeatureCheck;
