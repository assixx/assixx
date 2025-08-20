/**
 * API v2 Security Middleware Stacks
 * Provides easy-to-use security stacks for v2 endpoints
 */
import { RequestHandler } from 'express';

import { ValidationMiddleware } from '../../types/middleware.types';
import { rateLimiter } from '../rateLimiter';
import { validateTenantIsolation } from '../tenantIsolation';
import { authenticateV2, requireRoleV2 } from './auth.middleware';

// Security middleware stacks for v2 endpoints
export const securityV2 = {
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
   * USES V2 AUTH MIDDLEWARE
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
   * USES V2 AUTH MIDDLEWARE
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
   * USES V2 AUTH MIDDLEWARE
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
   * USES V2 AUTH MIDDLEWARE
   */
  api: (validation?: ValidationMiddleware): RequestHandler[] => {
    const stack: RequestHandler[] = [
      rateLimiter.api,
      authenticateV2 as RequestHandler, // TODO: Add API key support
    ];
    if (validation) {
      stack.push(...validation);
    }
    return stack;
  },

  /**
   * File upload endpoints
   * Special rate limiting for uploads
   * USES V2 AUTH MIDDLEWARE
   */
  upload: (validation?: ValidationMiddleware): RequestHandler[] => {
    const stack: RequestHandler[] = [rateLimiter.upload, authenticateV2 as RequestHandler];
    if (validation) {
      stack.push(...validation);
    }
    return stack;
  },
};

export default securityV2;
