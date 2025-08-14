/**
 * Root Management Routes
 * API endpoints for root user admin management and dashboard
 */

import bcrypt from "bcryptjs";
import express, { Router } from "express";
import { param } from "express-validator";
import { RowDataPacket, ResultSetHeader } from "mysql2";

const router: Router = express.Router();

import { executeQuery, execute } from "../database";
import { security } from "../middleware/security";
import { createValidation } from "../middleware/validation";
import { getRootLogsByUserId, getLastRootLogin } from "../models/rootLog";
import Tenant from "../models/tenant";
import User from "../models/user";
import { tenantDeletionService } from "../services/tenantDeletion.service";
import { successResponse, errorResponse } from "../types/response.types";
import { query } from "../utils/db";
import { getErrorMessage } from "../utils/errorHandler";
import { logger } from "../utils/logger";
import { typed } from "../utils/routeHandlers";
/**
 * Root Management Routes
 * API endpoints for root user admin management and dashboard
 */

// import { authenticateToken, authorizeRole } from '../auth'; // Now using security.root()
// Import models (now ES modules)
// Extended Request interfaces
// Removed unused AuthenticatedRequest interface - using the one from auth types

/* Unused interfaces - kept for future reference
interface CreateAdminRequest extends AuthenticatedRequest {
  body: {
    username: string;
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    company?: string;
    notes?: string;
    [key: string]: unknown; // Allow additional fields
  };
}

interface AdminListRequest extends AuthenticatedRequest {}

interface DeleteAdminRequest extends AuthenticatedRequest {
  params: {
    id: string;
  };
}

interface AdminDetailsRequest extends AuthenticatedRequest {
  params: {
    id: string;
  };
}

interface UpdateAdminRequest extends AuthenticatedRequest {
  params: {
    id: string;
  };
  body: {
    username?: string;
    email?: string;
    company?: string;
    new_password?: string;
    notes?: string;
  };
}

interface AdminLogsRequest extends AuthenticatedRequest {
  params: {
    id: string;
  };
  query: {
    days?: string;
  };
}

interface DashboardDataRequest extends AuthenticatedRequest {}
*/

// Response interfaces
interface DashboardData {
  adminCount: number;
  employeeCount: number;
  totalUsers: number;
  tenantId: number;
  features: unknown[];
}

interface DatabaseError extends Error {
  code?: string;
}

interface LegacyAdminUpdateData {
  username?: string;
  email?: string;
  company?: string;
  notes?: string;
  password?: string;
  new_password?: string;
}

// Validation schemas
const updateAdminValidation = createValidation([
  param("id").isInt({ min: 1 }).withMessage("Ungültige Admin-ID"),
]);

// Admin-Benutzer erstellen - POST /admins endpoint
router.post(
  "/admins",
  ...security.root(),
  typed.body<{
    username: string;
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    company?: string;
    notes?: string;
    role?: string;
    tenant_id?: number;
    is_active?: boolean;
  }>(async (req, res) => {
    logger.info(
      `Attempt to create admin user by root user: ${req.user.username}`,
    );
    try {
      const adminData = {
        ...req.body,
        first_name: req.body.first_name ?? "",
        last_name: req.body.last_name ?? "",
        role: "admin",
        tenant_id: req.user.tenant_id,
        is_active: true, // Ensure new admins are active by default
      };
      const adminId = await User.create(adminData);

      // Add admin to tenant_admins table
      try {
        await executeQuery<RowDataPacket[]>(
          "INSERT INTO tenant_admins (tenant_id, user_id, is_primary) VALUES (?, ?, FALSE)",
          [req.user.tenant_id, adminId],
        );
        logger.info(`Admin ${adminId} added to tenant_admins table`);
      } catch (taError: unknown) {
        logger.warn("Could not add admin to tenant_admins:", taError);
        // Continue anyway - the admin was created successfully
      }

      logger.info(`Admin user created successfully with ID: ${adminId}`);
      res
        .status(201)
        .json({ message: "Admin-Benutzer erfolgreich erstellt", adminId });
    } catch (error: unknown) {
      logger.error(
        "Fehler beim Erstellen des Admin-Benutzers:",
        getErrorMessage(error),
      );
      const dbError = error as DatabaseError;
      if (dbError.code === "ER_DUP_ENTRY") {
        res.status(409).json({
          message:
            "Ein Benutzer mit diesem Benutzernamen oder dieser E-Mail existiert bereits.",
        });
        return;
      }
      res.status(500).json({
        message: "Fehler beim Erstellen des Admin-Benutzers",
        error: getErrorMessage(error),
      });
    }
  }),
);

// Legacy endpoint for backward compatibility
router.post(
  "/create-admin",
  ...security.root(),
  typed.body<{
    username: string;
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    company?: string;
    notes?: string;
    role?: string;
    tenant_id?: number;
    is_active?: boolean;
  }>(async (req, res) => {
    logger.info(
      `Attempt to create admin user by root user: ${req.user.username}`,
    );
    try {
      const adminData = {
        ...req.body,
        first_name: req.body.first_name ?? "",
        last_name: req.body.last_name ?? "",
        role: "admin",
        tenant_id: req.user.tenant_id,
        is_active: true, // Ensure new admins are active by default
      };
      const adminId = await User.create(adminData);

      // Add admin to tenant_admins table
      try {
        await executeQuery<RowDataPacket[]>(
          "INSERT INTO tenant_admins (tenant_id, user_id, is_primary) VALUES (?, ?, FALSE)",
          [req.user.tenant_id, adminId],
        );
        logger.info(`Admin ${adminId} added to tenant_admins table`);
      } catch (taError: unknown) {
        logger.warn("Could not add admin to tenant_admins:", taError);
        // Continue anyway - the admin was created successfully
      }

      logger.info(`Admin user created successfully with ID: ${adminId}`);
      res
        .status(201)
        .json({ message: "Admin-Benutzer erfolgreich erstellt", adminId });
    } catch (error: unknown) {
      logger.error(
        "Fehler beim Erstellen des Admin-Benutzers:",
        getErrorMessage(error),
      );
      const dbError = error as DatabaseError;
      if (dbError.code === "ER_DUP_ENTRY") {
        res.status(409).json({
          message:
            "Ein Benutzer mit diesem Benutzernamen oder dieser E-Mail existiert bereits.",
        });
        return;
      }
      res.status(500).json({
        message: "Fehler beim Erstellen des Admin-Benutzers",
        error: getErrorMessage(error),
      });
    }
  }),
);

