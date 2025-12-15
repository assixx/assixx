/**
 * Combined Security Middleware
 * Provides easy-to-use security stacks for different endpoint types
 * Uses v2 authentication middleware
 */
import { RequestHandler } from 'express';

import { ValidationMiddleware } from '../types/middleware.types.js';
import { RateLimiterType } from '../types/security.types.js';
import { rateLimiter } from './rateLimiter.js';
import { validateTenantIsolation } from './tenantIsolation.js';
import { authenticateV2, requireRoleV2 } from './v2/auth.middleware.js';

/**
 * Security middleware stacks for different endpoint types
 */
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
      authenticateV2 as RequestHandler,
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
      authenticateV2 as RequestHandler,
      validateTenantIsolation as RequestHandler,
      requireRoleV2('admin') as RequestHandler,
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
      authenticateV2 as RequestHandler,
      requireRoleV2('root') as RequestHandler,
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
    const stack: RequestHandler[] = [rateLimiter.api, authenticateV2 as RequestHandler];
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
    const stack: RequestHandler[] = [rateLimiter.upload, authenticateV2 as RequestHandler];
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

    if (options.rateLimit != null) {
      const rateLimitMiddleware = rateLimiter[options.rateLimit];
      stack.push(rateLimitMiddleware);
    }

    if (options.authenticate === true) {
      stack.push(authenticateV2 as RequestHandler);
    }

    if (options.roles != null) {
      stack.push(requireRoleV2(options.roles) as RequestHandler);
    }

    if (options.validation) {
      stack.push(...options.validation);
    }

    return stack;
  },
};

/**
 * Pre-built security stacks for common scenarios
 */
export const securityStacks: Record<string, RequestHandler[]> = {
  publicRead: security.public(),
  publicWrite: security.public(),
  login: security.auth(),
  signup: security.auth(),
  passwordReset: security.auth(),
  userProfile: security.user(),
  userSettings: security.user(),
  userDocuments: security.user(),
  adminDashboard: security.admin(),
  adminUsers: security.admin(),
  adminReports: security.admin(),
  rootTenants: security.root(),
  rootSystem: security.root(),
  uploadDocument: security.upload(),
  uploadImage: security.upload(),
  apiEndpoint: security.api(),
};
