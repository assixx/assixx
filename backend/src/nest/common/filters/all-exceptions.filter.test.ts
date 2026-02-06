/**
 * Tests for AllExceptionsFilter
 *
 * Phase 14C — Infrastructure tests
 * Tests error normalization, HTTP status mapping, Sentry reporting,
 * and consistent error response structure.
 */
import { HttpException, HttpStatus } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { AllExceptionsFilter } from './all-exceptions.filter.js';

// vi.hoisted for variables needed in mock factories (hoisted above vi.mock)
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock Sentry before importing the filter
vi.mock('@sentry/nestjs', () => ({
  captureException: vi.fn(),
}));

// Mock Logger — use regular function, NOT arrow (arrow can't be constructor)
vi.mock('@nestjs/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nestjs/common')>();
  return {
    ...actual,

    Logger: vi.fn(function FakeLogger() {
      return mockLogger;
    }),
  };
});

/** Create a mock ArgumentsHost for testing */
function createMockHost(overrides?: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
}): {
  switchToHttp: () => {
    getResponse: () => {
      code: ReturnType<typeof vi.fn>;
      send: ReturnType<typeof vi.fn>;
    };
    getRequest: () => {
      url: string;
      method: string;
      headers: Record<string, string>;
    };
  };
} {
  const mockSend = vi.fn();
  const mockCode = vi.fn().mockReturnValue({ send: mockSend });
  return {
    switchToHttp: () => ({
      getResponse: () => ({ code: mockCode, send: mockSend }),
      getRequest: () => ({
        url: overrides?.url ?? '/api/v2/test',
        method: overrides?.method ?? 'GET',
        headers: overrides?.headers ?? {},
      }),
    }),
  };
}

/** Extract the response sent by the filter */
function getSentResponse(host: ReturnType<typeof createMockHost>): {
  statusCode: number;
  body: {
    success: false;
    error: { code: string; message: string; details?: unknown[] };
    timestamp: string;
    path: string;
    requestId?: string;
  };
} {
  const httpCtx = host.switchToHttp();
  const response = httpCtx.getResponse();
  const statusCode = response.code.mock.calls[0]?.[0] as number;
  const body = response.code.mock.results[0]?.value.send.mock.calls[0]?.[0] as {
    success: false;
    error: { code: string; message: string; details?: unknown[] };
    timestamp: string;
    path: string;
    requestId?: string;
  };
  return { statusCode, body };
}

/**
 * Wrapper to invoke ExceptionFilter.catch() without triggering
 * eslint-plugin-promise's `promise/valid-params` false positive.
 */
