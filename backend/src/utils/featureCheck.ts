/**
 * Feature Check Utility
 * Minimal utilities for checking feature access without importing legacy routes/v2
 *
 * Used by emailService and other utilities that need feature checks but can't use NestJS DI.
 */
import { RowDataPacket, query as executeQuery } from './db.js';
import { logger } from './logger.js';

interface DbFeature extends RowDataPacket {
  id: number;
  code: string;
}

/**
 * Check if a tenant has access to a specific feature
 *
 * @param tenantId - Tenant ID to check
 * @param featureCode - Feature code (e.g., 'email_notifications')
 * @returns true if tenant has active access to the feature
 */
async function checkTenantFeatureAccess(
  tenantId: number,
  featureCode: string,
): Promise<boolean> {
  try {
    const query = `
      SELECT tf.id
      FROM tenant_features tf
      JOIN features f ON tf.feature_id = f.id
      WHERE tf.tenant_id = $1
      AND f.code = $2
      AND tf.is_active = 1
      AND (tf.valid_until IS NULL OR tf.valid_until > NOW())
    `;
    const [rows] = await executeQuery<RowDataPacket[]>(query, [
      tenantId,
      featureCode,
    ]);
    return rows.length > 0;
  } catch (error: unknown) {
    logger.error(`Error checking feature access: ${(error as Error).message}`);
    return false;
  }
}

/**
 * Log usage of a feature for a tenant
 *
 * @param tenantId - Tenant ID
 * @param featureCode - Feature code
 * @param userId - User ID (optional)
 * @param metadata - Additional metadata to log
 * @returns true if logged successfully
 */
async function logFeatureUsage(
  tenantId: number,
  featureCode: string,
  userId: number | null = null,
  metadata: Record<string, unknown> = {},
): Promise<boolean> {
  try {
    // Find feature ID
    const [features] = await executeQuery<DbFeature[]>(
      'SELECT id FROM features WHERE code = $1',
      [featureCode],
    );
    const feature = features[0];

    if (feature === undefined) {
      logger.warn(`Feature ${featureCode} not found for logging`);
      return false;
    }

    // Log usage
    await executeQuery(
      'INSERT INTO feature_usage_logs (tenant_id, feature_id, user_id, usage_date, metadata) VALUES ($1, $2, $3, CURRENT_DATE, $4)',
      [tenantId, feature.id, userId, JSON.stringify(metadata)],
    );

    // Increment current usage counter
    await executeQuery(
      'UPDATE tenant_features SET current_usage = current_usage + 1 WHERE tenant_id = $1 AND feature_id = $2',
      [tenantId, feature.id],
    );

    return true;
  } catch (error: unknown) {
    logger.error(`Error logging feature usage: ${(error as Error).message}`);
    return false;
  }
}

/**
 * Feature check object for backward compatibility
 * Provides the same interface as the legacy Feature model
 */
export const FeatureCheck = {
  checkTenantAccess: checkTenantFeatureAccess,
  logUsage: logFeatureUsage,
};

export default FeatureCheck;
