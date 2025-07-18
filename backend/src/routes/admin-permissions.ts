/**
 * Admin Permissions Routes
 * Handles department and group permissions for admin users
 */

import express, { Router } from "express";
import { RowDataPacket } from "mysql2/promise";

import { executeQuery } from "../config/database.js";
import { security } from "../middleware/security";
import { createValidation, body, param } from "../middleware/validation";
import adminPermissionService from "../services/adminPermission.service.js";
import { successResponse, errorResponse } from "../types/response.types";
import { getErrorMessage } from "../utils/errorHandler.js";
import { logger } from "../utils/logger.js";
import { typed } from "../utils/routeHandlers";

const router: Router = express.Router();

// Validation middleware
const validatePermissions = createValidation([
  body("departmentIds")
    .optional()
    .isArray()
    .withMessage("departmentIds muss ein Array sein"),
  body("departmentIds.*")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Ungültige Abteilungs-ID"),
  body("groupIds")
    .optional()
    .isArray()
    .withMessage("groupIds muss ein Array sein"),
  body("groupIds.*")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Ungültige Gruppen-ID"),
  body("permissions")
    .optional()
    .isObject()
    .withMessage("permissions muss ein Objekt sein"),
  body("permissions.can_read").optional().isBoolean(),
  body("permissions.can_write").optional().isBoolean(),
  body("permissions.can_delete").optional().isBoolean(),
]);

// Get departments for a specific admin
router.get(
  "/:adminId",
  ...security.root(
    createValidation([
      param("adminId").isInt({ min: 1 }).withMessage("Ungültige Admin-ID"),
    ]),
  ),
  typed.params<{ adminId: string }>(async (req, res) => {
    const adminId = parseInt(req.params.adminId);

    try {
      // Get the tenant_id from the admin being queried
      const [adminRows] = await executeQuery<RowDataPacket[]>(
        "SELECT tenant_id FROM users WHERE id = ?",
        [adminId],
      );

      if (!adminRows || adminRows.length === 0) {
        res.status(404).json({
          success: false,
          error: "Admin nicht gefunden",
        });
        return;
      }

      const targetTenantId = adminRows[0].tenant_id;

      const result = await adminPermissionService.getAdminDepartments(
        adminId,
        targetTenantId,
      );

      res.json(successResponse(result));
    } catch (error) {
      logger.error("Error getting admin departments:", error);
      res
        .status(500)
        .json(
          errorResponse(
            "Fehler beim Abrufen der Abteilungsberechtigungen",
            500,
          ),
        );
    }
  }),
);

// Get current admin's departments (for sidebar badge)
router.get(
  "/my-departments",
  ...security.user(),
  typed.auth(async (req, res) => {
    // Only admins need department info
    if (req.user.role !== "admin") {
      res.json(
        successResponse({
          departments: [],
          hasAllAccess: req.user.role === "root",
        }),
      );
      return;
    }

    try {
      const result = await adminPermissionService.getAdminDepartments(
        req.user.id,
        req.user.tenant_id,
      );

      res.json(successResponse(result));
    } catch (error) {
      logger.error("Error getting my departments:", error);
      res
        .status(500)
        .json(
          errorResponse("Fehler beim Abrufen der eigenen Abteilungen", 500),
        );
    }
  }),
);

