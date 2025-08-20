/**
 * Tenant Controller
 * Handles tenant-related operations
 */
import { Request, Response } from 'express';
import { Pool } from 'mysql2/promise';

import tenantService from '../services/tenant.service';

// Extended Request interface with tenant database
interface TenantRequest extends Request {
  tenantDb?: Pool;
}

// Interface for create/update request bodies
interface TenantCreateRequest extends TenantRequest {
  body: {
    company_name: string;
    subdomain: string;
    contact_email: string;
    company_email?: string;
    email?: string;
    contact_phone?: string;
    company_phone?: string;
    address?: string;
    country?: string;
    status?: 'active' | 'inactive' | 'suspended';
    plan_type?: 'free' | 'basic' | 'premium' | 'enterprise';
    trial_ends_at?: string | Date | null;
    subscription_plan?: string | null;
    subscription_ends_at?: string | Date | null;
    max_users?: number;
    is_active?: boolean;
    settings?: Record<string, unknown>;
    billing_contact?: string;
    custom_domain?: string;
  };
}

interface TenantUpdateRequest extends TenantRequest {
  body: {
    company_name?: string;
    subdomain?: string;
    contact_email?: string;
    contact_phone?: string;
    address?: string;
    plan_type?: 'free' | 'basic' | 'premium' | 'enterprise';
    max_users?: number;
    is_active?: boolean;
    settings?: Record<string, unknown>;
    billing_contact?: string;
    custom_domain?: string;
  };
  params: {
    id: string;
  };
}

interface TenantGetRequest extends TenantRequest {
  params: {
    id: string;
  };
}

interface TenantQueryRequest extends TenantRequest {
  query: {
    search?: string;
    plan_type?: 'free' | 'basic' | 'premium' | 'enterprise';
    is_active?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortDir?: 'ASC' | 'DESC';
  };
}

/**
 *
 */
class TenantController {
  /**
   * Holt alle Tenant Einträge
   * GET /api/tenant
   * @param req
   * @param res
   */
  getAll(req: TenantQueryRequest, res: Response): void {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: 'Tenant database not available' });
        return;
      }

      const filters = {
        ...req.query,
        is_active:
          req.query.is_active === 'true' ? true
          : req.query.is_active === 'false' ? false
          : undefined,
        page:
          req.query.page != null && req.query.page !== '' ?
            Number.parseInt(req.query.page, 10)
          : undefined,
        limit:
          req.query.limit != null && req.query.limit !== '' ?
            Number.parseInt(req.query.limit, 10)
          : undefined,
      };
      const result = tenantService.getAll(req.tenantDb, filters);
      res.json(result);
    } catch (error: unknown) {
      console.error('Error in TenantController.getAll:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Holt einen Tenant Eintrag per ID
   * GET /api/tenant/:id
   * @param req
   * @param res
   */
  getById(req: TenantGetRequest, res: Response): void {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: 'Tenant database not available' });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const result = tenantService.getById(req.tenantDb, id);
      if (!result) {
        res.status(404).json({ error: 'Nicht gefunden' });
        return;
      }
      res.json(result);
    } catch (error: unknown) {
      console.error('Error in TenantController.getById:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Erstellt einen neuen Tenant Eintrag
   * POST /api/tenant
   * @param req
   * @param res
   */
  create(req: TenantCreateRequest, res: Response): void {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: 'Tenant database not available' });
        return;
      }

      // TODO: The Tenant.create method expects admin user details (admin_email, admin_password, etc.)
      // This controller method seems to be for administrative tenant creation without creating an admin user
      // Need to either:
      // 1. Create a separate method in Tenant model for admin-only tenant creation
      // 2. Or require admin user details in the request body
      // For now, returning not implemented
      res.status(501).json({
        error: 'Not implemented',
        message:
          'Tenant creation requires admin user details which are not provided in this endpoint',
      });
      return;

      /* Original code - commented out until we resolve the type mismatch
      const tenantData = {
        subdomain: req.body.subdomain,
        company_name: req.body.company_name,
        company_email: req.body.company_email  ?? req.body.contact_email || req.body.email || '',
        company_phone: req.body.company_phone  ?? req.body.contact_phone ?? null,
        country: req.body.country  ?? 'DE',
        status: req.body.status  ?? 'active',
        trial_ends_at: req.body.trial_ends_at  ?? null,
        subscription_plan: req.body.subscription_plan  ?? null,
        subscription_ends_at: req.body.subscription_ends_at  ?? null,
        max_users: req.body.max_users  ?? 10,
      };
      const result = await tenantService.create(req.tenantDb, tenantData);
      res.status(201).json(result);
      */
    } catch (error: unknown) {
      console.error('Error in TenantController.create:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Aktualisiert einen Tenant Eintrag
   * PUT /api/tenant/:id
   * @param req
   * @param res
   */
  update(req: TenantUpdateRequest, res: Response): void {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: 'Tenant database not available' });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const result = tenantService.update(req.tenantDb, id, req.body);
      res.json(result);
    } catch (error: unknown) {
      console.error('Error in TenantController.update:', error);
      res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Löscht einen Tenant Eintrag
   * DELETE /api/tenant/:id
   * @param req
   * @param res
   */
  delete(req: TenantGetRequest, res: Response): void {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: 'Tenant database not available' });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      tenantService.delete(req.tenantDb, id);
      res.status(204).send();
    } catch (error: unknown) {
      console.error('Error in TenantController.delete:', error);
      res.status(500).json({
        error: 'Fehler beim Löschen',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// Export singleton instance
const tenantController = new TenantController();
export default tenantController;

// Named export for the class
export { TenantController };

// CommonJS compatibility