// Liste aller Admin-Benutzer abrufen
router.get(
  "/admins",
  ...security.root(),
  typed.auth(async (req, res) => {
    logger.info(
      `Fetching admin users list for root user: ${req.user.username}`,
    );
    try {
      // Admins mit erweiterten Informationen abrufen - NUR vom eigenen Tenant!
      const admins = await User.findByRole("admin", true, req.user.tenant_id);

      // Tenant-Informationen hinzufügen
      const adminsWithTenants = await Promise.all(
        admins.map(async (admin) => {
          if (admin.tenant_id != null && admin.tenant_id !== 0) {
            const tenant = await Tenant.findById(admin.tenant_id);
            admin.tenant_name = tenant ? tenant.company_name : null;
          }
          return admin;
        }),
      );

      logger.info(`Retrieved ${adminsWithTenants.length} admin users`);
      res.json(adminsWithTenants);
    } catch (error: unknown) {
      logger.error(
        "Fehler beim Abrufen der Admin-Benutzer:",
        getErrorMessage(error),
      );
      res.status(500).json({
        message: "Fehler beim Abrufen der Admin-Benutzer",
        error: getErrorMessage(error),
      });
    }
  }),
);

interface AdminUpdateData {
  username?: string;
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  department_id?: number;
  position?: string;
  is_active?: boolean;
}

// Admin-Benutzer aktualisieren
router.put(
  "/admins/:id",
  ...security.root(updateAdminValidation),
  typed.paramsBody<{ id: string }, AdminUpdateData>(async (req, res) => {
    const adminId = req.params.id;
    const updateData = req.body;

    logger.info(
      `Updating admin (ID: ${adminId}) by root user: ${req.user.username}`,
    );
    logger.info(`Update data received:`, updateData);

    try {
      // Prüfen ob Admin existiert
      const admin = await User.findById(
        parseInt(adminId, 10),
        req.user.tenant_id,
      );
      if (!admin || admin.role !== "admin") {
        res.status(404).json({ message: "Admin nicht gefunden" });
        return;
      }

      // Passwort hashen falls vorhanden
      if (updateData.password != null && updateData.password !== "") {
        updateData.password = await bcrypt.hash(updateData.password, 10);
      }

      // Update durchführen
      const success = await User.update(
        parseInt(adminId, 10),
        updateData,
        req.user.tenant_id,
      );

      if (success) {
        res.json(successResponse(null, "Admin erfolgreich aktualisiert"));
      } else {
        res.status(500).json(errorResponse("Fehler beim Aktualisieren", 500));
      }
    } catch (error: unknown) {
      logger.error("Fehler beim Aktualisieren des Admins:", error);
      res.status(500).json(errorResponse("Fehler beim Aktualisieren", 500));
    }
  }),
);

