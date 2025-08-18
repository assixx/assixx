/**
 * Areas Routes
 * API endpoints for area/location management
 */

import express, { Router } from "express";
import { authenticateToken } from "../auth";
import type { AuthenticatedRequest } from "../types/request.types";
import { getErrorMessage } from "../utils/errorHandler";

const router: Router = express.Router();

// Request body interfaces
interface CreateAreaBody {
  name: string;
  description?: string;
  type?: string;
  capacity?: number;
}

// Area type definition
interface Area {
  id: number;
  name: string;
  description?: string;
  type: string;
  capacity?: number;
  tenant_id: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Get all areas for the authenticated tenant
 * GET /api/areas
 */
router.get("/", authenticateToken, (req, res): void => {
  // Type assertion after authentication middleware
  const authReq = req as AuthenticatedRequest;
  try {
    if (authReq.tenantId == null || authReq.tenantId === 0) {
      res.status(401).json({
        success: false,
        message: "Tenant ID not found",
      });
      return;
    }
    // Mock implementation - replace with actual database query
    const areas: Area[] = [
      {
        id: 1,
        name: "Hauptgebäude",
        description: "Verwaltungsgebäude mit Büros",
        type: "building",
        capacity: 100,
        tenant_id: authReq.tenantId,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 2,
        name: "Lager Nord",
        description: "Hauptlagerbereich",
        type: "warehouse",
        capacity: 500,
        tenant_id: authReq.tenantId,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    // Filter by tenant_id
    const tenantAreas = areas.filter(
      (area) => area.tenant_id === authReq.tenantId,
    );

    res.json({
      success: true,
      data: tenantAreas,
      meta: {
        total: tenantAreas.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error("[Areas] List error:", error);
    res.status(500).json({
      success: false,
      message: "Fehler beim Abrufen der Bereiche",
      error: getErrorMessage(error),
    });
  }
});

/**
 * Get area by ID
 * GET /api/areas/:id
 */
router.get("/:id", authenticateToken, (req, res): void => {
  // Type assertion after authentication middleware
  const authReq = req as AuthenticatedRequest;

  try {
    if (authReq.tenantId == null || authReq.tenantId === 0) {
      res.status(401).json({
        success: false,
        message: "Tenant ID not found",
      });
      return;
    }
    const areaId = Number.parseInt(authReq.params.id);

    // Mock implementation
    const area: Area = {
      id: areaId,
      name: "Beispielbereich",
      description: "Ein Beispielbereich",
      type: "office",
      capacity: 50,
      tenant_id: authReq.tenantId,
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Check if area belongs to tenant
    if (area.tenant_id !== authReq.tenantId) {
      res.status(404).json({
        success: false,
        message: "Bereich nicht gefunden",
      });
      return;
    }

    res.json({
      success: true,
      data: area,
    });
  } catch (error: unknown) {
    console.error("[Areas] Get by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Fehler beim Abrufen des Bereichs",
      error: getErrorMessage(error),
    });
  }
});

/**
 * Create new area (Admin only)
 * POST /api/areas
 */
router.post("/", authenticateToken, (req, res): void => {
  // Type assertion after authentication middleware
  const authReq = req as AuthenticatedRequest;

  try {
    // Check admin permission
    if (!["admin", "root", "manager"].includes(authReq.user.role)) {
      res.status(403).json({
        success: false,
        message: "Keine Berechtigung zum Erstellen von Bereichen",
      });
      return;
    }

    if (authReq.tenantId == null || authReq.tenantId === 0) {
      res.status(401).json({
        success: false,
        message: "Tenant ID not found",
      });
      return;
    }

    // Type-safe body parsing
    const body = authReq.body as CreateAreaBody;

    if (!body.name) {
      res.status(400).json({
        success: false,
        message: "Name ist erforderlich",
      });
      return;
    }

    // Mock implementation - replace with actual database insert
    const newArea: Area = {
      id: Math.floor(Math.random() * 1000),
      name: body.name,
      description: body.description,
      type: body.type ?? "general",
      capacity: body.capacity,
      tenant_id: authReq.tenantId,
      created_at: new Date(),
      updated_at: new Date(),
    };

    res.status(201).json({
      success: true,
      data: newArea,
      message: "Bereich erfolgreich erstellt",
    });
  } catch (error: unknown) {
    console.error("[Areas] Create error:", error);
    res.status(500).json({
      success: false,
      message: "Fehler beim Erstellen des Bereichs",
      error: getErrorMessage(error),
    });
  }
});

export default router;
