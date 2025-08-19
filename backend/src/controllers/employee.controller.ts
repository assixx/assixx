/**
 * Employee Controller
 * Handles employee-related operations
 * NOTE: This controller was previously named UserController but renamed for consistency
 */

import { Pool } from "mysql2/promise";

import { Request, Response } from "express";

import type { UserCreateData } from "../models/user";
import employeeService from "../services/employee.service";

// Extended Request interface with tenant database
interface TenantRequest extends Request {
  tenantDb?: Pool;
  tenantId?: number | null;
  user?: {
    id: number;
    tenantId: number;
    role: string;
    [key: string]: unknown;
  };
}

// Interface for create/update request bodies
interface EmployeeCreateRequest extends TenantRequest {
  body: {
    tenant_id: number;
    username: string;
    email: string;
    password?: string;
    password_hash?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    role?: "admin" | "user" | "manager";
    department_id?: number | null;
    team_id?: number | null;
    hire_date?: Date | string;
    salary?: number;
    position?: string;
    location?: string;
    employee_id?: string;
    is_active?: boolean;
    avatar_url?: string;
    profile_picture?: string;
    language?: string;
    timezone?: string;
  };
}

interface EmployeeUpdateRequest extends TenantRequest {
  body: {
    username?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    role?: "admin" | "user" | "manager";
    department_id?: number | null;
    team_id?: number | null;
    hire_date?: Date | string;
    salary?: number;
    position?: string;
    location?: string;
    employee_id?: string;
    is_active?: boolean;
    avatar_url?: string;
    profile_picture?: string;
    is_archived?: boolean;
    archived?: boolean;
  };
  params: {
    id: string;
  };
}

interface EmployeeGetRequest extends TenantRequest {
  params: {
    id: string;
  };
}

interface EmployeeQueryRequest extends TenantRequest {
  query: {
    search?: string;
    role?: "admin" | "user" | "manager";
    department_id?: string;
    team_id?: string;
    is_active?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortDir?: "ASC" | "DESC";
  };
}

/**
 *
 */