// Admin-Benutzer löschen
router.delete(
  "/admins/:id",
  ...security.root(
    createValidation([
      param("id").isInt({ min: 1 }).withMessage("Ungültige Admin-ID"),
    ]),
  ),
  typed.params<{ id: string }>(async (req, res) => {
    const rootUser = req.user.username;
    const adminId = req.params.id;

    logger.info(
      `Attempt to delete admin (ID: ${adminId}) by root user: ${rootUser}`,
    );

    try {
      // Zuerst prüfen, ob der zu löschende Benutzer wirklich ein Admin ist
      const adminToDelete = await User.findById(
        parseInt(adminId, 10),
        req.user.tenant_id,
      );

      if (!adminToDelete) {
        logger.warn(`Admin user with ID ${adminId} not found`);
        res.status(404).json({ message: "Admin-Benutzer nicht gefunden" });
        return;
      }

      if (adminToDelete.role !== "admin") {
        logger.warn(`User with ID ${adminId} is not an admin`);
        res
          .status(403)
          .json({ message: "Der zu löschende Benutzer ist kein Admin" });
        return;
      }

      // Admin löschen - hier müssen wir eine neue Methode in der User-Klasse erstellen
      const success = await User.delete(parseInt(adminId, 10));

      if (success) {
        logger.info(`Admin user with ID ${adminId} deleted successfully`);
        res.json(successResponse(null, "Admin-Benutzer erfolgreich gelöscht"));
      } else {
        logger.warn(`Failed to delete admin user with ID ${adminId}`);
        res
          .status(500)
          .json(errorResponse("Fehler beim Löschen des Admin-Benutzers", 500));
      }
    } catch (error: unknown) {
      logger.error(`Error deleting admin user with ID ${adminId}:`, error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Löschen des Admin-Benutzers", 500));
    }
  }),
);

// NEUE ROUTE: Details eines Admin-Benutzers abrufen
router.get(
  "/admin/:id",
  ...security.root(
    createValidation([
      param("id").isInt({ min: 1 }).withMessage("Ungültige Admin-ID"),
    ]),
  ),
  typed.params<{ id: string }>(async (req, res) => {
    const rootUser = req.user.username;
    const adminId = req.params.id;

    logger.info(
      `Root user ${rootUser} requesting details for admin ${adminId}`,
    );

    try {
      const admin = await User.findById(
        parseInt(adminId, 10),
        req.user.tenant_id,
      );

      if (!admin) {
        logger.warn(`Admin with ID ${adminId} not found`);
        res.status(404).json({ message: "Admin-Benutzer nicht gefunden" });
        return;
      }

      if (admin.role !== "admin") {
        logger.warn(`User with ID ${adminId} is not an admin`);
        res
          .status(403)
          .json({ message: "Der abgefragte Benutzer ist kein Admin" });
        return;
      }

      // Passwort-Hash aus den Antwortdaten entfernen
      const { password: _password, ...adminData } = admin;

      // Letzten Login-Zeitpunkt hinzufügen, falls vorhanden
      const lastLogin = await getLastRootLogin(parseInt(adminId, 10));
      if (lastLogin) {
        adminData.last_login = lastLogin.created_at;
      }

      logger.info(`Details for admin ${adminId} retrieved successfully`);
      res.json(successResponse(adminData));
    } catch (error: unknown) {
      logger.error(`Error retrieving details for admin ${adminId}:`, error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen der Admin-Details", 500));
    }
  }),
);

// NEUE ROUTE: Admin-Benutzer aktualisieren
router.put(
  "/admin/:id",
  ...security.root(updateAdminValidation),
  typed.paramsBody<{ id: string }, LegacyAdminUpdateData>(async (req, res) => {
    const rootUser = req.user.username;
    const adminId = req.params.id;

    logger.info(`Root user ${rootUser} attempting to update admin ${adminId}`);

    try {
      const admin = await User.findById(
        parseInt(adminId, 10),
        req.user.tenant_id,
      );

      if (!admin) {
        logger.warn(`Admin with ID ${adminId} not found`);
        res.status(404).json({ message: "Admin-Benutzer nicht gefunden" });
        return;
      }

      if (admin.role !== "admin") {
        logger.warn(`User with ID ${adminId} is not an admin`);
        res
          .status(403)
          .json({ message: "Der zu aktualisierende Benutzer ist kein Admin" });
        return;
      }

      // Aktualisierbare Felder extrahieren
      const { username, email, company, new_password, notes } = req.body;

      // Objekt für die Aktualisierung erstellen
      const updateData: LegacyAdminUpdateData = {
        username,
        email,
        company,
        notes,
      };

      // Wenn ein neues Passwort übermittelt wurde, Hash erstellen
      if (
        new_password != null &&
        new_password !== "" &&
        new_password.trim() !== ""
      ) {
        updateData.password = await bcrypt.hash(new_password, 10);
      }

      // Admin aktualisieren
      await User.update(parseInt(adminId, 10), updateData, req.user.tenant_id);

      logger.info(
        `Admin ${adminId} updated successfully by root user ${rootUser}`,
      );
      res.json(
        successResponse(null, "Admin-Benutzer erfolgreich aktualisiert"),
      );
    } catch (error: unknown) {
      logger.error(`Error updating admin ${adminId}:`, error);
      res
        .status(500)
        .json(
          errorResponse("Fehler beim Aktualisieren des Admin-Benutzers", 500),
        );
    }
  }),
);

// NEUE ROUTE: Admin-Logs abrufen
router.get(
  "/admin/:id/logs",
  ...security.root(
    createValidation([
      param("id").isInt({ min: 1 }).withMessage("Ungültige Admin-ID"),
    ]),
  ),
  typed.params<{ id: string }>(async (req, res) => {
    const rootUser = req.user.username;
    const adminId = req.params.id;
    const days = parseInt(req.query.days as string) || 0; // 0 bedeutet alle Logs

    logger.info(
      `Root user ${rootUser} requesting logs for admin ${adminId} (days: ${days})`,
    );

    try {
      const admin = await User.findById(
        parseInt(adminId, 10),
        req.user.tenant_id,
      );

      if (!admin) {
        logger.warn(`Admin with ID ${adminId} not found`);
        res.status(404).json({ message: "Admin-Benutzer nicht gefunden" });
        return;
      }

      if (admin.role !== "admin") {
        logger.warn(`User with ID ${adminId} is not an admin`);
        res
          .status(403)
          .json({ message: "Der abgefragte Benutzer ist kein Admin" });
        return;
      }

      // Logs abrufen
      const logs = await getRootLogsByUserId(parseInt(adminId, 10), days);

      logger.info(`Retrieved ${logs.length} logs for admin ${adminId}`);
      res.json(successResponse(logs));
    } catch (error: unknown) {
      logger.error(`Error retrieving logs for admin ${adminId}:`, error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen der Admin-Logs", 500));
    }
  }),
);

// Alle Tenants abrufen
router.get(
  "/tenants",
  ...security.root(),
  typed.auth(async (req, res) => {
    logger.info(`Root user ${req.user.username} requesting tenants list`);

    try {
      const tenants = await Tenant.findAll();
      res.json(successResponse(tenants));
    } catch (error: unknown) {
      logger.error("Fehler beim Abrufen der Tenants:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen der Tenants", 500));
    }
  }),
);

// Dashboard-Daten für Root-User
router.get(
  "/dashboard-data",
  ...security.root(),
  typed.auth(async (req, res) => {
    logger.info(`Root user ${req.user.username} requesting dashboard data`);

    try {
      // Anzahl der Admins abrufen
      const admins = await User.findByRole("admin", false, req.user.tenant_id);
      const adminCount = admins.length;

      // Anzahl der Mitarbeiter abrufen
      const employees = await User.findByRole(
        "employee",
        false,
        req.user.tenant_id,
      );
      const employeeCount = employees.length;

      // Tenant-Informationen könnten hier ergänzt werden
      const dashboardData: DashboardData = {
        adminCount,
        employeeCount,
        totalUsers: adminCount + employeeCount + 1, // +1 für Root-User
        tenantId: req.user.tenant_id,
        features: [], // Könnte mit Feature-Informationen ergänzt werden
      };

      logger.info(
        `Dashboard data retrieved successfully for root user ${req.user.username}`,
      );
      res.json(successResponse(dashboardData));
    } catch (error: unknown) {
      logger.error(`Error retrieving dashboard data:`, error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen der Dashboard-Daten", 500));
    }
  }),
);

// NEUE ROUTE: Storage-Informationen für Root-User
router.get(
  "/storage-info",
  ...security.root(),
  typed.auth(async (req, res) => {
    logger.info(`Root user ${req.user.username} requesting storage info`);

    try {
      // Import necessary model
      const Document = (await import("../models/document")).default;

      // Get tenant information
      const tenant = await Tenant.findById(req.user.tenant_id);

      if (!tenant) {
        logger.error(`Tenant ${req.user.tenant_id} not found`);
        res.status(404).json({ message: "Tenant nicht gefunden" });
        return;
      }

      // Get storage limits based on tenant plan
      const storageLimits: Record<string, number> = {
        basic: 5 * 1024 * 1024 * 1024, // 5 GB
        professional: 25 * 1024 * 1024 * 1024, // 25 GB
        enterprise: 100 * 1024 * 1024 * 1024, // 100 GB
      };

      const totalStorage =
        storageLimits[tenant.current_plan ?? "basic"] || storageLimits.basic;

      // Get actual storage usage (sum of all document sizes)
      const usedStorage = await Document.getTotalStorageUsed(
        req.user.tenant_id,
      );

      // Calculate percentage
      const percentage = Math.round((usedStorage / totalStorage) * 100);

      const storageInfo = {
        used: usedStorage,
        total: totalStorage,
        percentage: Math.min(percentage, 100), // Cap at 100%
        plan: tenant.current_plan ?? "basic",
      };

      logger.info(
        `Storage info for tenant ${req.user.tenant_id}: ${usedStorage} / ${totalStorage} bytes (${percentage}%)`,
      );
      res.json(successResponse(storageInfo));
    } catch (error: unknown) {
      logger.error(`Error retrieving storage info:`, error);
      res
        .status(500)
        .json(
          errorResponse("Fehler beim Abrufen der Speicherinformationen", 500),
        );
    }
  }),
);

// ========== TENANT DELETION ROUTES ==========
// Import tenant deletion service
// Get deletion status for all tenants
router.get(
  "/deletion-status",
  ...security.root(),
  typed.auth(async (_req, res) => {
    try {
      const [deletions] = await executeQuery(
        `SELECT
          q.*,
          t.company_name,
          t.subdomain,
          u.username as requester_name,
          u.email as requester_email
        FROM tenant_deletion_queue q
        JOIN tenants t ON t.id = q.tenant_id
        JOIN users u ON u.id = q.created_by
        ORDER BY q.created_at DESC`,
      );

      res.json(successResponse(deletions));
    } catch (error: unknown) {
      logger.error("Error fetching deletion status:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen des Löschstatus"));
    }
  }),
);

// NEW SECURE ROUTE: Delete current tenant (no ID needed - uses JWT token)
router.delete(
  "/tenants/current",
  ...security.root(),
  typed.body<{ reason?: string }>(async (req, res) => {
    const rootUser = req.user;
    const tenantId = rootUser.tenant_id; // ALWAYS use tenant from JWT token

    logger.warn(
      `🔒 SECURE DELETE: Root user ${rootUser.username} (ID: ${rootUser.id}) requesting deletion of their own tenant ${tenantId}`,
    );

    // Check if there are at least 2 root users
    try {
      const rootUsers = await User.findByRole("root", false, tenantId);
      if (rootUsers.length < 2) {
        logger.warn(
          `Tenant deletion blocked: Only ${rootUsers.length} root user(s) exist for tenant ${tenantId}`,
        );
        res
          .status(400)
          .json(
            errorResponse(
              "Tenant-Löschung nicht möglich: Es müssen mindestens 2 Root-Benutzer vorhanden sein, bevor der Tenant gelöscht werden kann.",
              400,
            ),
          );
        return;
      }
    } catch (error: unknown) {
      logger.error("Error checking root users:", error);
    }

    // Security audit log
    await execute(
      `INSERT INTO admin_logs (tenant_id, user_id, action, entity_type, entity_id, new_values, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        rootUser.tenant_id,
        rootUser.id,
        "tenant_deletion_requested_secure",
        "tenant",
        tenantId,
        JSON.stringify({
          reason: req.body.reason ?? "Keine Angabe",
          user_agent: req.headers["user-agent"],
          secure_route: true,
        }),
        req.ip,
      ],
    );

    try {
      // Request tenant deletion (requires approval from second root user)
      const queueId = await tenantDeletionService.requestTenantDeletion(
        tenantId,
        rootUser.id,
        req.body.reason ?? "Keine Angabe",
        req.ip,
      );

      res.json(
        successResponse(
          {
            queueId,
            tenantId, // Return for confirmation only
            scheduledDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            message:
              "Löschung beantragt - Genehmigung durch zweiten Root-User erforderlich",
            estimatedTime: "30 Tage Grace Period + 10-15 Minuten Löschvorgang",
            approvalRequired: true,
          },
          "Löschung wurde beantragt und wartet auf Genehmigung",
        ),
      );
    } catch (error: unknown) {
      logger.error(`Error queueing tenant ${tenantId} for deletion:`, error);
      res.status(500).json(errorResponse(getErrorMessage(error), 500));
    }
  }),
);

// Approve tenant deletion
router.post(
  "/deletion-approvals/:id/approve",
  ...security.root(),
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const queueId = parseInt(req.params.id);
      const approverId = req.user.id;

      await tenantDeletionService.approveDeletion(queueId, approverId);

      res.json(successResponse({ message: "Löschung genehmigt" }));
    } catch (error: unknown) {
      logger.error("Error approving deletion:", error);
      const message =
        error instanceof Error ? error.message : "Fehler bei der Genehmigung";
      res.status(400).json(errorResponse(message));
    }
  }),
);

// Reject tenant deletion
router.post(
  "/deletion-approvals/:id/reject",
  ...security.root(),
  typed.paramsBody<{ id: string }, { reason?: string }>(async (req, res) => {
    try {
      const queueId = parseInt(req.params.id);
      const approverId = req.user.id;
      const { reason } = req.body;

      await tenantDeletionService.rejectDeletion(
        queueId,
        approverId,
        reason ?? "Keine Angabe",
      );

      res.json(successResponse({ message: "Löschung abgelehnt" }));
    } catch (error: unknown) {
      logger.error("Error rejecting deletion:", error);
      const message =
        error instanceof Error ? error.message : "Fehler beim Ablehnen";
      res.status(400).json(errorResponse(message));
    }
  }),
);

// Emergency stop
router.post(
  "/deletion-emergency/:id/stop",
  ...security.root(),
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const queueId = parseInt(req.params.id);
      const stoppedBy = req.user.id;

      await tenantDeletionService.emergencyStop(queueId, stoppedBy);

      res.json(successResponse({ message: "Emergency Stop aktiviert!" }));
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Fehler beim Emergency Stop";
      logger.error("Error emergency stop:", error);
      res.status(400).json(errorResponse(message));
    }
  }),
);

// LEGACY ROUTE: Delete tenant by ID (with enhanced security checks)
router.delete(
  "/tenants/:id",
  ...security.root(),
  typed.paramsBody<{ id: string }, { reason?: string }>(async (req, res) => {
    const tenantId = parseInt(req.params.id, 10);
    const rootUser = req.user;

    // SECURITY WARNING: This route uses tenant ID from URL
    logger.warn(
      `⚠️ LEGACY DELETE: Root user ${rootUser.username} requesting deletion of tenant ${tenantId} via URL parameter`,
    );

    try {
      // CRITICAL SECURITY CHECK: Verify the root user has permission to delete this tenant
      if (rootUser.tenant_id !== tenantId) {
        // Log security violation attempt
        logger.error(
          `🚨 SECURITY VIOLATION: User ${rootUser.username} (tenant ${rootUser.tenant_id}) attempted to delete tenant ${tenantId}`,
        );

        await execute(
          `INSERT INTO admin_logs (tenant_id, user_id, action, entity_type, entity_id, new_values, ip_address, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            rootUser.tenant_id,
            rootUser.id,
            "security_violation_tenant_deletion",
            "tenant",
            tenantId,
            JSON.stringify({
              attempted_tenant_id: tenantId,
              user_tenant_id: rootUser.tenant_id,
              reason: "Attempted to delete different tenant",
              user_agent: req.headers["user-agent"],
            }),
            req.ip,
          ],
        );

        res
          .status(403)
          .json(
            errorResponse(
              "ZUGRIFF VERWEIGERT: Sie können nur Ihren eigenen Tenant löschen",
              403,
            ),
          );
        return;
      }

      // Additional paranoia check
      if (isNaN(tenantId) || tenantId <= 0) {
        res.status(400).json(errorResponse("Ungültige Tenant-ID", 400));
        return;
      }

      // Request tenant deletion (requires approval from second root user)
      const queueId = await tenantDeletionService.requestTenantDeletion(
        tenantId,
        rootUser.id,
        req.body.reason,
        req.ip,
      );

      res.json(
        successResponse(
          {
            queueId,
            scheduledDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            message:
              "Löschung beantragt - Genehmigung durch zweiten Root-User erforderlich",
            estimatedTime: "30 Tage Grace Period + 10-15 Minuten Löschvorgang",
            approvalRequired: true,
          },
          "Löschung wurde beantragt und wartet auf Genehmigung",
        ),
      );
    } catch (error: unknown) {
      logger.error(`Error queueing tenant ${tenantId} for deletion:`, error);
      res.status(500).json(errorResponse(getErrorMessage(error), 500));
    }
  }),
);

