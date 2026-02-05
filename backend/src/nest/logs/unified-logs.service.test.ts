/**
 * Unit tests for UnifiedLogsService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: RLS context enforcement, cursor-based streaming,
 *        count aggregation, export metadata, tenant-id-zero guard.
 *
 * NOTE: This service uses @Inject(PG_POOL) with raw pg Pool + pg-cursor.
 *       Mock chain: pool.connect() → client.query(Cursor) → cursor.read()/close()
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LogFilterParams } from './unified-logs.service.js';
import { UnifiedLogsService } from './unified-logs.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('pg-cursor', () => {
  return {
    default: vi.fn(),
  };
});

// =============================================================
// Mock factories
// =============================================================

function createMockCursor() {
  return {
    read: vi.fn().mockResolvedValue([]),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockClient() {
  const cursor = createMockCursor();
  return {
    query: vi.fn().mockReturnValue(cursor),
    release: vi.fn(),
    _cursor: cursor,
  };
}

function createMockPool() {
  const client = createMockClient();
  return {
    connect: vi.fn().mockResolvedValue(client),
    _client: client,
  };
}

function makeFilter(overrides: Partial<LogFilterParams> = {}): LogFilterParams {
  return {
    tenantId: 10,
    dateFrom: new Date('2025-01-01'),
    dateTo: new Date('2025-12-31'),
    source: 'all',
    ...overrides,
  };
}

// =============================================================
// UnifiedLogsService
// =============================================================

describe('UnifiedLogsService', () => {
  let service: UnifiedLogsService;
  let mockPool: ReturnType<typeof createMockPool>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool = createMockPool();
    service = new UnifiedLogsService(mockPool as never);
  });

  // =============================================================
  // streamLogs — tenantId guard
  // =============================================================

  describe('streamLogs', () => {
    it('should throw Error when tenantId is 0', async () => {
      const generator = service.streamLogs(makeFilter({ tenantId: 0 }));

      await expect(generator.next()).rejects.toThrow(
        'tenantId is required for RLS-protected queries',
      );
    });

    it('should set RLS context before streaming', async () => {
      const client = mockPool._client;
      // set_config for RLS
      client.query
        .mockResolvedValueOnce(undefined) // setRlsContext
        .mockReturnValueOnce(client._cursor) // audit_trail cursor
        .mockReturnValueOnce(client._cursor) // root_logs cursor
        .mockResolvedValueOnce(undefined); // clearRlsContext

      const generator = service.streamLogs(makeFilter({ source: 'audit_trail' }));
      const result = await generator.next();

      expect(result.done).toBe(true);
      // First call should be set_config for RLS
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('set_config'),
        expect.arrayContaining(['10']),
      );
      expect(client.release).toHaveBeenCalled();
    });

    it('should yield mapped audit_trail entries', async () => {
      const client = mockPool._client;
      const cursor = createMockCursor();
      cursor.read
        .mockResolvedValueOnce([
          {
            id: 1,
            tenant_id: 10,
            user_id: 5,
            user_name: 'Max',
            user_role: 'admin',
            action: 'create',
            resource_type: 'user',
            resource_id: 10,
            resource_name: 'New user',
            changes: null,
            ip_address: '127.0.0.1',
            user_agent: null,
            status: 'success',
            error_message: null,
            created_at: new Date('2025-06-01'),
          },
        ])
        .mockResolvedValueOnce([]); // end of cursor

      client.query
        .mockResolvedValueOnce(undefined) // setRlsContext
        .mockReturnValueOnce(cursor); // cursor query

      const generator = service.streamLogs(makeFilter({ source: 'audit_trail' }));
      const first = await generator.next();

      expect(first.done).toBe(false);
      expect(first.value?.source).toBe('audit_trail');
      expect(first.value?.action).toBe('create');
      expect(first.value?.userName).toBe('Max');
    });
  });

  // =============================================================
  // countLogs
  // =============================================================

  describe('countLogs', () => {
    it('should throw Error when tenantId is 0', async () => {
      await expect(
        service.countLogs(makeFilter({ tenantId: 0 })),
      ).rejects.toThrow('tenantId is required');
    });

    it('should count from both tables when source is all', async () => {
      const client = mockPool._client;
      client.query
        .mockResolvedValueOnce(undefined) // setRlsContext
        .mockResolvedValueOnce({ rows: [{ count: '50' }] }) // audit_trail count
        .mockResolvedValueOnce({ rows: [{ count: '30' }] }) // root_logs count
        .mockResolvedValueOnce(undefined); // clearRlsContext

      const result = await service.countLogs(makeFilter({ source: 'all' }));

      expect(result).toBe(80);
      expect(client.release).toHaveBeenCalled();
    });

    it('should count only audit_trail when source is audit_trail', async () => {
      const client = mockPool._client;
      client.query
        .mockResolvedValueOnce(undefined) // setRlsContext
        .mockResolvedValueOnce({ rows: [{ count: '25' }] }) // audit_trail count
        .mockResolvedValueOnce(undefined); // clearRlsContext

      const result = await service.countLogs(
        makeFilter({ source: 'audit_trail' }),
      );

      expect(result).toBe(25);
    });
  });

  // =============================================================
  // getExportMetadata
  // =============================================================

  describe('getExportMetadata', () => {
    it('should return metadata with counted total', async () => {
      const client = mockPool._client;
      // countLogs internals
      client.query
        .mockResolvedValueOnce(undefined) // setRlsContext
        .mockResolvedValueOnce({ rows: [{ count: '100' }] })
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })
        .mockResolvedValueOnce(undefined); // clearRlsContext

      const result = await service.getExportMetadata(
        makeFilter(),
        'TestCorp',
      );

      expect(result.tenantId).toBe(10);
      expect(result.tenantName).toBe('TestCorp');
      expect(result.totalEntries).toBe(150);
      expect(result.source).toBe('all');
    });
  });
});
