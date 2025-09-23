/**
 * Tenant Status Middleware
 * Checks tenant deletion status and blocks access to suspended/deleting tenants
 */
import { NextFunction, Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';

import type { AuthenticatedRequest } from '../types/request.types';
import { query } from '../utils/db';
import { logger } from '../utils/logger';

interface TenantStatusRow extends RowDataPacket {
  deletion_status: 'active' | 'marked_for_deletion' | 'suspended' | 'deleting';
  deletion_requested_at?: Date;
  company_name: string;
}

/**
 * Check if the request path is whitelisted
 */
function isPathWhitelisted(path: string): boolean {
  const whitelistedPaths = [
    '/api/auth/logout',
    '/api/root/tenants/:id/deletion-status',
    '/api/root/tenants/:id/cancel-deletion',
    '/api/export-data',
    '/health',
  ];

  return whitelistedPaths.some((whitelistedPath) => {
    // Safe: whitelistedPaths is a hardcoded array, not user input
    // eslint-disable-next-line security/detect-non-literal-regexp
    const regex = new RegExp('^' + whitelistedPath.replace(/:[^/]+/g, '[^/]+') + '$');
    return regex.test(path);
  });
}

/**
 * Handle tenant status response based on deletion status
 */
function handleTenantStatus(
  tenant: TenantStatusRow,
  tenantId: number,
  username: string,
  res: Response,
  next: NextFunction,
): void {
  switch (tenant.deletion_status) {
    case 'active':
      next();
      break;

    case 'marked_for_deletion':
      res.setHeader('X-Tenant-Status', 'marked-for-deletion');
      if (tenant.deletion_requested_at) {
        const scheduledDate = new Date(tenant.deletion_requested_at);
        scheduledDate.setDate(scheduledDate.getDate() + 30);
        res.setHeader('X-Tenant-Deletion-Date', scheduledDate.toISOString());
      }
      next();
      break;

    case 'suspended':
      logger.warn(`Access denied to suspended tenant ${tenantId} by user ${username}`);
      res.status(403).json({
        error: 'Tenant is suspended and scheduled for deletion',
        code: 'TENANT_SUSPENDED',
        status: tenant.deletion_status,
        message:
          'Ihr Konto wurde gesperrt und wird gelöscht. Bitte kontaktieren Sie den Support für weitere Informationen.',
      });
      break;

    case 'deleting':
      logger.warn(`Access denied to deleting tenant ${tenantId} by user ${username}`);
      res.status(403).json({
        error: 'Tenant is currently being deleted',
        code: 'TENANT_DELETING',
        status: tenant.deletion_status,
        message:
          'Ihr Konto wird gerade gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.',
      });
      break;

    default:
      logger.error(`Unknown tenant deletion status: ${String(tenant.deletion_status)}`);
      next();
  }
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
    if (!authReq.user.tenant_id) {
      next();
      return;
    }

    const tenantId = authReq.user.tenant_id;

    // Check if path is whitelisted
    if (isPathWhitelisted(req.path)) {
      next();
      return;
    }

    // Check tenant status
    const [tenantRows] = await query<TenantStatusRow[]>(
      'SELECT deletion_status, deletion_requested_at, company_name FROM tenants WHERE id = ?',
      [tenantId],
    );

    if (tenantRows.length === 0) {
      logger.error(`Tenant ${tenantId} not found in status check`);
      res.status(404).json({
        error: 'Tenant not found',
        code: 'TENANT_NOT_FOUND',
      });
      return;
    }

    handleTenantStatus(tenantRows[0], tenantId, authReq.user.username, res, next);
  } catch (error: unknown) {
    logger.error('Error in tenant status middleware:', error);
    // Don't block access on middleware errors
    next();
  }
}

/**
 * Stricter version that only allows active tenants
 */
export async function requireActiveTenant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // First check regular tenant status
    await new Promise<void>((resolve, reject) => {
      void checkTenantStatus(req, res, (err?: unknown) => {
        if (err !== null && err !== undefined && err !== '') {
          reject(
            err instanceof Error ? err : (
              new Error(typeof err === 'string' ? err : JSON.stringify(err))
            ),
          );
        } else {
          resolve();
        }
      });
    });

    const authReq = req as AuthenticatedRequest;
    if (!authReq.user.tenant_id) {
      next();
      return;
    }

    // Additional check for marked_for_deletion
    const [rows] = await query<TenantStatusRow[]>(
      'SELECT deletion_status FROM tenants WHERE id = ?',
      [authReq.user.tenant_id],
    );

    if (rows.length > 0 && rows[0].deletion_status !== 'active') {
      res.status(403).json({
        error: 'This action requires an active tenant',
        code: 'TENANT_NOT_ACTIVE',
        status: rows[0].deletion_status,
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
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
      'SELECT deletion_status, deletion_requested_at FROM tenants WHERE id = ?',
      [tenantId],
    );

    if (tenantRows.length === 0) {
      return null;
    }

    const tenant = tenantRows[0];

    const result = {
      isScheduledForDeletion: tenant.deletion_status !== 'active',
      status: tenant.deletion_status,
      deletionDate: undefined as Date | undefined,
      daysRemaining: undefined as number | undefined,
    };

    if (tenant.deletion_status === 'marked_for_deletion' && tenant.deletion_requested_at) {
      const scheduledDate = new Date(tenant.deletion_requested_at);
      scheduledDate.setDate(scheduledDate.getDate() + 30); // 30 day grace period

      result.deletionDate = scheduledDate;
      result.daysRemaining = Math.max(
        0,
        Math.ceil((scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      );
    }

    return result;
  } catch (error: unknown) {
    logger.error('Error getting tenant deletion info:', error);
    return null;
  }
}

export default checkTenantStatus;
