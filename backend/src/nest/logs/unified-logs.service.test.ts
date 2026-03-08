/**
 * Unit tests for UnifiedLogsService
 *
 * Phase 11 → Phase 14: Service tests — mocked dependencies.
 * Focus: RLS context enforcement, cursor-based streaming,
 *        count aggregation, export metadata, tenant-id-zero guard,
 *        private helpers (WHERE builders, row mappers, JSON parsing).
 *
 * NOTE: This service uses @Inject(PG_POOL) with raw pg Pool + pg-cursor.
 *       Mock chain: pool.connect() → client.query(Cursor) → cursor.read()/close()
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LogFilterParams } from './unified-logs.service.js';
import { UnifiedLogsService } from './unified-logs.service.js';
import { IS_ACTIVE } from '@assixx/shared/constants';

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

/** Full audit_trail row for mapping tests */
function makeAuditTrailRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    tenant_id: 10,
    user_id: 5,
    user_name: 'Max',
    user_role: 'admin',
    action: 'create',
    resource_type: 'user',
    resource_id: 10,
    resource_name: 'New user',
    changes: '{"field":"value"}',
    ip_address: '127.0.0.1',
    user_agent: 'Mozilla/5.0',
    status: 'success',
    error_message: null,
    created_at: new Date('2025-06-01T10:00:00Z'),
    ...overrides,
  };
}

/** Full root_logs row for mapping tests */
function makeRootLogsRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 100,
    tenant_id: 10,
    user_id: 3,
    user_name: 'Admin User',
    user_role: 'root',
    action: 'login',
    entity_type: 'session',
    entity_id: 42,
    details: 'User logged in',
    old_values: '{"active":false}',
    new_values: '{"active":true}',
    ip_address: '10.0.0.1',
    user_agent: 'Chrome/120',
    was_role_switched: false,
    is_active: IS_ACTIVE.ACTIVE,
    created_at: new Date('2025-06-15T08:30:00Z'),
    ...overrides,
  };
}

// =============================================================
// Private helper methods (via bracket notation)
// =============================================================

