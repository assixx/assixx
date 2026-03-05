/**
 * Audit Trail Interceptor – Unit Tests
 *
 * Mocked dependencies: AuditRequestFilterService, AuditMetadataService,
 * AuditLoggingService, and audit.helpers module functions.
 *
 * Tests: skip paths (excluded, OPTIONS, throttled), standard logging,
 * pre-fetch mutation logging, error handling.
 */
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditLoggingService } from '../audit/audit-logging.service.js';
import type { AuditMetadataService } from '../audit/audit-metadata.service.js';
import type { AuditRequestFilterService } from '../audit/audit-request-filter.service.js';
import { AuditTrailInterceptor } from './audit-trail.interceptor.js';

// =============================================================
// Module Mocks (hoisted before vi.mock)
// =============================================================

const mockHelpers = vi.hoisted(() => ({
  shouldExclude: vi.fn().mockReturnValue(false),
  determineAction: vi.fn().mockReturnValue('view'),
  isAuthEndpoint: vi.fn().mockReturnValue(false),
}));

vi.mock('../audit/audit.helpers.js', () => mockHelpers);

// =============================================================
// Mock Factories
// =============================================================

function createMockRequestFilter() {
  return {
    shouldSkipRequest: vi.fn().mockReturnValue(false),
    shouldThrottleListOrView: vi.fn().mockReturnValue(false),
  };
}

function createMockMetadataService() {
  return {
    extractRequestMetadata: vi.fn().mockReturnValue({
      endpoint: '/users',
      resourceType: 'users',
      resourceId: '123',
      resourceUuid: null,
      action: 'view',
    }),
    fetchResourceBeforeMutation: vi
      .fn()
      .mockResolvedValue({ id: '123', name: 'Old Name' }),
  };
}

function createMockLoggingService() {
  return {
    logSuccess: vi.fn(),
    logFailure: vi.fn(),
  };
}

interface MockRequest {
  url: string;
  method: string;
  user?: { tenantId: number; userId: number; role: string };
}

