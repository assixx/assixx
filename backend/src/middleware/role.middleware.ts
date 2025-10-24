/**
 * Role Middleware
 * Checks if user has required role to access resource
 */
import { NextFunction, Response } from 'express';

import type { AuthenticatedRequest } from '../types/request.types';

/**
 * Middleware to check if user has one of the required roles
 * @param allowedRoles - Array of allowed roles
 */
export function checkRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Diese Funktion erfordert eine der folgenden Rollen: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}

/**
 * Shorthand middleware for admin-only routes
 */
export const requireAdmin = checkRole(['admin', 'root']);

/**
 * Shorthand middleware for root-only routes
 */
export const requireRoot = checkRole(['root']);