describe('UnifiedLogsService – private helpers', () => {
  let service: UnifiedLogsService;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockPool = createMockPool();
    service = new UnifiedLogsService(mockPool as never);
  });

  // =============================================================
  // safeJsonParse
  // =============================================================

  describe('safeJsonParse', () => {
    it('parses valid JSON string', () => {
      const result = service['safeJsonParse']('{"key":"value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('returns undefined for null', () => {
      expect(service['safeJsonParse'](null)).toBeUndefined();
    });

    it('returns undefined for undefined', () => {
      expect(service['safeJsonParse'](undefined)).toBeUndefined();
    });

    it('returns undefined for invalid JSON', () => {
      expect(service['safeJsonParse']('not-json{')).toBeUndefined();
    });

    it('passes through already-parsed object', () => {
      const obj = { already: 'parsed' };
      const result = service['safeJsonParse'](obj as unknown as string);
      expect(result).toBe(obj); // same reference
    });

    it('returns undefined for non-object JSON (string/number)', () => {
      expect(service['safeJsonParse']('"just a string"')).toBeUndefined();
      expect(service['safeJsonParse']('42')).toBeUndefined();
    });
  });

  // =============================================================
  // buildAuditTrailWhereClause
  // =============================================================

  describe('buildAuditTrailWhereClause', () => {
    it('builds base clause with tenantId and date range', () => {
      const result = service['buildAuditTrailWhereClause'](makeFilter());

      expect(result.whereClause).toContain('tenant_id = $1');
      expect(result.whereClause).toContain('created_at >= $2');
      expect(result.whereClause).toContain('created_at <= $3');
      expect(result.params).toHaveLength(3);
      expect(result.params[0]).toBe(10);
    });

    it('includes all optional filters', () => {
      const result = service['buildAuditTrailWhereClause'](
        makeFilter({ action: 'create', userId: 5, entityType: 'user' }),
      );

      expect(result.whereClause).toContain('action = $4');
      expect(result.whereClause).toContain('user_id = $5');
      expect(result.whereClause).toContain('resource_type = $6');
      expect(result.params).toHaveLength(6);
      expect(result.params[3]).toBe('create');
      expect(result.params[4]).toBe(5);
      expect(result.params[5]).toBe('user');
    });
  });

  // =============================================================
  // buildRootLogsWhereClause
  // =============================================================

  describe('buildRootLogsWhereClause', () => {
    it('builds base clause with tenantId, dates, and soft-delete exclusion', () => {
      const result = service['buildRootLogsWhereClause'](makeFilter());

      expect(result.whereClause).toContain('r.tenant_id = $1');
      expect(result.whereClause).toContain('is_active');
      expect(result.whereClause).toContain('!= 4');
      expect(result.whereClause).toContain('r.created_at >= $2');
      expect(result.whereClause).toContain('r.created_at <= $3');
      expect(result.params).toHaveLength(3);
    });

    it('includes all optional filters with r. prefix', () => {
      const result = service['buildRootLogsWhereClause'](
        makeFilter({ action: 'login', userId: 3, entityType: 'session' }),
      );

      expect(result.whereClause).toContain('r.action = $4');
      expect(result.whereClause).toContain('r.user_id = $5');
      expect(result.whereClause).toContain('r.entity_type = $6');
      expect(result.params).toEqual([
        10,
        new Date('2025-01-01'),
        new Date('2025-12-31'),
        'login',
        3,
        'session',
      ]);
    });
  });

  // =============================================================
  // mapAuditTrailRow
  // =============================================================

  describe('mapAuditTrailRow', () => {
    it('maps a full audit_trail row to UnifiedLogEntry', () => {
      const row = makeAuditTrailRow();
      const result = service['mapAuditTrailRow'](row);

      expect(result.id).toBe(1);
      expect(result.source).toBe('audit_trail');
      expect(result.tenantId).toBe(10);
      expect(result.userId).toBe(5);
      expect(result.userName).toBe('Max');
      expect(result.userRole).toBe('admin');
      expect(result.action).toBe('create');
      expect(result.entityType).toBe('user');
      expect(result.entityId).toBe(10);
      expect(result.details).toBe('New user');
      expect(result.ipAddress).toBe('127.0.0.1');
      expect(result.status).toBe('success');
      expect(result.changes).toEqual({ field: 'value' });
      expect(result.timestamp).toBe('2025-06-01T10:00:00.000Z');
    });

    it('defaults null fields to fallback values', () => {
      const row = makeAuditTrailRow({
        user_name: null,
        user_role: null,
        resource_id: null,
        resource_name: null,
        ip_address: null,
        changes: null,
      });
      const result = service['mapAuditTrailRow'](row);

      expect(result.userName).toBe('Unknown');
      expect(result.userRole).toBe('');
      expect(result.entityId).toBeUndefined();
      expect(result.details).toBeUndefined();
      expect(result.ipAddress).toBeUndefined();
      expect(result.changes).toBeUndefined();
    });

    it('maps status "failure" correctly', () => {
      const row = makeAuditTrailRow({ status: 'failure' });
      const result = service['mapAuditTrailRow'](row);
      expect(result.status).toBe('failure');
    });
  });

  // =============================================================
  // mapRootLogsRow
  // =============================================================

  describe('mapRootLogsRow', () => {
    it('maps a full root_logs row to UnifiedLogEntry', () => {
      const row = makeRootLogsRow();
      const result = service['mapRootLogsRow'](row);

      expect(result.id).toBe(100);
      expect(result.source).toBe('root_logs');
      expect(result.tenantId).toBe(10);
      expect(result.userId).toBe(3);
      expect(result.userName).toBe('Admin User');
      expect(result.userRole).toBe('root');
      expect(result.action).toBe('login');
      expect(result.entityType).toBe('session');
      expect(result.entityId).toBe(42);
      expect(result.details).toBe('User logged in');
      expect(result.status).toBe('success'); // always success for root_logs
      expect(result.wasRoleSwitched).toBe(false);
      expect(result.oldValues).toEqual({ active: false });
      expect(result.newValues).toEqual({ active: true });
      expect(result.timestamp).toBe('2025-06-15T08:30:00.000Z');
    });

    it('defaults null fields to fallback values', () => {
      const row = makeRootLogsRow({
        user_name: null,
        user_role: null,
        entity_type: null,
        entity_id: null,
        details: null,
        ip_address: null,
        old_values: null,
        new_values: null,
      });
      const result = service['mapRootLogsRow'](row);

      expect(result.userName).toBe('Unknown');
      expect(result.userRole).toBe('');
      expect(result.entityType).toBe('');
      expect(result.entityId).toBeUndefined();
      expect(result.details).toBeUndefined();
      expect(result.ipAddress).toBeUndefined();
      expect(result.oldValues).toBeUndefined();
      expect(result.newValues).toBeUndefined();
    });
  });
});

// =============================================================
// DB-Mocked Public Methods
// =============================================================