// Get current tenant deletion status (SECURE)
router.get(
  "/tenants/current/deletion-status",
  ...security.root(),
  typed.auth(async (req, res) => {
    const rootUser = req.user;
    const tenantId = rootUser.tenant_id; // Always from JWT

    logger.info(
      `Root user ${rootUser.username} checking deletion status for their tenant ${tenantId}`,
    );

    try {
      const [deletionQueue] = await query<RowDataPacket[]>(
        `SELECT
          dq.*,
          t.company_name,
          u.username as requested_by_username
        FROM deletion_queue dq
        JOIN tenants t ON t.id = dq.tenant_id
        JOIN users u ON u.id = dq.created_by
        WHERE dq.tenant_id = ?
        AND dq.status NOT IN ('cancelled', 'completed')
        ORDER BY dq.created_at DESC
        LIMIT 1`,
        [tenantId],
      );

      if (deletionQueue.length === 0) {
        res
          .status(404)
          .json(errorResponse("Keine aktive Löschung gefunden", 404));
        return;
      }

      res.json(successResponse(deletionQueue, "Löschstatus abgerufen"));
    } catch (error: unknown) {
      logger.error("Error getting deletion status:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen des Löschstatus", 500));
    }
  }),
);

// Get tenant deletion status by ID (LEGACY)
router.get(
  "/tenants/:id/deletion-status",
  ...security.root(),
  typed.params<{ id: string }>(async (req, res) => {
    const tenantId = parseInt(req.params.id, 10);
    const rootUser = req.user;

    try {
      // Verify the root user has permission to view this tenant's status
      if (rootUser.tenant_id !== tenantId) {
        res
          .status(403)
          .json(
            errorResponse(
              "Sie können nur Ihren eigenen Tenant-Status einsehen",
              403,
            ),
          );
        return;
      }

      const status = await tenantDeletionService.getDeletionStatus(tenantId);

      if (!status) {
        res
          .status(404)
          .json(errorResponse("Keine Löschung für diesen Tenant geplant", 404));
        return;
      }

      res.json(successResponse(status));
    } catch (error: unknown) {
      logger.error(
        `Error getting deletion status for tenant ${tenantId}:`,
        error,
      );
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen des Löschstatus", 500));
    }
  }),
);

