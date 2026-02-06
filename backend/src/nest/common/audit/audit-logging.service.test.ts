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
import type { AuditRequestMetadata } from './audit.constants.js';

// =============================================================
// Mocks
// =============================================================

function createMockDb() {
  return { query: vi.fn().mockResolvedValue([]) };
}

function createMinimalMetadata(
  overrides?: Partial<AuditRequestMetadata>,
): AuditRequestMetadata {
  return {
    action: 'create',
    resourceType: 'users',
    resourceId: 42,
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
    service = new AuditLoggingService(mockDb as unknown as DatabaseService);
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
  });
});
