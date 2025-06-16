/**
 * Employee Availability Routes
 * Endpoints for managing employee vacation, sick leave, etc.
 */

import express from "express";
import availabilityController from "../controllers/availability.controller";
import { authenticateToken } from "../middleware/auth";
import { checkFeature } from "../middleware/features";

const router = express.Router();

// Get current availability status for all employees
router.get(
  "/current",
  authenticateToken as any,
  checkFeature("shift_planning") as any,
  availabilityController.getCurrentStatus.bind(availabilityController) as any,
);

// Get availability summary for date range
router.get(
  "/summary",
  authenticateToken as any,
  checkFeature("shift_planning") as any,
  availabilityController.getSummary.bind(availabilityController) as any,
);

// Get all availability records (with filters)
router.get(
  "/",
  authenticateToken as any,
  checkFeature("shift_planning") as any,
  availabilityController.getAll.bind(availabilityController) as any,
);

// Get specific availability record
router.get(
  "/:id",
  authenticateToken as any,
  checkFeature("shift_planning") as any,
  availabilityController.getById.bind(availabilityController) as any,
);

// Create new availability record
router.post(
  "/",
  authenticateToken as any,
  checkFeature("shift_planning") as any,
  availabilityController.create.bind(availabilityController) as any,
);

// Update availability record
router.put(
  "/:id",
  authenticateToken as any,
  checkFeature("shift_planning") as any,
  availabilityController.update.bind(availabilityController) as any,
);

// Delete availability record
router.delete(
  "/:id",
  authenticateToken as any,
  checkFeature("shift_planning") as any,
  availabilityController.delete.bind(availabilityController) as any,
);

export default router;
