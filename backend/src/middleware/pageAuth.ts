/**
 * Page Authentication Middleware
 * Provides dashboard redirect and security headers
 *
 * NOTE: Page-level permissions are handled by requireRoleV2 middleware in html.routes.ts
 * This file only provides utility functions for redirect and CSP headers.
 */
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { logger } from '../utils/logger.js';

// Constants
const EMPLOYEE_DASHBOARD_PATH = '/employee-dashboard';
const ADMIN_DASHBOARD_PATH = '/admin-dashboard';
const ROOT_DASHBOARD_PATH = '/root-dashboard';

interface DecodedToken {
  id: number;
  username: string;
  role: string;
  tenant_id: number;
  iat: number;
  exp: number;
}

/**
 * Extract token from cookie or Authorization header
 */
function getTokenFromRequest(req: Request): string | null {
  // Try cookie first (bracket notation for index signature)
  const cookieToken = req.cookies['token'] as string | undefined;
  if (cookieToken != null && cookieToken !== '') return cookieToken;

  // Try Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ') === true) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Get dashboard URL based on role
 */
function getDashboardForRole(role: string): string {
  switch (role) {
    case 'employee':
      return EMPLOYEE_DASHBOARD_PATH;
    case 'admin':
      return ADMIN_DASHBOARD_PATH;
    case 'root':
      return ROOT_DASHBOARD_PATH;
    default:
      return '/login';
  }
}

/**
 * Middleware to automatically redirect to correct dashboard
 * Used for root '/' URL
 */
export function redirectToDashboard(req: Request, res: Response): void {
  const token = getTokenFromRequest(req);

  if (token == null || token === '') {
    // No token - redirect to landing page
    res.redirect('/index');
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env['JWT_SECRET'] ?? 'your-secret-key',
    ) as DecodedToken;
    const dashboardUrl = getDashboardForRole(decoded.role);
    res.redirect(dashboardUrl);
  } catch (error: unknown) {
    logger.error('Token verification failed:', error);
    // Invalid token - redirect to landing page
    res.redirect('/index');
  }
}

/**
 * Content Security Policy middleware
 * Sets security headers for all responses
 */
export function contentSecurityPolicy(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
      "img-src 'self' data: blob:; " +
      "font-src 'self' data: https://cdnjs.cloudflare.com https://fonts.gstatic.com; " +
      "connect-src 'self' ws: wss:; " +
      "frame-src 'self' blob:; " +
      "object-src 'self' blob:; " +
      "base-uri 'self'; " +
      "form-action 'self';",
  );

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
}

export default {
  redirectToDashboard,
  contentSecurityPolicy,
};
