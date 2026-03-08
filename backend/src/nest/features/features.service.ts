/**
 * Features Service (Native NestJS)
 *
 * Business logic for feature management.
 * Uses DatabaseService directly - NO Express delegation.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';

/**
 * Feature category type
 */
type FeatureCategoryType = 'basic' | 'core' | 'premium' | 'enterprise';

/**
 * Feature status type
 */
type FeatureStatus = 'active' | 'trial' | 'disabled' | 'expired';

/**
 * Database row for features table
 */
interface DbFeatureRow {
  id: number;
  code: string;
  name: string;
  description: string | null;
  category: FeatureCategoryType;
  base_price: string | number | null;
  is_active: number | boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Database row for tenant_features join query
 */
interface DbTenantFeatureRow {
  id: number;
  tenant_id: number;
  feature_id: number;
  feature_code: string;
  feature_name: string;
  category: FeatureCategoryType;
  default_price: string | number | null;
  is_active: number | boolean;
  activated_at: Date | null;
  expires_at: Date | null;
  activated_by: number | null;
  custom_config: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Database row for features with tenant status
 */
interface DbFeatureWithTenantStatusRow extends DbFeatureRow {
  tf_is_active: number | boolean | null;
  activated_at: Date | null;
  expires_at: Date | null;
  status: string;
}

/**
 * Database row for feature usage stats
 */
interface DbFeatureUsageStatsRow {
  date: Date;
  usage_count: number;
  unique_users: number;
}

/**
 * Database row for tenants
 */
interface DbTenantRow {
  id: number;
  subdomain: string;
  company_name: string;
  status: string;
}

/**
 * API Feature type
 */
export interface Feature {
  id: number;
  code: string;
  name: string;
  description?: string;
  category: FeatureCategoryType;
  price?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * API TenantFeature type
 */
export interface TenantFeature {
  id: number;
  tenantId: number;
  featureId: number;
  featureCode: string;
  featureName: string;
  status: FeatureStatus;
  isActive: boolean;
  validFrom?: string;
  validUntil?: string;
  activatedBy?: number;
  activatedAt?: string;
  customConfig?: Record<string, unknown>;
}

/**
 * Feature with tenant info
 */
export interface FeatureWithTenantInfo extends Feature {
  tenantFeature?: {
    status: string;
    isActive: boolean;
    validFrom?: string;
    validUntil?: string;
  };
}

/**
 * Feature activation request
 */
export interface FeatureActivationRequest {
  tenantId: number;
  featureCode: string;
  options?:
    | {
        expiresAt?: string | undefined;
        customConfig?: Record<string, unknown> | undefined;
      }
    | undefined;
}

/**
 * Feature usage stats
 */
export interface FeatureUsageStats {
  date: string;
  featureCode: string;
  usageCount: number;
  uniqueUsers: number;
}

/**
 * Feature category grouping
 */
export interface FeatureCategory {
  category: string;
  features: Feature[];
}

/**
 * Tenant features summary
 */
export interface TenantFeaturesSummary {
  tenantId: number;
  activeFeatures: number;
  trialFeatures: number;
  disabledFeatures: number;
  totalCost: number;
  features: TenantFeature[];
}

/**
 * Tenant with features
 */
export interface TenantWithFeatures {
  id: number;
  subdomain: string;
  companyName: string;
  status: string;
  featuresummary: {
    activeFeatures: number;
    trialFeatures: number;
    disabledFeatures: number;
    totalCost: number;
  };
}

@Injectable()
export class FeaturesService {
  private readonly logger = new Logger(FeaturesService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Map database row to API Feature
   */
  private mapDbFeatureToApi(row: DbFeatureRow): Feature {
    const feature: Feature = {
      id: row.id,
      code: row.code,
      name: row.name,
      category: row.category,
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };

    if (row.description !== null) {
      feature.description = row.description;
    }

    if (row.base_price !== null) {
      feature.price = Number.parseFloat(String(row.base_price));
    }

    return feature;
  }

  /**
   * Parse custom config JSON safely
   */
  private parseCustomConfig(
    config: unknown,
  ): Record<string, unknown> | undefined {
    if (config === null || typeof config !== 'string') {
      return undefined;
    }
    try {
      return JSON.parse(config) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  /**
   * Map tenant feature row to API type with status calculation
   */
  private mapTenantFeatureRow(row: DbTenantFeatureRow): TenantFeature {
    const isActive = Boolean(row.is_active);
    let status: FeatureStatus = 'disabled';

    if (isActive) {
      const isExpired =
        row.expires_at !== null && new Date(row.expires_at) < new Date();
      status = isExpired ? 'expired' : 'active';
    }

    const tenantFeature: TenantFeature = {
      id: row.id,
      tenantId: row.tenant_id,
      featureId: row.feature_id,
      featureCode: row.feature_code,
      featureName: row.feature_name,
      status,
      isActive,
    };

    if (row.activated_at !== null) {
      tenantFeature.validFrom = new Date(row.activated_at).toISOString();
      tenantFeature.activatedAt = new Date(row.activated_at).toISOString();
    }

    if (row.expires_at !== null) {
      tenantFeature.validUntil = new Date(row.expires_at).toISOString();
    }

    if (row.activated_by !== null) {
      tenantFeature.activatedBy = row.activated_by;
    }

    const customConfig = this.parseCustomConfig(row.custom_config);
    if (customConfig !== undefined) {
      tenantFeature.customConfig = customConfig;
    }

    return tenantFeature;
  }

  /**
   * Map feature with tenant status row
   */
  private mapFeatureWithTenantStatusRow(
    row: DbFeatureWithTenantStatusRow,
  ): FeatureWithTenantInfo {
    const feature = this.mapDbFeatureToApi(row);

    const result: FeatureWithTenantInfo = { ...feature };

    if (row.tf_is_active !== null) {
      result.tenantFeature = {
        status: row.status,
        isActive: Boolean(row.tf_is_active),
      };

      if (row.activated_at !== null) {
        result.tenantFeature.validFrom = new Date(
          row.activated_at,
        ).toISOString();
      }

      if (row.expires_at !== null) {
        result.tenantFeature.validUntil = new Date(
          row.expires_at,
        ).toISOString();
      }
    }

    return result;
  }

  /**
   * Get all available features
   */
  async getAllFeatures(includeInactive: boolean = false): Promise<Feature[]> {
    this.logger.debug(
      `Getting all features (includeInactive: ${includeInactive})`,
    );

    const whereClause =
      includeInactive ? '' : `WHERE is_active = ${IS_ACTIVE.ACTIVE}`;
    const rows = await this.db.query<DbFeatureRow>(
      `SELECT * FROM features ${whereClause} ORDER BY category, sort_order, name`,
    );

    return rows.map((row: DbFeatureRow) => this.mapDbFeatureToApi(row));
  }

  /**
   * Get features grouped by category
   */
  async getFeaturesByCategory(
    includeInactive: boolean = false,
  ): Promise<FeatureCategory[]> {
    this.logger.debug('Getting features by category');

    const features = await this.getAllFeatures(includeInactive);

    return features.reduce<FeatureCategory[]>(
      (acc: FeatureCategory[], feature: Feature) => {
        const category = acc.find(
          (c: FeatureCategory) => c.category === feature.category,
        );
        if (category !== undefined) {
          category.features.push(feature);
        } else {
          acc.push({
            category: feature.category,
            features: [feature],
          });
        }
        return acc;
      },
      [],
    );
  }

  /**
   * Get single feature by code
   */
  async getFeatureByCode(code: string): Promise<Feature | null> {
    this.logger.debug(`Getting feature by code: ${code}`);

    const row = await this.db.queryOne<DbFeatureRow>(
      'SELECT * FROM features WHERE code = $1',
      [code],
    );

    if (row === null) {
      return null;
    }

    return this.mapDbFeatureToApi(row);
  }

  /**
   * Get tenant features
   */
  async getTenantFeatures(tenantId: number): Promise<TenantFeature[]> {
    this.logger.debug(`Getting tenant features for tenant ${tenantId}`);

    const rows = await this.db.query<DbTenantFeatureRow>(
      `
      SELECT
        tf.*,
        f.code as feature_code,
        f.name as feature_name,
        f.category,
        f.base_price as default_price
      FROM tenant_features tf
      JOIN features f ON tf.feature_id = f.id
      WHERE tf.tenant_id = $1
      ORDER BY f.category, f.name
      `,
      [tenantId],
    );

    return rows.map((row: DbTenantFeatureRow) => this.mapTenantFeatureRow(row));
  }

  /**
   * Get all features with tenant-specific info
   */
  async getFeaturesWithTenantInfo(
    tenantId: number,
  ): Promise<FeatureWithTenantInfo[]> {
    this.logger.debug(
      `Getting features with tenant info for tenant ${tenantId}`,
    );

    const rows = await this.db.query<DbFeatureWithTenantStatusRow>(
      `
      SELECT
        f.*,
        tf.is_active as tf_is_active,
        tf.activated_at,
        tf.expires_at,
        CASE
          WHEN tf.is_active = ${IS_ACTIVE.ACTIVE} AND (tf.expires_at IS NULL OR tf.expires_at >= NOW()) THEN 'active'
          WHEN tf.is_active = ${IS_ACTIVE.ACTIVE} AND tf.expires_at < NOW() THEN 'expired'
          WHEN tf.is_active = ${IS_ACTIVE.INACTIVE} THEN 'disabled'
          ELSE 'not_activated'
        END as status
      FROM features f
      LEFT JOIN tenant_features tf ON f.id = tf.feature_id AND tf.tenant_id = $1
      WHERE f.is_active = ${IS_ACTIVE.ACTIVE}
      ORDER BY f.category, f.sort_order, f.name
      `,
      [tenantId],
    );

    return rows.map((row: DbFeatureWithTenantStatusRow) =>
      this.mapFeatureWithTenantStatusRow(row),
    );
  }

  /**
   * Get tenant features summary
   */
  async getTenantFeaturesSummary(
    tenantId: number,
  ): Promise<TenantFeaturesSummary> {
    this.logger.debug(`Getting tenant features summary for tenant ${tenantId}`);

    const features = await this.getTenantFeatures(tenantId);

    const summary: TenantFeaturesSummary = {
      tenantId,
      activeFeatures: 0,
      trialFeatures: 0,
      disabledFeatures: 0,
      totalCost: 0,
      features,
    };

    for (const feature of features) {
      switch (feature.status) {
        case 'active':
          summary.activeFeatures++;
          break;
        case 'trial':
          summary.trialFeatures++;
          break;
        case 'disabled':
        case 'expired':
          summary.disabledFeatures++;
          break;
      }
    }

    return summary;
  }

  /**
   * Activate feature for tenant
   */
  async activateFeature(
    request: FeatureActivationRequest,
    activatedBy: number,
  ): Promise<void> {
    this.logger.log(
      `Activating feature ${request.featureCode} for tenant ${request.tenantId}`,
    );

    const feature = await this.getFeatureByCode(request.featureCode);
    if (feature === null) {
      throw new NotFoundException(`Feature ${request.featureCode} not found`);
    }

    const customConfig =
      request.options?.customConfig !== undefined ?
        JSON.stringify(request.options.customConfig)
      : null;

    const expiresAt = request.options?.expiresAt ?? null;

    // Check if tenant already has this feature
    const existing = await this.db.queryOne<{ id: number }>(
      'SELECT id FROM tenant_features WHERE tenant_id = $1 AND feature_id = $2',
      [request.tenantId, feature.id],
    );

    if (existing !== null) {
      // Update existing
      await this.db.query(
        `UPDATE tenant_features SET is_active = ${IS_ACTIVE.ACTIVE}, activated_at = NOW(), expires_at = $1,
         activated_by = $2, custom_config = $3, updated_at = NOW()
         WHERE tenant_id = $4 AND feature_id = $5`,
        [expiresAt, activatedBy, customConfig, request.tenantId, feature.id],
      );
    } else {
      // Insert new
      await this.db.query(
        `INSERT INTO tenant_features (tenant_id, feature_id, is_active, activated_at, expires_at,
         activated_by, custom_config, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), $4, $5, $6, NOW(), NOW())`,
        [
          request.tenantId,
          feature.id,
          true,
          expiresAt,
          activatedBy,
          customConfig,
        ],
      );
    }

    this.logger.log(
      `Feature ${request.featureCode} activated for tenant ${request.tenantId}`,
    );
  }

  /**
   * Deactivate feature for tenant
   */
  async deactivateFeature(
    tenantId: number,
    featureCode: string,
    _deactivatedBy: number,
  ): Promise<void> {
    this.logger.log(
      `Deactivating feature ${featureCode} for tenant ${tenantId}`,
    );

    const feature = await this.getFeatureByCode(featureCode);
    if (feature === null) {
      throw new NotFoundException(`Feature ${featureCode} not found`);
    }

    const rows = await this.db.query(
      `UPDATE tenant_features
       SET is_active = ${IS_ACTIVE.INACTIVE}, updated_at = NOW()
       WHERE tenant_id = $1 AND feature_id = $2
       RETURNING id`,
      [tenantId, feature.id],
    );

    if (rows.length === 0) {
      throw new NotFoundException(
        `Feature ${featureCode} not found for tenant`,
      );
    }

    // Reset all user permissions for this feature to false (Defense in Depth).
    // Prevents "magic restore" of old permissions when feature is re-activated.
    await this.db.query(
      `UPDATE user_feature_permissions
       SET can_read = false, can_write = false, can_delete = false, updated_at = NOW()
       WHERE tenant_id = $1 AND feature_code = $2`,
      [tenantId, featureCode],
    );

    this.logger.log(
      `Feature ${featureCode} deactivated for tenant ${tenantId}, user permissions reset`,
    );
  }

  /**
   * Get feature usage statistics
   */
  async getUsageStats(
    tenantId: number,
    featureCode: string,
    startDate: string,
    endDate: string,
  ): Promise<FeatureUsageStats[]> {
    this.logger.debug(`Getting usage stats for feature ${featureCode}`);

    const feature = await this.getFeatureByCode(featureCode);
    if (feature === null) {
      throw new NotFoundException(`Feature ${featureCode} not found`);
    }

    const rows = await this.db.query<DbFeatureUsageStatsRow>(
      `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as usage_count,
        COUNT(DISTINCT user_id) as unique_users
      FROM feature_usage_logs
      WHERE tenant_id = $1
      AND feature_id = $2
      AND DATE(created_at) BETWEEN $3 AND $4
      GROUP BY DATE(created_at)
      ORDER BY date
      `,
      [tenantId, feature.id, startDate, endDate],
    );

    return rows.map((row: DbFeatureUsageStatsRow) => {
      const dateStr = new Date(row.date).toISOString().split('T')[0];
      return {
        date: dateStr ?? '',
        featureCode,
        usageCount: row.usage_count,
        uniqueUsers: row.unique_users,
      };
    });
  }

  /**
   * Check if tenant has access to feature
   */
  async checkTenantAccess(
    tenantId: number,
    featureCode: string,
  ): Promise<boolean> {
    this.logger.log(`Checking tenant access to feature ${featureCode}`);

    const row = await this.db.queryOne(
      `
      SELECT tf.*
      FROM tenant_features tf
      JOIN features f ON tf.feature_id = f.id
      WHERE tf.tenant_id = $1
      AND f.code = $2
      AND tf.is_active = ${IS_ACTIVE.ACTIVE}
      AND (tf.expires_at IS NULL OR tf.expires_at >= NOW())
      `,
      [tenantId, featureCode],
    );

    return row !== null;
  }

  /**
   * Get all tenants with features (Root only)
   */
  async getAllTenantsWithFeatures(): Promise<TenantWithFeatures[]> {
    this.logger.debug('Getting all tenants with features');

    const tenants = await this.db.query<DbTenantRow>(`
      SELECT id, subdomain, company_name, status
      FROM tenants
      ORDER BY company_name
    `);

    const results: TenantWithFeatures[] = [];

    for (const tenant of tenants) {
      const summary = await this.getTenantFeaturesSummary(tenant.id);
      results.push({
        id: tenant.id,
        subdomain: tenant.subdomain,
        companyName: tenant.company_name,
        status: tenant.status,
        featuresummary: {
          activeFeatures: summary.activeFeatures,
          trialFeatures: summary.trialFeatures,
          disabledFeatures: summary.disabledFeatures,
          totalCost: summary.totalCost,
        },
      });
    }

    return results;
  }
}