// Set permissions for an admin
router.post(
  "/",
  ...security.root(validatePermissions),
  typed.auth(async (req, res) => {
    const {
      adminId,
      departmentIds = [],
      permissions = { can_read: true, can_write: false, can_delete: false },
    } = req.body as {
      adminId?: number;
      departmentIds?: number[];
      permissions?: {
        can_read: boolean;
        can_write: boolean;
        can_delete: boolean;
      };
    };

    if (!adminId) {
      res.status(400).json({
        success: false,
        error: "Admin-ID ist erforderlich",
      });
      return;
    }

    try {
      logger.info("[DEBUG] POST /admin-permissions called:", {
        adminId,
        departmentIds,
        permissions,
        userId: req.user.id,
        tenantId: req.user.tenant_id,
      });

      // Get the tenant_id from the admin being modified
      const [adminRows] = await executeQuery<RowDataPacket[]>(
        "SELECT tenant_id FROM users WHERE id = ?",
        [adminId],
      );

      if (!adminRows || adminRows.length === 0) {
        res.status(404).json({
          success: false,
          error: "Admin nicht gefunden",
        });
        return;
      }

      const targetTenantId = adminRows[0].tenant_id;
      logger.info("[DEBUG] Target tenant ID:", targetTenantId);

      const success = await adminPermissionService.setPermissions(
        adminId,
        departmentIds,
        req.user.id,
        targetTenantId,
        permissions,
      );

      if (success) {
        logger.info(
          `Root user ${req.user.id} set permissions for admin ${adminId}`,
        );
        res.json(successResponse(null, "Berechtigungen erfolgreich gesetzt"));
      } else {
        res
          .status(500)
          .json(errorResponse("Fehler beim Setzen der Berechtigungen", 500));
      }
    } catch (error) {
      logger.error("Error setting admin permissions:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Setzen der Berechtigungen", 500));
    }
  }),
);

// Set group permissions for an admin
router.post(
  "/groups",
  ...security.root(validatePermissions),
  typed.auth(async (req, res) => {
    const {
      adminId,
      groupIds = [],
      permissions = { can_read: true, can_write: false, can_delete: false },
    } = req.body as {
      adminId?: number;
      groupIds?: number[];
      permissions?: {
        can_read: boolean;
        can_write: boolean;
        can_delete: boolean;
      };
    };

    if (!adminId) {
      res.status(400).json({
        success: false,
        error: "Admin-ID ist erforderlich",
      });
      return;
    }

    try {
      const success = await adminPermissionService.setGroupPermissions(
        adminId,
        groupIds,
        req.user.id,
        req.user.tenant_id,
        permissions,
      );

      if (success) {
        logger.info(
          `Root user ${req.user.id} set group permissions for admin ${adminId}`,
        );
        res.json({
          success: true,
          message: "Gruppenberechtigungen erfolgreich gesetzt",
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Fehler beim Setzen der Gruppenberechtigungen",
        });
      }
    } catch (error) {
      logger.error(
        `Error setting admin group permissions: ${getErrorMessage(error)}`,
      );
      res.status(500).json({
        success: false,
        error: "Fehler beim Setzen der Gruppenberechtigungen",
      });
    }
  }),
);

// Remove specific department permission
router.delete(
  "/:adminId/:departmentId",
  ...security.root(
    createValidation([
      param("adminId").isInt({ min: 1 }).withMessage("Ungültige Admin-ID"),
      param("departmentId")
        .isInt({ min: 1 })
        .withMessage("Ungültige Abteilungs-ID"),
    ]),
  ),
  typed.params<{ adminId: string; departmentId: string }>(async (req, res) => {
    const adminId = parseInt(req.params.adminId);
    const departmentId = parseInt(req.params.departmentId);

    try {
      const success = await adminPermissionService.removePermission(
        adminId,
        departmentId,
        req.user.tenant_id,
      );

      if (success) {
        await adminPermissionService.logPermissionChange(
          "revoke",
          adminId,
          departmentId,
          "department",
          req.user.id,
          req.user.tenant_id,
        );

        res.json({
          success: true,
          message: "Berechtigung erfolgreich entfernt",
        });
      } else {
        res.status(404).json({
          success: false,
          error: "Berechtigung nicht gefunden",
        });
      }
    } catch (error) {
      logger.error(
        `Error removing admin permission: ${getErrorMessage(error)}`,
      );
      res.status(500).json({
        success: false,
        error: "Fehler beim Entfernen der Berechtigung",
      });
    }
  }),
);

