/**
 * Features API Routes
 * Handles feature management for multi-tenant system
 */

import express, { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRole } from '../auth';
import { checkFeature } from '../middleware/features';
import { logger } from '../utils/logger';

// Import Feature model and database (now ES modules)
import Feature from '../models/feature';
import db from '../database';

const router: Router = express.Router();

// Extended Request interfaces
interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
  };
  tenantId: number;
}

/* Unused interfaces - kept for future reference
interface TenantFeaturesRequest extends AuthenticatedRequest {
  params: {
    tenantId: string;
  };
}

interface FeatureActivationRequest extends AuthenticatedRequest {
  body: {
    tenantId: number;
    featureCode: string;
    options?: {
      activatedBy?: number;
      config?: any;
      expiresAt?: Date | string;
      [key: string]: any;
    };
  };
}

interface FeatureDeactivationRequest extends AuthenticatedRequest {
  body: {
    tenantId: number;
    featureCode: string;
  };
}

interface FeatureUsageRequest extends AuthenticatedRequest {
  params: {
    featureCode: string;
  };
  query: {
    startDate?: string;
    endDate?: string;
  };
}
*/

// Removed unused interface

// Get all available features (public)
router.get(
  '/available',
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const features = await Feature.findAll();
      res.json(features);
    } catch (error: any) {
      logger.error(`Error fetching available features: ${error.message}`);
      res.status(500).json({ error: 'Fehler beim Abrufen der Features' });
    }
  }
);

// Get features for a specific tenant (authenticated)
router.get(
  '/tenant/:tenantId',
  authenticateToken,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      // Only Root and Admin can view other tenants
      const requestedTenantId = parseInt(req.params.tenantId, 10);
      const userTenantId = req.tenantId;

      if (
        requestedTenantId !== userTenantId &&
        authReq.user.role !== 'root' &&
        authReq.user.role !== 'admin'
      ) {
        res.status(403).json({ error: 'Keine Berechtigung' });
        return;
      }

      const features = await Feature.getTenantFeatures(requestedTenantId);
      res.json(features);
    } catch (error: any) {
      logger.error(`Error fetching tenant features: ${error.message}`);
      res
        .status(500)
        .json({ error: 'Fehler beim Abrufen der Tenant-Features' });
    }
  }
);

// Get my features
router.get(
  '/my-features',
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    try {
      // const authReq = req as AuthenticatedRequest; // Unused
      const features = await Feature.getTenantFeatures(req.tenantId);
      res.json(features);
    } catch (error: any) {
      logger.error(`Error fetching my features: ${error.message}`);
      res.status(500).json({ error: 'Fehler beim Abrufen der Features' });
    }
  }
);

// Activate feature (Root and Admin only)
router.post(
  '/activate',
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      // Only Root and Admin can activate features
      if (authReq.user.role !== 'root' && authReq.user.role !== 'admin') {
        res.status(403).json({ error: 'Keine Berechtigung' });
        return;
      }

      const { tenantId, featureCode, options = {} } = req.body;

      if (!tenantId || !featureCode) {
        res
          .status(400)
          .json({ error: 'Tenant ID und Feature Code sind erforderlich' });
        return;
      }

      // Set activatedBy
      options.activatedBy = authReq.user.id;

      await Feature.activateForTenant(tenantId, featureCode, options);

      logger.info(
        `Feature ${featureCode} activated for tenant ${tenantId} by user ${authReq.user.username}`
      );
      res.json({ message: 'Feature erfolgreich aktiviert' });
    } catch (error: any) {
      logger.error(`Error activating feature: ${error.message}`);
      res.status(500).json({ error: 'Fehler beim Aktivieren des Features' });
    }
  }
);

// Deactivate feature (Root and Admin only)
router.post(
  '/deactivate',
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      if (authReq.user.role !== 'root' && authReq.user.role !== 'admin') {
        res.status(403).json({ error: 'Keine Berechtigung' });
        return;
      }

      const { tenantId, featureCode } = req.body;

      if (!tenantId || !featureCode) {
        res
          .status(400)
          .json({ error: 'Tenant ID und Feature Code sind erforderlich' });
        return;
      }

      await Feature.deactivateForTenant(tenantId, featureCode);

      logger.info(
        `Feature ${featureCode} deactivated for tenant ${tenantId} by user ${authReq.user.username}`
      );
      res.json({ message: 'Feature erfolgreich deaktiviert' });
    } catch (error: any) {
      logger.error(`Error deactivating feature: ${error.message}`);
      res.status(500).json({ error: 'Fehler beim Deaktivieren des Features' });
    }
  }
);

// Get feature usage statistics
router.get(
  '/usage/:featureCode',
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    try {
      // const authReq = req as AuthenticatedRequest; // Unused
      const { featureCode } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res
          .status(400)
          .json({ error: 'Start- und Enddatum sind erforderlich' });
        return;
      }

      const stats = await Feature.getUsageStats(
        req.tenantId,
        featureCode,
        startDate,
        endDate
      );
      res.json(stats);
    } catch (error: any) {
      logger.error(`Error fetching usage stats: ${error.message}`);
      res
        .status(500)
        .json({ error: 'Fehler beim Abrufen der Nutzungsstatistiken' });
    }
  }
);

// Test route to check feature access
router.get(
  '/test/:featureCode',
  authenticateToken as any,
  (req: any, res: any, next: any) =>
    checkFeature(req.params.featureCode)(req, res, next),
  (req: any, res: any): void => {
    res.json({
      message: `Zugriff auf Feature ${req.params.featureCode} gewährt`,
      feature: req.params.featureCode,
    });
  }
);

// Get all tenants with features (Root only)
router.get(
  '/all-tenants',
  authenticateToken as any,
  authorizeRole('root') as any,
  async (_req: any, res: any): Promise<void> => {
    try {
      // Get all tenants
      const [tenants] = await db.query(
        'SELECT id, subdomain, company_name, status FROM tenants ORDER BY company_name'
      );

      // Get activated features for each tenant
      for (const tenant of tenants as any[]) {
        tenant.features = await Feature.getTenantFeatures(tenant.id);
      }

      res.json(tenants);
    } catch (error: any) {
      logger.error(
        `Error fetching all tenants with features: ${error.message}`
      );
      res
        .status(500)
        .json({ error: 'Fehler beim Abrufen der Tenant-Features' });
    }
  }
);

export default router;

// CommonJS compatibility
