/**
 * Department Controller
 * Handles department-related operations
 */

import { Request, Response } from "express";
import { Pool } from "mysql2/promise";
import departmentService from "../services/department.service";
import type {
  DepartmentCreateData,
  DepartmentUpdateData,
} from "../models/department";

// Extended Request interface with tenant database
interface TenantRequest extends Request {
  tenantDb?: Pool;
  tenantId?: number | null;
  user?: {
    id: number;
    tenant_id: number;
    role: string;
    [key: string]: any;
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
    sortDir?: "ASC" | "DESC";
  };
}

class DepartmentController {
  /**
   * Holt alle Department Einträge
   * GET /api/department
   */
  async getAll(req: DepartmentQueryRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: "Tenant database not available" });
        return;
      }

      // Get tenant ID from request
      const tenantId = req.tenantId || req.user?.tenant_id;
      if (!tenantId) {
        res.status(400).json({ error: "Tenant ID not found" });
        return;
      }

      // Parse query parameters to appropriate types
      const filters = {
        search: req.query.search,
        parent_id: req.query.parent_id
          ? parseInt(req.query.parent_id)
          : undefined,
        manager_id: req.query.manager_id
          ? parseInt(req.query.manager_id)
          : undefined,
        active: req.query.active ? req.query.active === "true" : undefined,
        page: req.query.page ? parseInt(req.query.page) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit) : undefined,
        sortBy: req.query.sortBy,
        sortDir: req.query.sortDir,
      };

      const result = await departmentService.getAll(req.tenantDb, tenantId, filters);
      res.json(result);
    } catch (error) {
      console.error("Error in DepartmentController.getAll:", error);
      res.status(500).json({
        error: "Fehler beim Abrufen der Daten",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Holt einen Department Eintrag per ID
   * GET /api/department/:id
   */
  async getById(req: DepartmentGetRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: "Tenant database not available" });
        return;
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }

      // Get tenant ID from request
      const tenantId = req.tenantId || req.user?.tenant_id;
      if (!tenantId) {
        res.status(400).json({ error: "Tenant ID not found" });
        return;
      }

      const result = await departmentService.getById(req.tenantDb, id, tenantId);
      if (!result) {
        res.status(404).json({ error: "Nicht gefunden" });
        return;
      }
      res.json(result);
    } catch (error) {
      console.error("Error in DepartmentController.getById:", error);
      res.status(500).json({
        error: "Fehler beim Abrufen der Daten",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Erstellt einen neuen Department Eintrag
   * POST /api/department
   */
  async create(req: DepartmentCreateRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: "Tenant database not available" });
        return;
      }

      const departmentData: DepartmentCreateData = {
        name: req.body.name,
        description: req.body.description,
        manager_id: req.body.manager_id || undefined,
        parent_id: req.body.parent_id || undefined,
        status: req.body.status || undefined,
        visibility: req.body.visibility || undefined,
        tenant_id: req.user?.tenant_id || 0,
      };
      const result = await departmentService.create(
        req.tenantDb,
        departmentData,
      );
      res.status(201).json(result);
    } catch (error) {
      console.error("Error in DepartmentController.create:", error);
      res.status(500).json({
        error: "Fehler beim Erstellen",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Aktualisiert einen Department Eintrag
   * PUT /api/department/:id
   */
  async update(req: DepartmentUpdateRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: "Tenant database not available" });
        return;
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }

      const updateData: DepartmentUpdateData = {
        name: req.body.name,
        description: req.body.description,
        manager_id:
          req.body.manager_id !== null ? req.body.manager_id : undefined,
        parent_id: req.body.parent_id !== null ? req.body.parent_id : undefined,
        status: req.body.status,
        visibility: req.body.visibility,
      };
      // Get tenant ID from request
      const tenantId = req.tenantId || req.user?.tenant_id;
      if (!tenantId) {
        res.status(400).json({ error: "Tenant ID not found" });
        return;
      }

      const result = await departmentService.update(
        req.tenantDb,
        id,
        tenantId,
        updateData,
      );
      res.json(result);
    } catch (error) {
      console.error("Error in DepartmentController.update:", error);
      res.status(500).json({
        error: "Fehler beim Aktualisieren",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Löscht einen Department Eintrag
   * DELETE /api/department/:id
   */
  async delete(req: DepartmentGetRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: "Tenant database not available" });
        return;
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }

      await departmentService.delete(req.tenantDb, id);
      res.status(204).send();
    } catch (error) {
      console.error("Error in DepartmentController.delete:", error);
      res.status(500).json({
        error: "Fehler beim Löschen",
        message: error instanceof Error ? error.message : "Unknown error",
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
