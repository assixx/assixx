/**
 * Root API v2 Routes
 * Route definitions for root user operations
 */
import { Router } from 'express';
import { body, param } from 'express-validator';

import { security } from '../../../middleware/security.js';
import { createValidation } from '../../../middleware/validation.js';
import { typed } from '../../../utils/routeHandlers.js';
import { rootController } from './root.controller.js';

const router = Router();

// Admin Management Routes
router.get(
  '/admins',
  ...security.root(),
  typed.auth(rootController.getAdmins.bind(rootController)),
);

router.get(
  '/admins/:id',
  ...security.root(
    createValidation([param('id').isInt({ min: 1 }).withMessage('Invalid admin ID')]),
  ),
  typed.params<{ id: string }>(rootController.getAdminById.bind(rootController)),
);

router.post(
  '/admins',
  ...security.root(
    createValidation([
      body('username').isString().notEmpty(),
      body('email').isEmail(),
      body('password').isString().isLength({ min: 6 }),
      body('firstName').optional().isString(),
      body('lastName').optional().isString(),
      body('company').optional().isString(),
      body('notes').optional().isString(),
    ]),
  ),
  typed.body(rootController.createAdmin.bind(rootController)),
);

router.put(
  '/admins/:id',
  ...security.root(
    createValidation([
      param('id').isInt({ min: 1 }).withMessage('Invalid admin ID'),
      body('username').optional().isString(),
      body('email').optional().isEmail(),
      body('password').optional().isString().isLength({ min: 6 }),
      body('firstName').optional().isString(),
      body('lastName').optional().isString(),
      body('company').optional().isString(),
      body('notes').optional().isString(),
      body('isActive').optional().isBoolean(),
    ]),
  ),
  typed.paramsBody<{ id: string }>(rootController.updateAdmin.bind(rootController)),
);

router.delete(
  '/admins/:id',
  ...security.root(
    createValidation([param('id').isInt({ min: 1 }).withMessage('Invalid admin ID')]),
  ),
  typed.params<{ id: string }>(rootController.deleteAdmin.bind(rootController)),
);

router.get(
  '/admins/:id/logs',
  ...security.root(
    createValidation([param('id').isInt({ min: 1 }).withMessage('Invalid admin ID')]),
  ),
  typed.params<{ id: string }>(rootController.getAdminLogs.bind(rootController)),
);

// Tenant Management Routes
router.get(
  '/tenants',
  ...security.root(),
  typed.auth(rootController.getTenants.bind(rootController)),
);

// Root User Management Routes
router.get(
  '/users',
  ...security.root(),
  typed.auth(rootController.getRootUsers.bind(rootController)),
);

router.get(
  '/users/:id',
  ...security.root(
    createValidation([param('id').isInt({ min: 1 }).withMessage('Invalid user ID')]),
  ),
  typed.params<{ id: string }>(rootController.getRootUserById.bind(rootController)),
);

router.post(
  '/users',
  ...security.root(
    createValidation([
      body('username').isString().notEmpty(),
      body('email').isEmail(),
      body('password').isString().isLength({ min: 6 }),
      body('firstName').isString().notEmpty(),
      body('lastName').isString().notEmpty(),
      body('position').optional().isString(),
      body('notes').optional().isString(),
      body('employeeNumber').optional().isString(),
      body('departmentId').optional().isNumeric(),
      body('isActive').optional().isBoolean(),
    ]),
  ),
  typed.body(rootController.createRootUser.bind(rootController)),
);

router.put(
  '/users/:id',
  ...security.root(
    createValidation([
      param('id').isInt({ min: 1 }).withMessage('Invalid user ID'),
      body('firstName').optional().isString(),
      body('lastName').optional().isString(),
      body('email').optional().isEmail(),
      body('position').optional().isString(),
      body('notes').optional().isString(),
      body('employeeNumber').optional().isString(),
      body('departmentId').optional().isNumeric(),
      body('isActive').optional().isBoolean(),
    ]),
  ),
  typed.paramsBody<{ id: string }>(rootController.updateRootUser.bind(rootController)),
);

router.delete(
  '/users/:id',
  ...security.root(
    createValidation([param('id').isInt({ min: 1 }).withMessage('Invalid user ID')]),
  ),
  typed.params<{ id: string }>(rootController.deleteRootUser.bind(rootController)),
);

// Dashboard & System Info Routes
router.get(
  '/dashboard',
  ...security.root(),
  typed.auth(rootController.getDashboard.bind(rootController)),
);

router.get(
  '/storage',
  ...security.root(),
  typed.auth(rootController.getStorageInfo.bind(rootController)),
);

// Tenant Deletion Routes

// DELETE /tenants/current - Compatible with v1 API
router.delete(
  '/tenants/current',
  ...security.root(createValidation([body('reason').optional().isString()])),
  typed.paramsBody<Record<string, never>, { reason?: string }>(
    rootController.deleteCurrentTenant.bind(rootController),
  ),
);

router.post(
  '/tenant/deletion',
  ...security.root(createValidation([body('reason').optional().isString()])),
  typed.body(rootController.requestTenantDeletion.bind(rootController)),
);

router.get(
  '/tenant/deletion-status',
  ...security.root(),
  typed.auth(rootController.getDeletionStatus.bind(rootController)),
);

router.post(
  '/tenant/cancel-deletion',
  ...security.root(),
  typed.auth(rootController.cancelDeletion.bind(rootController)),
);

router.post(
  '/tenant/deletion-dry-run',
  ...security.root(),
  typed.auth(rootController.deletionDryRun.bind(rootController)),
);

// Deletion Approval Routes
router.get(
  '/deletion-approvals',
  ...security.root(),
  typed.auth(rootController.getAllDeletionRequests.bind(rootController)),
);

router.get(
  '/deletion-approvals/pending',
  ...security.root(),
  typed.auth(rootController.getPendingApprovals.bind(rootController)),
);

router.post(
  '/deletion-approvals/:queueId/approve',
  ...security.root(
    createValidation([param('queueId').isInt({ min: 1 }), body('comment').optional().isString()]),
  ),
  typed.paramsBody<{ queueId: string }, { comment?: string }>(
    rootController.approveDeletion.bind(rootController),
  ),
);

router.post(
  '/deletion-approvals/:queueId/reject',
  ...security.root(
    createValidation([param('queueId').isInt({ min: 1 }), body('reason').isString().notEmpty()]),
  ),
  typed.paramsBody<{ queueId: string }, { reason: string }>(
    rootController.rejectDeletion.bind(rootController),
  ),
);

router.post(
  '/deletion-queue/:queueId/emergency-stop',
  ...security.root(createValidation([param('queueId').isInt({ min: 1 })])),
  typed.params<{ queueId: string }>(rootController.emergencyStop.bind(rootController)),
);

export default router;
