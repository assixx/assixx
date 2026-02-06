/**
 * Unit tests for AuditMetadataService
 *
 * Phase 9: Service tests — mocked DatabaseService + ClsService.
 * extractRequestMetadata: composition of pure helpers (already tested in Phase 4).
 * fetchResourceBeforeMutation: DB query with fire-and-forget error handling.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../../database/database.service.js';
import { AuditMetadataService } from './audit-metadata.service.js';

// =============================================================
// Mocks
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

function createMockCls() {
  return { get: vi.fn() };
}

function createMockRequest(overrides?: Record<string, unknown>) {
  return {
    url: '/api/v2/users/42',
    method: 'DELETE',
    params: { id: '42' },
    headers: { 'user-agent': 'TestAgent/1.0' },
    ip: '192.168.1.1',
    ...overrides,
  };
}

// =============================================================
// AuditMetadataService
// =============================================================

describe('AuditMetadataService', () => {
  let service: AuditMetadataService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockCls: ReturnType<typeof createMockCls>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockCls = createMockCls();
    service = new AuditMetadataService(
      mockDb as unknown as DatabaseService,
      mockCls as never,
    );
  });

  // =============================================================
  // extractRequestMetadata
  // =============================================================

  describe('extractRequestMetadata', () => {
    it('should extract metadata from request with all fields', () => {
      mockCls.get.mockReturnValue('req-uuid-123');
      const request = createMockRequest();

      const result = service.extractRequestMetadata(request as never, 'delete');

      expect(result.action).toBe('delete');
      expect(result.endpoint).toBe('/api/v2/users/42');
      expect(result.httpMethod).toBe('DELETE');
      expect(result.userAgent).toBe('TestAgent/1.0');
      expect(result.requestId).toBe('req-uuid-123');
    });

    it('should set requestId to null when CLS has no requestId', () => {
      mockCls.get.mockReturnValue(undefined);
      const request = createMockRequest();

      const result = service.extractRequestMetadata(request as never, 'create');

      expect(result.requestId).toBeNull();
    });

    it('should strip query string from endpoint', () => {
      mockCls.get.mockReturnValue(undefined);
      const request = createMockRequest({
        url: '/api/v2/logs/export?format=json&source=all',
      });

      const result = service.extractRequestMetadata(request as never, 'export');

      expect(result.endpoint).toBe('/api/v2/logs/export');
    });
  });

  // =============================================================
  // fetchResourceBeforeMutation
  // =============================================================

  describe('fetchResourceBeforeMutation', () => {
    it('should return null when resourceId is null', async () => {
      const result = await service.fetchResourceBeforeMutation('user', null, 1);

      expect(result).toBeNull();
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should return null when resourceType has no table mapping', async () => {
      const result = await service.fetchResourceBeforeMutation(
        'unknown-type',
        42,
        1,
      );

      expect(result).toBeNull();
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should return sanitized data when resource is found', async () => {
      mockDb.query.mockResolvedValueOnce([
        { id: 42, name: 'Test User', password: 'secret' },
      ]);

      const result = await service.fetchResourceBeforeMutation('user', 42, 1);

      expect(result).not.toBeNull();
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users'),
        [42, 1],
      );
    });

    it('should return null when resource is not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.fetchResourceBeforeMutation('user', 999, 1);

      expect(result).toBeNull();
    });

    it('should return null and not throw when DB query fails', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.fetchResourceBeforeMutation('user', 42, 1);

      expect(result).toBeNull();
    });
  });
});
