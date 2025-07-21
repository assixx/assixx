import { query as executeQuery, RowDataPacket } from "../utils/db";
import { logger } from "../utils/logger";

// Database interfaces
interface DbFeature extends RowDataPacket {
  id: number;
  code: string;
  name: string;
  description?: string;
  category: string;
  price?: number;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface DbTenantFeature extends RowDataPacket {
  id?: number;
  tenant_id: number;
  feature_id: number;
  status: "active" | "trial" | "disabled";
  valid_from?: Date;
  valid_until?: Date | null;
  custom_price?: number | null;
  trial_days?: number;
  usage_limit?: number | null;
  current_usage?: number;
  activated_by?: number | null;
  // Extended fields from joins
  code?: string;
  name?: string;
  is_available?: number;
}

interface FeatureActivationOptions {
  activatedBy?: number | null;
  expiresAt?: Date | string | null;
  config?: Record<string, unknown>;
}

interface FeatureUsageStat extends RowDataPacket {
  date: Date;
  usage_count: number;
  unique_users: number;
}

export class Feature {
  // Alle Features abrufen
  static async findAll(): Promise<DbFeature[]> {
    try {
      const [features] = await executeQuery<DbFeature[]>(
        "SELECT * FROM features WHERE is_active = true ORDER BY category, name",
      );
      return features;
    } catch (error) {
      logger.error(`Error fetching features: ${(error as Error).message}`);
      throw error;
    }
  }

