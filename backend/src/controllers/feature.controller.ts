/**
 * Feature Controller
 * Handles feature-related operations
 */
import { Request, Response } from 'express';
import { Pool } from 'mysql2/promise';

import featureService from '../services/feature.service';

// Constants
const TENANT_DB_NOT_AVAILABLE = 'Tenant database not available';
const UNKNOWN_ERROR = 'Unknown error';

// Extended Request interface with tenant database
interface TenantRequest extends Request {
  tenantDb?: Pool;
  user?: {
    id: number;
    tenantId: number;
    [key: string]: unknown;
  };
}

// Interface for create/update request bodies
interface FeatureCreateRequest extends TenantRequest {
  body: {
    tenant_id: number;
    name: string;
    feature_key?: string;
    key?: string;
    description?: string;
    category?: string;
    is_enabled?: boolean;
    config_data?: Record<string, unknown>;
    created_by?: number;
    price?: number;
    billing_type?: 'free' | 'monthly' | 'yearly' | 'usage';
    dependencies?: string[];
    min_users?: number;
    max_users?: number;
  };
}

interface FeatureUpdateRequest extends TenantRequest {
  body: {
    name?: string;
    description?: string;
    category?: string;
    is_enabled?: boolean;
    config_data?: Record<string, unknown>;
    price?: number;
    billing_type?: 'free' | 'monthly' | 'yearly' | 'usage';
    dependencies?: string[];
    min_users?: number;
    max_users?: number;
  };
  params: {
    id: string;
  };
}

interface FeatureGetRequest extends TenantRequest {
  params: {
    id: string;
  };
}

interface FeatureQueryRequest extends TenantRequest {
  query: {
    search?: string;
    category?: string;
    is_enabled?: string;
    billing_type?: 'free' | 'monthly' | 'yearly' | 'usage';
    page?: string;
    limit?: string;
    sortBy?: string;
    sortDir?: 'ASC' | 'DESC';
  };
}

/**
 *
 */
class FeatureController {
  /**
   * Holt alle Feature Einträge
   * GET /api/feature
   * @param req - The request object
   * @param res - The response object
   */
  getAll(req: FeatureQueryRequest, res: Response): void {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: TENANT_DB_NOT_AVAILABLE });
        return;
      }

      const filters = {
        ...req.query,
        is_enabled:
          req.query.is_enabled === 'true' ? true
          : req.query.is_enabled === 'false' ? false
          : undefined,
        page: req.query.page !== undefined ? Number.parseInt(req.query.page, 10) : undefined,
        limit: req.query.limit !== undefined ? Number.parseInt(req.query.limit, 10) : undefined,
      };
      const result = featureService.getAll(req.tenantDb, filters);
      res.json(result);
    } catch (error: unknown) {
      console.error('Error in FeatureController.getAll:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }

  /**
   * Holt einen Feature Eintrag per ID
   * GET /api/feature/:id
   * @param req - The request object
   * @param res - The response object
   */
  getById(req: FeatureGetRequest, res: Response): void {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: TENANT_DB_NOT_AVAILABLE });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const result = featureService.getById(req.tenantDb, id);
      if (!result) {
        res.status(404).json({ error: 'Nicht gefunden' });
        return;
      }
      res.json(result);
    } catch (error: unknown) {
      console.error('Error in FeatureController.getById:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }

  /**
   * Erstellt einen neuen Feature Eintrag
   * POST /api/feature
   * @param req - The request object
   * @param res - The response object
   */
  create(req: FeatureCreateRequest, res: Response): void {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: TENANT_DB_NOT_AVAILABLE });
        return;
      }

      const featureData = {
        tenant_id: req.user?.tenantId ?? 0,
        feature_key: req.body.feature_key ?? req.body.key ?? 'new_feature',
        is_enabled: req.body.is_enabled ?? false,
        enabled_by: req.body.is_enabled === true ? (req.user?.id ?? null) : null,
      };
      const result = featureService.create(req.tenantDb, featureData);
      res.status(201).json(result);
    } catch (error: unknown) {
      console.error('Error in FeatureController.create:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }

  /**
   * Aktualisiert einen Feature Eintrag
   * PUT /api/feature/:id
   * @param req - The request object
   * @param res - The response object
   */
  update(req: FeatureUpdateRequest, res: Response): void {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: TENANT_DB_NOT_AVAILABLE });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const result = featureService.update(req.tenantDb, id, req.body);
      res.json(result);
    } catch (error: unknown) {
      console.error('Error in FeatureController.update:', error);
      res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }

  /**
   * Löscht einen Feature Eintrag
   * DELETE /api/feature/:id
   * @param req - The request object
   * @param res - The response object
   */
  delete(req: FeatureGetRequest, res: Response): void {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: TENANT_DB_NOT_AVAILABLE });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      featureService.delete(req.tenantDb, id);
      res.status(204).send();
    } catch (error: unknown) {
      console.error('Error in FeatureController.delete:', error);
      res.status(500).json({
        error: 'Fehler beim Löschen',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }
}

// Export singleton instance
const featureController = new FeatureController();
export default featureController;

// Named export for the class
export { FeatureController };

// CommonJS compatibility
