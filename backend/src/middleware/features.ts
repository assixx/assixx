import { Request, Response, NextFunction } from 'express';
import Feature from '../models/feature.js';
import { logger } from '../utils/logger.js';
import { query, RowDataPacket } from '../utils/db.js';
import { AuthenticatedRequest } from '../types/request.types.js';

export interface FeatureCheckOptions {
  sendUpgradeHint?: boolean;
  customErrorMessage?: string;
}

// Type guard to check if request is authenticated
function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return 'user' in req && req.user != null;
}

// Middleware um zu prüfen ob ein Tenant ein bestimmtes Feature hat
export const checkFeature =
  (featureCode: string, options: FeatureCheckOptions = {}) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Tenant ID aus Request holen
      // Priorität: req.tenantId (von tenant middleware) > req.user.tenant_id (von JWT)
      let numericTenantId: number;

      // Check if request is authenticated
      if (!isAuthenticated(req)) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Debug logging
      logger.info(
        `[Feature Check Debug] Checking feature '${featureCode}' - req.tenantId: ${req.tenantId}, req.user: ${JSON.stringify(req.user ? { id: req.user.id, tenant_id: req.user.tenant_id } : null)}`
      );

      if (req.tenantId) {
        // Check if tenantId is already numeric (from auth middleware)
        if (typeof req.tenantId === 'number' || !isNaN(Number(req.tenantId))) {
          numericTenantId = Number(req.tenantId);
        } else {
          // Otherwise it's a subdomain, look it up
          // Use database query
          const [tenantRows] = await query<RowDataPacket[]>(
            'SELECT id FROM tenants WHERE subdomain = ?',
            [req.tenantId]
          );

          if (tenantRows.length === 0) {
            return res.status(404).json({
              error: 'Tenant nicht gefunden',
              upgrade_required: true,
            });
          }

          numericTenantId = tenantRows[0].id;
        }
      } else if (req.user && req.user.tenant_id) {
        // Fallback: Verwende tenant_id aus JWT Token
        numericTenantId = req.user.tenant_id;
      } else {
        return res.status(400).json({
          error: 'Keine Tenant-ID gefunden',
        });
      }

      logger.info(
        `Checking feature '${featureCode}' for tenant ID: ${numericTenantId}`
      );

      // Prüfe ob Feature aktiv ist
      const hasFeature = await Feature.checkTenantAccess(
        numericTenantId,
        featureCode
      );

      if (!hasFeature) {
        const errorMessage =
          options.customErrorMessage ||
          `Diese Funktion (${featureCode}) ist für Ihren Tarif nicht verfügbar.`;

        logger.warn(
          `Feature '${featureCode}' not available for tenant ${numericTenantId}`
        );

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

        return res.status(403).json(response);
      }

      logger.info(
        `Feature '${featureCode}' is active for tenant ${numericTenantId}`
      );
      return next();
    } catch (error) {
      logger.error(`Error checking feature '${featureCode}':`, error);
      return res.status(500).json({
        error: 'Fehler bei der Feature-Überprüfung',
      });
    }
  };

// Middleware um mehrere Features gleichzeitig zu prüfen (mindestens eines muss aktiv sein)
export const checkAnyFeature =
  (featureCodes: string[], options: FeatureCheckOptions = {}) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      let numericTenantId: number;

      if (req.tenantId) {
        // Check if tenantId is already numeric (from auth middleware)
        if (typeof req.tenantId === 'number' || !isNaN(Number(req.tenantId))) {
          numericTenantId = Number(req.tenantId);
        } else {
          // Otherwise it's a subdomain, look it up
          // Use database query
          const [tenantRows] = await query<RowDataPacket[]>(
            'SELECT id FROM tenants WHERE subdomain = ?',
            [req.tenantId]
          );

          if (tenantRows.length === 0) {
            return res.status(404).json({
              error: 'Tenant nicht gefunden',
              upgrade_required: true,
            });
          }

          numericTenantId = tenantRows[0].id;
        }
      } else if (req.user && req.user.tenant_id) {
        numericTenantId = req.user.tenant_id;
      } else {
        return res.status(400).json({
          error: 'Keine Tenant-ID gefunden',
        });
      }

      // Prüfe jedes Feature
      for (const featureCode of featureCodes) {
        const hasFeature = await Feature.checkTenantAccess(
          numericTenantId,
          featureCode
        );
        if (hasFeature) {
          logger.info(
            `At least one feature (${featureCode}) is active for tenant ${numericTenantId}`
          );
          return next();
        }
      }

      // Keine der Features ist aktiv
      const errorMessage =
        options.customErrorMessage ||
        `Keine der erforderlichen Funktionen (${featureCodes.join(
          ', '
        )}) ist für Ihren Tarif verfügbar.`;

      logger.warn(
        `None of the features [${featureCodes.join(
          ', '
        )}] are available for tenant ${numericTenantId}`
      );

      return res.status(403).json({
        error: errorMessage,
        features_required: featureCodes,
        upgrade_required: options.sendUpgradeHint !== false,
      });
    } catch (error) {
      logger.error('Error checking features:', error);
      return res.status(500).json({
        error: 'Fehler bei der Feature-Überprüfung',
      });
    }
  };

// Middleware um alle Features zu prüfen (alle müssen aktiv sein)
export const checkAllFeatures =
  (featureCodes: string[], options: FeatureCheckOptions = {}) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      let numericTenantId: number;

      if (req.tenantId) {
        // Check if tenantId is already numeric (from auth middleware)
        if (typeof req.tenantId === 'number' || !isNaN(Number(req.tenantId))) {
          numericTenantId = Number(req.tenantId);
        } else {
          // Otherwise it's a subdomain, look it up
          // Use database query
          const [tenantRows] = await query<RowDataPacket[]>(
            'SELECT id FROM tenants WHERE subdomain = ?',
            [req.tenantId]
          );

          if (tenantRows.length === 0) {
            return res.status(404).json({
              error: 'Tenant nicht gefunden',
              upgrade_required: true,
            });
          }

          numericTenantId = tenantRows[0].id;
        }
      } else if (req.user && req.user.tenant_id) {
        numericTenantId = req.user.tenant_id;
      } else {
        return res.status(400).json({
          error: 'Keine Tenant-ID gefunden',
        });
      }

      // Prüfe jedes Feature
      const missingFeatures: string[] = [];
      for (const featureCode of featureCodes) {
        const hasFeature = await Feature.checkTenantAccess(
          numericTenantId,
          featureCode
        );
        if (!hasFeature) {
          missingFeatures.push(featureCode);
        }
      }

      if (missingFeatures.length > 0) {
        const errorMessage =
          options.customErrorMessage ||
          `Die folgenden Funktionen sind für Ihren Tarif nicht verfügbar: ${missingFeatures.join(
            ', '
          )}`;

        logger.warn(
          `Features [${missingFeatures.join(
            ', '
          )}] are not available for tenant ${numericTenantId}`
        );

        return res.status(403).json({
          error: errorMessage,
          features_required: featureCodes,
          features_missing: missingFeatures,
          upgrade_required: options.sendUpgradeHint !== false,
        });
      }

      logger.info(
        `All features [${featureCodes.join(
          ', '
        )}] are active for tenant ${numericTenantId}`
      );
      return next();
    } catch (error) {
      logger.error('Error checking all features:', error);
      return res.status(500).json({
        error: 'Fehler bei der Feature-Überprüfung',
      });
    }
  };

export default {
  checkFeature,
  checkAnyFeature,
  checkAllFeatures,
};
