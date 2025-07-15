/**
 * Tenant Status Middleware
 * Checks tenant deletion status and blocks access to suspended/deleting tenants
 */

import { Request, Response, NextFunction } from "express";
import { query } from "../utils/db";
import { logger } from "../utils/logger";
import { AuthenticatedRequest } from "../types/request.types";
import { RowDataPacket } from "mysql2";

interface TenantStatusRow extends RowDataPacket {
  deletion_status: "active" | "marked_for_deletion" | "suspended" | "deleting";
  deletion_requested_at?: Date;
  company_name: string;
}

/**
 * Middleware to check tenant status before allowing access
 * Skips check for certain whitelisted routes
 */
export async function checkTenantStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;

    // Skip if no user or no tenant_id
    if (!authReq.user || !authReq.user.tenant_id) {
      next();
      return;
    }

    const tenantId = authReq.user.tenant_id;

    // Whitelist certain routes that should always be accessible
    const whitelistedPaths = [
      "/api/auth/logout",
      "/api/root/tenants/:id/deletion-status",
      "/api/root/tenants/:id/cancel-deletion",
      "/api/export-data",
      "/health",
    ];

    const isWhitelisted = whitelistedPaths.some((path) => {
      const regex = new RegExp("^" + path.replace(/:[^/]+/g, "[^/]+") + "$");
      return regex.test(req.path);
    });

    if (isWhitelisted) {
      next();
      return;
    }

    // Check tenant status
    const [tenantRows] = await query<TenantStatusRow[]>(
      "SELECT deletion_status, deletion_requested_at, company_name FROM tenants WHERE id = ?",
      [tenantId],
    );

    const tenant = tenantRows[0];

    if (!tenant) {
      logger.error(`Tenant ${tenantId} not found in status check`);
      res.status(404).json({
        error: "Tenant not found",
        code: "TENANT_NOT_FOUND",
      });
      return;
    }

    // Block access based on deletion status
    switch (tenant.deletion_status) {
      case "active":
        // Normal operation
        next();
        break;

      case "marked_for_deletion":
        // Still accessible but with warning header
        res.setHeader("X-Tenant-Status", "marked-for-deletion");
        if (tenant.deletion_requested_at) {
          const scheduledDate = new Date(tenant.deletion_requested_at);
          scheduledDate.setDate(scheduledDate.getDate() + 30);
          res.setHeader("X-Tenant-Deletion-Date", scheduledDate.toISOString());
        }
        next();
        break;

      case "suspended":
        logger.warn(
          `Access denied to suspended tenant ${tenantId} by user ${authReq.user.username}`,
        );
        res.status(403).json({
          error: "Tenant is suspended and scheduled for deletion",
          code: "TENANT_SUSPENDED",
          status: tenant.deletion_status,
          message:
            "Ihr Konto wurde gesperrt und wird gelöscht. Bitte kontaktieren Sie den Support für weitere Informationen.",
        });
        break;

      case "deleting":
        logger.warn(
          `Access denied to deleting tenant ${tenantId} by user ${authReq.user.username}`,
        );
        res.status(403).json({
          error: "Tenant is currently being deleted",
          code: "TENANT_DELETING",
          status: tenant.deletion_status,
          message:
            "Ihr Konto wird gerade gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.",
        });
        break;

      default:
        logger.error(
          `Unknown tenant deletion status: ${tenant.deletion_status}`,
        );
        next();
    }
  } catch (error) {
    logger.error("Error in tenant status middleware:", error);
    // Don't block access on middleware errors
    next();
  }
}

/**
 * Stricter version that only allows active tenants
 */
export function requireActiveTenant(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  checkTenantStatus(req, res, (err?: unknown) => {
    if (err) {
      next(err);
      return;
    }

    const authReq = req as AuthenticatedRequest;
    if (!authReq.user || !authReq.user.tenant_id) {
      next();
      return;
    }

    // Additional check for marked_for_deletion
    query<TenantStatusRow[]>(
      "SELECT deletion_status FROM tenants WHERE id = ?",
      [authReq.user.tenant_id],
    )
      .then(([rows]) => {
        const tenant = rows[0];
        if (tenant && tenant.deletion_status !== "active") {
          res.status(403).json({
            error: "This action requires an active tenant",
            code: "TENANT_NOT_ACTIVE",
            status: tenant.deletion_status,
          });
        } else {
          next();
        }
      })
      .catch(next);
  });
}

/**
 * Helper to get tenant deletion info
 */
export async function getTenantDeletionInfo(tenantId: number): Promise<{
  isScheduledForDeletion: boolean;
  deletionDate?: Date;
  status: string;
  daysRemaining?: number;
} | null> {
  try {
    const [tenantRows] = await query<TenantStatusRow[]>(
      "SELECT deletion_status, deletion_requested_at FROM tenants WHERE id = ?",
      [tenantId],
    );

    const tenant = tenantRows[0];

    if (!tenant) {
      return null;
    }

    const result = {
      isScheduledForDeletion: tenant.deletion_status !== "active",
      status: tenant.deletion_status,
      deletionDate: undefined as Date | undefined,
      daysRemaining: undefined as number | undefined,
    };

    if (
      tenant.deletion_status === "marked_for_deletion" &&
      tenant.deletion_requested_at
    ) {
      const scheduledDate = new Date(tenant.deletion_requested_at);
      scheduledDate.setDate(scheduledDate.getDate() + 30); // 30 day grace period

      result.deletionDate = scheduledDate;
      result.daysRemaining = Math.max(
        0,
        Math.ceil(
          (scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      );
    }

    return result;
  } catch (error) {
    logger.error("Error getting tenant deletion info:", error);
    return null;
  }
}

export default checkTenantStatus;