// Remove specific group permission
router.delete(
  "/:adminId/group/:groupId",
  ...security.root(
    createValidation([
      param("adminId").isInt({ min: 1 }).withMessage("Ungültige Admin-ID"),
      param("groupId").isInt({ min: 1 }).withMessage("Ungültige Gruppen-ID"),
    ]),
  ),
  typed.params<{ adminId: string; groupId: string }>(async (req, res) => {
    const adminId = parseInt(req.params.adminId);
    const groupId = parseInt(req.params.groupId);

    try {
      const success = await adminPermissionService.removeGroupPermission(
        adminId,
        groupId,
        req.user.tenant_id,
      );

      if (success) {
        await adminPermissionService.logPermissionChange(
          "revoke",
          adminId,
          groupId,
          "group",
          req.user.id,
          req.user.tenant_id,
        );

        res.json({
          success: true,
          message: "Gruppenberechtigung erfolgreich entfernt",
        });
      } else {
        res.status(404).json({
          success: false,
          error: "Gruppenberechtigung nicht gefunden",
        });
      }
    } catch (error) {
      logger.error(
        `Error removing admin group permission: ${getErrorMessage(error)}`,
      );
      res.status(500).json({
        success: false,
        error: "Fehler beim Entfernen der Gruppenberechtigung",
      });
    }
  }),
);

// Bulk operations
router.post(
  "/bulk",
  ...security.root(
    createValidation([
      body("adminIds")
        .isArray({ min: 1 })
        .withMessage("adminIds muss ein nicht-leeres Array sein"),
      body("adminIds.*").isInt({ min: 1 }).withMessage("Ungültige Admin-ID"),
      body("operation")
        .isIn(["assign", "remove"])
        .withMessage("Operation muss assign oder remove sein"),
      body("departmentIds")
        .optional()
        .isArray()
        .withMessage("departmentIds muss ein Array sein"),
      body("departmentIds.*")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Ungültige Abteilungs-ID"),
      body("groupIds")
        .optional()
        .isArray()
        .withMessage("groupIds muss ein Array sein"),
      body("groupIds.*")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Ungültige Gruppen-ID"),
      body("permissions")
        .optional()
        .isObject()
        .withMessage("permissions muss ein Objekt sein"),
      body("permissions.can_read").optional().isBoolean(),
      body("permissions.can_write").optional().isBoolean(),
      body("permissions.can_delete").optional().isBoolean(),
    ]),
  ),
  typed.auth(async (req, res) => {
    const {
      adminIds,
      departmentIds = [],
      operation,
      permissions = { can_read: true, can_write: false, can_delete: false },
    } = req.body as {
      adminIds?: number[];
      departmentIds?: number[];
      operation?: string;
      permissions?: {
        can_read: boolean;
        can_write: boolean;
        can_delete: boolean;
      };
    };

    try {
      let successCount = 0;
      const errors: string[] = [];

      for (const adminId of adminIds ?? []) {
        try {
          if (operation === "assign") {
            const success = await adminPermissionService.setPermissions(
              adminId,
              departmentIds,
              req.user.id,
              req.user.tenant_id,
              permissions,
            );
            if (success) successCount++;
          } else {
            // For remove operation, remove all department permissions
            const success = await adminPermissionService.setPermissions(
              adminId,
              [],
              req.user.id,
              req.user.tenant_id,
            );
            if (success) successCount++;
          }
        } catch (error) {
          errors.push(`Admin ${adminId}: ${getErrorMessage(error)}`);
        }
      }

      res.json({
        success: true,
        message: `${successCount} von ${adminIds?.length ?? 0} Admins erfolgreich bearbeitet`,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      logger.error(
        `Error in bulk permission operation: ${getErrorMessage(error)}`,
      );
      res.status(500).json({
        success: false,
        error: "Fehler bei der Bulk-Operation",
      });
    }
  }),
);

export default router;
