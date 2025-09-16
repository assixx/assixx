/**
 * Page Authentication Middleware
 * Protects HTML pages based on user roles
 */
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { logger } from '../utils/logger.js';

// Constants
const EMPLOYEE_DASHBOARD_PATH = '/employee-dashboard';
const ADMIN_DASHBOARD_PATH = '/admin-dashboard';
const ROOT_DASHBOARD_PATH = '/root-dashboard';

interface PageConfig {
  allowedRoles: string[];
  redirectOnFail: string;
}

interface DecodedToken {
  id: number;
  username: string;
  role: string;
  tenant_id: number;
  iat: number;
  exp: number;
}

// Define which pages are accessible by which roles
const pagePermissions: Partial<Record<string, PageConfig>> = {
  // Admin pages
  [ADMIN_DASHBOARD_PATH]: {
    allowedRoles: ['admin', 'root'],
    redirectOnFail: EMPLOYEE_DASHBOARD_PATH,
  },
  '/admin-profile': {
    allowedRoles: ['admin', 'root'],
    redirectOnFail: '/employee-profile',
  },
  '/admin-config': {
    allowedRoles: ['admin', 'root'],
    redirectOnFail: EMPLOYEE_DASHBOARD_PATH,
  },
  '/feature-management': {
    allowedRoles: ['admin', 'root'],
    redirectOnFail: EMPLOYEE_DASHBOARD_PATH,
  },
  '/documents': {
    allowedRoles: ['employee', 'admin', 'root'],
    redirectOnFail: '/login',
  },
  '/survey-admin': {
    allowedRoles: ['admin', 'root'],
    redirectOnFail: '/survey-employee',
  },
  '/org-management': {
    allowedRoles: ['admin', 'root'],
    redirectOnFail: EMPLOYEE_DASHBOARD_PATH,
  },
  '/archived-employees': {
    allowedRoles: ['admin', 'root'],
    redirectOnFail: EMPLOYEE_DASHBOARD_PATH,
  },

  // Employee pages
  [EMPLOYEE_DASHBOARD_PATH]: {
    allowedRoles: ['employee', 'admin', 'root'],
    redirectOnFail: '/login',
  },
  '/employee-profile': {
    allowedRoles: ['employee'],
    redirectOnFail: '/admin-profile',
  },
  '/profile': {
    allowedRoles: ['employee', 'admin', 'root'],
    redirectOnFail: '/login',
  },
  '/salary-documents': {
    allowedRoles: ['employee', 'admin', 'root'],
    redirectOnFail: '/login',
  },
  '/survey-employee': {
    allowedRoles: ['employee'],
    redirectOnFail: '/survey-admin',
  },

  // Root pages
  [ROOT_DASHBOARD_PATH]: {
    allowedRoles: ['root'],
    redirectOnFail: ADMIN_DASHBOARD_PATH,
  },
  '/root-profile': {
    allowedRoles: ['root'],
    redirectOnFail: '/admin-profile',
  },
  '/root-features': {
    allowedRoles: ['root'],
    redirectOnFail: '/feature-management',
  },
  '/manage-admins': {
    allowedRoles: ['root'],
    redirectOnFail: ADMIN_DASHBOARD_PATH,
  },
  '/storage-upgrade': {
    allowedRoles: ['root'],
    redirectOnFail: ADMIN_DASHBOARD_PATH,
  },
  '/manage-root-users': {
    allowedRoles: ['root'],
    redirectOnFail: ROOT_DASHBOARD_PATH,
  },
  '/account-settings': {
    allowedRoles: ['root'],
    redirectOnFail: ROOT_DASHBOARD_PATH,
  },
  '/tenant-deletion-status': {
    allowedRoles: ['root'],
    redirectOnFail: ROOT_DASHBOARD_PATH,
  },
  '/logs': {
    allowedRoles: ['root'],
    redirectOnFail: ROOT_DASHBOARD_PATH,
  },
  '/departments': {
    allowedRoles: ['admin', 'root'],
    redirectOnFail: ADMIN_DASHBOARD_PATH,
  },
  '/manage-department-groups': {
    allowedRoles: ['admin', 'root'],
    redirectOnFail: ADMIN_DASHBOARD_PATH,
  },

  // Shared pages (all authenticated users)
  '/blackboard': {
    allowedRoles: ['employee', 'admin', 'root'],
    redirectOnFail: '/login',
  },
  '/calendar': {
    allowedRoles: ['employee', 'admin', 'root'],
    redirectOnFail: '/login',
  },
  '/chat': {
    allowedRoles: ['employee', 'admin', 'root'],
    redirectOnFail: '/login',
  },
  '/shifts': {
    allowedRoles: ['employee', 'admin', 'root'],
    redirectOnFail: '/login',
  },
  '/kvp': {
    allowedRoles: ['employee', 'admin', 'root'],
    redirectOnFail: '/login',
  },
  '/kvp-detail': {
    allowedRoles: ['employee', 'admin', 'root'],
    redirectOnFail: '/login',
  },
  '/documents-personal': {
    allowedRoles: ['employee', 'admin', 'root'],
    redirectOnFail: '/login',
  },
  '/documents-payroll': {
    allowedRoles: ['employee', 'admin', 'root'],
    redirectOnFail: '/login',
  },
  '/documents-company': {
    allowedRoles: ['employee', 'admin', 'root'],
    redirectOnFail: '/login',
  },
  '/documents-department': {
    allowedRoles: ['employee', 'admin', 'root'],
    redirectOnFail: '/login',
  },
  '/documents-team': {
    allowedRoles: ['employee', 'admin', 'root'],
    redirectOnFail: '/login',
  },
  '/documents-search': {
    allowedRoles: ['employee', 'admin', 'root'],
    redirectOnFail: '/login',
  },

  // Public pages (no auth required)
  '/login': {
    allowedRoles: ['*'],
    redirectOnFail: '/login',
  },
  '/signup': {
    allowedRoles: ['*'],
    redirectOnFail: '/login',
  },
  '/': {
    allowedRoles: ['*'],
    redirectOnFail: '/login',
  },
  '/index': {
    allowedRoles: ['*'],
    redirectOnFail: '/login',
  },
};

