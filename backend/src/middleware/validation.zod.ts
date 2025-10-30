/**
 * Zod Validation Middleware for Assixx
 * Based on Zod v4 Documentation Best Practices
 *
 * Key Features:
 * - Type-safe validation with automatic type inference
 * - safeParse for non-throwing error handling
 * - Consistent error format with express-validator compatibility
 * - Support for query, body, and params validation
 */
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */
// Type parameters are necessary here for proper type inference from Zod schemas
import { NextFunction, Request, Response } from 'express';
import { ZodError, z } from 'zod';

import { errorResponse } from '../utils/apiResponse.js';

/**
 * Custom error formatter for Zod errors
 * Converts Zod errors to our API error format
 */
function formatZodError(error: ZodError): { field: string; message: string }[] {
  // eslint-disable-next-line @typescript-eslint/typedef -- z.ZodIssue is deprecated, type is auto-inferred from error.issues
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'root',
    message: issue.message,
  }));
}

/**
 * Helper to safely get request body as unknown
 * Express types req.body as 'any' - this helper makes it explicit
 */
function getRequestBody(req: Request): unknown {
  return req.body;
}

/**
 * Validation middleware factory for request body
 * Uses safeParse to avoid throwing errors
 * Automatically infers types from schema
 */
export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Use safeParse instead of parse to avoid throwing
    const result = schema.safeParse(getRequestBody(req));

    if (!result.success) {
      const details = formatZodError(result.error);
      const response = errorResponse('VALIDATION_ERROR', 'Validation failed', details);
      res.status(400).json(response);
      return;
    }

    // Replace body with validated and transformed data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    req.body = result.data as any;
    next();
  };
}

/**
 * Validation middleware factory for query parameters
 * Handles string-to-number conversions automatically
 */
export function validateQuery<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const details = formatZodError(result.error);
      const response = errorResponse('VALIDATION_ERROR', 'Invalid query parameters', details);
      res.status(400).json(response);
      return;
    }

    // Type-safe assignment without any
    Object.assign(req.query, result.data);
    next();
  };
}

/**
 * Validation middleware factory for URL parameters
 * Useful for ID validation and transformation
 */
export function validateParams<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      const details = formatZodError(result.error);
      const response = errorResponse('VALIDATION_ERROR', 'Invalid URL parameters', details);
      res.status(400).json(response);
      return;
    }

    // Type-safe assignment without any
    Object.assign(req.params, result.data);
    next();
  };
}

/**
 * Combined validation for body, query, and params
 * Useful for complex endpoints with multiple input sources
 */
export function validate(options: { body?: z.ZodType; query?: z.ZodType; params?: z.ZodType }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate params first (URL structure)
      if (options.params) {
        const paramsResult = options.params.safeParse(req.params);
        if (!paramsResult.success) {
          const details = formatZodError(paramsResult.error);
          const response = errorResponse('VALIDATION_ERROR', 'Invalid URL parameters', details);
          res.status(400).json(response);
          return;
        }
        Object.assign(req.params, paramsResult.data);
      }

      // Validate query parameters
      if (options.query) {
        const queryResult = options.query.safeParse(req.query);
        if (!queryResult.success) {
          const details = formatZodError(queryResult.error);
          const response = errorResponse('VALIDATION_ERROR', 'Invalid query parameters', details);
          res.status(400).json(response);
          return;
        }
        Object.assign(req.query, queryResult.data);
      }

      // Validate body last (most complex)
      if (options.body) {
        const bodyResult = options.body.safeParse(getRequestBody(req));
        if (!bodyResult.success) {
          const details = formatZodError(bodyResult.error);
          const response = errorResponse('VALIDATION_ERROR', 'Validation failed', details);
          res.status(400).json(response);
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
        req.body = bodyResult.data as any;
      }

      next();
    } catch (error) {
      // Unexpected error (not validation)
      console.error('Validation middleware error:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Validation system error'));
    }
  };
}

/**
 * Helper to create reusable validation middleware
 * Allows defining validation once and using in multiple routes
 */
export function createValidator<T extends z.ZodType>(
  schema: T,
): {
  body: ReturnType<typeof validateBody>;
  query: ReturnType<typeof validateQuery>;
  params: ReturnType<typeof validateParams>;
  schema: T;
} {
  return {
    body: validateBody(schema),
    query: validateQuery(schema),
    params: validateParams(schema),
    schema, // Export schema for type inference
  };
}

// Re-export Zod for convenience
export { z, type ZodError } from 'zod';
