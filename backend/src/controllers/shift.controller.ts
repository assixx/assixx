/**
 * Shift Controller
 * Handles shift planning and scheduling operations
 */

import { Request, Response } from "express";
import { Pool } from "mysql2/promise";
import shiftService from "../services/shift.service";

// Extended Request interface with tenant database
interface TenantRequest extends Request {
  tenantDb?: Pool;
}

// Interface for create/update request bodies
interface ShiftCreateRequest extends TenantRequest {
  body: {
    tenant_id: number;
    user_id: number;
    template_id?: number;
    shift_date: Date | string;
    date?: Date | string; // Alternative to shift_date
    start_time: string;
    end_time: string;
    break_duration?: number;
    position?: string;
    department_id?: number;
    location?: string;
    status?: "scheduled" | "confirmed" | "completed" | "cancelled";
    notes?: string;
    created_by: number;
    hourly_rate?: number;
    shift_plan_id?: number;
    plan_id?: number; // Alternative to shift_plan_id
  };
}

interface ShiftUpdateRequest extends TenantRequest {
  body: {
    user_id?: number;
    template_id?: number;
    shift_date?: Date | string;
    start_time?: string;
    end_time?: string;
    break_duration?: number;
    position?: string;
    department_id?: number;
    location?: string;
    status?: "scheduled" | "confirmed" | "completed" | "cancelled";
    notes?: string;
    hourly_rate?: number;
  };
  params: {
    id: string;
  };
}

interface ShiftGetRequest extends TenantRequest {
  params: {
    id: string;
  };
}

interface ShiftQueryRequest extends TenantRequest {
  query: {
    search?: string;
    user_id?: string;
    department_id?: string;
    position?: string;
    status?: "scheduled" | "confirmed" | "completed" | "cancelled";
    start_date?: string;
    end_date?: string;
    location?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortDir?: "ASC" | "DESC";
  };
}

class ShiftController {
  /**
   * Holt alle Shift Einträge
   * GET /api/shift
   */
  async getAll(req: ShiftQueryRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: "Tenant database not available" });
        return;
      }

      const filters = {
        department_id: req.query.department_id
          ? parseInt(req.query.department_id, 10)
          : undefined,
        team_id: undefined as number | undefined, // Not in query but expected by ShiftFilters
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        status: req.query.status as
          | "draft"
          | "published"
          | "archived"
          | undefined,
        plan_id: undefined as number | undefined,
        template_id: undefined as number | undefined,
      };
      const result = await shiftService.getAll(req.tenantDb, filters);
      res.json(result);
    } catch (error) {
      console.error("Error in ShiftController.getAll:", error);
      res.status(500).json({
        error: "Fehler beim Abrufen der Daten",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Holt einen Shift Eintrag per ID
   * GET /api/shift/:id
   */
  async getById(req: ShiftGetRequest, res: Response): Promise<void> {
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

      const result = await shiftService.getById(req.tenantDb, id);
      if (!result) {
        res.status(404).json({ error: "Nicht gefunden" });
        return;
      }
      res.json(result);
    } catch (error) {
      console.error("Error in ShiftController.getById:", error);
      res.status(500).json({
        error: "Fehler beim Abrufen der Daten",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Erstellt einen neuen Shift Eintrag
   * POST /api/shift
   */
  async create(req: ShiftCreateRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: "Tenant database not available" });
        return;
      }

      const shift_plan_id = req.body.shift_plan_id ?? req.body.plan_id;

      if (!shift_plan_id) {
        res.status(400).json({ error: "Shift plan ID is required" });
        return;
      }

      const createData = {
        ...req.body,
        tenant_id: req.user.tenant_id,
        shift_plan_id,
        date: req.body.date ?? req.body.shift_date,
      };
      const result = await shiftService.create(req.tenantDb, createData);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error in ShiftController.create:", error);
      res.status(500).json({
        error: "Fehler beim Erstellen",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Aktualisiert einen Shift Eintrag
   * PUT /api/shift/:id
   */
  async update(req: ShiftUpdateRequest, res: Response): Promise<void> {
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

      const result = await shiftService.update(req.tenantDb, id, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error in ShiftController.update:", error);
      res.status(500).json({
        error: "Fehler beim Aktualisieren",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Löscht einen Shift Eintrag
   * DELETE /api/shift/:id
   */
  async delete(req: ShiftGetRequest, res: Response): Promise<void> {
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

      await shiftService.delete(req.tenantDb, id);
      res.status(204).send();
    } catch (error) {
      console.error("Error in ShiftController.delete:", error);
      res.status(500).json({
        error: "Fehler beim Löschen",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

// Export singleton instance
const shiftController = new ShiftController();
export default shiftController;

// Named export for the class
export { ShiftController };

// CommonJS compatibility