// Cancel current tenant deletion (SECURE)
router.post(
  "/tenants/current/cancel-deletion",
  ...security.root(),
  typed.auth(async (req, res) => {
    const rootUser = req.user;
    const tenantId = rootUser.tenant_id; // Always from JWT

    logger.info(
      `🔒 SECURE: Root user ${rootUser.username} cancelling deletion of their tenant ${tenantId}`,
    );

    try {
      await tenantDeletionService.cancelDeletion(tenantId, rootUser.id);

      res.json(
        successResponse({ tenantId }, "Löschung erfolgreich abgebrochen"),
      );
    } catch (error: unknown) {
      logger.error("Error cancelling deletion:", error);
      res.status(500).json(errorResponse(getErrorMessage(error), 500));
    }
  }),
);

// Cancel tenant deletion by ID (LEGACY - with security checks)
router.post(
  "/tenants/:id/cancel-deletion",
  ...security.root(),
  typed.params<{ id: string }>(async (req, res) => {
    const tenantId = parseInt(req.params.id, 10);
    const rootUser = req.user;

    logger.info(
      `Root user ${rootUser.username} attempting to cancel deletion of tenant ${tenantId}`,
    );

    try {
      // Verify the root user has permission
      if (rootUser.tenant_id !== tenantId) {
        res
          .status(403)
          .json(
            errorResponse("Sie können nur Ihre eigene Löschung abbrechen", 403),
          );
        return;
      }

      await tenantDeletionService.cancelDeletion(tenantId, rootUser.id);

      res.json(
        successResponse(
          { cancelled: true },
          "Löschung wurde erfolgreich abgebrochen",
        ),
      );
    } catch (error: unknown) {
      logger.error(`Error cancelling deletion for tenant ${tenantId}:`, error);
      res.status(500).json(errorResponse(getErrorMessage(error), 500));
    }
  }),
);

