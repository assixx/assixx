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
  "/admin-dashboard": {
    allowedRoles: ["admin", "root"],
    redirectOnFail: "/employee-dashboard",
  },
  "/admin-profile": {
    allowedRoles: ["admin", "root"],
    redirectOnFail: "/employee-profile",
  },
  "/admin-config": {
    allowedRoles: ["admin", "root"],
    redirectOnFail: "/employee-dashboard",
  },
  "/feature-management": {
    allowedRoles: ["admin", "root"],
    redirectOnFail: "/employee-dashboard",
  },
  "/documents": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/login",
  },
  "/survey-admin": {
    allowedRoles: ["admin", "root"],
    redirectOnFail: "/survey-employee",
  },
  "/org-management": {
    allowedRoles: ["admin", "root"],
    redirectOnFail: "/employee-dashboard",
  },
  "/archived-employees": {
    allowedRoles: ["admin", "root"],
    redirectOnFail: "/employee-dashboard",
  },

  // Employee pages
  "/employee-dashboard": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/login",
  },
  "/employee-profile": {
    allowedRoles: ["employee"],
    redirectOnFail: "/admin-profile",
  },
  "/profile": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/login",
  },
  "/salary-documents": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/login",
  },
  "/survey-employee": {
    allowedRoles: ["employee"],
    redirectOnFail: "/survey-admin",
  },

  // Root pages
  "/root-dashboard": {
    allowedRoles: ["root"],
    redirectOnFail: "/admin-dashboard",
  },
  "/root-profile": {
    allowedRoles: ["root"],
    redirectOnFail: "/admin-profile",
  },
  "/root-features": {
    allowedRoles: ["root"],
    redirectOnFail: "/feature-management",
  },
  "/manage-admins": {
    allowedRoles: ["root"],
    redirectOnFail: "/admin-dashboard",
  },
  "/storage-upgrade": {
    allowedRoles: ["root"],
    redirectOnFail: "/admin-dashboard",
  },
  "/manage-root-users": {
    allowedRoles: ["root"],
    redirectOnFail: "/root-dashboard",
  },
  "/account-settings": {
    allowedRoles: ["root"],
    redirectOnFail: "/root-dashboard",
  },
  "/tenant-deletion-status": {
    allowedRoles: ["root"],
    redirectOnFail: "/root-dashboard",
  },
  "/logs": {
    allowedRoles: ["root"],
    redirectOnFail: "/root-dashboard",
  },
  "/departments": {
    allowedRoles: ["admin", "root"],
    redirectOnFail: "/admin-dashboard",
  },
  "/manage-department-groups": {
    allowedRoles: ["admin", "root"],
    redirectOnFail: "/admin-dashboard",
  },

  // Shared pages (all authenticated users)
  "/blackboard": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/login",
  },
  "/calendar": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/login",
  },
  "/chat": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/login",
  },
  "/shifts": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/login",
  },
  "/kvp": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/login",
  },
  "/kvp-detail": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/login",
  },
  "/documents-personal": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/login",
  },
  "/documents-payroll": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/login",
  },
  "/documents-company": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/login",
  },
  "/documents-department": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/login",
  },
  "/documents-team": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/login",
  },
  "/documents-search": {
    allowedRoles: ["employee", "admin", "root"],
    redirectOnFail: "/login",
  },

  // Public pages (no auth required)
  "/login": {
    allowedRoles: ["*"],
    redirectOnFail: "/login",
  },
  "/signup": {
    allowedRoles: ["*"],
    redirectOnFail: "/login",
  },
  "/": {
    allowedRoles: ["*"],
    redirectOnFail: "/login",
  },
  "/index": {
    allowedRoles: ["*"],
    redirectOnFail: "/login",
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
      return "/employee-dashboard";
    case "admin":
      return "/admin-dashboard";
    case "root":
      return "/root-dashboard";
    default:
      return "/login";
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
    return res.redirect("/login");
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
    res.redirect("/login");
  }
}

/**
 * Middleware to automatically redirect to correct dashboard
 */
export function redirectToDashboard(req: Request, res: Response): void {
  const token = getTokenFromRequest(req);

  if (!token) {
    // No token - redirect to landing page
    return res.redirect("/index");
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
    // Invalid token - redirect to landing page
    res.redirect("/index");
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
