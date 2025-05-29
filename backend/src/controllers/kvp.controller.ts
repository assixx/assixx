/**
 * KVP Controller
 * Handles KVP (Kontinuierlicher Verbesserungsprozess / Continuous Improvement Process) operations
 */

import { Request, Response } from 'express';
import { Pool } from 'mysql2/promise';
import kvpService from '../services/kvp.service';

// Extended Request interface with tenant database
interface TenantRequest extends Request {
  tenantDb?: Pool;
}

// Interface for create/update request bodies
interface KvpCreateRequest extends TenantRequest {
  body: {
    tenant_id: number;
    title: string;
    description: string;
    category_id?: number;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    status?:
      | 'submitted'
      | 'in_review'
      | 'approved'
      | 'rejected'
      | 'implemented';
    submitted_by: number;
    department_id?: number;
    estimated_cost?: number;
    estimated_savings?: number;
    implementation_date?: Date | string;
    attachments?: any[];
    impact_area?: string;
    risk_assessment?: string;
  };
}

interface KvpUpdateRequest extends TenantRequest {
  body: {
    title?: string;
    description?: string;
    category_id?: number;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    status?:
      | 'submitted'
      | 'in_review'
      | 'approved'
      | 'rejected'
      | 'implemented';
    department_id?: number;
    estimated_cost?: number;
    estimated_savings?: number;
    implementation_date?: Date | string;
    attachments?: any[];
    impact_area?: string;
    risk_assessment?: string;
    reviewer_id?: number;
    review_notes?: string;
  };
  params: {
    id: string;
  };
}

interface KvpGetRequest extends TenantRequest {
  params: {
    id: string;
  };
}

interface KvpQueryRequest extends TenantRequest {
  query: {
    search?: string;
    category_id?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    status?:
      | 'submitted'
      | 'in_review'
      | 'approved'
      | 'rejected'
      | 'implemented';
    submitted_by?: string;
    department_id?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortDir?: 'ASC' | 'DESC';
  };
}

class KvpController {
  /**
   * Holt alle KVP Einträge
   * GET /api/kvp
   */
  async getAll(req: KvpQueryRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: 'Tenant database not available' });
        return;
      }

      const filters = {
        ...req.query,
        category_id: req.query.category_id
          ? parseInt(req.query.category_id, 10)
          : undefined,
        page: req.query.page ? parseInt(req.query.page, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
      };
      const result = await kvpService.getAll(req.tenantDb, filters);
      res.json(result);
    } catch (error) {
      console.error('Error in KvpController.getAll:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Holt einen KVP Eintrag per ID
   * GET /api/kvp/:id
   */
  async getById(req: KvpGetRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: 'Tenant database not available' });
        return;
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const result = await kvpService.getById(req.tenantDb, id);
      if (!result) {
        res.status(404).json({ error: 'Nicht gefunden' });
        return;
      }
      res.json(result);
    } catch (error) {
      console.error('Error in KvpController.getById:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Erstellt einen neuen KVP Eintrag
   * POST /api/kvp
   */
  async create(req: KvpCreateRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: 'Tenant database not available' });
        return;
      }

      const result = await kvpService.create(req.tenantDb, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error('Error in KvpController.create:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Aktualisiert einen KVP Eintrag
   * PUT /api/kvp/:id
   */
  async update(req: KvpUpdateRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: 'Tenant database not available' });
        return;
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const result = await kvpService.update(req.tenantDb, id, req.body);
      res.json(result);
    } catch (error) {
      console.error('Error in KvpController.update:', error);
      res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Löscht einen KVP Eintrag
   * DELETE /api/kvp/:id
   */
  async delete(req: KvpGetRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: 'Tenant database not available' });
        return;
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      await kvpService.delete(req.tenantDb, id);
      res.status(204).send();
    } catch (error) {
      console.error('Error in KvpController.delete:', error);
      res.status(500).json({
        error: 'Fehler beim Löschen',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// Export singleton instance
const kvpController = new KvpController();
export default kvpController;

// Named export for the class
export { KvpController };

// CommonJS compatibility
