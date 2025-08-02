/**
 * Root API v2 Routes
 * Route definitions for root user operations
 */

import { Router } from "express";
import { param, body } from "express-validator";

import { security } from "../../../middleware/security.js";
import { createValidation } from "../../../middleware/validation.js";
import { typed } from "../../../utils/routeHandlers.js";

import { rootController } from "./root.controller.js";

const router = Router();

// Admin Management Routes
router.get("/admins", ...security.root(), typed.auth(rootController.getAdmins));

router.get(
  "/admins/:id",
  ...security.root(
    createValidation([
      param("id").isInt({ min: 1 }).withMessage("Invalid admin ID"),
    ]),
  ),
  typed.params<{ id: string }>(rootController.getAdminById),
);

router.post(
  "/admins",
  ...security.root(
    createValidation([
      body("username").isString().notEmpty(),
      body("email").isEmail(),
      body("password").isString().isLength({ min: 6 }),
      body("firstName").optional().isString(),
      body("lastName").optional().isString(),
      body("company").optional().isString(),
      body("notes").optional().isString(),
    ]),
  ),
  typed.body(rootController.createAdmin),
);

router.put(
  "/admins/:id",
  ...security.root(
    createValidation([
      param("id").isInt({ min: 1 }).withMessage("Invalid admin ID"),
      body("username").optional().isString(),
      body("email").optional().isEmail(),
      body("password").optional().isString().isLength({ min: 6 }),
      body("firstName").optional().isString(),
      body("lastName").optional().isString(),
      body("company").optional().isString(),
      body("notes").optional().isString(),
      body("isActive").optional().isBoolean(),
    ]),
  ),
  typed.paramsBody<{ id: string }, unknown>(rootController.updateAdmin),
);

router.delete(
  "/admins/:id",
  ...security.root(
    createValidation([
      param("id").isInt({ min: 1 }).withMessage("Invalid admin ID"),
    ]),
  ),
  typed.params<{ id: string }>(rootController.deleteAdmin),
);

router.get(
  "/admins/:id/logs",
  ...security.root(
    createValidation([
      param("id").isInt({ min: 1 }).withMessage("Invalid admin ID"),
    ]),
  ),
  typed.params<{ id: string }>(rootController.getAdminLogs),
);

// Tenant Management Routes
router.get(
  "/tenants",
  ...security.root(),
  typed.auth(rootController.getTenants),
);

// Root User Management Routes
router.get(
  "/users",
  ...security.root(),
  typed.auth(rootController.getRootUsers),
);

router.get(
  "/users/:id",
  ...security.root(
    createValidation([
      param("id").isInt({ min: 1 }).withMessage("Invalid user ID"),
    ]),
  ),
  typed.params<{ id: string }>(rootController.getRootUserById),
);

router.post(
  "/users",
  ...security.root(
    createValidation([
      body("username").isString().notEmpty(),
      body("email").isEmail(),
      body("password").isString().isLength({ min: 6 }),
      body("firstName").isString().notEmpty(),
      body("lastName").isString().notEmpty(),
      body("position").optional().isString(),
      body("notes").optional().isString(),
      body("isActive").optional().isBoolean(),
    ]),
  ),
  typed.body(rootController.createRootUser),
);

router.put(
  "/users/:id",
  ...security.root(
    createValidation([
      param("id").isInt({ min: 1 }).withMessage("Invalid user ID"),
      body("firstName").optional().isString(),
      body("lastName").optional().isString(),
      body("email").optional().isEmail(),
      body("position").optional().isString(),
      body("notes").optional().isString(),
      body("isActive").optional().isBoolean(),
    ]),
  ),
  typed.paramsBody<{ id: string }, unknown>(rootController.updateRootUser),
);

router.delete(
  "/users/:id",
  ...security.root(
    createValidation([
      param("id").isInt({ min: 1 }).withMessage("Invalid user ID"),
    ]),
  ),
  typed.params<{ id: string }>(rootController.deleteRootUser),
);

// Dashboard & System Info Routes
router.get(
  "/dashboard",
  ...security.root(),
  typed.auth(rootController.getDashboard),
);

router.get(
  "/storage",
  ...security.root(),
  typed.auth(rootController.getStorageInfo),
);

// Tenant Deletion Routes
router.post(
  "/tenant/deletion",
  ...security.root(createValidation([body("reason").optional().isString()])),
  typed.body(rootController.requestTenantDeletion),
);

router.get(
  "/tenant/deletion-status",
  ...security.root(),
  typed.auth(rootController.getDeletionStatus),
);

router.post(
  "/tenant/cancel-deletion",
  ...security.root(),
  typed.auth(rootController.cancelDeletion),
);

router.post(
  "/tenant/deletion-dry-run",
  ...security.root(),
  typed.auth(rootController.deletionDryRun),
);

// Deletion Approval Routes
router.get(
  "/deletion-approvals",
  ...security.root(),
  typed.auth(rootController.getAllDeletionRequests),
);

router.get(
  "/deletion-approvals/pending",
  ...security.root(),
  typed.auth(rootController.getPendingApprovals),
);

router.post(
  "/deletion-approvals/:queueId/approve",
  ...security.root(
    createValidation([
      param("queueId").isInt({ min: 1 }),
      body("comment").optional().isString(),
    ]),
  ),
  typed.paramsBody<{ queueId: string }, { comment?: string }>(
    rootController.approveDeletion,
  ),
);

router.post(
  "/deletion-approvals/:queueId/reject",
  ...security.root(
    createValidation([
      param("queueId").isInt({ min: 1 }),
      body("reason").isString().notEmpty(),
    ]),
  ),
  typed.paramsBody<{ queueId: string }, { reason: string }>(
    rootController.rejectDeletion,
  ),
);

router.post(
  "/deletion-queue/:queueId/emergency-stop",
  ...security.root(createValidation([param("queueId").isInt({ min: 1 })])),
  typed.params<{ queueId: string }>(rootController.emergencyStop),
);

export default router;
