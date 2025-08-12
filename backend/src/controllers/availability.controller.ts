/**
 * Employee Availability Controller
 * Handles HTTP requests for employee availability management
 */

import { Request, Response } from "express";

import availabilityService from "../services/availability.service";
import type { AuthenticatedRequest } from "../types/request.types";

// Type guard to check if request has authenticated user
function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return "user" in req && req.user != null && "tenant_id" in req.user;
}

class AvailabilityController {
  /**
   * Get all availability records
   * GET /api/availability
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const tenantId = req.user.tenant_id;

      const filter = {
        tenant_id: tenantId,
        employeeId:
          req.query.employee_id !== undefined
            ? parseInt(req.query.employee_id as string)
            : undefined,
        status: req.query.status as string,
        startDate: req.query.start_date as string,
        endDate: req.query.end_date as string,
      };

      const records = await availabilityService.getAll(filter);
      res.json({ availability: records });
    } catch (error: unknown) {
      console.error("Error in AvailabilityController.getAll:", error);
      res.status(500).json({ error: "Fehler beim Laden der Verfügbarkeiten" });
    }
  }

  /**
   * Get current availability status for all employees
   * GET /api/availability/current
   */
  async getCurrentStatus(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const tenantId = req.user.tenant_id;

      const employees = await availabilityService.getCurrentStatus(tenantId);
      res.json({ employees });
    } catch (error: unknown) {
      console.error("Error in AvailabilityController.getCurrentStatus:", error);
      res
        .status(500)
        .json({ error: "Fehler beim Laden der aktuellen Verfügbarkeiten" });
    }
  }

  /**
   * Get availability summary for date range
   * GET /api/availability/summary
   */
  async getSummary(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const tenantId = req.user.tenant_id;

      const { start_date, end_date } = req.query;
      if (start_date === undefined || end_date === undefined) {
        res.status(400).json({ error: "Start- und Enddatum erforderlich" });
        return;
      }

      const summary = await availabilityService.getAvailabilitySummary(
        tenantId,
        start_date as string,
        end_date as string,
      );
      res.json({ summary });
    } catch (error: unknown) {
      console.error("Error in AvailabilityController.getSummary:", error);
      res.status(500).json({ error: "Fehler beim Laden der Zusammenfassung" });
    }
  }

  /**
   * Get availability by ID
   * GET /api/availability/:id
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const tenantId = req.user.tenant_id;

      const id = parseInt(req.params.id);
      const record = await availabilityService.getById(id, tenantId);

      if (record === null) {
        res.status(404).json({ error: "Verfügbarkeit nicht gefunden" });
        return;
      }

      res.json(record);
    } catch (error: unknown) {
      console.error("Error in AvailabilityController.getById:", error);
      res.status(500).json({ error: "Fehler beim Laden der Verfügbarkeit" });
    }
  }

  /**
   * Create new availability record
   * POST /api/availability
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const tenantId = req.user.tenant_id;
      const userId = req.user.id;

      const { employee_id, status, start_date, end_date, reason, notes } =
        req.body as {
          employee_id?: number;
          status?: string;
          start_date?: string;
          end_date?: string;
          reason?: string;
          notes?: string;
        };

      // Validate required fields
      if (
        employee_id === undefined ||
        status === undefined ||
        status === "" ||
        start_date === undefined ||
        start_date === "" ||
        end_date === undefined ||
        end_date === ""
      ) {
        res.status(400).json({
          error: "Mitarbeiter, Status, Start- und Enddatum sind erforderlich",
        });
        return;
      }

      // Validate dates
      const start = new Date(start_date);
      const end = new Date(end_date);
      if (end < start) {
        res.status(400).json({
          error: "Enddatum muss nach oder gleich dem Startdatum sein",
        });
        return;
      }

      // Check permission - only admin/root can create for others
      if (req.user.role === "employee" && employee_id !== userId) {
        res.status(403).json({
          error: "Mitarbeiter können nur ihre eigene Verfügbarkeit ändern",
        });
        return;
      }

      const id = await availabilityService.create({
        employeeId: employee_id,
        tenant_id: tenantId,
        status: status as
          | "available"
          | "unavailable"
          | "vacation"
          | "sick"
          | "other"
          | "training",
        startDate: start_date,
        endDate: end_date,
        reason,
        notes,
        createdBy: userId,
      });

      const created = await availabilityService.getById(id, tenantId);
      res.status(201).json(created);
    } catch (error: unknown) {
      console.error("Error in AvailabilityController.create:", error);
      res
        .status(500)
        .json({ error: "Fehler beim Erstellen der Verfügbarkeit" });
    }
  }

  /**
   * Update availability record
   * PUT /api/availability/:id
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const tenantId = req.user.tenant_id;
      const userId = req.user.id;

      const id = parseInt(req.params.id);
      const { status, start_date, end_date, reason, notes } = req.body as {
        status?: string;
        start_date?: string;
        end_date?: string;
        reason?: string;
        notes?: string;
      };

      // Get existing record
      const existing = await availabilityService.getById(id, tenantId);
      if (existing === null) {
        res.status(404).json({ error: "Verfügbarkeit nicht gefunden" });
        return;
      }

      // Check permission
      if (req.user.role === "employee" && existing.employeeId !== userId) {
        res.status(403).json({
          error: "Mitarbeiter können nur ihre eigene Verfügbarkeit ändern",
        });
        return;
      }

      // Validate dates if provided
      if (
        start_date !== undefined &&
        start_date !== "" &&
        end_date !== undefined &&
        end_date !== ""
      ) {
        const start = new Date(start_date);
        const end = new Date(end_date);
        if (end < start) {
          res.status(400).json({
            error: "Enddatum muss nach oder gleich dem Startdatum sein",
          });
          return;
        }
      }

      const success = await availabilityService.update(id, tenantId, {
        status: status as
          | "available"
          | "unavailable"
          | "vacation"
          | "sick"
          | "other"
          | "training",
        startDate: start_date,
        endDate: end_date,
        reason,
        notes,
      });

      if (!success) {
        res
          .status(500)
          .json({ error: "Fehler beim Aktualisieren der Verfügbarkeit" });
        return;
      }

      const updated = await availabilityService.getById(id, tenantId);
      res.json(updated);
    } catch (error: unknown) {
      console.error("Error in AvailabilityController.update:", error);
      res
        .status(500)
        .json({ error: "Fehler beim Aktualisieren der Verfügbarkeit" });
    }
  }

  /**
   * Delete availability record
   * DELETE /api/availability/:id
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const tenantId = req.user.tenant_id;
      const userId = req.user.id;

      const id = parseInt(req.params.id);

      // Get existing record
      const existing = await availabilityService.getById(id, tenantId);
      if (existing === null) {
        res.status(404).json({ error: "Verfügbarkeit nicht gefunden" });
        return;
      }

      // Check permission
      if (req.user.role === "employee" && existing.employeeId !== userId) {
        res.status(403).json({
          error: "Mitarbeiter können nur ihre eigene Verfügbarkeit löschen",
        });
        return;
      }

      const success = await availabilityService.delete(id, tenantId);

      if (!success) {
        res
          .status(500)
          .json({ error: "Fehler beim Löschen der Verfügbarkeit" });
        return;
      }

      res.json({ message: "Verfügbarkeit erfolgreich gelöscht" });
    } catch (error: unknown) {
      console.error("Error in AvailabilityController.delete:", error);
      res.status(500).json({ error: "Fehler beim Löschen der Verfügbarkeit" });
    }
  }
}

// Export singleton instance
const availabilityController = new AvailabilityController();
export default availabilityController;

// Named export for the class
export { AvailabilityController };
