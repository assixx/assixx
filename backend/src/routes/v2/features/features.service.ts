import { ServiceError as ServiceErrorClass } from '../../../utils/ServiceError.js';
import { ResultSetHeader, RowDataPacket, execute, query } from '../../../utils/db.js';
import { fieldMapper } from '../../../utils/fieldMapper.js';
import { logger } from '../../../utils/logger.js';
// eslint-disable-next-line @typescript-eslint/naming-convention
import RootLog from '../logs/logs.service.js';
import {
  ActivationOptions,
  DbFeature,
  DbFeatureUsageStats,
  DbTenantFeature,
  Feature,
  FeatureActivationRequest,
  FeatureCategory,
  FeatureUsageStats,
  FeatureWithTenantInfo,
  TenantFeature,
  TenantFeaturesSummary,
  TenantWithFeatures,
} from './types.js';

/**
 * Features service with static methods
 * DESIGN PATTERN: Service als Klasse mit statischen Methoden für bessere Organisation
 * und Namespace-Gruppierung. Alternative wäre ein Objekt mit Funktionen.
 */
/** Query result interface for features with tenant status */
interface FeatureWithTenantStatusRow extends DbFeature {
  tf_is_active: number | boolean | null;
  activated_at: Date | null;
  expires_at: Date | null;
  status: string;
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class FeaturesService {
  /**
   * Map DbTenantFeature row to TenantFeature with parsed config and status
   */
  private static mapTenantFeatureRow(row: DbTenantFeature, mapped: TenantFeature): TenantFeature {
    // Parse custom_config if it's a string
    if (row.custom_config !== null && typeof row.custom_config === 'string') {
      try {
        mapped.customConfig = JSON.parse(row.custom_config) as Record<string, unknown>;
      } catch {
        mapped.customConfig = {};
      }
    }
    // Set status based on is_active and expires_at
    const isActive = row.is_active === true;
    if (isActive) {
      const isExpired = row.expires_at !== null && new Date(row.expires_at) < new Date();
      mapped.status = isExpired ? 'expired' : 'active';
    } else {
      mapped.status = 'disabled';
    }
    return mapped;
  }

  /**
   * Map a FeatureWithTenantStatusRow to FeatureWithTenantInfo
   */
  private static mapFeatureWithTenantStatusRow(
    row: FeatureWithTenantStatusRow,
  ): FeatureWithTenantInfo {
    const feature = fieldMapper.dbToApi({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      category: row.category,
      base_price: row.base_price,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }) as Feature;

    const result: FeatureWithTenantInfo = {
      id: feature.id,
      code: feature.code,
      name: feature.name,
      category: feature.category,
      isActive: feature.isActive,
      createdAt: feature.createdAt,
      updatedAt: feature.updatedAt,
    };

    if (feature.description !== undefined) result.description = feature.description;
    if (feature.price !== undefined) result.price = feature.price;

    if (row.tf_is_active !== null) {
      result.tenantFeature = { status: row.status, isActive: Boolean(row.tf_is_active) };
      if (row.activated_at !== null) {
        result.tenantFeature.validFrom = new Date(row.activated_at).toISOString();
      }
      if (row.expires_at !== null) {
        result.tenantFeature.validUntil = new Date(row.expires_at).toISOString();
      }
    }

    return result;
  }

  // Get all available features
  /**
   *
   * @param includeInactive - The includeInactive parameter
   */
  // eslint-disable-next-line @typescript-eslint/typedef -- Default parameter with literal value
  static async getAllFeatures(includeInactive = false): Promise<Feature[]> {
    try {
      const whereClause = includeInactive ? '' : 'WHERE is_active = true';
      const [rows] = await query<DbFeature[]>(
        `SELECT * FROM features ${whereClause} ORDER BY category, sort_order, name`,
      );

      return rows.map((row: DbFeature) => {
        const mapped = fieldMapper.dbToApi(row) as Feature;
        // Map base_price to price - only add property if value is defined
        if ('base_price' in row && row.base_price !== null) {
          mapped.price = Number.parseFloat(row.base_price as string);
        }
        return mapped;
      });
    } catch (error: unknown) {
      logger.error(`Error fetching features: ${String(error)}`);
      throw error;
    }
  }

  // Get features grouped by category
  /**
   *
   * @param includeInactive - The includeInactive parameter
   */
  // eslint-disable-next-line @typescript-eslint/typedef -- Default parameter with literal value
  static async getFeaturesByCategory(includeInactive = false): Promise<FeatureCategory[]> {
    try {
      const features = await this.getAllFeatures(includeInactive);

      return features.reduce<FeatureCategory[]>((acc: FeatureCategory[], feature: Feature) => {
        const category = acc.find((c: FeatureCategory) => c.category === feature.category);
        if (category) {
          category.features.push(feature);
        } else {
          acc.push({
            category: feature.category,
            features: [feature],
          });
        }
        return acc;
      }, []);
    } catch (error: unknown) {
      logger.error(`Error fetching features by category: ${String(error)}`);
      throw error;
    }
  }

  // Get single feature by code
  /**
   *
   * @param code - The code parameter
   */
  static async getFeatureByCode(code: string): Promise<Feature | null> {
    try {
      const [rows] = await query<DbFeature[]>('SELECT * FROM features WHERE code = $1', [code]);

      if (rows.length === 0) return null;
      return fieldMapper.dbToApi(rows[0]) as Feature;
    } catch (error: unknown) {
      logger.error(`Error fetching feature by code: ${String(error)}`);
      throw error;
    }
  }

  // Get tenant features
  /**
   *
   * @param tenantId - The tenant ID
   */
  static async getTenantFeatures(tenantId: number): Promise<TenantFeature[]> {
    try {
      const [rows] = await query<DbTenantFeature[]>(
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

      return rows.map((row: DbTenantFeature) =>
        FeaturesService.mapTenantFeatureRow(row, fieldMapper.dbToApi(row) as TenantFeature),
      );
    } catch (error: unknown) {
      logger.error(`Error fetching tenant features: ${String(error)}`);
      throw error;
    }
  }

  // Get all features with tenant-specific info
  /**
   *
   * @param tenantId - The tenant ID
   */
  static async getFeaturesWithTenantInfo(tenantId: number): Promise<FeatureWithTenantInfo[]> {
    try {
      const [rows] = await query<FeatureWithTenantStatusRow[]>(
        `
        SELECT
          f.*,
          tf.is_active as tf_is_active,
          tf.activated_at,
          tf.expires_at,
          CASE
            WHEN tf.is_active = TRUE AND (tf.expires_at IS NULL OR tf.expires_at >= NOW()) THEN 'active'
            WHEN tf.is_active = TRUE AND tf.expires_at < NOW() THEN 'expired'
            WHEN tf.is_active = FALSE THEN 'disabled'
            ELSE 'not_activated'
          END as status
        FROM features f
        LEFT JOIN tenant_features tf ON f.id = tf.feature_id AND tf.tenant_id = $1
        WHERE f.is_active = true
        ORDER BY f.category, f.sort_order, f.name
      `,
        [tenantId],
      );

      return rows.map((row: FeatureWithTenantStatusRow) =>
        FeaturesService.mapFeatureWithTenantStatusRow(row),
      );
    } catch (error: unknown) {
      logger.error(`Error fetching features with tenant info: ${String(error)}`);
      throw error;
    }
  }

  /** Update existing tenant feature record */
  private static async updateTenantFeature(
    tenantId: number,
    featureId: number,
    options: ActivationOptions,
  ): Promise<void> {
    const customConfig =
      options.customConfig !== undefined ? JSON.stringify(options.customConfig) : null;
    await execute(
      `UPDATE tenant_features SET is_active = true, activated_at = NOW(), expires_at = $1,
       activated_by = $1, custom_config = $2, updated_at = NOW()
       WHERE tenant_id = $3 AND feature_id = $2`,
      [options.expiresAt ?? null, options.activatedBy, customConfig, tenantId, featureId],
    );
  }

  /** Insert new tenant feature record */
  private static async insertTenantFeature(
    tenantId: number,
    featureId: number,
    options: ActivationOptions,
  ): Promise<void> {
    const customConfig =
      options.customConfig !== undefined ? JSON.stringify(options.customConfig) : null;
    await execute(
      `INSERT INTO tenant_features (tenant_id, feature_id, is_active, activated_at, expires_at,
       activated_by, custom_config, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), $4, $5, $6, NOW(), NOW())`,
      [tenantId, featureId, true, options.expiresAt ?? null, options.activatedBy, customConfig],
    );
  }

  // Activate feature for tenant
  /**
   * @param request - The request parameter
   * @param activatedBy - The activatedBy parameter
   */
  static async activateFeature(
    request: FeatureActivationRequest,
    activatedBy: number,
  ): Promise<void> {
    try {
      const feature = await this.getFeatureByCode(request.featureCode);
      if (!feature) {
        throw new ServiceErrorClass('NOT_FOUND', `Feature ${request.featureCode} not found`);
      }

      const options: ActivationOptions = { ...request.options, activatedBy };

      const [existing] = await query<RowDataPacket[]>(
        'SELECT id FROM tenant_features WHERE tenant_id = $1 AND feature_id = $2',
        [request.tenantId, feature.id],
      );

      if (existing.length > 0) {
        await FeaturesService.updateTenantFeature(request.tenantId, feature.id, options);
      } else {
        await FeaturesService.insertTenantFeature(request.tenantId, feature.id, options);
      }

      await RootLog.log(
        'feature_activated',
        activatedBy,
        request.tenantId,
        JSON.stringify({ featureCode: request.featureCode, options }),
      );

      logger.info(`Feature ${request.featureCode} activated for tenant ${request.tenantId}`);
    } catch (error: unknown) {
      logger.error(`Error activating feature: ${String(error)}`);
      throw error;
    }
  }

  // Deactivate feature for tenant
  /**
   *
   * @param tenantId - The tenant ID
   * @param featureCode - The featureCode parameter
   * @param deactivatedBy - The deactivatedBy parameter
   */
  static async deactivateFeature(
    tenantId: number,
    featureCode: string,
    deactivatedBy: number,
  ): Promise<void> {
    try {
      // Get feature by code
      const feature = await this.getFeatureByCode(featureCode);
      if (!feature) {
        throw new ServiceErrorClass('NOT_FOUND', `Feature ${featureCode} not found`);
      }

      const [result] = await execute<ResultSetHeader>(
        `
        UPDATE tenant_features
        SET is_active = false, updated_at = NOW()
        WHERE tenant_id = $1 AND feature_id = $2
      `,
        [tenantId, feature.id],
      );

      if (result.affectedRows === 0) {
        throw new ServiceErrorClass('NOT_FOUND', `Feature ${featureCode} not found for tenant`);
      }

      // Log the deactivation
      await RootLog.log(
        'feature_deactivated',
        deactivatedBy,
        tenantId,
        JSON.stringify({ featureCode }),
      );

      logger.info(`Feature ${featureCode} deactivated for tenant ${tenantId}`);
    } catch (error: unknown) {
      logger.error(`Error deactivating feature: ${String(error)}`);
      throw error;
    }
  }

  // Get feature usage statistics
  /**
   *
   * @param tenantId - The tenant ID
   * @param featureCode - The featureCode parameter
   * @param startDate - The startDate parameter
   * @param endDate - The endDate parameter
   */
  static async getUsageStats(
    tenantId: number,
    featureCode: string,
    startDate: string,
    endDate: string,
  ): Promise<FeatureUsageStats[]> {
    try {
      // Get feature by code
      const feature = await this.getFeatureByCode(featureCode);
      if (!feature) {
        throw new ServiceErrorClass('NOT_FOUND', `Feature ${featureCode} not found`);
      }

      const [rows] = await query<DbFeatureUsageStats[]>(
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

      return rows.map((row: DbFeatureUsageStats): FeatureUsageStats => {
        const dateStr = new Date(row.date).toISOString().split('T')[0];
        // dateStr is guaranteed to be a string (non-undefined) from toISOString().split()
        if (dateStr === undefined) {
          throw new Error('Date conversion failed for usage stats');
        }
        return {
          date: dateStr,
          featureCode,
          usageCount: row.usage_count,
          uniqueUsers: row.unique_users,
        };
      });
    } catch (error: unknown) {
      logger.error(`Error fetching usage stats: ${String(error)}`);
      throw error;
    }
  }

  // Get tenant features summary
  /**
   *
   * @param tenantId - The tenant ID
   */
  static async getTenantFeaturesSummary(tenantId: number): Promise<TenantFeaturesSummary> {
    try {
      const features = await this.getTenantFeatures(tenantId);

      const summary: TenantFeaturesSummary = {
        tenantId,
        activeFeatures: 0,
        trialFeatures: 0,
        disabledFeatures: 0,
        totalCost: 0,
        features,
      };

      features.forEach((feature: TenantFeature) => {
        switch (feature.status) {
          case 'active':
            summary.activeFeatures++;
            // Note: customPrice would be added here if it existed in DB
            break;
          case 'trial':
            summary.trialFeatures++;
            break;
          case 'disabled':
          case 'expired':
            summary.disabledFeatures++;
            break;
        }
      });

      return summary;
    } catch (error: unknown) {
      logger.error(`Error fetching tenant features summary: ${String(error)}`);
      throw error;
    }
  }

  // Check if tenant has access to feature
  /**
   *
   * @param tenantId - The tenant ID
   * @param featureCode - The featureCode parameter
   */
  static async checkTenantAccess(tenantId: number, featureCode: string): Promise<boolean> {
    try {
      const [rows] = await query<RowDataPacket[]>(
        `
        SELECT tf.*
        FROM tenant_features tf
        JOIN features f ON tf.feature_id = f.id
        WHERE tf.tenant_id = $1
        AND f.code = $2
        AND tf.is_active = true
        AND (tf.expires_at IS NULL OR tf.expires_at >= NOW())
      `,
        [tenantId, featureCode],
      );

      return rows.length > 0;
    } catch (error: unknown) {
      logger.error(`Error checking tenant feature access: ${String(error)}`);
      return false;
    }
  }

  // Log feature usage
  /**
   *
   * @param tenantId - The tenant ID
   * @param featureCode - The featureCode parameter
   * @param userId - The user ID
   * @param metadata - The metadata parameter
   */
  static async logUsage(
    tenantId: number,
    featureCode: string,
    userId: number | null = null,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      const feature = await this.getFeatureByCode(featureCode);
      if (!feature) {
        logger.warn(`Trying to log usage for non-existent feature: ${featureCode}`);
        return;
      }

      // Log usage
      await execute(
        `
        INSERT INTO feature_usage_logs (tenant_id, feature_id, user_id, action, metadata)
        VALUES ($1, $2, $3, $4, $5)
      `,
        [tenantId, feature.id, userId ?? 0, 'usage', JSON.stringify(metadata)],
      );

      // Note: current_usage tracking would go here if the column existed
    } catch (error: unknown) {
      logger.error(`Error logging feature usage: ${String(error)}`);
      // Don't throw - we don't want to break the app if usage logging fails
    }
  }

  // Get all tenants with features (Root only)
  /**
   *
   */
  static async getAllTenantsWithFeatures(): Promise<TenantWithFeatures[]> {
    try {
      interface TenantRow extends RowDataPacket {
        id: number;
        subdomain: string;
        company_name: string;
        status: string;
      }

      const [tenants] = await query<TenantRow[]>(`
        SELECT id, subdomain, company_name, status
        FROM tenants
        ORDER BY company_name
      `);

      // Get features for each tenant
      return await Promise.all(
        tenants.map(async (tenant: TenantRow) => {
          const summary = await this.getTenantFeaturesSummary(tenant.id);
          return {
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
          };
        }),
      );
    } catch (error: unknown) {
      logger.error(`Error fetching all tenants with features: ${String(error)}`);
      throw error;
    }
  }
}
