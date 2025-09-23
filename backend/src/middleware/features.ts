import { NextFunction, Request, Response } from 'express';

import featureModel from '../models/feature.js';
import { AuthenticatedRequest } from '../types/request.types.js';
import { RowDataPacket, query } from '../utils/db.js';
import { logger } from '../utils/logger.js';

export interface FeatureCheckOptions {
  sendUpgradeHint?: boolean;
  customErrorMessage?: string;
}

// Type guard to check if request is authenticated
function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return 'user' in req && req.user != null;
}

/**
 * Extract numeric tenant ID from request
 */
async function extractTenantId(
  req: AuthenticatedRequest,
): Promise<{ tenantId: number; error?: { status: number; message: Record<string, unknown> } }> {
  // Use req.tenantId if available
  if (req.tenantId != null) {
    // Already numeric
    if (typeof req.tenantId === 'number') {
      return { tenantId: req.tenantId };
    }

    // Can be converted to number
    const numericId = Number(req.tenantId);
    if (!Number.isNaN(numericId)) {
      return { tenantId: numericId };
    }

    // Must be a subdomain - look it up
    const [tenantRows] = await query<RowDataPacket[]>(
      'SELECT id FROM tenants WHERE subdomain = ?',
      [req.tenantId],
    );

    if (tenantRows.length === 0) {
      return {
        tenantId: 0,
        error: {
          status: 404,
          message: { error: 'Tenant nicht gefunden', upgrade_required: true },
        },
      };
    }

    return { tenantId: tenantRows[0].id as number };
  }

  // Fallback to JWT tenant_id
  if (req.user.tenant_id) {
    return { tenantId: req.user.tenant_id };
  }

  return {
    tenantId: 0,
    error: { status: 400, message: { error: 'Keine Tenant-ID gefunden' } },
  };
}

/**
 * Build error response for missing feature
 */
function buildFeatureErrorResponse(
  featureCode: string,
  options: FeatureCheckOptions,
): { error: string; feature_required: string; upgrade_required?: boolean } {
  const errorMessage =
    options.customErrorMessage ??
    `Diese Funktion (${featureCode}) ist für Ihren Tarif nicht verfügbar.`;

  const response: {
    error: string;
    feature_required: string;
    upgrade_required?: boolean;
  } = {
    error: errorMessage,
    feature_required: featureCode,
  };

  if (options.sendUpgradeHint !== false) {
    response.upgrade_required = true;
  }

  return response;
}

// Middleware um zu prüfen ob ein Tenant ein bestimmtes Feature hat
export const checkFeature =
  (featureCode: string, options: FeatureCheckOptions = {}) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check authentication
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Debug logging
      logger.info(
        `[Feature Check Debug] Checking feature '${featureCode}' - req.tenantId: ${String(req.tenantId)}, req.user: ${JSON.stringify({ id: req.user.id, tenant_id: req.user.tenant_id })}`,
      );

      // Extract tenant ID
      const { tenantId, error } = await extractTenantId(req);
      if (error) {
        res.status(error.status).json(error.message);
        return;
      }

      logger.info(`Checking feature '${featureCode}' for tenant ID: ${tenantId}`);

      // Check feature access
      const hasFeature = await featureModel.checkTenantAccess(tenantId, featureCode);
      if (!hasFeature) {
        logger.warn(`Feature '${featureCode}' not available for tenant ${tenantId}`);
        const response = buildFeatureErrorResponse(featureCode, options);
        res.status(403).json(response);
        return;
      }

      logger.info(`Feature '${featureCode}' is active for tenant ${tenantId}`);
      next();
    } catch (error) {
      logger.error(`Error checking feature '${featureCode}':`, error);
      res.status(500).json({ error: 'Fehler bei der Feature-Überprüfung' });
    }
  };

/**
 * Check if any of the features are active
 */
async function checkAnyFeatureActive(
  featureCodes: string[],
  tenantId: number,
): Promise<string | null> {
  for (const featureCode of featureCodes) {
    const hasFeature = await featureModel.checkTenantAccess(tenantId, featureCode);
    if (hasFeature) {
      return featureCode;
    }
  }
  return null;
}

// Middleware um mehrere Features gleichzeitig zu prüfen (mindestens eines muss aktiv sein)
export const checkAnyFeature =
  (featureCodes: string[], options: FeatureCheckOptions = {}) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract tenant ID
      const { tenantId, error } = await extractTenantId(req);
      if (error) {
        res.status(error.status).json(error.message);
        return;
      }

      // Check if any feature is active
      const activeFeature = await checkAnyFeatureActive(featureCodes, tenantId);
      if (activeFeature) {
        logger.info(`At least one feature (${activeFeature}) is active for tenant ${tenantId}`);
        next();
        return;
      }

      // None of the features are active
      const errorMessage =
        options.customErrorMessage ??
        `Keine der erforderlichen Funktionen (${featureCodes.join(', ')}) ist für Ihren Tarif verfügbar.`;

      logger.warn(
        `None of the features [${featureCodes.join(', ')}] are available for tenant ${tenantId}`,
      );

      res.status(403).json({
        error: errorMessage,
        features_required: featureCodes,
        upgrade_required: options.sendUpgradeHint !== false,
      });
    } catch (error) {
      logger.error('Error checking features:', error);
      res.status(500).json({ error: 'Fehler bei der Feature-Überprüfung' });
    }
  };

/**
 * Check which features are missing
 */
async function checkMissingFeatures(featureCodes: string[], tenantId: number): Promise<string[]> {
  const missingFeatures: string[] = [];
  for (const featureCode of featureCodes) {
    const hasFeature = await featureModel.checkTenantAccess(tenantId, featureCode);
    if (!hasFeature) {
      missingFeatures.push(featureCode);
    }
  }
  return missingFeatures;
}

// Middleware um alle Features zu prüfen (alle müssen aktiv sein)
export const checkAllFeatures =
  (featureCodes: string[], options: FeatureCheckOptions = {}) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract tenant ID
      const { tenantId, error } = await extractTenantId(req);
      if (error) {
        res.status(error.status).json(error.message);
        return;
      }

      // Check which features are missing
      const missingFeatures = await checkMissingFeatures(featureCodes, tenantId);

      if (missingFeatures.length > 0) {
        const errorMessage =
          options.customErrorMessage ??
          `Die folgenden Funktionen sind für Ihren Tarif nicht verfügbar: ${missingFeatures.join(', ')}`;

        logger.warn(
          `Features [${missingFeatures.join(', ')}] are not available for tenant ${tenantId}`,
        );

        res.status(403).json({
          error: errorMessage,
          features_required: featureCodes,
          features_missing: missingFeatures,
          upgrade_required: options.sendUpgradeHint !== false,
        });
        return;
      }

      logger.info(`All features [${featureCodes.join(', ')}] are active for tenant ${tenantId}`);
      next();
    } catch (error) {
      logger.error('Error checking all features:', error);
      res.status(500).json({ error: 'Fehler bei der Feature-Überprüfung' });
    }
  };

export default {
  checkFeature,
  checkAnyFeature,
  checkAllFeatures,
};
