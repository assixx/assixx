/**
 * Admin Log Controller
 * Handles admin log-related operations
 */
import { Response } from 'express';
import { Pool } from 'mysql2/promise';

import type { RootLogCreateData as AdminLogCreateData } from '../models/rootLog';
import adminService from '../services/admin.service';
import { AuthenticatedRequest } from '../types/request.types';

// Extended Request interface with tenant database
interface TenantRequest extends AuthenticatedRequest {
  tenantDb?: Pool;
}

// Interface for create/update request bodies
interface AdminLogCreateRequest extends TenantRequest {
  body: {
    tenant_id: number;
    user_id: number;
    action: string;
    entity_type?: string | null;
    entity_id?: number | null;
    details?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
  };
}

interface AdminLogUpdateRequest extends TenantRequest {
  body: {
    action?: string;
    entity_type?: string | null;
    entity_id?: number | null;
    details?: string | null;
  };
  params: {
    id: string;
  };
}

interface AdminLogGetRequest extends TenantRequest {
  params: {
    id: string;
  };
}

interface AdminLogQueryRequest extends TenantRequest {
  query: {
    user_id?: string;
    action?: string;
    entity_type?: string;
    start_date?: string;
    end_date?: string;
    limit?: string;
    offset?: string;
  };
}

/**
 *
 */
class AdminLogController {
  /**
   * Holt alle AdminLog Einträge
   * GET /api/admin
   * @param req
   * @param res
   */
  async getAll(req: AdminLogQueryRequest, res: Response): Promise<void> {
    try {
      if (req.tenantDb == null) {
        res.status(400).json({ error: 'Tenant database not available' });
        return;
      }

      // Parse query parameters to appropriate types
      const filters = {
        user_id:
          req.query.user_id != null && req.query.user_id.length > 0 ?
            Number.parseInt(req.query.user_id)
          : undefined,
        action: req.query.action,
        entity_type: req.query.entity_type,
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        limit:
          req.query.limit != null && req.query.limit.length > 0 ?
            Number.parseInt(req.query.limit)
          : undefined,
        offset:
          req.query.offset != null && req.query.offset.length > 0 ?
            Number.parseInt(req.query.offset)
          : undefined,
      };

      const result = await adminService.getAll(req.tenantDb, filters);
      res.json(result);
    } catch (error: unknown) {
      console.error('Error in AdminLogController.getAll:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Holt einen AdminLog Eintrag per ID
   * GET /api/admin/:id
   * @param req
   * @param res
   */
  async getById(req: AdminLogGetRequest, res: Response): Promise<void> {
    try {
      if (req.tenantDb == null) {
        res.status(400).json({ error: 'Tenant database not available' });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const result = await adminService.getById(req.tenantDb, id);
      if (result == null) {
        res.status(404).json({ error: 'Nicht gefunden' });
        return;
      }
      res.json(result);
    } catch (error: unknown) {
      console.error('Error in AdminLogController.getById:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Erstellt einen neuen AdminLog Eintrag
   * POST /api/admin
   * @param req
   * @param res
   */
  async create(req: AdminLogCreateRequest, res: Response): Promise<void> {
    try {
      if (req.tenantDb == null) {
        res.status(400).json({ error: 'Tenant database not available' });
        return;
      }

      const logData: AdminLogCreateData = {
        user_id: req.user.id,
        tenant_id: req.tenantId ?? 0,
        action: req.body.action,
        ip_address: req.ip,
        entity_type: req.body.entity_type ?? undefined,
        entity_id: req.body.entity_id ?? undefined,
        new_values:
          req.body.details != null && req.body.details.length > 0 ?
            { details: req.body.details }
          : undefined,
        user_agent: req.get('user-agent') ?? undefined,
      };
      const result = await adminService.create(req.tenantDb, logData);
      res.status(201).json(result);
    } catch (error: unknown) {
      console.error('Error in AdminLogController.create:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Aktualisiert einen AdminLog Eintrag
   * PUT /api/admin/:id
   * @param req
   * @param res
   */
  async update(req: AdminLogUpdateRequest, res: Response): Promise<void> {
    try {
      if (req.tenantDb == null) {
        res.status(400).json({ error: 'Tenant database not available' });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const result = await adminService.update(req.tenantDb, id, req.body);
      res.json(result);
    } catch (error: unknown) {
      console.error('Error in AdminLogController.update:', error);
      res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Löscht einen AdminLog Eintrag
   * DELETE /api/admin/:id
   * @param req
   * @param res
   */
  async delete(req: AdminLogGetRequest, res: Response): Promise<void> {
    try {
      if (req.tenantDb == null) {
        res.status(400).json({ error: 'Tenant database not available' });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      await adminService.delete(req.tenantDb, id);
      res.status(204).send();
    } catch (error: unknown) {
      console.error('Error in AdminLogController.delete:', error);
      res.status(500).json({
        error: 'Fehler beim Löschen',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// Export singleton instance
const adminLogController = new AdminLogController();
export default adminLogController;

// Named export for the class
export { AdminLogController };

// CommonJS compatibility
