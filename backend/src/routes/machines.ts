/**
 * Machines Routes
 * API endpoints for machine management
 */

import express, { Router, Request } from "express";
import { authenticateToken } from "../auth";
import { getErrorMessage } from "../utils/errorHandler";

const router: Router = express.Router();

// Extended Request interfaces
interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
    tenant_id: number;
  };
}

// Removed unused interfaces - MachinesListRequest, MachineByIdRequest, MachineCreateRequest

// Machine type definition
interface Machine {
  id: number;
  name: string;
  department_id: number;
  status: string;
  description?: string;
  location?: string;
  maintenance_schedule?: string;
  created_at?: Date;
}

/**
 * Get all machines
 * GET /api/machines
 */
router.get("/", authenticateToken, (req, res): void => {
  try {
    // const authReq = req as AuthenticatedRequest;
    // For now, return dummy machine data
    // In production, this would query the machines table
    const machines: Machine[] = [
      { id: 1, name: "Anlage 01", department_id: 1, status: "active" },
      { id: 2, name: "Anlage 02", department_id: 1, status: "active" },
      { id: 3, name: "Förderband A", department_id: 2, status: "active" },
      { id: 4, name: "Förderband B", department_id: 2, status: "active" },
      { id: 5, name: "Prüfstand 01", department_id: 3, status: "maintenance" },
      { id: 6, name: "Prüfstand 02", department_id: 3, status: "active" },
    ];

    // Filter by department if requested
    const departmentId = req.query.department_id;
    let filteredMachines = machines;

    if (departmentId !== undefined && departmentId !== "") {
      filteredMachines = machines.filter(
        (machine) =>
          machine.department_id ==
          Number.parseInt(
            typeof departmentId === "string"
              ? departmentId
              : typeof departmentId === "number"
                ? String(departmentId)
                : "0",
          ),
      );
    }

    res.json({
      success: true,
      machines: filteredMachines,
    });
  } catch (error: unknown) {
    console.error("Error fetching machines:", getErrorMessage(error));
    res.status(500).json({
      success: false,
      message: "Fehler beim Laden der Maschinen",
    });
  }
});

/**
 * Get machine by ID
 * GET /api/machines/:id
 */
router.get("/:id", authenticateToken, (req, res): void => {
  try {
    // const authReq = req as AuthenticatedRequest;
    const machineId = Number.parseInt(req.params.id);

    // Dummy machine data
    const machine: Machine = {
      id: machineId,
      name: `Maschine ${machineId}`,
      department_id: 1,
      status: "active",
      description: "Automatisch generierte Maschine",
      location: "Halle A",
      maintenance_schedule: "Wöchentlich",
    };

    res.json({
      success: true,
      machine,
    });
  } catch (error: unknown) {
    console.error("Error fetching machine:", getErrorMessage(error));
    res.status(500).json({
      success: false,
      message: "Fehler beim Laden der Maschine",
    });
  }
});

/**
 * Create new machine (Admin only)
 * POST /api/machines
 */
router.post("/", authenticateToken, (req, res): void => {
  try {
    const authReq = req as AuthenticatedRequest;
    // Check admin permission
    if (!["admin", "root", "manager"].includes(authReq.user.role)) {
      res.status(403).json({
        success: false,
        message: "Keine Berechtigung zum Erstellen von Maschinen",
      });
      return;
    }

    const { name, department_id, description, location } = req.body as {
      name?: string;
      department_id?: number;
      description?: string;
      location?: string;
    };

    if (
      name == null ||
      name === "" ||
      department_id == null ||
      department_id === 0
    ) {
      res.status(400).json({
        success: false,
        message: "Name und Abteilung sind erforderlich",
      });
      return;
    }

    // For now, return dummy created machine
    const machine: Machine = {
      id: Date.now(),
      name: name,
      department_id: department_id,
      description: description ?? undefined,
      location: location ?? undefined,
      status: "active",
      created_at: new Date(),
    };

    res.status(201).json({
      success: true,
      message: "Maschine erfolgreich erstellt",
      machine,
    });
  } catch (error: unknown) {
    console.error("Error creating machine:", getErrorMessage(error));
    res.status(500).json({
      success: false,
      message: "Fehler beim Erstellen der Maschine",
    });
  }
});

export default router;

// CommonJS compatibility
