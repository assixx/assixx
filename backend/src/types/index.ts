/**
 * Central Type Export File
 * Re-exports all types from the types directory for easy importing
 */

// Auth Types
export * from "./auth.types";

// Request Types
export * from "./request.types";

// Response Types
export * from "./response.types";

// Security Types
export * from "./security.types";

// Middleware Types
export * from "./middleware.types";

// Database Types
export * from "./database.types";

// Tenant Types
export * from "./tenant.types";

// Model Types
export type * from "./models";

// Convenience type for any authenticated handler
import { Response, NextFunction } from "express";

import { AuthenticatedRequest } from "./request.types";

export type AuthenticatedHandler = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => Promise<void> | void;

// Re-export commonly used types for convenience
export type {
  AuthenticatedRequest,
  AuthUser,
  PaginatedRequest,
  BodyRequest,
  QueryRequest,
  ParamsRequest,
} from "./request.types";

export type {
  ApiResponse,
  PaginatedResponse,
  ErrorResponse,
  ValidationErrorResponse,
} from "./response.types";

export type {
  RateLimiterType,
  SecurityEventType,
  SecurityMiddlewareOptions,
} from "./security.types";
