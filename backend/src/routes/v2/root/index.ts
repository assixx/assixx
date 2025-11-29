/**
 * Root API v2 Routes
 * Route definitions for root user operations
 */
import { Router } from 'express';
import { z } from 'zod';

import { security } from '../../../middleware/security.js';
import {
  validate,
  validateBody,
  validateParams,
  validateQuery,
} from '../../../middleware/validation.zod.js';
import { typed } from '../../../utils/routeHandlers.js';
import { rootController } from './root.controller.js';
import {
  AdminIdParamSchema,
  CreateAdminSchema,
  RootApiFiltersSchema,
  UpdateAdminSchema,
  UpdateRootUserSchema,
} from './root.validation.zod.js';

const router = Router();

// Admin Management Routes
router.get(
  '/admins',
  ...security.root(),
  validateQuery(RootApiFiltersSchema), // Add query validation
  typed.auth(rootController.getAdmins.bind(rootController)),
);

router.get(
  '/admins/:id',
  ...security.root(),
  validateParams(AdminIdParamSchema), // Use centralized schema
  typed.params<{ id: string }>(rootController.getAdminById.bind(rootController)),
);

router.post(
  '/admins',
  ...security.root(),
  validateBody(CreateAdminSchema), // Use centralized schema
  typed.body(rootController.createAdmin.bind(rootController)),
);

router.put(
  '/admins/:id',
  ...security.root(),
  validate({
    params: AdminIdParamSchema,
    body: UpdateAdminSchema,
  }),
  typed.paramsBody<{ id: string }>(rootController.updateAdmin.bind(rootController)),
);

router.delete(
  '/admins/:id',
  ...security.root(),
  validateParams(AdminIdParamSchema),
  typed.params<{ id: string }>(rootController.deleteAdmin.bind(rootController)),
);

router.get(
  '/admins/:id/logs',
  ...security.root(),
  validateParams(AdminIdParamSchema),
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
  ...security.root(),
  validateParams(z.object({ id: z.coerce.number().int().min(1, 'Invalid user ID') })),
  typed.params<{ id: string }>(rootController.getRootUserById.bind(rootController)),
);

router.post(
  '/users',
  ...security.root(),
  validateBody(
    z.object({
      username: z.string().min(1),
      email: z.email(),
      password: z.string().min(6),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      position: z.string().optional(),
      notes: z.string().optional(),
      employeeNumber: z.string().optional(),
      departmentId: z.number().optional(),
      isActive: z.boolean().optional(),
    }),
  ),
  typed.body(rootController.createRootUser.bind(rootController)),
);

router.put(
  '/users/:id',
  ...security.root(),
  validate({
    params: z.object({
      id: z.coerce.number().int().min(1, 'Invalid user ID'),
    }),
    body: UpdateRootUserSchema,
  }),
  typed.paramsBody<{ id: string }>(rootController.updateRootUser.bind(rootController)),
);

router.delete(
  '/users/:id',
  ...security.root(),
  validateParams(z.object({ id: z.coerce.number().int().min(1, 'Invalid user ID') })),
  typed.params<{ id: string }>(rootController.deleteRootUser.bind(rootController)),
);

// Dashboard & System Info Routes
router.get(
  '/dashboard',
  ...security.root(),
  typed.auth(rootController.getDashboard.bind(rootController)),
);

router.get(
  '/stats',
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
  ...security.root(),
  validateBody(
    z.object({
      reason: z.string().optional(),
    }),
  ),
  typed.paramsBody<Record<string, never>, { reason?: string }>(
    rootController.deleteCurrentTenant.bind(rootController),
  ),
);

router.post(
  '/tenant/deletion',
  ...security.root(),
  validateBody(
    z.object({
      reason: z.string().optional(),
    }),
  ),
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
  ...security.root(),
  validate({
    params: z.object({
      queueId: z.coerce.number().int().min(1),
    }),
    body: z.object({
      comment: z.string().optional(),
    }),
  }),
  typed.paramsBody<{ queueId: string }, { comment?: string }>(
    rootController.approveDeletion.bind(rootController),
  ),
);

router.post(
  '/deletion-approvals/:queueId/reject',
  ...security.root(),
  validate({
    params: z.object({
      queueId: z.coerce.number().int().min(1),
    }),
    body: z.object({
      reason: z.string().min(1),
    }),
  }),
  typed.paramsBody<{ queueId: string }, { reason: string }>(
    rootController.rejectDeletion.bind(rootController),
  ),
);

router.post(
  '/deletion-queue/:queueId/emergency-stop',
  ...security.root(),
  validateParams(z.object({ queueId: z.coerce.number().int().min(1) })),
  typed.params<{ queueId: string }>(rootController.emergencyStop.bind(rootController)),
);

export default router;