  // Feature by Code finden
  static async findByCode(code: string): Promise<DbFeature | undefined> {
    try {
      const [features] = await executeQuery<DbFeature[]>(
        "SELECT * FROM features WHERE code = ?",
        [code],
      );
      return features[0];
    } catch (error) {
      logger.error(
        `Error finding feature by code: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // Prüfen ob Tenant ein Feature hat
  static async checkTenantAccess(
    tenant_id: number,
    featureCode: string,
  ): Promise<boolean> {
    try {
      const query = `
        SELECT tf.*, f.code, f.name 
        FROM tenant_features tf
        JOIN features f ON tf.feature_id = f.id
        WHERE tf.tenant_id = ? 
        AND f.code = ?
        AND tf.is_active = 1
        AND (tf.expires_at IS NULL OR tf.expires_at >= NOW())
      `;

      const [results] = await executeQuery<DbTenantFeature[]>(query, [
        tenant_id,
        featureCode,
      ]);

      if (results.length === 0) {
        return false;
      }

      const feature = results[0];

      // Prüfe Usage-Limit wenn vorhanden
      if (
        feature.usage_limit !== null &&
        feature.usage_limit !== undefined &&
        feature.current_usage !== undefined &&
        feature.current_usage >= feature.usage_limit
      ) {
        logger.warn(
          `Feature ${featureCode} usage limit reached for tenant ${tenant_id}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      logger.error(
        `Error checking tenant feature access: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // Feature für Tenant aktivieren
  static async activateForTenant(
    tenant_id: number,
    featureCode: string,
    options: FeatureActivationOptions = {},
  ): Promise<boolean> {
    try {
      const feature = await this.findByCode(featureCode);
      if (!feature) {
        throw new Error(`Feature ${featureCode} not found`);
      }

      const { activatedBy = null, expiresAt = null, config = null } = options;

      const query = `
        INSERT INTO tenant_features 
        (tenant_id, feature_id, is_active, activated_by, expires_at, custom_config)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        is_active = VALUES(is_active),
        activated_by = VALUES(activated_by),
        expires_at = VALUES(expires_at),
        custom_config = VALUES(custom_config),
        updated_at = CURRENT_TIMESTAMP
      `;

      await executeQuery(query, [
        tenant_id,
        feature.id,
        true, // is_active
        activatedBy,
        expiresAt,
        config ? JSON.stringify(config) : null,
      ]);

      logger.info(`Feature ${featureCode} activated for tenant ${tenant_id}`);
      return true;
    } catch (error) {
      logger.error(
        `Error activating feature for tenant: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // Feature für Tenant deaktivieren
  static async deactivateForTenant(
    tenant_id: number,
    featureCode: string,
  ): Promise<boolean> {
    try {
      const feature = await this.findByCode(featureCode);
      if (!feature) {
        throw new Error(`Feature ${featureCode} not found`);
      }

      const query = `
        UPDATE tenant_features 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = ? AND feature_id = ?
      `;

      await executeQuery(query, [tenant_id, feature.id]);
      logger.info(`Feature ${featureCode} deactivated for tenant ${tenant_id}`);
      return true;
    } catch (error) {
      logger.error(
        `Error deactivating feature for tenant: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // Feature-Nutzung protokollieren
  static async logUsage(
    tenant_id: number,
    featureCode: string,
    userId: number | null = null,
    metadata: Record<string, unknown> = {},
  ): Promise<boolean> {
    try {
      const feature = await this.findByCode(featureCode);
      if (!feature) {
        throw new Error(`Feature ${featureCode} not found`);
      }

      // Log erstellen
      await executeQuery(
        "INSERT INTO feature_usage_logs (tenant_id, feature_id, user_id, usage_date, metadata) VALUES (?, ?, ?, CURDATE(), ?)",
        [tenant_id, feature.id, userId, JSON.stringify(metadata)],
      );

      // Current usage erhöhen
      await executeQuery(
        "UPDATE tenant_features SET current_usage = current_usage + 1 WHERE tenant_id = ? AND feature_id = ?",
        [tenant_id, feature.id],
      );

      return true;
    } catch (error) {
      logger.error(`Error logging feature usage: ${(error as Error).message}`);
      throw error;
    }
  }

  // Alle Features eines Tenants abrufen
  static async getTenantFeatures(
    tenant_id: number,
  ): Promise<DbTenantFeature[]> {
    try {
      const query = `
        SELECT 
          f.*,
          tf.is_active,
          tf.activated_at,
          tf.expires_at,
          tf.custom_config,
          CASE 
            WHEN tf.is_active = TRUE AND (tf.expires_at IS NULL OR tf.expires_at >= NOW()) THEN 1
            ELSE 0
          END as is_available
        FROM features f
        LEFT JOIN tenant_features tf ON f.id = tf.feature_id AND tf.tenant_id = ?
        WHERE f.is_active = true
        ORDER BY f.category, f.name
      `;

      const [features] = await executeQuery<DbTenantFeature[]>(query, [
        tenant_id,
      ]);
      return features;
    } catch (error) {
      logger.error(
        `Error fetching tenant features: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // Feature-Nutzungsstatistiken abrufen
  static async getUsageStats(
    tenant_id: number,
    featureCode: string,
    startDate: Date | string,
    endDate: Date | string,
  ): Promise<FeatureUsageStat[]> {
    try {
      const feature = await this.findByCode(featureCode);
      if (!feature) {
        throw new Error(`Feature ${featureCode} not found`);
      }

      const query = `
        SELECT 
          DATE(usage_date) as date,
          COUNT(*) as usage_count,
          COUNT(DISTINCT user_id) as unique_users
        FROM feature_usage_logs
        WHERE tenant_id = ? 
        AND feature_id = ?
        AND usage_date BETWEEN ? AND ?
        GROUP BY DATE(usage_date)
        ORDER BY date
      `;

      const [stats] = await executeQuery<FeatureUsageStat[]>(query, [
        tenant_id,
        feature.id,
        startDate,
        endDate,
      ]);
      return stats;
    } catch (error) {
      logger.error(`Error fetching usage stats: ${(error as Error).message}`);
      throw error;
    }
  }

  // Check if a feature is enabled for a specific tenant
  static async isEnabledForTenant(
    featureKey: string,
    tenant_id: number,
  ): Promise<boolean> {
    try {
      // Use the existing checkTenantAccess method which does exactly what we need
      return await this.checkTenantAccess(tenant_id, featureKey);
    } catch (error) {
      logger.error(
        `Error checking if feature ${featureKey} is enabled for tenant ${tenant_id}: ${(error as Error).message}`,
      );
      return false;
    }
  }
}

// Default export for CommonJS compatibility
export default Feature;

// CommonJS compatibility
