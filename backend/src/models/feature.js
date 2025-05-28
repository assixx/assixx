const db = require('../database');
const { logger } = require('../utils/logger');

class Feature {
  // Alle Features abrufen
  static async findAll() {
    try {
      const [features] = await db.query(
        'SELECT * FROM features WHERE is_active = true ORDER BY category, name'
      );
      return features;
    } catch (error) {
      logger.error(`Error fetching features: ${error.message}`);
      throw error;
    }
  }

  // Feature by Code finden
  static async findByCode(code) {
    try {
      const [features] = await db.query(
        'SELECT * FROM features WHERE code = ?',
        [code]
      );
      return features[0];
    } catch (error) {
      logger.error(`Error finding feature by code: ${error.message}`);
      throw error;
    }
  }

  // Prüfen ob Tenant ein Feature hat
  static async checkTenantAccess(tenantId, featureCode) {
    try {
      const query = `
        SELECT tf.*, f.code, f.name 
        FROM tenant_features tf
        JOIN features f ON tf.feature_id = f.id
        WHERE tf.tenant_id = ? 
        AND f.code = ?
        AND tf.status = 'active'
        AND (tf.valid_until IS NULL OR tf.valid_until >= CURDATE())
      `;

      const [results] = await db.query(query, [tenantId, featureCode]);

      if (results.length === 0) {
        return false;
      }

      const feature = results[0];

      // Prüfe Usage-Limit wenn vorhanden
      if (
        feature.usage_limit !== null &&
        feature.current_usage >= feature.usage_limit
      ) {
        logger.warn(
          `Feature ${featureCode} usage limit reached for tenant ${tenantId}`
        );
        return false;
      }

      return true;
    } catch (error) {
      logger.error(`Error checking tenant feature access: ${error.message}`);
      throw error;
    }
  }

  // Feature für Tenant aktivieren
  static async activateForTenant(tenantId, featureCode, options = {}) {
    try {
      const feature = await this.findByCode(featureCode);
      if (!feature) {
        throw new Error(`Feature ${featureCode} not found`);
      }

      const {
        validFrom = new Date(),
        validUntil = null,
        customPrice = null,
        trialDays = 0,
        usageLimit = null,
        activatedBy = null,
      } = options;

      const status = trialDays > 0 ? 'trial' : 'active';
      const trialEndDate =
        trialDays > 0
          ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
          : null;

      const query = `
        INSERT INTO tenant_features 
        (tenant_id, feature_id, status, valid_from, valid_until, custom_price, trial_days, usage_limit, activated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        valid_from = VALUES(valid_from),
        valid_until = VALUES(valid_until),
        custom_price = VALUES(custom_price),
        trial_days = VALUES(trial_days),
        usage_limit = VALUES(usage_limit),
        activated_by = VALUES(activated_by),
        updated_at = CURRENT_TIMESTAMP
      `;

      await db.query(query, [
        tenantId,
        feature.id,
        status,
        validFrom,
        trialEndDate || validUntil,
        customPrice,
        trialDays,
        usageLimit,
        activatedBy,
      ]);

      logger.info(`Feature ${featureCode} activated for tenant ${tenantId}`);
      return true;
    } catch (error) {
      logger.error(`Error activating feature for tenant: ${error.message}`);
      throw error;
    }
  }

  // Feature für Tenant deaktivieren
  static async deactivateForTenant(tenantId, featureCode) {
    try {
      const feature = await this.findByCode(featureCode);
      if (!feature) {
        throw new Error(`Feature ${featureCode} not found`);
      }

      const query = `
        UPDATE tenant_features 
        SET status = 'disabled', updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = ? AND feature_id = ?
      `;

      await db.query(query, [tenantId, feature.id]);
      logger.info(`Feature ${featureCode} deactivated for tenant ${tenantId}`);
      return true;
    } catch (error) {
      logger.error(`Error deactivating feature for tenant: ${error.message}`);
      throw error;
    }
  }

  // Feature-Nutzung protokollieren
  static async logUsage(tenantId, featureCode, userId = null, metadata = {}) {
    try {
      const feature = await this.findByCode(featureCode);
      if (!feature) {
        throw new Error(`Feature ${featureCode} not found`);
      }

      // Log erstellen
      await db.query(
        'INSERT INTO feature_usage_logs (tenant_id, feature_id, user_id, usage_date, metadata) VALUES (?, ?, ?, CURDATE(), ?)',
        [tenantId, feature.id, userId, JSON.stringify(metadata)]
      );

      // Current usage erhöhen
      await db.query(
        'UPDATE tenant_features SET current_usage = current_usage + 1 WHERE tenant_id = ? AND feature_id = ?',
        [tenantId, feature.id]
      );

      return true;
    } catch (error) {
      logger.error(`Error logging feature usage: ${error.message}`);
      throw error;
    }
  }

  // Alle Features eines Tenants abrufen
  static async getTenantFeatures(tenantId) {
    try {
      const query = `
        SELECT 
          f.*,
          tf.status,
          tf.valid_from,
          tf.valid_until,
          tf.custom_price,
          tf.usage_limit,
          tf.current_usage,
          CASE 
            WHEN tf.status = 'active' AND (tf.valid_until IS NULL OR tf.valid_until >= CURDATE()) THEN 1
            ELSE 0
          END as is_available
        FROM features f
        LEFT JOIN tenant_features tf ON f.id = tf.feature_id AND tf.tenant_id = ?
        WHERE f.is_active = true
        ORDER BY f.category, f.name
      `;

      const [features] = await db.query(query, [tenantId]);
      return features;
    } catch (error) {
      logger.error(`Error fetching tenant features: ${error.message}`);
      throw error;
    }
  }

  // Feature-Nutzungsstatistiken abrufen
  static async getUsageStats(tenantId, featureCode, startDate, endDate) {
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

      const [stats] = await db.query(query, [
        tenantId,
        feature.id,
        startDate,
        endDate,
      ]);
      return stats;
    } catch (error) {
      logger.error(`Error fetching usage stats: ${error.message}`);
      throw error;
    }
  }
}

module.exports = Feature;
