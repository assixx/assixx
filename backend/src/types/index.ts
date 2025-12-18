// Convenience type for any authenticated handler
import { NextFunction, Response } from 'express';

import type { AuthenticatedRequest } from './request.types.js';

/**
 * Central Type Export File
 * Re-exports all types from the types directory for easy importing
 */

// Auth Types
export * from './auth.types.js';

// Request Types
export * from './request.types.js';

// Response Types
export * from './response.types.js';

// Security Types
export * from './security.types.js';

// Database Types
export * from './database.types.js';

// Tenant Types
export * from './tenant.types.js';

// Model Types
export type * from './models.js';

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
} from './request.types.js';

export type {
  ApiResponse,
  PaginatedResponse,
  ErrorResponse,
  ValidationErrorResponse,
} from './response.types.js';

export type {
  RateLimiterType,
  SecurityEventType,
  SecurityMiddlewareOptions,
} from './security.types.js';
