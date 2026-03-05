/**
 * Unit tests for AuditLoggingService
 *
 * Phase 9: Service tests — mocked DatabaseService.
 * Helpers (buildAuditChanges, buildUserName, etc.) are already tested in Phase 4.
 * Focus: return value of logFailure, fire-and-forget behavior, DB call verification.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../../database/database.service.js';
import { AuditLoggingService } from './audit-logging.service.js';
import type { AuditMetadataService } from './audit-metadata.service.js';
import type { AuditRequestMetadata } from './audit.constants.js';

// =============================================================
// Mocks
// =============================================================

function createMockDb() {
  return { query: vi.fn().mockResolvedValue([]) };
}

function createMockMetadataService() {
  return { fetchResourceName: vi.fn().mockResolvedValue(null) };
}

function createMinimalMetadata(
  overrides?: Partial<AuditRequestMetadata>,
): AuditRequestMetadata {
  return {
    action: 'create',
    resourceType: 'users',
    resourceId: 42,
    resourceUuid: null,
    endpoint: '/api/v2/users',
    httpMethod: 'POST',
    ipAddress: '127.0.0.1',
    userAgent: 'TestAgent/1.0',
    requestId: 'req-123',
    ...overrides,
  };
}

function createMockUser() {
  return {
    id: 1,
    tenantId: 10,
    email: 'admin@test.de',
    activeRole: 'admin',
    firstName: 'Max',
    lastName: 'Mustermann',
  };
}

function createMockRequest(overrides?: Record<string, unknown>) {
  return {
    url: '/api/v2/users',
    method: 'POST',
    body: { name: 'Test' },
    params: {},
    headers: {},
    ...overrides,
  };
}

function createMockResponse(statusCode = 201) {
  return { statusCode };
}

// =============================================================
// AuditLoggingService
// =============================================================

describe('AuditLoggingService', () => {
  let service: AuditLoggingService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    const mockMeta = createMockMetadataService();
    service = new AuditLoggingService(
      mockDb as unknown as DatabaseService,
      mockMeta as unknown as AuditMetadataService,
    );
  });

  // =============================================================
  // logSuccess
  // =============================================================

  describe('logSuccess', () => {
    it('should call db.query with INSERT INTO audit_trail', async () => {
      const user = createMockUser();
      const metadata = createMinimalMetadata();
      const request = createMockRequest();
      const response = createMockResponse();

      service.logSuccess(
        user as never,
        metadata,
        Date.now(),
        request as never,
        response as never,
        null,
      );

      // Fire-and-forget: wait for microtask to complete
      await vi.waitFor(() => {
        expect(mockDb.query).toHaveBeenCalledTimes(1);
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_trail'),
        expect.arrayContaining([10, 1, 'Max Mustermann', 'admin', 'create']),
      );
    });

    it('should not throw when db.query fails', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('DB down'));
      const metadata = createMinimalMetadata();
      const request = createMockRequest();
      const response = createMockResponse();

      expect(() => {
        service.logSuccess(
          createMockUser() as never,
          metadata,
          Date.now(),
          request as never,
          response as never,
          null,
        );
      }).not.toThrow();
    });
  });

  // =============================================================
  // logFailure
  // =============================================================

  describe('logFailure', () => {
    it('should return error message from Error object', () => {
      const metadata = createMinimalMetadata();
      const request = createMockRequest();
      const response = createMockResponse(500);
      const error = new Error('Something broke');

      const result = service.logFailure(
        createMockUser() as never,
        metadata,
        Date.now(),
        request as never,
        response as never,
        error,
        null,
      );

      expect(result).toBe('Something broke');
    });

    it('should return stringified error for non-Error types', () => {
      const metadata = createMinimalMetadata();
      const request = createMockRequest();
      const response = createMockResponse(400);

      const result = service.logFailure(
        createMockUser() as never,
        metadata,
        Date.now(),
        request as never,
        response as never,
        'raw string error',
        null,
      );

      expect(result).toBe('raw string error');
    });

    it('should use fallback tenantId 0 when user is undefined', async () => {
      const metadata = createMinimalMetadata();
      const request = createMockRequest();
      const response = createMockResponse(401);

      service.logFailure(
        undefined,
        metadata,
        Date.now(),
        request as never,
        response as never,
        new Error('Unauthorized'),
        null,
      );

      await vi.waitFor(() => {
        expect(mockDb.query).toHaveBeenCalledTimes(1);
      });

      const args = mockDb.query.mock.calls[0] as unknown[];
      const params = args[1] as unknown[];
      expect(params[0]).toBe(0); // tenantId fallback
      expect(params[1]).toBe(0); // userId fallback
    });

    it('should use status 500 when response statusCode < 400', async () => {
      const metadata = createMinimalMetadata();
      const request = createMockRequest();
      const response = createMockResponse(200); // < 400 → falls back to 500

      const result = service.logFailure(
        createMockUser() as never,
        metadata,
        Date.now(),
        request as never,
        response as never,
        new Error('Unexpected'),
        null,
      );

      expect(result).toBe('Unexpected');

      await vi.waitFor(() => {
        expect(mockDb.query).toHaveBeenCalledTimes(1);
      });

      // Verify the changes JSON contains status 500 (not 200)
      const args = mockDb.query.mock.calls[0] as unknown[];
      const params = args[1] as unknown[];
      const changesJson = params[8] as string;
      const changes = JSON.parse(changesJson) as { _http: { status: number } };
      expect(changes._http.status).toBe(500);
    });

    it('should extract resourceName from preMutationData on delete', async () => {
      const metadata = createMinimalMetadata({
        action: 'delete',
        httpMethod: 'DELETE',
        resourceType: 'user',
      });
      // Body has no name field → extractResourceName returns null
      const request = createMockRequest({ body: { id: 42 } });
      const response = createMockResponse(500);
      const preMutation = { username: 'deleted_user' };

      service.logFailure(
        createMockUser() as never,
        metadata,
        Date.now(),
        request as never,
        response as never,
        new Error('Fail'),
        preMutation,
      );

      await vi.waitFor(() => {
        expect(mockDb.query).toHaveBeenCalledTimes(1);
      });

      // resourceName should be extracted from preMutationData
      const args = mockDb.query.mock.calls[0] as unknown[];
      const params = args[1] as unknown[];
      // params[7] = resourceName
      expect(params[7]).toBe('deleted_user');
    });
  });

  // =============================================================
  // logSuccess — additional branches
  // =============================================================

  describe('logSuccess — additional branches', () => {
    it('should use extractLoginEmail when user is undefined', async () => {
      const metadata = createMinimalMetadata({ action: 'login' });
      const request = createMockRequest({
        body: { email: 'login@test.de' },
      });
      const response = createMockResponse(200);

      service.logSuccess(
        undefined,
        metadata,
        Date.now(),
        request as never,
        response as never,
        null,
      );

      await vi.waitFor(() => {
        expect(mockDb.query).toHaveBeenCalledTimes(1);
      });

      const args = mockDb.query.mock.calls[0] as unknown[];
      const params = args[1] as unknown[];
      // params[2] = userName → extractLoginEmail result
      expect(params[2]).toBe('login@test.de');
    });

    it('should extract resourceName from preMutationData on delete success', async () => {
      const metadata = createMinimalMetadata({
        action: 'delete',
        httpMethod: 'DELETE',
        resourceType: 'user',
      });
      const request = createMockRequest({ body: null });
      const response = createMockResponse(200);
      const preMutation = { username: 'to_be_deleted' };

      service.logSuccess(
        createMockUser() as never,
        metadata,
        Date.now(),
        request as never,
        response as never,
        preMutation,
      );

      await vi.waitFor(() => {
        expect(mockDb.query).toHaveBeenCalledTimes(1);
      });

      const args = mockDb.query.mock.calls[0] as unknown[];
      const params = args[1] as unknown[];
      expect(params[7]).toBe('to_be_deleted');
    });

    it('should pass null changes when changes object is null-ish', async () => {
      const metadata = createMinimalMetadata({ action: 'view' });
      const request = createMockRequest({
        url: '/api/v2/users/42',
        params: { id: '42' },
      });
      const response = createMockResponse(200);

      service.logSuccess(
        createMockUser() as never,
        metadata,
        Date.now(),
        request as never,
        response as never,
        null,
      );

      await vi.waitFor(() => {
        expect(mockDb.query).toHaveBeenCalledTimes(1);
      });

      // changes param (index 8) should be JSON stringified
      const args = mockDb.query.mock.calls[0] as unknown[];
      const params = args[1] as unknown[];
      expect(typeof params[8]).toBe('string');
    });
  });
});
