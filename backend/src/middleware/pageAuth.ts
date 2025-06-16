/**
 * Page Authentication Middleware
 * Protects HTML pages based on user roles
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { logger } from "../utils/logger.js";

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
const pagePermissions: Record<string, PageConfig> = {
  // Admin pages
  "/pages/admin-dashboard.html": {
    allowedRoles: ["admin", "root"],
    redirectOnFail: "/pages/employee-dashboard.html",
  },
  "/pages/admin-profile.html": {
    allowedRoles: ["admin", "root"],
    redirectOnFail: "/pages/employee-profile.html",
  },
  "/pages/admin-config.html": {
    allowedRoles: ["admin", "root"],
    redirectOnFail: "/pages/employee-dashboard.html",
  },
  "/pages/feature-management.html": {
    allowedRoles: ["admin", "root"],
    redirectOnFail: "/pages/employee-dashboard.html",
  },
  "/pages/documents.html": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/pages/login.html",
  },
  "/pages/survey-admin.html": {
    allowedRoles: ["admin", "root"],
    redirectOnFail: "/pages/survey-employee.html",
  },
  "/pages/org-management.html": {
    allowedRoles: ["admin", "root"],
    redirectOnFail: "/pages/employee-dashboard.html",
  },
  "/pages/archived-employees.html": {
    allowedRoles: ["admin", "root"],
    redirectOnFail: "/pages/employee-dashboard.html",
  },

  // Employee pages
  "/pages/employee-dashboard.html": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/pages/login.html",
  },
  "/pages/employee-profile.html": {
    allowedRoles: ["employee"],
    redirectOnFail: "/pages/admin-profile.html",
  },
  "/pages/profile.html": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/pages/login.html",
  },
  "/pages/salary-documents.html": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/pages/login.html",
  },
  "/pages/survey-employee.html": {
    allowedRoles: ["employee"],
    redirectOnFail: "/pages/survey-admin.html",
  },

  // Root pages
  "/pages/root-dashboard.html": {
    allowedRoles: ["root"],
    redirectOnFail: "/pages/admin-dashboard.html",
  },
  "/pages/root-profile.html": {
    allowedRoles: ["root"],
    redirectOnFail: "/pages/admin-profile.html",
  },
  "/pages/root-features.html": {
    allowedRoles: ["root"],
    redirectOnFail: "/pages/feature-management.html",
  },
  "/pages/manage-admins.html": {
    allowedRoles: ["root"],
    redirectOnFail: "/pages/admin-dashboard.html",
  },
  "/pages/storage-upgrade.html": {
    allowedRoles: ["root"],
    redirectOnFail: "/pages/admin-dashboard.html",
  },

  // Shared pages (all authenticated users)
  "/pages/blackboard.html": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/pages/login.html",
  },
  "/pages/calendar.html": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/pages/login.html",
  },
  "/pages/chat.html": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/pages/login.html",
  },
  "/pages/shifts.html": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/pages/login.html",
  },
  "/pages/kvp.html": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/pages/login.html",
  },

  // Public pages (no auth required)
  "/pages/login.html": {
    allowedRoles: ["*"],
    redirectOnFail: "/pages/login.html",
  },
  "/pages/signup.html": {
    allowedRoles: ["*"],
    redirectOnFail: "/pages/login.html",
  },
  "/pages/index.html": {
    allowedRoles: ["*"],
    redirectOnFail: "/pages/login.html",
  },
};

/**
 * Extract token from cookie or Authorization header
 */
function getTokenFromRequest(req: Request): string | null {
  // Try cookie first
  const cookieToken = req.cookies?.["token"];
  if (cookieToken) return cookieToken;

  // Try Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Get dashboard URL based on role
 */
function getDashboardForRole(role: string): string {
  switch (role) {
    case "employee":
      return "/pages/employee-dashboard.html";
    case "admin":
      return "/pages/admin-dashboard.html";
    case "root":
      return "/pages/root-dashboard.html";
    default:
      return "/pages/login.html";
  }
}

/**
 * Middleware to protect HTML pages based on user role
 */
export function protectPage(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const pagePath = req.path;
  const pageConfig = pagePermissions[pagePath];

  // If page is not in our config, allow it (static assets, etc.)
  if (!pageConfig) {
    return next();
  }

  // Public pages
  if (pageConfig.allowedRoles.includes("*")) {
    return next();
  }

  // Get token
  const token = getTokenFromRequest(req);

  if (!token) {
    logger.warn(`No token for protected page: ${pagePath}`);
    return res.redirect("/pages/login.html");
  }

  try {
    // Verify token
    const decoded = jwt.verify(
      token,
      process.env["JWT_SECRET"] || "your-secret-key",
    ) as DecodedToken;

    // Check if user's role is allowed
    if (!pageConfig.allowedRoles.includes(decoded.role)) {
      logger.warn(
        `User ${decoded.username} (${decoded.role}) tried to access ${pagePath}`,
      );

      // Redirect to appropriate page based on role
      const redirectUrl = getDashboardForRole(decoded.role);
      return res.redirect(redirectUrl);
    }

    // User is authorized, continue
    next();
  } catch (error) {
    logger.error("Token verification failed:", error);
    res.redirect("/pages/login.html");
  }
}

/**
 * Middleware to automatically redirect to correct dashboard
 */
export function redirectToDashboard(req: Request, res: Response): void {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.redirect("/pages/login.html");
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env["JWT_SECRET"] || "your-secret-key",
    ) as DecodedToken;
    const dashboardUrl = getDashboardForRole(decoded.role);
    res.redirect(dashboardUrl);
  } catch (error) {
    logger.error("Token verification failed:", error);
    res.redirect("/pages/login.html");
  }
}

/**
 * Content Security Policy middleware
 */
export function contentSecurityPolicy(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader(
    "Content-Security-Policy",
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
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  next();
}

export default {
  protectPage,
  redirectToDashboard,
  contentSecurityPolicy,
};