function catchException(
  f: AllExceptionsFilter,
  exception: unknown,
  host: ReturnType<typeof createMockHost>,
): void {
  // eslint-disable-next-line promise/valid-params -- ExceptionFilter.catch(), not Promise.catch()
  f.catch(exception, host as never);
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    vi.clearAllMocks();
    filter = new AllExceptionsFilter();
  });

  describe('ZodError handling', () => {
    it('should return 400 with VALIDATION_ERROR code', () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          path: ['name'],
          message: 'Expected string, received number',
        },
      ] as ZodError['issues']);
      const host = createMockHost();

      catchException(filter, zodError, host);

      const { statusCode, body } = getSentResponse(host);
      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBe('Validation failed');
    });

    it('should map Zod issues to field details', () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          path: ['user', 'email'],
          message: 'Required',
        },
        {
          code: 'too_small',
          path: ['user', 'name'],
          message: 'String must contain at least 1 character(s)',
        },
      ] as ZodError['issues']);
      const host = createMockHost();

      catchException(filter, zodError, host);

      const { body } = getSentResponse(host);
      expect(body.error.details).toHaveLength(2);
      expect(body.error.details![0]).toEqual({
        field: 'user.email',
        message: 'Required',
      });
      expect(body.error.details![1]).toEqual({
        field: 'user.name',
        message: 'String must contain at least 1 character(s)',
      });
    });

    it('should handle ZodError with empty path', () => {
      const zodError = new ZodError([
        {
          code: 'custom',
          path: [],
          message: 'Custom error',
        },
      ] as ZodError['issues']);
      const host = createMockHost();

      catchException(filter, zodError, host);

      const { body } = getSentResponse(host);
      expect(body.error.details![0]).toEqual({
        field: '',
        message: 'Custom error',
      });
    });

    it('should not report ZodError to Sentry (4xx)', () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          path: ['x'],
          message: 'bad',
        },
      ] as ZodError['issues']);
      const host = createMockHost();

      catchException(filter, zodError, host);

      expect(Sentry.captureException).not.toHaveBeenCalled();
    });
  });

  describe('HttpException handling', () => {
    it('should handle HttpException with string response', () => {
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);
      const host = createMockHost();

      catchException(filter, exception, host);

      const { statusCode, body } = getSentResponse(host);
      expect(statusCode).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('Not Found');
    });

    it('should handle HttpException with object response', () => {
      const exception = new HttpException(
        {
          code: 'USER_NOT_FOUND',
          message: 'User does not exist',
          details: [{ field: 'id', message: 'Invalid ID' }],
        },
        HttpStatus.NOT_FOUND,
      );
      const host = createMockHost();

      catchException(filter, exception, host);

      const { statusCode, body } = getSentResponse(host);
      expect(statusCode).toBe(404);
      expect(body.error.code).toBe('USER_NOT_FOUND');
      expect(body.error.message).toBe('User does not exist');
      expect(body.error.details).toEqual([
        { field: 'id', message: 'Invalid ID' },
      ]);
    });

    it('should use default error code when object has no code', () => {
      const exception = new HttpException(
        { message: 'Custom message' },
        HttpStatus.FORBIDDEN,
      );
      const host = createMockHost();

      catchException(filter, exception, host);

      const { body } = getSentResponse(host);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toBe('Custom message');
    });

    it('should fallback to exception.message when object has no message', () => {
      const exception = new HttpException(
        { code: 'CUSTOM' },
        HttpStatus.BAD_REQUEST,
      );
      const host = createMockHost();

      catchException(filter, exception, host);

      const { body } = getSentResponse(host);
      expect(body.error.code).toBe('CUSTOM');
      // HttpException uses the JSON-stringified object as the message property
      expect(body.error.message).toBe(exception.message);
    });

    it('should not include details when not provided in object response', () => {
      const exception = new HttpException(
        { message: 'No details here' },
        HttpStatus.BAD_REQUEST,
      );
      const host = createMockHost();

      catchException(filter, exception, host);

      const { body } = getSentResponse(host);
      expect(body.error).not.toHaveProperty('details');
    });

    it('should not report 4xx HttpExceptions to Sentry', () => {
      const exception = new HttpException('Bad', HttpStatus.BAD_REQUEST);
      const host = createMockHost();

      catchException(filter, exception, host);

      expect(Sentry.captureException).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should report 5xx HttpException to Sentry', () => {
      const exception = new HttpException(
        'Server broke',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      const host = createMockHost();

      catchException(filter, exception, host);

      expect(Sentry.captureException).toHaveBeenCalledWith(
        exception,
        expect.objectContaining({
          extra: expect.objectContaining({
            statusCode: 500,
          }) as unknown,
          tags: expect.objectContaining({
            statusCode: '500',
          }) as unknown,
        }),
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('ServiceError handling', () => {
    it('should handle ServiceError with custom status and code', () => {
      const serviceError = {
        code: 'TENANT_LIMIT_EXCEEDED',
        message: 'Maximum users reached',
        statusCode: 403,
      };
      const host = createMockHost();

      catchException(filter, serviceError, host);

      const { statusCode, body } = getSentResponse(host);
      expect(statusCode).toBe(403);
      expect(body.error.code).toBe('TENANT_LIMIT_EXCEEDED');
      expect(body.error.message).toBe('Maximum users reached');
    });

    it('should include ServiceError details when present', () => {
      const serviceError = {
        code: 'VALIDATION_FAILED',
        message: 'Input invalid',
        statusCode: 422,
        details: [{ field: 'email', message: 'Already taken' }],
      };
      const host = createMockHost();

      catchException(filter, serviceError, host);

      const { body } = getSentResponse(host);
      expect(body.error.details).toEqual([
        { field: 'email', message: 'Already taken' },
      ]);
    });

    it('should not include details when ServiceError has no details', () => {
      const serviceError = {
        code: 'NOT_FOUND',
        message: 'Not found',
        statusCode: 404,
      };
      const host = createMockHost();

      catchException(filter, serviceError, host);

      const { body } = getSentResponse(host);
      expect(body.error).not.toHaveProperty('details');
    });

    it('should report 5xx ServiceError to Sentry', () => {
      const serviceError = {
        code: 'DB_ERROR',
        message: 'Connection lost',
        statusCode: 500,
      };
      const host = createMockHost();

      catchException(filter, serviceError, host);

      expect(Sentry.captureException).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Unknown error handling', () => {
    it('should return 500 for unknown errors', () => {
      const host = createMockHost();

      catchException(filter, new Error('Something broke'), host);

      const { statusCode, body } = getSentResponse(host);
      expect(statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should show error message in non-production environment', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';
      const host = createMockHost();

      catchException(filter, new Error('Detailed failure'), host);

      const { body } = getSentResponse(host);
      expect(body.error.message).toBe('Detailed failure');
      process.env['NODE_ENV'] = originalEnv;
    });

    it('should hide error message in production environment', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';
      const host = createMockHost();

      catchException(filter, new Error('Secret detail'), host);

      const { body } = getSentResponse(host);
      expect(body.error.message).toBe('Internal server error');
      process.env['NODE_ENV'] = originalEnv;
    });

    it('should stringify non-Error unknown exceptions in dev', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';
      const host = createMockHost();

      catchException(filter, 'raw string error', host);

      const { body } = getSentResponse(host);
      expect(body.error.message).toBe('raw string error');
      process.env['NODE_ENV'] = originalEnv;
    });

    it('should report unknown errors to Sentry (5xx)', () => {
      const host = createMockHost();

      catchException(filter, new Error('crash'), host);

      expect(Sentry.captureException).toHaveBeenCalled();
    });
  });

  describe('Response structure', () => {
    it('should always include success: false', () => {
      const host = createMockHost();

      catchException(
        filter,
        new HttpException('test', HttpStatus.BAD_REQUEST),
        host,
      );

      const { body } = getSentResponse(host);
      expect(body.success).toBe(false);
    });

    it('should include ISO timestamp', () => {
      const host = createMockHost();

      catchException(
        filter,
        new HttpException('test', HttpStatus.BAD_REQUEST),
        host,
      );

      const { body } = getSentResponse(host);
      expect(body.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it('should include request path', () => {
      const host = createMockHost({ url: '/api/v2/users/123' });

      catchException(
        filter,
        new HttpException('test', HttpStatus.NOT_FOUND),
        host,
      );

      const { body } = getSentResponse(host);
      expect(body.path).toBe('/api/v2/users/123');
    });

    it('should include requestId when x-request-id header is present', () => {
      const host = createMockHost({
        headers: { 'x-request-id': 'req-abc-123' },
      });

      catchException(
        filter,
        new HttpException('test', HttpStatus.BAD_REQUEST),
        host,
      );

      const { body } = getSentResponse(host);
      expect(body.requestId).toBe('req-abc-123');
    });

    it('should omit requestId when header is not present', () => {
      const host = createMockHost();

      catchException(
        filter,
        new HttpException('test', HttpStatus.BAD_REQUEST),
        host,
      );

      const { body } = getSentResponse(host);
      expect(body).not.toHaveProperty('requestId');
    });
  });

  describe('Error code mapping', () => {
    const statusCodeMappings: Array<[number, string]> = [
      [400, 'BAD_REQUEST'],
      [401, 'UNAUTHORIZED'],
      [403, 'FORBIDDEN'],
      [404, 'NOT_FOUND'],
      [405, 'METHOD_NOT_ALLOWED'],
      [409, 'CONFLICT'],
      [422, 'UNPROCESSABLE_ENTITY'],
      [429, 'TOO_MANY_REQUESTS'],
      [500, 'INTERNAL_SERVER_ERROR'],
      [502, 'BAD_GATEWAY'],
      [503, 'SERVICE_UNAVAILABLE'],
    ];

    for (const [status, expectedCode] of statusCodeMappings) {
      it(`should map status ${String(status)} to ${expectedCode}`, () => {
        const exception = new HttpException(`Error ${String(status)}`, status);
        const host = createMockHost();

        catchException(filter, exception, host);

        const { body } = getSentResponse(host);
        expect(body.error.code).toBe(expectedCode);
      });
    }

    it('should return UNKNOWN_ERROR for unmapped status codes', () => {
      const exception = new HttpException('Teapot', 418);
      const host = createMockHost();

      catchException(filter, exception, host);

      const { body } = getSentResponse(host);
      expect(body.error.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('Logging behavior', () => {
    it('should log warnings for 4xx errors', () => {
      const host = createMockHost({ url: '/api/v2/users', method: 'POST' });

      catchException(
        filter,
        new HttpException('Bad Request', HttpStatus.BAD_REQUEST),
        host,
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[POST] /api/v2/users - 400'),
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should log errors with stack trace for 5xx', () => {
      const host = createMockHost({ url: '/api/v2/data', method: 'GET' });
      const error = new Error('DB crashed');

      catchException(filter, error, host);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('[GET] /api/v2/data - 500'),
        expect.stringContaining('DB crashed'),
      );
    });

    it('should stringify non-Error exceptions for 5xx stack', () => {
      const host = createMockHost();

      catchException(
        filter,
        { code: 'BOOM', message: 'fail', statusCode: 502 },
        host,
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('502'),
        expect.any(String),
      );
    });
  });

  describe('isServiceError type guard', () => {
    it('should not treat null as ServiceError', () => {
      const host = createMockHost();

      catchException(filter, null, host);

      const { statusCode } = getSentResponse(host);
      expect(statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should not treat primitive as ServiceError', () => {
      const host = createMockHost();
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';

      catchException(filter, 42, host);

      const { statusCode, body } = getSentResponse(host);
      expect(statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(body.error.message).toBe('42');
      process.env['NODE_ENV'] = originalEnv;
    });

    it('should not treat object missing statusCode as ServiceError', () => {
      const host = createMockHost();

      catchException(filter, { code: 'X', message: 'Y' }, host);

      const { statusCode } = getSentResponse(host);
      expect(statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
