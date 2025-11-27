/**
 * Error Handler Configuration Loader
 * Sets up 404 and error handling middleware
 * MUST BE LOADED LAST!
 */
import { Application, NextFunction, Request, Response } from 'express';

import { createErrorResponse } from '../utils/errors.js';

/**
 * Load error handling configuration
 * WARNING: This MUST be the last loader called!
 * @param app - Express application instance
 */
export function loadErrorHandler(app: Application): void {
  // 404 Handler - catches all unmatched routes
  app.use((_req: Request, res: Response): void => {
    res.status(404).json({
      message: 'Route not found',
      path: _req.originalUrl,
      method: _req.method,
    });
  });

  // Centralized error handler - MUST be last middleware
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    // Log error internally (always)
    console.error('[ERROR]', {
      name: err.name,
      message: err.message,
      stack: process.env['NODE_ENV'] === 'production' ? undefined : err.stack,
      timestamp: new Date().toISOString(),
    });

    // Check if headers already sent (prevents double response)
    if (res.headersSent) {
      console.error('[ERROR] Headers already sent, cannot send error response');
      return;
    }

    // ServiceError - Custom business logic errors
    if (err.name === 'ServiceError' && 'statusCode' in err) {
      const serviceError = err as Error & {
        statusCode: number;
        code: string;
        details?: { field: string; message: string }[];
      };
      const response = createErrorResponse(
        serviceError.code,
        serviceError.message,
        serviceError.statusCode,
        serviceError.details,
      );
      res.status(response.status).json(response.body);
      return;
    }

    // Validation errors (from Zod or other validators)
    if (err.name === 'ValidationError' || err.name === 'ZodError') {
      const response = createErrorResponse('VALIDATION_ERROR', 'Validation failed', 400, err);
      res.status(response.status).json(response.body);
      return;
    }

    // Default 500 error - hide details in production
    const isDevelopment = process.env['NODE_ENV'] === 'development';
    const response = createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      isDevelopment ? err.message : 'An unexpected error occurred',
      500,
      isDevelopment ? { stack: err.stack, details: err } : undefined,
    );
    res.status(response.status).json(response.body);
  });

  console.log('✅ Error handling configured (404 and error handler)');
}
