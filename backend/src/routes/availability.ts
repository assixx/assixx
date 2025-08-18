/**
 * Employee Availability Routes
 * Endpoints for managing employee vacation, sick leave, etc.
 */

import express, { Router } from "express";

import availabilityController from "../controllers/availability.controller";
import { checkFeature } from "../middleware/features";
import { security } from "../middleware/security";

const router: Router = express.Router();

// Get current availability status for all employees
router.get(
  "/current",
  ...security.user(),
  checkFeature("shift_planning"),
  availabilityController.getCurrentStatus.bind(availabilityController),
);

// Get availability summary for date range
router.get(
  "/summary",
  ...security.user(),
  checkFeature("shift_planning"),
  availabilityController.getSummary.bind(availabilityController),
);

// Get all availability records (with filters)
router.get(
  "/",
  ...security.user(),
  checkFeature("shift_planning"),
  availabilityController.getAll.bind(availabilityController),
);

// Get specific availability record
router.get(
  "/:id",
  ...security.user(),
  checkFeature("shift_planning"),
  availabilityController.getById.bind(availabilityController),
);

// Create new availability record
router.post(
  "/",
  ...security.user(),
  checkFeature("shift_planning"),
  availabilityController.create.bind(availabilityController),
);

// Update availability record
router.put(
  "/:id",
  ...security.user(),
  checkFeature("shift_planning"),
  availabilityController.update.bind(availabilityController),
);

// Delete availability record
router.delete(
  "/:id",
  ...security.admin(),
  checkFeature("shift_planning"),
  availabilityController.delete.bind(availabilityController),
);

export default router;