// Approve tenant deletion request
router.post(
  "/deletion-approvals/:queueId/approve",
  ...security.root(),
  typed.paramsBody<{ queueId: string }, { comment?: string }>(
    async (req, res) => {
      const queueId = parseInt(req.params.queueId, 10);
      const rootUser = req.user;

      logger.info(
        `Root user ${rootUser.username} approving deletion request ${queueId}`,
      );

      try {
        await tenantDeletionService.approveDeletion(
          queueId,
          rootUser.id,
          req.body.comment,
        );

        res.json(
          successResponse(
            { approved: true },
            "Löschung wurde genehmigt und wird nach der Grace Period durchgeführt",
          ),
        );
      } catch (error: unknown) {
        logger.error(`Error approving deletion ${queueId}:`, error);
        res.status(500).json(errorResponse(getErrorMessage(error), 500));
      }
    },
  ),
);

// Reject tenant deletion request
router.post(
  "/deletion-approvals/:queueId/reject",
  ...security.root(),
  typed.paramsBody<{ queueId: string }, { reason: string }>(
    async (req, res) => {
      const queueId = parseInt(req.params.queueId, 10);
      const rootUser = req.user;

      logger.info(
        `Root user ${rootUser.username} rejecting deletion request ${queueId}`,
      );

      try {
        if (!req.body.reason) {
          res
            .status(400)
            .json(errorResponse("Grund für Ablehnung ist erforderlich", 400));
          return;
        }

        await tenantDeletionService.rejectDeletion(
          queueId,
          rootUser.id,
          req.body.reason,
        );

        res.json(
          successResponse({ rejected: true }, "Löschung wurde abgelehnt"),
        );
      } catch (error: unknown) {
        logger.error(`Error rejecting deletion ${queueId}:`, error);
        res.status(500).json(errorResponse(getErrorMessage(error), 500));
      }
    },
  ),
);

// Get pending deletion approvals
router.get(
  "/deletion-approvals/pending",
  ...security.root(),
  typed.auth(async (req, res) => {
    const rootUser = req.user;

    logger.info(
      `Root user ${rootUser.username} requesting pending deletion approvals`,
    );

    try {
      // Get pending approvals from view
      const [pendingApprovals] = await query(
        `SELECT * FROM v_pending_deletion_approvals
         WHERE requester_id != ?
         ORDER BY requested_at DESC`,
        [rootUser.id],
      );

      res.json(successResponse(pendingApprovals));
    } catch (error: unknown) {
      logger.error("Error getting pending approvals:", error);
      res
        .status(500)
        .json(
          errorResponse(
            "Fehler beim Abrufen der ausstehenden Genehmigungen",
            500,
          ),
        );
    }
  }),
);

