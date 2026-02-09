/**
 * Feature Check Service
 *
 * Checks feature access for tenants and logs feature usage.
 * Replaces legacy utils/featureCheck.ts with proper NestJS DI.
 */
import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';

interface DbFeature {
  id: number;
}

@Injectable()
export class FeatureCheckService {
  private readonly logger = new Logger(FeatureCheckService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Check if a tenant has access to a specific feature
   *
   * @param tenantId - Tenant ID to check
   * @param featureCode - Feature code (e.g., 'email_notifications')
   * @returns true if tenant has active access to the feature
   */
  async checkTenantAccess(
    tenantId: number,
    featureCode: string,
  ): Promise<boolean> {
    try {
      const rows = await this.db.query<DbFeature>(
        `SELECT tf.id
         FROM tenant_features tf
         JOIN features f ON tf.feature_id = f.id
         WHERE tf.tenant_id = $1
         AND f.code = $2
         AND tf.is_active = 1
         AND (tf.valid_until IS NULL OR tf.valid_until > NOW())`,
        [tenantId, featureCode],
      );
      return rows.length > 0;
    } catch (error: unknown) {
      this.logger.error(
        `Error checking feature access: ${(error as Error).message}`,
      );
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
  async logUsage(
    tenantId: number,
    featureCode: string,
    userId: number | null = null,
    metadata: Record<string, unknown> = {},
  ): Promise<boolean> {
    try {
      const features = await this.db.query<DbFeature>(
        'SELECT id FROM features WHERE code = $1',
        [featureCode],
      );
      const feature = features[0];

      if (feature === undefined) {
        this.logger.warn(`Feature ${featureCode} not found for logging`);
        return false;
      }

      await this.db.query(
        'INSERT INTO feature_usage_logs (tenant_id, feature_id, user_id, usage_date, metadata) VALUES ($1, $2, $3, CURRENT_DATE, $4)',
        [tenantId, feature.id, userId, JSON.stringify(metadata)],
      );

      await this.db.query(
        'UPDATE tenant_features SET current_usage = current_usage + 1 WHERE tenant_id = $1 AND feature_id = $2',
        [tenantId, feature.id],
      );

      return true;
    } catch (error: unknown) {
      this.logger.error(
        `Error logging feature usage: ${(error as Error).message}`,
      );
      return false;
    }
  }
}
