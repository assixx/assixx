/**
 * Department Controller
 * Handles department-related operations
 */
import { Request, Response } from 'express';
import { Pool } from 'mysql2/promise';

import type { DepartmentCreateData, DepartmentUpdateData } from '../models/department';
import departmentService from '../services/department.service';

// Constants
const TENANT_DB_NOT_AVAILABLE = 'Tenant database not available';
const UNKNOWN_ERROR = 'Unknown error';

// Extended Request interface with tenant database
interface TenantRequest extends Request {
  tenantDb?: Pool;
  tenantId?: number | null;
  user?: {
    id: number;
    tenant_id: number;
    role: string;
    [key: string]: unknown;
  };
}

// Interface for create/update request bodies
interface DepartmentCreateRequest extends TenantRequest {
  body: {
    tenant_id: number;
    name: string;
    description?: string;
    parent_id?: number | null;
    manager_id?: number | null;
    location?: string;
    budget?: number;
    cost_center?: string;
    active?: boolean;
    status?: string;
    visibility?: string;
  };
}

interface DepartmentUpdateRequest extends TenantRequest {
  body: {
    name?: string;
    description?: string;
    parent_id?: number | null;
    manager_id?: number | null;
    location?: string;
    budget?: number;
    cost_center?: string;
    active?: boolean;
    status?: string;
    visibility?: string;
  };
  params: {
    id: string;
  };
}

interface DepartmentGetRequest extends TenantRequest {
  params: {
    id: string;
  };
}

interface DepartmentQueryRequest extends TenantRequest {
  query: {
    search?: string;
    parent_id?: string;
    manager_id?: string;
    active?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortDir?: 'ASC' | 'DESC';
  };
}

/**
 *
 */
class DepartmentController {
  /**
   * Parse number query parameter
   */
  private parseNumberParam(value: string | undefined): number | undefined {
    if (value === undefined || value === '') {
      return undefined;
    }
    return Number.parseInt(value);
  }

  /**
   * Parse boolean query parameter
   */
  private parseBooleanParam(value: string | undefined): boolean | undefined {
    if (value === undefined || value === '') {
      return undefined;
    }
    return value === 'true';
  }

  /**
   * Parse query filters
   */
  private parseQueryFilters(query: DepartmentQueryRequest['query']): Record<string, unknown> {
    return {
      search: query.search,
      parent_id: this.parseNumberParam(query.parent_id),
      manager_id: this.parseNumberParam(query.manager_id),
      active: this.parseBooleanParam(query.active),
      page: this.parseNumberParam(query.page),
      limit: this.parseNumberParam(query.limit),
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    };
  }

  /**
   * Holt alle Department Einträge
   * GET /api/department
   * @param req - The request object
   * @param res - The response object
   */
  async getAll(req: DepartmentQueryRequest, res: Response): Promise<void> {
    try {
      if (req.tenantDb === undefined) {
        res.status(400).json({ error: TENANT_DB_NOT_AVAILABLE });
        return;
      }

      // Get tenant ID from request
      const tenantId = req.tenantId ?? req.user?.tenant_id;
      if (tenantId === undefined || tenantId === 0) {
        res.status(400).json({ error: 'Tenant ID not found' });
        return;
      }

      const filters = this.parseQueryFilters(req.query);
      const result = await departmentService.getAll(req.tenantDb, tenantId, filters);
      res.json(result);
    } catch (error: unknown) {
      console.error('Error in DepartmentController.getAll:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }

  /**
   * Holt einen Department Eintrag per ID
   * GET /api/department/:id
   * @param req - The request object
   * @param res - The response object
   */
  async getById(req: DepartmentGetRequest, res: Response): Promise<void> {
    try {
      if (req.tenantDb === undefined) {
        res.status(400).json({ error: TENANT_DB_NOT_AVAILABLE });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      // Get tenant ID from request
      const tenantId = req.tenantId ?? req.user?.tenant_id;
      if (tenantId === undefined || tenantId === 0) {
        res.status(400).json({ error: 'Tenant ID not found' });
        return;
      }

      const result = await departmentService.getById(req.tenantDb, id, tenantId);
      if (result === null) {
        res.status(404).json({ error: 'Nicht gefunden' });
        return;
      }
      res.json(result);
    } catch (error: unknown) {
      console.error('Error in DepartmentController.getById:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }

  /**
   * Erstellt einen neuen Department Eintrag
   * POST /api/department
   * @param req - The request object
   * @param res - The response object
   */
  async create(req: DepartmentCreateRequest, res: Response): Promise<void> {
    try {
      if (req.tenantDb === undefined) {
        res.status(400).json({ error: TENANT_DB_NOT_AVAILABLE });
        return;
      }

      const departmentData: DepartmentCreateData = {
        name: req.body.name,
        description: req.body.description,
        manager_id: req.body.manager_id ?? undefined,
        parent_id: req.body.parent_id ?? undefined,
        status: req.body.status ?? undefined,
        visibility: req.body.visibility ?? undefined,
        tenant_id: req.user?.tenant_id ?? 0,
      };
      const result = await departmentService.create(req.tenantDb, departmentData);
      res.status(201).json(result);
    } catch (error: unknown) {
      console.error('Error in DepartmentController.create:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }

  /**
   * Aktualisiert einen Department Eintrag
   * PUT /api/department/:id
   * @param req - The request object
   * @param res - The response object
   */
  async update(req: DepartmentUpdateRequest, res: Response): Promise<void> {
    try {
      if (req.tenantDb === undefined) {
        res.status(400).json({ error: TENANT_DB_NOT_AVAILABLE });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const updateData: DepartmentUpdateData = {
        name: req.body.name,
        description: req.body.description,
        manager_id: req.body.manager_id !== null ? req.body.manager_id : undefined,
        parent_id: req.body.parent_id !== null ? req.body.parent_id : undefined,
        status: req.body.status,
        visibility: req.body.visibility,
      };
      // Get tenant ID from request
      const tenantId = req.tenantId ?? req.user?.tenant_id;
      if (tenantId === undefined || tenantId === 0) {
        res.status(400).json({ error: 'Tenant ID not found' });
        return;
      }

      const result = await departmentService.update(req.tenantDb, id, tenantId, updateData);
      res.json(result);
    } catch (error: unknown) {
      console.error('Error in DepartmentController.update:', error);
      res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }

  /**
   * Löscht einen Department Eintrag
   * DELETE /api/department/:id
   * @param req - The request object
   * @param res - The response object
   */
  async delete(req: DepartmentGetRequest, res: Response): Promise<void> {
    try {
      if (req.tenantDb === undefined) {
        res.status(400).json({ error: TENANT_DB_NOT_AVAILABLE });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      await departmentService.delete(req.tenantDb, id);
      res.status(204).send();
    } catch (error: unknown) {
      console.error('Error in DepartmentController.delete:', error);
      res.status(500).json({
        error: 'Fehler beim Löschen',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }
}

// Export singleton instance
const departmentController = new DepartmentController();
export default departmentController;

// Named export for the class
export { DepartmentController };

// CommonJS compatibility