// Emergency stop deletion
router.post(
  "/deletion-queue/:queueId/emergency-stop",
  ...security.root(),
  typed.params<{ queueId: string }>(async (req, res) => {
    const queueId = parseInt(req.params.queueId, 10);
    const rootUser = req.user;

    logger.error(
      `🚨 EMERGENCY STOP: Root user ${rootUser.username} triggering emergency stop for deletion ${queueId}`,
    );

    try {
      await tenantDeletionService.triggerEmergencyStop(queueId, rootUser.id);

      res.json(
        successResponse(
          { emergencyStopped: true },
          "Emergency Stop ausgelöst - Löschung wird angehalten",
        ),
      );
    } catch (error: unknown) {
      logger.error(`Error triggering emergency stop ${queueId}:`, error);
      res.status(500).json(errorResponse(getErrorMessage(error), 500));
    }
  }),
);

// Dry-run deletion simulation
router.post(
  "/tenants/:id/deletion-dry-run",
  ...security.root(),
  typed.params<{ id: string }>(async (req, res) => {
    const tenantId = parseInt(req.params.id, 10);
    const rootUser = req.user;

    logger.info(
      `Root user ${rootUser.username} requesting dry-run for tenant ${tenantId}`,
    );

    try {
      if (rootUser.tenant_id !== tenantId) {
        res
          .status(403)
          .json(
            errorResponse(
              "Sie können nur Ihren eigenen Tenant simulieren",
              403,
            ),
          );
        return;
      }

      const report = await tenantDeletionService.performDryRun(tenantId);

      res.json(successResponse(report));
    } catch (error: unknown) {
      logger.error(`Error performing dry-run for tenant ${tenantId}:`, error);
      res.status(500).json(errorResponse("Fehler bei der Simulation", 500));
    }
  }),
);

// Retry failed deletion (admin only)
router.post(
  "/deletion-queue/:queueId/retry",
  ...security.root(),
  typed.params<{ queueId: string }>(async (req, res) => {
    const queueId = parseInt(req.params.queueId, 10);
    const rootUser = req.user;

    logger.warn(
      `Root user ${rootUser.username} retrying failed deletion ${queueId}`,
    );

    try {
      await tenantDeletionService.retryDeletion(queueId);

      res.json(
        successResponse({ retrying: true }, "Löschung wird erneut versucht"),
      );
    } catch (error: unknown) {
      logger.error(`Error retrying deletion ${queueId}:`, error);
      res.status(500).json(errorResponse(getErrorMessage(error), 500));
    }
  }),
);

// ========================================
// ROOT USER MANAGEMENT ROUTES
// ========================================

// Get all root users
router.get(
  "/users",
  ...security.root(),
  typed.auth(async (req, res) => {
    const rootUser = req.user;

    logger.info(`Root user ${rootUser.username} accessing root user list`);

    try {
      const [rootUsers] = await executeQuery<RowDataPacket[]>(
        `SELECT
          id, username, email, first_name, last_name,
          position, notes, is_active, employee_id, created_at, updated_at
        FROM users
        WHERE role = 'root' AND tenant_id = ?
        ORDER BY created_at DESC`,
        [rootUser.tenant_id],
      );

      res.json(successResponse({ users: rootUsers }));
    } catch (error: unknown) {
      logger.error("Error fetching root users:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Laden der Root-Benutzer", 500));
    }
  }),
);

// Get single root user
router.get(
  "/users/:id",
  ...security.root(),
  typed.params<{ id: string }>(async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const rootUser = req.user;

    try {
      const [users] = await executeQuery<RowDataPacket[]>(
        `SELECT
          id, username, email, first_name, last_name,
          position, notes, is_active, created_at, updated_at
        FROM users
        WHERE id = ? AND role = 'root' AND tenant_id = ?`,
        [userId, rootUser.tenant_id],
      );

      if (users.length === 0) {
        res
          .status(404)
          .json(errorResponse("Root-Benutzer nicht gefunden", 404));
        return;
      }

      res.json(successResponse({ user: users[0] }));
    } catch (error: unknown) {
      logger.error("Error fetching root user:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Laden des Root-Benutzers", 500));
    }
  }),
);

