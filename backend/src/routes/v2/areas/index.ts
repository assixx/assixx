/**
 * Areas Routes v2
 * API endpoints for area/location management
 */

import { Router } from "express";

import { security } from "../../../middleware/security.js";
import { typed } from "../../../utils/routeHandlers.js";

import {
  getAreasController,
  getAreaHierarchyController,
  getAreaByIdController,
  createAreaController,
  updateAreaController,
  deleteAreaController,
  getAreaStatsController,
} from "./areas.controller.js";
import {
  getAreasValidation,
  getAreaByIdValidation,
  createAreaValidation,
  updateAreaValidation,
  deleteAreaValidation,
} from "./areas.validation.js";

const router = Router();

// Get all areas (all authenticated users)
router.get(
  "/",
  ...security.user(),
  getAreasValidation,
  typed.auth(getAreasController),
);

// Get area hierarchy (all authenticated users)
router.get(
  "/hierarchy",
  ...security.user(),
  typed.auth(getAreaHierarchyController),
);

// Get area statistics (all authenticated users)
router.get("/stats", ...security.user(), typed.auth(getAreaStatsController));

// Get area by ID (all authenticated users)
router.get(
  "/:id",
  ...security.user(),
  getAreaByIdValidation,
  typed.auth(getAreaByIdController),
);

// Create new area (admin/root only)
router.post(
  "/",
  ...security.admin(),
  createAreaValidation,
  typed.auth(createAreaController),
);

// Update area (admin/root only)
router.put(
  "/:id",
  ...security.admin(),
  updateAreaValidation,
  typed.auth(updateAreaController),
);

// Delete area (admin/root only)
router.delete(
  "/:id",
  ...security.admin(),
  deleteAreaValidation,
  typed.auth(deleteAreaController),
);

export default router;
