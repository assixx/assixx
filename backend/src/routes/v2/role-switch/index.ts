/**
 * Role Switch API v2 Routes
 * Enhanced security and standardized responses
 */
import { Router } from 'express';

import { securityV2 } from '../../../middleware/v2/security.middleware.js';
import { typed } from '../../../utils/routeHandlers.js';
import { RoleSwitchController } from './role-switch.controller.js';

const router = Router();

/**
 * @swagger
 * /api/v2/role-switch/to-employee:
 *   post:
 *     summary: Switch to employee view
 *     description: Allows admin and root users to switch their view to employee mode
 *     tags: [Role Switch]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully switched to employee view
 *       403:
 *         description: Insufficient permissions
 */
router.post(
  '/to-employee',
  ...securityV2.user(), // Any authenticated user, but service checks for admin/root
  typed.auth(RoleSwitchController.switchToEmployee),
);

/**
 * @swagger
 * /api/v2/role-switch/to-original:
 *   post:
 *     summary: Switch back to original role
 *     description: Switch back from employee view to original role (admin/root)
 *     tags: [Role Switch]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully switched back to original role
 *       403:
 *         description: Insufficient permissions
 */
router.post(
  '/to-original',
  ...securityV2.user(),
  typed.auth(RoleSwitchController.switchToOriginal),
);

/**
 * @swagger
 * /api/v2/role-switch/root-to-admin:
 *   post:
 *     summary: Switch root to admin view
 *     description: Allows root users to switch their view to admin mode
 *     tags: [Role Switch]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully switched to admin view
 *       403:
 *         description: Only root users can use this endpoint
 */
router.post('/root-to-admin', ...securityV2.user(), typed.auth(RoleSwitchController.rootToAdmin));

/**
 * @swagger
 * /api/v2/role-switch/status:
 *   get:
 *     summary: Get role switch status
 *     description: Get current role switch status and permissions
 *     tags: [Role Switch]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current role switch status
 */
router.get('/status', ...securityV2.user(), typed.auth(RoleSwitchController.getStatus));

export default router;
