/**
 * Tenant Isolation Middleware
 * Ensures users can only access resources from their own tenant
 */
import { NextFunction, Response } from 'express';

import type { AuthenticatedRequest } from '../types/request.types';
import { errorResponse } from '../types/response.types';
import { logger } from '../utils/logger';

/**
 * Extracts tenant ID string from various request sources
 */
function extractTenantIdFromRequest(req: AuthenticatedRequest): string | undefined {
  // Try header first
  const headerTenantId = req.headers['x-tenant-id'];
  if (headerTenantId !== undefined) {
    return Array.isArray(headerTenantId) ? headerTenantId[0] : headerTenantId;
  }

  // Try route params
  if (req.params.tenantId) {
    return req.params.tenantId;
  }

  // Try query params
  const queryTenantId = req.query.tenant_id;
  if (queryTenantId === undefined) {
    return undefined;
  }

  if (Array.isArray(queryTenantId)) {
    return queryTenantId[0] as string;
  }

  if (typeof queryTenantId === 'string') {
    return queryTenantId;
  }

  // ParsedQs object - skip complex objects
  return undefined;
}

/**
 * Checks if the requested tenant matches user's tenant
 */
function isValidTenantAccess(
  requestedTenantStr: string | undefined,
  userTenantId: number,
  userId: number,
): boolean {
  if (requestedTenantStr === undefined || requestedTenantStr === '') {
    return true;
  }

  const requestedId = Number.parseInt(requestedTenantStr, 10);

  if (requestedId !== userTenantId) {
    logger.warn(
      `Tenant isolation violation: User ${userId} from tenant ${userTenantId} ` +
        `attempted to access tenant ${requestedId}`,
    );
    return false;
  }

  return true;
}

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
    if (!req.user.tenant_id) {
      logger.warn('Tenant isolation: No user or tenant_id in request');
      res.status(401).json(errorResponse('Nicht authentifiziert', 401));
      return;
    }

    // Extract tenant ID from request
    const requestedTenantId = extractTenantIdFromRequest(req);

    // Validate tenant access
    if (!isValidTenantAccess(requestedTenantId, req.user.tenant_id, req.user.id)) {
      res.status(403).json(errorResponse('Sie haben keinen Zugriff auf diese Ressourcen', 403));
      return;
    }

    // All checks passed
    next();
  } catch (error: unknown) {
    logger.error('Tenant isolation middleware error:', error);
    res.status(500).json(errorResponse('Fehler bei der Tenant-Validierung', 500));
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