/**
 * Extract token from cookie or Authorization header
 */
function getTokenFromRequest(req: Request): string | null {
  // Try cookie first
  const cookieToken = req.cookies.token as string | undefined;
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
 * Middleware to protect HTML pages based on user role
 */
export function protectPage(req: Request, res: Response, next: NextFunction): void {
  const pagePath = req.path;

  // Use Object.prototype.hasOwnProperty for safe property access
  const pageConfig =
    Object.prototype.hasOwnProperty.call(pagePermissions, pagePath) ?
      // Safe: pagePath is from req.path, and we've already checked it exists
      // eslint-disable-next-line security/detect-object-injection
      pagePermissions[pagePath]
    : undefined;

  // If page is not in our config, allow it (static assets, etc.)
  if (pageConfig === undefined) {
    next();
    return;
  }

  // Public pages
  if (pageConfig.allowedRoles.includes('*')) {
    next();
    return;
  }

  // Get token
  const token = getTokenFromRequest(req);

  if (token == null || token === '') {
    logger.warn(`No token for protected page: ${pagePath}`);
    res.redirect('/login');
    return;
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET ?? 'your-secret-key') as DecodedToken;

    // Check if user's role is allowed
    if (!pageConfig.allowedRoles.includes(decoded.role)) {
      logger.warn(`User ${decoded.username} (${decoded.role}) tried to access ${pagePath}`);

      // Redirect to appropriate page based on role
      const redirectUrl = getDashboardForRole(decoded.role);
      res.redirect(redirectUrl);
      return;
    }

    // User is authorized, continue
    next();
  } catch (error: unknown) {
    logger.error('Token verification failed:', error);
    res.redirect('/login');
  }
}

/**
 * Middleware to automatically redirect to correct dashboard
 */
export function redirectToDashboard(req: Request, res: Response): void {
  const token = getTokenFromRequest(req);

  if (token == null || token === '') {
    // No token - redirect to landing page
    res.redirect('/index');
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET ?? 'your-secret-key') as DecodedToken;
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
  protectPage,
  redirectToDashboard,
  contentSecurityPolicy,
};
