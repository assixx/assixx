/**
 * Combined Security Middleware
 * Provides easy-to-use security stacks for different endpoint types
 */

import { RequestHandler, Router } from "express";

import { ValidationMiddleware } from "../types/middleware.types";
import { RateLimiterType } from "../types/security.types";

import { authenticateToken, requireRole } from "./auth-refactored";
import { rateLimiter } from "./rateLimiter";
import { validateTenantIsolation } from "./tenantIsolation";

// Security middleware stacks for different endpoint types
export const security = {
  /**
   * Public endpoints (no authentication required)
   * Rate limited to prevent abuse
   */
  public: (validation?: ValidationMiddleware): RequestHandler[] => {
    const stack: RequestHandler[] = [rateLimiter.public];
    if (validation) {
      stack.push(...validation);
    }
    return stack;
  },

  /**
   * Authentication endpoints (login, signup, password reset)
   * Strict rate limiting to prevent brute force
   */
  auth: (validation?: ValidationMiddleware): RequestHandler[] => {
    const stack: RequestHandler[] = [rateLimiter.auth];
    if (validation) {
      stack.push(...validation);
    }
    return stack;
  },

  /**
   * Authenticated user endpoints
   * Requires valid authentication token
   */
  user: (validation?: ValidationMiddleware): RequestHandler[] => {
    const stack: RequestHandler[] = [
      rateLimiter.authenticated,
      authenticateToken as RequestHandler,
      validateTenantIsolation as RequestHandler,
    ];
    if (validation) {
      stack.push(...validation);
    }
    return stack;
  },

  /**
   * Admin-only endpoints
   * Requires admin role
   */
  admin: (validation?: ValidationMiddleware): RequestHandler[] => {
    const stack: RequestHandler[] = [
      rateLimiter.admin,
      authenticateToken as RequestHandler,
      validateTenantIsolation as RequestHandler,
      requireRole("admin") as RequestHandler,
    ];
    if (validation) {
      stack.push(...validation);
    }
    return stack;
  },

  /**
   * Root-only endpoints
   * Requires root role
   */
  root: (validation?: ValidationMiddleware): RequestHandler[] => {
    const stack: RequestHandler[] = [
      rateLimiter.admin,
      authenticateToken as RequestHandler,
      requireRole("root") as RequestHandler,
    ];
    if (validation) {
      stack.push(...validation);
    }
    return stack;
  },

  /**
   * API endpoints (for external integrations)
   * Can use either token auth or API key
   */
  api: (validation?: ValidationMiddleware): RequestHandler[] => {
    const stack: RequestHandler[] = [
      rateLimiter.api,
      authenticateToken as RequestHandler, // TODO: Add API key support
    ];
    if (validation) {
      stack.push(...validation);
    }
    return stack;
  },

  /**
   * File upload endpoints
   * Special rate limiting for uploads
   */
  upload: (validation?: ValidationMiddleware): RequestHandler[] => {
    const stack: RequestHandler[] = [
      rateLimiter.upload,
      authenticateToken as RequestHandler,
    ];
    if (validation) {
      stack.push(...validation);
    }
    return stack;
  },

  /**
   * Custom security stack
   * Build your own combination
   */
  custom: (options: {
    rateLimit?: RateLimiterType;
    authenticate?: boolean;
    roles?: string | string[];
    validation?: ValidationMiddleware;
  }): RequestHandler[] => {
    const stack: RequestHandler[] = [];

    // Add rate limiter
    if (options.rateLimit != null) {
      const rateLimitMiddleware = rateLimiter[options.rateLimit];
      stack.push(rateLimitMiddleware);
    }

    // Add authentication
    if (options.authenticate === true) {
      stack.push(authenticateToken as RequestHandler);
    }

    // Add role authorization
    if (options.roles != null) {
      stack.push(requireRole(options.roles) as RequestHandler);
    }

    // Add validation
    if (options.validation) {
      stack.push(...options.validation);
    }

    return stack;
  },
};

// Pre-built security stacks for common scenarios
export const securityStacks: Record<string, RequestHandler[]> = {
  // Public routes
  publicRead: security.public(),
  publicWrite: security.public(),

  // Auth routes
  login: security.auth(),
  signup: security.auth(),
  passwordReset: security.auth(),

  // User routes
  userProfile: security.user(),
  userSettings: security.user(),
  userDocuments: security.user(),

  // Admin routes
  adminDashboard: security.admin(),
  adminUsers: security.admin(),
  adminReports: security.admin(),

  // Root routes
  rootTenants: security.root(),
  rootSystem: security.root(),

  // Upload routes
  uploadDocument: security.upload(),
  uploadImage: security.upload(),

  // API routes
  apiEndpoint: security.api(),
};

// Helper function to apply security to entire router
export function applySecurityToRouter(
  router: Router,
  defaultSecurity: RequestHandler[],
): void {
  // Store original methods
  const originalGet = router.get.bind(router);
  const originalPost = router.post.bind(router);
  const originalPut = router.put.bind(router);
  const originalPatch = router.patch.bind(router);
  const originalDelete = router.delete.bind(router);

  // Override methods to prepend security middleware
  // Type-safe method override for complex Express router signatures
  type RouterMethod = (path: string, ...handlers: RequestHandler[]) => Router;

  (router.get as RouterMethod) = (
    path: string,
    ...handlers: RequestHandler[]
  ) => {
    return originalGet(path, ...defaultSecurity, ...handlers);
  };

  (router.post as RouterMethod) = (
    path: string,
    ...handlers: RequestHandler[]
  ) => {
    return originalPost(path, ...defaultSecurity, ...handlers);
  };

  (router.put as RouterMethod) = (
    path: string,
    ...handlers: RequestHandler[]
  ) => {
    return originalPut(path, ...defaultSecurity, ...handlers);
  };

  (router.patch as RouterMethod) = (
    path: string,
    ...handlers: RequestHandler[]
  ) => {
    return originalPatch(path, ...defaultSecurity, ...handlers);
  };

  (router.delete as RouterMethod) = (
    path: string,
    ...handlers: RequestHandler[]
  ) => {
    return originalDelete(path, ...defaultSecurity, ...handlers);
  };
}

export default security;
