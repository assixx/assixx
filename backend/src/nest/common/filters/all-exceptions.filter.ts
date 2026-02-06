/**
 * All Exceptions Filter
 *
 * Global exception filter that catches all unhandled exceptions.
 * Formats errors consistently for API responses.
 *
 * Integrates with Sentry for error tracking (5xx errors only).
 * @see docs/adr/ADR-002-alerting-monitoring.md
 */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/naming-convention -- Sentry SDK convention
import * as Sentry from '@sentry/nestjs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

/** Field error detail */
interface FieldError {
  field: string;
  message: string;
}

/**
 * Standard API error response structure
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: FieldError[];
  };
  timestamp: string;
  path: string;
  requestId?: string;
}

/** ServiceError type from existing codebase */
interface ServiceError {
  code: string;
  message: string;
  statusCode: number;
  details?: FieldError[];
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const { status, errorResponse } = this.buildErrorResponse(
      exception,
      request,
    );

    // Log error (only log 500s as errors, others as warnings)
    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );

      // Report 5xx errors to Sentry (server errors = bugs we need to fix)
      // 4xx errors are client errors and not reported
      Sentry.captureException(exception, {
        extra: {
          path: request.url,
          method: request.method,
          statusCode: status,
          errorCode: errorResponse.error.code,
        },
        tags: {
          statusCode: String(status),
          errorCode: errorResponse.error.code,
        },
      });
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} - ${status}: ${errorResponse.error.message}`,
      );
    }

    void reply.code(status).send(errorResponse);
  }

  private buildErrorResponse(
    exception: unknown,
    request: FastifyRequest,
  ): { status: number; errorResponse: ErrorResponse } {
    const timestamp = new Date().toISOString();
    const path = request.url;
    const requestId = request.headers['x-request-id'] as string | undefined;

    // Zod validation error
    if (exception instanceof ZodError) {
      return this.buildZodErrorResponse(exception, timestamp, path, requestId);
    }

    // NestJS HttpException
    if (exception instanceof HttpException) {
      return this.buildHttpExceptionResponse(
        exception,
        timestamp,
        path,
        requestId,
      );
    }

    // ServiceError (from existing codebase)
    if (this.isServiceError(exception)) {
      return this.buildServiceErrorResponse(
        exception,
        timestamp,
        path,
        requestId,
      );
    }

    // Unknown error (500)
    return this.buildUnknownErrorResponse(
      exception,
      timestamp,
      path,
      requestId,
    );
  }

  private buildZodErrorResponse(
    exception: ZodError,
    timestamp: string,
    path: string,
    requestId: string | undefined,
  ): { status: number; errorResponse: ErrorResponse } {
    return {
      status: HttpStatus.BAD_REQUEST,
      errorResponse: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: exception.issues.map(
            (issue: ZodError['issues'][number]) => ({
              field: issue.path.join('.'),
              message: issue.message,
            }),
          ),
        },
        timestamp,
        path,
        ...(requestId !== undefined && { requestId }),
      },
    };
  }

  private buildHttpExceptionResponse(
    exception: HttpException,
    timestamp: string,
    path: string,
    requestId: string | undefined,
  ): { status: number; errorResponse: ErrorResponse } {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Handle structured error responses (getResponse returns string | object)
    if (typeof exceptionResponse === 'object') {
      const response = exceptionResponse as Record<string, unknown>;
      const details = response['details'] as FieldError[] | undefined;
      const code =
        (response['code'] as string | undefined) ?? this.getErrorCode(status);
      const message =
        (response['message'] as string | undefined) ?? exception.message;

      return {
        status,
        errorResponse: {
          success: false,
          error: {
            code,
            message,
            ...(details !== undefined && { details }),
          },
          timestamp,
          path,
          ...(requestId !== undefined && { requestId }),
        },
      };
    }

    // Simple string message
    return {
      status,
      errorResponse: {
        success: false,
        error: {
          code: this.getErrorCode(status),
          message:
            typeof exceptionResponse === 'string' ? exceptionResponse : (
              exception.message
            ),
        },
        timestamp,
        path,
        ...(requestId !== undefined && { requestId }),
      },
    };
  }

  private buildServiceErrorResponse(
    exception: ServiceError,
    timestamp: string,
    path: string,
    requestId: string | undefined,
  ): { status: number; errorResponse: ErrorResponse } {
    return {
      status: exception.statusCode,
      errorResponse: {
        success: false,
        error: {
          code: exception.code,
          message: exception.message,
          ...(exception.details !== undefined && {
            details: exception.details,
          }),
        },
        timestamp,
        path,
        ...(requestId !== undefined && { requestId }),
      },
    };
  }

  private buildUnknownErrorResponse(
    exception: unknown,
    timestamp: string,
    path: string,
    requestId: string | undefined,
  ): { status: number; errorResponse: ErrorResponse } {
    const message =
      process.env['NODE_ENV'] === 'production' ? 'Internal server error'
      : exception instanceof Error ? exception.message
      : String(exception);

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      errorResponse: {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message,
        },
        timestamp,
        path,
        ...(requestId !== undefined && { requestId }),
      },
    };
  }

  private getErrorCode(status: number): string {
    const codeMap: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      405: 'METHOD_NOT_ALLOWED',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };

    return codeMap[status] ?? 'UNKNOWN_ERROR';
  }

  private isServiceError(error: unknown): error is ServiceError {
    return (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      'message' in error &&
      'statusCode' in error
    );
  }
}
