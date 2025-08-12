/**
 * Tenant Isolation Middleware
 * Ensures users can only access resources from their own tenant
 */

import { Response, NextFunction } from "express";

import type { AuthenticatedRequest } from "../types/request.types";
import { errorResponse } from "../types/response.types";
import { logger } from "../utils/logger";

/**
 * Validates that the authenticated user belongs to the requested tenant
 * Prevents cross-tenant access attempts
 */
export function validateTenantIsolation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  try {
    // Check if user is authenticated
    if (!req.user?.tenant_id) {
      logger.warn("Tenant isolation: No user or tenant_id in request");
      res.status(401).json(errorResponse("Nicht authentifiziert", 401));
      return;
    }

    // Get the requested tenant ID from various sources
    const requestedTenantId =
      req.headers["x-tenant-id"] ?? req.params.tenantId ?? req.query.tenant_id;

    // If a specific tenant is requested, validate access
    if (
      requestedTenantId !== null &&
      requestedTenantId !== undefined &&
      requestedTenantId !== ""
    ) {
      const requestedId = parseInt(requestedTenantId.toString(), 10);
      const userTenantId = req.user.tenant_id;

      // Check if user is trying to access a different tenant
      if (requestedId !== userTenantId) {
        logger.warn(
          `Tenant isolation violation: User ${req.user.id} from tenant ${userTenantId} ` +
            `attempted to access tenant ${requestedId}`,
        );

        res
          .status(403)
          .json(
            errorResponse("Sie haben keinen Zugriff auf diese Ressourcen", 403),
          );
        return;
      }
    }

    // All checks passed
    next();
  } catch (error: unknown) {
    logger.error("Tenant isolation middleware error:", error);
    res
      .status(500)
      .json(errorResponse("Fehler bei der Tenant-Validierung", 500));
  }
}

/**
 * Strict tenant isolation - always validates tenant context
 * Use this for sensitive operations
 */
export function strictTenantIsolation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  // For strict mode, we always validate
  validateTenantIsolation(req, res, next);
}
