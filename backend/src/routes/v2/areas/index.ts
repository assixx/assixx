/**
 * Areas Routes v2
 * API endpoints for area/location management
 */
import { Router } from 'express';

import { security } from '../../../middleware/security.js';
import { typed } from '../../../utils/routeHandlers.js';
import {
  createAreaController,
  deleteAreaController,
  getAreaByIdController,
  getAreaHierarchyController,
  getAreaStatsController,
  getAreasController,
  updateAreaController,
} from './areas.controller.js';

const router = Router();

// Get all areas (all authenticated users)
router.get('/', ...security.user(), typed.auth(getAreasController));

// Get area hierarchy (all authenticated users)
router.get('/hierarchy', ...security.user(), typed.auth(getAreaHierarchyController));

// Get area statistics (all authenticated users)
router.get('/stats', ...security.user(), typed.auth(getAreaStatsController));

// Get area by ID (all authenticated users)
router.get('/:id', ...security.user(), typed.auth(getAreaByIdController));

// Create new area (admin/root only)
router.post('/', ...security.admin(), typed.auth(createAreaController));

// Update area (admin/root only)
router.put('/:id', ...security.admin(), typed.auth(updateAreaController));

// Delete area (admin/root only)
router.delete('/:id', ...security.admin(), typed.auth(deleteAreaController));

export default router;