// Create new root user
router.post(
  "/users",
  ...security.root(),
  typed.body<{
    username: string;
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    position?: string;
    notes?: string;
    is_active?: boolean;
  }>(async (req, res) => {
    const rootUser = req.user;
    const {
      username,
      email,
      password,
      first_name,
      last_name,
      position,
      notes,
      is_active = true,
    } = req.body;

    logger.warn(
      `Root user ${rootUser.username} creating new root user: ${email}`,
    );

    try {
      // Check if email already exists
      const [existing] = await executeQuery<RowDataPacket[]>(
        "SELECT id FROM users WHERE email = ? AND tenant_id = ?",
        [email, rootUser.tenant_id],
      );

      if (existing.length > 0) {
        res
          .status(400)
          .json(errorResponse("E-Mail-Adresse wird bereits verwendet", 400));
        return;
      }

      // Get tenant subdomain for employee_id generation
      const [tenantData] = await executeQuery<RowDataPacket[]>(
        "SELECT subdomain FROM tenants WHERE id = ?",
        [rootUser.tenant_id],
      );

      const subdomain: string =
        (tenantData[0]?.subdomain as string) || "DEFAULT";

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create root user (without employee_id first)
      const [result] = await executeQuery<ResultSetHeader>(
        `INSERT INTO users (
          username, email, password, first_name, last_name,
          role, position, notes, is_active, tenant_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'root', ?, ?, ?, ?, NOW(), NOW())`,
        [
          username || email,
          email,
          hashedPassword,
          first_name,
          last_name,
          position,
          notes,
          is_active,
          rootUser.tenant_id,
        ],
      );

      // Generate and update employee_id
      const { generateEmployeeId } = await import(
        "../utils/employeeIdGenerator"
      );
      const employeeId = generateEmployeeId(subdomain, "root", result.insertId);

      await executeQuery("UPDATE users SET employee_id = ? WHERE id = ?", [
        employeeId,
        result.insertId,
      ]);

      // Log the action
      await executeQuery(
        `INSERT INTO admin_logs (tenant_id, user_id, action, entity_type, entity_id, new_values, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          rootUser.tenant_id,
          rootUser.id,
          "root_user_created",
          "user",
          result.insertId,
          JSON.stringify({
            email,
            created_by: rootUser.email,
          }),
          req.ip,
        ],
      );

      logger.info(
        `Root user created successfully: ${email} (ID: ${result.insertId})`,
      );

      res.json(
        successResponse(
          { id: result.insertId },
          "Root-Benutzer erfolgreich erstellt",
        ),
      );
    } catch (error: unknown) {
      logger.error("Error creating root user:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Erstellen des Root-Benutzers", 500));
    }
  }),
);

// Update root user
router.put(
  "/users/:id",
  ...security.root(),
  typed.paramsBody<
    { id: string },
    {
      first_name?: string;
      last_name?: string;
      email?: string;
      position?: string;
      notes?: string;
      is_active?: boolean;
    }
  >(async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const rootUser = req.user;
    const { first_name, last_name, email, position, notes, is_active } =
      req.body;

    try {
      // Check if user exists and is root
      const [users] = await executeQuery<RowDataPacket[]>(
        "SELECT id FROM users WHERE id = ? AND role = 'root' AND tenant_id = ?",
        [userId, rootUser.tenant_id],
      );

      if (users.length === 0) {
        res
          .status(404)
          .json(errorResponse("Root-Benutzer nicht gefunden", 404));
        return;
      }

      // Update user
      await executeQuery(
        `UPDATE users SET
          first_name = ?, last_name = ?, email = ?,
          position = ?, notes = ?, is_active = ?, updated_at = NOW()
        WHERE id = ?`,
        [first_name, last_name, email, position, notes, is_active, userId],
      );

      // Log the action
      await executeQuery(
        `INSERT INTO admin_logs (tenant_id, user_id, action, entity_type, entity_id, new_values, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          rootUser.tenant_id,
          rootUser.id,
          "root_user_updated",
          "user",
          userId,
          JSON.stringify({
            updated_by: rootUser.email,
            changes: { first_name, last_name, email, position, is_active },
          }),
          req.ip,
        ],
      );

      res.json(successResponse(null, "Root-Benutzer erfolgreich aktualisiert"));
    } catch (error: unknown) {
      logger.error("Error updating root user:", error);
      res
        .status(500)
        .json(
          errorResponse("Fehler beim Aktualisieren des Root-Benutzers", 500),
        );
    }
  }),
);

// Delete root user
router.delete(
  "/users/:id",
  ...security.root(),
  typed.params<{ id: string }>(async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const rootUser = req.user;

    try {
      // Prevent self-deletion
      if (userId === rootUser.id) {
        res
          .status(400)
          .json(errorResponse("Sie können sich nicht selbst löschen", 400));
        return;
      }

      // Check if user exists and is root
      const [users] = await executeQuery<RowDataPacket[]>(
        "SELECT email FROM users WHERE id = ? AND role = 'root' AND tenant_id = ?",
        [userId, rootUser.tenant_id],
      );

      if (users.length === 0) {
        res
          .status(404)
          .json(errorResponse("Root-Benutzer nicht gefunden", 404));
        return;
      }

      const deletedEmail: string = users[0].email as string;

      // Check if at least 2 root users will remain
      const [rootCount] = await executeQuery<RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM users WHERE role = 'root' AND tenant_id = ? AND id != ?",
        [rootUser.tenant_id, userId],
      );

      if (rootCount[0].count < 1) {
        res
          .status(400)
          .json(
            errorResponse(
              "Es muss mindestens ein Root-Benutzer im System verbleiben",
              400,
            ),
          );
        return;
      }

      // Delete user
      await executeQuery("DELETE FROM users WHERE id = ?", [userId]);

      // Log the action
      await executeQuery(
        `INSERT INTO admin_logs (tenant_id, user_id, action, entity_type, entity_id, old_values, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          rootUser.tenant_id,
          rootUser.id,
          "root_user_deleted",
          "user",
          userId,
          JSON.stringify({
            deleted_email: deletedEmail,
            deleted_by: rootUser.email,
          }),
          req.ip,
        ],
      );

      logger.warn(`Root user deleted: ${deletedEmail} by ${rootUser.email}`);

      res.json(successResponse(null, "Root-Benutzer erfolgreich gelöscht"));
    } catch (error: unknown) {
      logger.error("Error deleting root user:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Löschen des Root-Benutzers", 500));
    }
  }),
);

// LEGACY: Old synchronous delete route (DEPRECATED - kept for backward compatibility)
router.delete(
  "/delete-tenant",
  ...security.root(),
  typed.auth((_req, res) => {
    logger.warn(
      `DEPRECATED: Using old synchronous delete endpoint. Please use DELETE /tenants/:id instead`,
    );

    // Redirect to new endpoint
    res
      .status(410)
      .json(
        errorResponse(
          "Diese Route ist veraltet. Bitte verwenden Sie DELETE /api/root/tenants/:id",
          410,
        ),
      );
  }),
);

export default router;

// CommonJS compatibility