function createMockContext(requestOverrides?: Partial<MockRequest>) {
  const request: MockRequest = {
    url: '/api/v2/users/123',
    method: 'GET',
    user: { tenantId: 1, userId: 100, role: 'admin' },
    ...requestOverrides,
  };
  const response = { statusCode: 200 };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

function createMockCallHandler(value: unknown = 'result'): CallHandler {
  return { handle: () => of(value) } as unknown as CallHandler;
}

function createErrorCallHandler(error: Error): CallHandler {
  return {
    handle: () => throwError(() => error),
  } as unknown as CallHandler;
}

// =============================================================
// Test Suite
// =============================================================

describe('AuditTrailInterceptor', () => {
  let interceptor: AuditTrailInterceptor;
  let mockFilter: ReturnType<typeof createMockRequestFilter>;
  let mockMetadata: ReturnType<typeof createMockMetadataService>;
  let mockLogging: ReturnType<typeof createMockLoggingService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFilter = createMockRequestFilter();
    mockMetadata = createMockMetadataService();
    mockLogging = createMockLoggingService();

    interceptor = new AuditTrailInterceptor(
      mockFilter as unknown as AuditRequestFilterService,
      mockMetadata as unknown as AuditMetadataService,
      mockLogging as unknown as AuditLoggingService,
    );
  });

  // -----------------------------------------------------------
  // Skip paths
  // -----------------------------------------------------------

  describe('skip conditions', () => {
    it('should skip excluded endpoints', async () => {
      mockHelpers.shouldExclude.mockReturnValueOnce(true);
      const next = createMockCallHandler();

      const result$ = interceptor.intercept(createMockContext(), next);
      const result = await lastValueFrom(result$);

      expect(result).toBe('result');
      expect(mockMetadata.extractRequestMetadata).not.toHaveBeenCalled();
      expect(mockLogging.logSuccess).not.toHaveBeenCalled();
    });

    it('should skip OPTIONS preflight', async () => {
      const next = createMockCallHandler();

      const result$ = interceptor.intercept(
        createMockContext({ method: 'OPTIONS' }),
        next,
      );
      const result = await lastValueFrom(result$);

      expect(result).toBe('result');
      expect(mockMetadata.extractRequestMetadata).not.toHaveBeenCalled();
    });

    it('should skip when shouldSkipRequest returns true', async () => {
      mockFilter.shouldSkipRequest.mockReturnValueOnce(true);
      const next = createMockCallHandler();

      const result$ = interceptor.intercept(createMockContext(), next);
      const result = await lastValueFrom(result$);

      expect(result).toBe('result');
      expect(mockMetadata.extractRequestMetadata).not.toHaveBeenCalled();
    });

    it('should skip when shouldThrottleListOrView returns true', async () => {
      mockFilter.shouldThrottleListOrView.mockReturnValueOnce(true);
      const next = createMockCallHandler();

      const result$ = interceptor.intercept(createMockContext(), next);
      const result = await lastValueFrom(result$);

      expect(result).toBe('result');
      expect(mockLogging.logSuccess).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------
  // Standard logging path
  // -----------------------------------------------------------

  describe('standard logging', () => {
    it('should log success for standard GET request', async () => {
      mockHelpers.determineAction.mockReturnValueOnce('view');
      const next = createMockCallHandler('response-data');

      const result$ = interceptor.intercept(createMockContext(), next);
      const result = await lastValueFrom(result$);

      expect(result).toBe('response-data');
      expect(mockLogging.logSuccess).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ tenantId: 1 }),
        expect.objectContaining({ endpoint: '/users' }),
        expect.any(Number),
        expect.any(Object),
        expect.any(Object),
        null,
      );
    });

    it('should log failure and rethrow error on standard request', async () => {
      const error = new Error('Something went wrong');
      const next = createErrorCallHandler(error);

      const result$ = interceptor.intercept(createMockContext(), next);

      await expect(lastValueFrom(result$)).rejects.toThrow(
        'Something went wrong',
      );
      expect(mockLogging.logFailure).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ tenantId: 1 }),
        expect.any(Object),
        expect.any(Number),
        expect.any(Object),
        expect.any(Object),
        error,
        null,
      );
    });

    it('should use standard logging for POST (no pre-fetch)', async () => {
      mockHelpers.determineAction.mockReturnValueOnce('create');
      const next = createMockCallHandler();

      const result$ = interceptor.intercept(
        createMockContext({ method: 'POST' }),
        next,
      );
      await lastValueFrom(result$);

      expect(mockLogging.logSuccess).toHaveBeenCalledOnce();
      // No pre-fetch for POST
      expect(mockMetadata.fetchResourceBeforeMutation).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------
  // Pre-fetch mutation path
  // -----------------------------------------------------------

  describe('mutation with pre-fetch', () => {
    it('should fetch resource before DELETE and log with pre-mutation data', async () => {
      mockHelpers.determineAction.mockReturnValueOnce('delete');
      mockMetadata.extractRequestMetadata.mockReturnValueOnce({
        endpoint: '/users',
        resourceType: 'users',
        resourceId: '456',
        resourceUuid: null,
        action: 'delete',
      });
      const next = createMockCallHandler();

      const result$ = interceptor.intercept(
        createMockContext({ method: 'DELETE' }),
        next,
      );
      await lastValueFrom(result$);

      expect(mockMetadata.fetchResourceBeforeMutation).toHaveBeenCalledWith(
        'users',
        '456',
        null,
        1,
      );
      expect(mockLogging.logSuccess).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.any(Number),
        expect.any(Object),
        expect.any(Object),
        { id: '123', name: 'Old Name' },
      );
    });

    it('should fetch resource before UPDATE and log with pre-mutation data', async () => {
      mockHelpers.determineAction.mockReturnValueOnce('update');
      mockMetadata.extractRequestMetadata.mockReturnValueOnce({
        endpoint: '/users',
        resourceType: 'users',
        resourceId: '789',
        resourceUuid: null,
        action: 'update',
      });
      const next = createMockCallHandler();

      const result$ = interceptor.intercept(
        createMockContext({ method: 'PUT' }),
        next,
      );
      await lastValueFrom(result$);

      expect(mockMetadata.fetchResourceBeforeMutation).toHaveBeenCalledWith(
        'users',
        '789',
        null,
        1,
      );
      expect(mockLogging.logSuccess).toHaveBeenCalledOnce();
    });

    it('should use standard logging for DELETE without resourceId or UUID', async () => {
      mockHelpers.determineAction.mockReturnValueOnce('delete');
      mockMetadata.extractRequestMetadata.mockReturnValueOnce({
        endpoint: '/users',
        resourceType: 'users',
        resourceId: null,
        resourceUuid: null,
        action: 'delete',
      });
      const next = createMockCallHandler();

      const result$ = interceptor.intercept(
        createMockContext({ method: 'DELETE' }),
        next,
      );
      await lastValueFrom(result$);

      // No pre-fetch when resourceId is null
      expect(mockMetadata.fetchResourceBeforeMutation).not.toHaveBeenCalled();
      expect(mockLogging.logSuccess).toHaveBeenCalledOnce();
    });

    it('should log failure with pre-mutation data when mutation fails', async () => {
      mockHelpers.determineAction.mockReturnValueOnce('delete');
      mockMetadata.extractRequestMetadata.mockReturnValueOnce({
        endpoint: '/users',
        resourceType: 'users',
        resourceId: '456',
        resourceUuid: null,
        action: 'delete',
      });
      const error = new Error('Delete failed');
      const next = createErrorCallHandler(error);

      const result$ = interceptor.intercept(
        createMockContext({ method: 'DELETE' }),
        next,
      );

      await expect(lastValueFrom(result$)).rejects.toThrow('Delete failed');
      expect(mockLogging.logFailure).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.any(Number),
        expect.any(Object),
        expect.any(Object),
        error,
        { id: '123', name: 'Old Name' },
      );
    });

    it('should use standard logging when user is undefined on mutation', async () => {
      mockHelpers.determineAction.mockReturnValueOnce('delete');
      mockMetadata.extractRequestMetadata.mockReturnValueOnce({
        endpoint: '/users',
        resourceType: 'users',
        resourceId: '456',
        resourceUuid: null,
        action: 'delete',
      });
      const next = createMockCallHandler();

      const result$ = interceptor.intercept(
        createMockContext({ method: 'DELETE', user: undefined }),
        next,
      );
      await lastValueFrom(result$);

      // Pre-fetch requires user (for tenantId), falls back to standard
      expect(mockMetadata.fetchResourceBeforeMutation).not.toHaveBeenCalled();
      expect(mockLogging.logSuccess).toHaveBeenCalledOnce();
    });
  });
});
