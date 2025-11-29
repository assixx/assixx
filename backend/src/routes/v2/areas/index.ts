/**
 * Areas Routes v2
 * API endpoints for area/location management
 */
import { RequestHandler, Router } from 'express';

import { filterAreasByAccess } from '../../../middleware/departmentAccess.js';
import { security } from '../../../middleware/security.js';
import { typed } from '../../../utils/routeHandlers.js';
import {
  assignDepartmentsController,
  createAreaController,
  deleteAreaController,
  getAreaByIdController,
  getAreaStatsController,
  getAreasController,
  updateAreaController,
} from './areas.controller.js';
import { areasValidationZod } from './areas.validation.zod.js';

const router = Router();

// Get all areas (filtered by user's accessible areas)
router.get(
  '/',
  ...security.user(),
  filterAreasByAccess as RequestHandler, // Filter by user's accessible areas
  areasValidationZod.list,
  typed.auth(getAreasController),
);

// NOTE: /hierarchy endpoint removed (2025-11-29) - areas are now flat (non-hierarchical)

// Get area statistics (all authenticated users)
router.get('/stats', ...security.user(), typed.auth(getAreaStatsController));

// Get area by ID (all authenticated users)
router.get(
  '/:id',
  ...security.user(),
  areasValidationZod.getById,
  typed.auth(getAreaByIdController),
);

// Create new area (admin/root only)
router.post('/', ...security.admin(), areasValidationZod.create, typed.auth(createAreaController));

// Update area (admin/root only)
router.put(
  '/:id',
  ...security.admin(),
  ...areasValidationZod.update,
  typed.auth(updateAreaController),
);

// Delete area (admin/root only)
router.delete(
  '/:id',
  ...security.admin(),
  areasValidationZod.delete,
  typed.auth(deleteAreaController),
);

// Assign departments to area (admin/root only)
router.post(
  '/:id/departments',
  ...security.admin(),
  areasValidationZod.getById, // Validates :id param
  typed.auth(assignDepartmentsController),
);

export default router;