describe('UnifiedLogsService – DB-mocked methods', () => {
  let service: UnifiedLogsService;
  let mockPool: ReturnType<typeof createMockPool>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool = createMockPool();
    service = new UnifiedLogsService(mockPool as never);
  });

  // =============================================================
  // streamLogs
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

    it('should yield mapped root_logs entries', async () => {
      const client = mockPool._client;
      const cursor = createMockCursor();
      cursor.read
        .mockResolvedValueOnce([
          {
            id: 100,
            tenant_id: 10,
            user_id: 3,
            user_name: 'Admin',
            user_role: 'root',
            action: 'login',
            entity_type: 'session',
            entity_id: null,
            details: null,
            old_values: null,
            new_values: null,
            ip_address: '10.0.0.1',
            user_agent: 'Chrome',
            was_role_switched: false,
            is_active: IS_ACTIVE.ACTIVE,
            created_at: new Date('2025-06-15'),
          },
        ])
        .mockResolvedValueOnce([]); // end of cursor

      client.query
        .mockResolvedValueOnce(undefined) // setRlsContext
        .mockReturnValueOnce(cursor); // cursor query

      const generator = service.streamLogs(makeFilter({ source: 'root_logs' }));
      const first = await generator.next();

      expect(first.done).toBe(false);
      expect(first.value?.source).toBe('root_logs');
      expect(first.value?.action).toBe('login');
      expect(first.value?.userName).toBe('Admin');
      expect(first.value?.status).toBe('success');
    });

    it('should stream from both tables when source is all', async () => {
      const client = mockPool._client;

      const auditCursor = createMockCursor();
      auditCursor.read
        .mockResolvedValueOnce([makeAuditTrailRow()])
        .mockResolvedValueOnce([]);

      const rootCursor = createMockCursor();
      rootCursor.read
        .mockResolvedValueOnce([makeRootLogsRow()])
        .mockResolvedValueOnce([]);

      client.query
        .mockResolvedValueOnce(undefined) // setRlsContext
        .mockReturnValueOnce(auditCursor) // audit_trail cursor
        .mockReturnValueOnce(rootCursor) // root_logs cursor
        .mockResolvedValueOnce(undefined); // clearRlsContext

      const entries = [];
      for await (const entry of service.streamLogs(makeFilter({ source: 'all' }))) {
        entries.push(entry);
      }

      expect(entries).toHaveLength(2);
      expect(entries[0]?.source).toBe('audit_trail');
      expect(entries[1]?.source).toBe('root_logs');
    });

    it('should release client even when streaming throws', async () => {
      const client = mockPool._client;
      const brokenCursor = createMockCursor();
      brokenCursor.read.mockRejectedValueOnce(new Error('DB connection lost'));
      brokenCursor.close.mockResolvedValueOnce(undefined);

      client.query
        .mockResolvedValueOnce(undefined) // setRlsContext
        .mockReturnValueOnce(brokenCursor); // cursor that fails

      const generator = service.streamLogs(makeFilter({ source: 'audit_trail' }));

      await expect(generator.next()).rejects.toThrow('DB connection lost');
      // Client must still be released
      expect(client.release).toHaveBeenCalled();
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

    it('should count only root_logs when source is root_logs', async () => {
      const client = mockPool._client;
      client.query
        .mockResolvedValueOnce(undefined) // setRlsContext
        .mockResolvedValueOnce({ rows: [{ count: '15' }] }) // root_logs count
        .mockResolvedValueOnce(undefined); // clearRlsContext

      const result = await service.countLogs(
        makeFilter({ source: 'root_logs' }),
      );

      expect(result).toBe(15);
    });

    it('should default to 0 when count row is missing', async () => {
      const client = mockPool._client;
      client.query
        .mockResolvedValueOnce(undefined) // setRlsContext
        .mockResolvedValueOnce({ rows: [] }) // empty audit_trail
        .mockResolvedValueOnce({ rows: [] }) // empty root_logs
        .mockResolvedValueOnce(undefined); // clearRlsContext

      const result = await service.countLogs(makeFilter({ source: 'all' }));

      expect(result).toBe(0);
    });
  });

  // =============================================================
  // getExportMetadata
  // =============================================================

  describe('getExportMetadata', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return metadata with counted total', async () => {
      const client = mockPool._client;
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

    it('should include ISO date strings and generatedAt', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-15T12:00:00.000Z'));

      const client = mockPool._client;
      client.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce(undefined);

      const result = await service.getExportMetadata(makeFilter());

      expect(result.dateFrom).toBe('2025-01-01T00:00:00.000Z');
      expect(result.dateTo).toBe('2025-12-31T00:00:00.000Z');
      expect(result.generatedAt).toBe('2025-06-15T12:00:00.000Z');
    });

    it('should set tenantName to undefined when not provided', async () => {
      const client = mockPool._client;
      client.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce(undefined);

      const result = await service.getExportMetadata(makeFilter());

      expect(result.tenantName).toBeUndefined();
      expect(result.totalEntries).toBe(15);
    });
  });
});