class EmployeeController {
  /**
   * Holt alle Employee Einträge
   * GET /api/employee
   * @param req
   * @param res
   */
  async getAll(req: EmployeeQueryRequest, res: Response): Promise<void> {
    try {
      if (req.tenantDb === undefined) {
        res.status(400).json({ error: "Tenant database not available" });
        return;
      }

      // Parse query parameters to appropriate types
      const tenantId = req.tenantId ?? req.user?.tenantId;
      if (tenantId === undefined || tenantId === 0) {
        res.status(400).json({ error: "Tenant ID not found" });
        return;
      }

      const filters = {
        tenant_id: tenantId,
        search: req.query.search,
        role: req.query.role,
        department_id:
          req.query.department_id !== undefined &&
          req.query.department_id !== ""
            ? Number.parseInt(req.query.department_id)
            : undefined,
        team_id:
          req.query.team_id !== undefined && req.query.team_id !== ""
            ? Number.parseInt(req.query.team_id)
            : undefined,
        is_active:
          req.query.is_active !== undefined && req.query.is_active !== ""
            ? req.query.is_active === "true"
            : undefined,
        page:
          req.query.page !== undefined && req.query.page !== ""
            ? Number.parseInt(req.query.page)
            : undefined,
        limit:
          req.query.limit !== undefined && req.query.limit !== ""
            ? Number.parseInt(req.query.limit)
            : undefined,
        sortBy: req.query.sortBy,
        sortDir: req.query.sortDir,
      };

      const result = await employeeService.getAll(req.tenantDb, filters);
      res.json(result);
    } catch (error: unknown) {
      console.error("Error in EmployeeController.getAll:", error);
      res.status(500).json({
        error: "Fehler beim Abrufen der Daten",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Holt einen Employee Eintrag per ID
   * GET /api/employee/:id
   * @param req
   * @param res
   */
  async getById(req: EmployeeGetRequest, res: Response): Promise<void> {
    try {
      if (req.tenantDb === undefined) {
        res.status(400).json({ error: "Tenant database not available" });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }

      // Get tenant ID from request
      const tenantId = req.tenantId ?? req.user?.tenantId;
      if (tenantId === undefined || tenantId === 0) {
        res.status(400).json({ error: "Tenant ID not found" });
        return;
      }

      const result = await employeeService.getById(req.tenantDb, id, tenantId);
      if (result === null) {
        res.status(404).json({ error: "Nicht gefunden" });
        return;
      }
      res.json(result);
    } catch (error: unknown) {
      console.error("Error in EmployeeController.getById:", error);
      res.status(500).json({
        error: "Fehler beim Abrufen der Daten",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Erstellt einen neuen Employee Eintrag
   * POST /api/employee
   * @param req
   * @param res
   */
  async create(req: EmployeeCreateRequest, res: Response): Promise<void> {
    try {
      if (req.tenantDb === undefined) {
        res.status(400).json({ error: "Tenant database not available" });
        return;
      }

      // Get tenant ID from request
      const tenantId = req.tenantId ?? req.user?.tenantId;
      if (tenantId === undefined || tenantId === 0) {
        res.status(400).json({ error: "Tenant ID not found" });
        return;
      }

      const employeeData: UserCreateData = {
        username: req.body.username,
        email: req.body.email,
        password: req.body.password ?? req.body.password_hash ?? "",
        first_name: req.body.first_name ?? "",
        last_name: req.body.last_name ?? "",
        role: req.body.role ?? "user",
        tenant_id: tenantId,
        department_id: req.body.department_id ?? undefined,
        profile_picture: req.body.profile_picture ?? undefined,
        position: req.body.position,
        phone: req.body.phone,
        employee_id: req.body.employee_id,
        status: req.body.is_active === false ? "inactive" : "active",
      };
      const result = await employeeService.create(req.tenantDb, employeeData);
      res.status(201).json(result);
    } catch (error: unknown) {
      console.error("Error in EmployeeController.create:", error);
      res.status(500).json({
        error: "Fehler beim Erstellen",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Aktualisiert einen Employee Eintrag
   * PUT /api/employee/:id
   * @param req
   * @param res
   */
  async update(req: EmployeeUpdateRequest, res: Response): Promise<void> {
    try {
      if (req.tenantDb === undefined) {
        res.status(400).json({ error: "Tenant database not available" });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }

      const updateData: Partial<UserCreateData> = {
        username: req.body.username,
        email: req.body.email,
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        role: req.body.role,
        department_id: req.body.department_id ?? undefined,
        profile_picture:
          req.body.profile_picture ?? req.body.avatar_url ?? undefined,
        position: req.body.position,
        phone: req.body.phone,
        status:
          req.body.is_active === false
            ? "inactive"
            : req.body.is_active === true
              ? "active"
              : undefined,
        is_archived: req.body.is_archived ?? req.body.archived,
      };
      // Remove undefined values - create new object without undefined values
      const cleanedUpdateData = Object.fromEntries(
        Object.entries(updateData as Record<string, unknown>).filter(
          ([, v]) => v !== undefined,
        ),
      ) as Partial<UserCreateData>;

      // Get tenant ID from request
      const tenantId = req.tenantId ?? req.user?.tenantId;
      if (tenantId === undefined || tenantId === 0) {
        res.status(400).json({ error: "Tenant ID not found" });
        return;
      }

      const result = await employeeService.update(
        req.tenantDb,
        id,
        tenantId,
        cleanedUpdateData,
      );
      res.json(result);
    } catch (error: unknown) {
      console.error("Error in EmployeeController.update:", error);
      res.status(500).json({
        error: "Fehler beim Aktualisieren",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Löscht einen Employee Eintrag
   * DELETE /api/employee/:id
   * @param req
   * @param res
   */
  async delete(req: EmployeeGetRequest, res: Response): Promise<void> {
    try {
      if (req.tenantDb === undefined) {
        res.status(400).json({ error: "Tenant database not available" });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }

      await employeeService.delete(req.tenantDb, id);
      res.status(204).send();
    } catch (error: unknown) {
      console.error("Error in EmployeeController.delete:", error);
      res.status(500).json({
        error: "Fehler beim Löschen",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

// Export singleton instance
const employeeController = new EmployeeController();
export default employeeController;

// Named export for the class
export { EmployeeController };

// CommonJS compatibility
