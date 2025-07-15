/**
 * Middleware-specific Type Definitions
 * Types for Express middleware functions with proper typing
 */

import { Request, Response, NextFunction, RequestHandler } from "express";
import { AuthenticatedRequest, AuthUser } from "./request.types";
import { ValidationChain } from "express-validator";
import { RateLimiterType, RateLimiterMiddleware } from "./security.types";

// Generic middleware that adds properties to request
export type MiddlewareWithRequest<T extends Request = Request> = (
  req: T,
  res: Response,
  next: NextFunction,
) => Promise<void> | void;

// Authentication middleware that ensures user is authenticated
export type AuthenticationMiddleware = MiddlewareWithRequest<Request> & {
  (req: Request, res: Response, next: NextFunction): void;
  (req: AuthenticatedRequest, res: Response, next: NextFunction): void;
};

// Role-based authorization middleware
export type AuthorizationMiddleware = (
  role: string | string[],
) => MiddlewareWithRequest<AuthenticatedRequest>;

// Permission-based authorization middleware
export type PermissionMiddleware = (
  permission: string | string[],
) => MiddlewareWithRequest<AuthenticatedRequest>;

// Rate limiter middleware factory is imported from security.types

// Validation middleware - can include validation chains and error handlers
export type ValidationMiddleware = (ValidationChain | RequestHandler)[];

// Error handling middleware
export type ErrorHandlerMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => void;

// Async handler wrapper type
export type AsyncHandler<T extends Request = Request> = (
  fn: (req: T, res: Response, next: NextFunction) => Promise<void>,
) => RequestHandler;

// Combined security middleware options
export interface SecurityMiddlewareStack {
  rateLimiter?: RateLimiterType;
  authenticate?: boolean;
  authorize?: string | string[];
  permissions?: string | string[];
  validate?: ValidationMiddleware;
  audit?: boolean;
}

// Middleware factory functions
export interface MiddlewareFactories {
  authenticate: AuthenticationMiddleware;
  authorize: AuthorizationMiddleware;
  requirePermission: PermissionMiddleware;
  rateLimiter: RateLimiterMiddleware;
  validate: (schema: ValidationMiddleware) => RequestHandler;
  asyncHandler: AsyncHandler;
}

// Type guard to check if request is authenticated
export function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return "user" in req && req.user != null && typeof req.user === "object";
}

// Type guard to check if user has specific role
export function hasRole(user: AuthUser, role: string | string[]): boolean {
  const roles = Array.isArray(role) ? role : [role];
  return roles.includes(user.role);
}

// Helper to create typed middleware
export function createMiddleware<T extends Request = Request>(
  handler: MiddlewareWithRequest<T>,
): RequestHandler {
  return handler as RequestHandler;
}

// Helper to create authenticated middleware
export function createAuthenticatedMiddleware(
  handler: MiddlewareWithRequest<AuthenticatedRequest>,
): RequestHandler {
  return ((req: Request, res: Response, next: NextFunction) => {
    if (!isAuthenticated(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return handler(req, res, next);
  }) as RequestHandler;
}

// Common middleware combinations
export const middlewareStacks = {
  publicRoute: (rateLimiter: RateLimiterMiddleware): RequestHandler[] => [
    rateLimiter.public as RequestHandler,
  ],

  authenticatedRoute: (
    rateLimiter: RateLimiterMiddleware,
    authenticate: AuthenticationMiddleware,
  ): RequestHandler[] => [
    rateLimiter.authenticated as RequestHandler,
    authenticate,
  ],

  adminRoute: (
    rateLimiter: RateLimiterMiddleware,
    authenticate: AuthenticationMiddleware,
    authorize: AuthorizationMiddleware,
  ): RequestHandler[] => [
    rateLimiter.admin as RequestHandler,
    authenticate,
    authorize("admin") as RequestHandler,
  ],

  apiRoute: (
    rateLimiter: RateLimiterMiddleware,
    authenticate: AuthenticationMiddleware,
    validate?: ValidationMiddleware,
  ): RequestHandler[] => {
    const stack: RequestHandler[] = [
      rateLimiter.api as RequestHandler,
      authenticate,
    ];
    if (validate) {
      stack.push(...validate);
    }
    return stack;
  },
};
