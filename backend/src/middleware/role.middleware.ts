/**
 * Role Middleware
 * Checks if user has required role to access resource
 */
import { NextFunction, Request, Response } from 'express';

interface AuthRequest extends Request {
  user?: {
    id: number;
    tenant_id: number;
    role: 'root' | 'admin' | 'employee';
  };
}

/**
 * Middleware to check if user has one of the required roles
 * @param allowedRoles - Array of allowed roles
 */
export function checkRole(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

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
