/**
 * Unit tests for DatabaseService
 *
 * Phase 13 Batch C (C5): Pure placeholder generators + mocked Pool/CLS methods.
 */
import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { DatabaseService } from './database.service.js';

// ============================================
// Mocks
// ============================================

function createMockPool() {
  const mockClient = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  };

  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn().mockResolvedValue(mockClient),
    end: vi.fn().mockResolvedValue(undefined),
    mockClient,
  };
}

function createMockCls(values: Record<string, unknown> = {}) {
  return {
    get: vi.fn((key: string) => values[key]),
  };
}

function createService(pool = createMockPool(), cls = createMockCls()) {
  return {
    service: new DatabaseService(pool as never, cls as never),
    pool,
    cls,
  };
}

// ============================================
// generateBulkPlaceholders (pure)
// ============================================

describe('generateBulkPlaceholders', () => {
  it('should generate 3 rows x 2 columns starting from $1', () => {
    const { service } = createService();
    const result = service.generateBulkPlaceholders(3, 2, 1);

    expect(result.placeholders).toBe('($1, $2), ($3, $4), ($5, $6)');
    expect(result.nextIndex).toBe(7);
  });

  it('should start from custom index', () => {
    const { service } = createService();
    const result = service.generateBulkPlaceholders(2, 3, 5);

    expect(result.placeholders).toBe('($5, $6, $7), ($8, $9, $10)');
    expect(result.nextIndex).toBe(11);
  });

  it('should handle single row single column', () => {
    const { service } = createService();
    const result = service.generateBulkPlaceholders(1, 1);

    expect(result.placeholders).toBe('($1)');
    expect(result.nextIndex).toBe(2);
  });

  it('should default startIndex to 1', () => {
    const { service } = createService();
    const result = service.generateBulkPlaceholders(1, 2);

    expect(result.placeholders).toBe('($1, $2)');
    expect(result.nextIndex).toBe(3);
  });

  it('should handle 0 rows', () => {
    const { service } = createService();
    const result = service.generateBulkPlaceholders(0, 3);

    expect(result.placeholders).toBe('');
    expect(result.nextIndex).toBe(1);
  });
});

// ============================================
// generateInPlaceholders (pure)
// ============================================

describe('generateInPlaceholders', () => {
  it('should generate 3 placeholders starting from $1', () => {
    const { service } = createService();
    const result = service.generateInPlaceholders(3, 1);

    expect(result.placeholders).toBe('$1, $2, $3');
    expect(result.nextIndex).toBe(4);
  });

  it('should start from custom index', () => {
    const { service } = createService();
    const result = service.generateInPlaceholders(2, 5);

    expect(result.placeholders).toBe('$5, $6');
    expect(result.nextIndex).toBe(7);
  });

  it('should default startIndex to 1', () => {
    const { service } = createService();
    const result = service.generateInPlaceholders(2);

    expect(result.placeholders).toBe('$1, $2');
  });

  it('should handle count=1', () => {
    const { service } = createService();
    const result = service.generateInPlaceholders(1);

    expect(result.placeholders).toBe('$1');
    expect(result.nextIndex).toBe(2);
  });

  it('should handle count=0', () => {
    const { service } = createService();
    const result = service.generateInPlaceholders(0);

    expect(result.placeholders).toBe('');
    expect(result.nextIndex).toBe(1);
  });
});

// ============================================
// query / queryOne
// ============================================

describe('query', () => {
  it('should delegate to pool.query and return rows', async () => {
    const { service, pool } = createService();
    pool.query.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] });

    const result = await service.query('SELECT * FROM users');

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM users', undefined);
  });

  it('should pass params to pool.query', async () => {
    const { service, pool } = createService();
    pool.query.mockResolvedValue({ rows: [{ id: 5 }] });

    await service.query('SELECT * FROM users WHERE id = $1', [5]);

    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [5]);
  });
});

describe('queryOne', () => {
  it('should return first row when found', async () => {
    const { service, pool } = createService();
    pool.query.mockResolvedValue({ rows: [{ id: 1, name: 'test' }] });

    const result = await service.queryOne('SELECT * FROM users WHERE id = $1', [1]);

    expect(result).toEqual({ id: 1, name: 'test' });
  });

  it('should return null when no rows', async () => {
    const { service, pool } = createService();
    pool.query.mockResolvedValue({ rows: [] });

    const result = await service.queryOne('SELECT * FROM users WHERE id = $1', [999]);

    expect(result).toBeNull();
  });
});

// ============================================
// transaction
// ============================================

describe('transaction', () => {
  it('should BEGIN, execute callback, and COMMIT', async () => {
    const { service, pool } = createService();

    const result = await service.transaction(async (client) => {
      await client.query('SELECT 1');
      return 'done';
    });

    expect(result).toBe('done');
    expect(pool.mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(pool.mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(pool.mockClient.release).toHaveBeenCalled();
  });

  it('should ROLLBACK on error and rethrow', async () => {
    const { service, pool } = createService();

    await expect(
      service.transaction(async () => {
        throw new Error('DB error');
      }),
    ).rejects.toThrow('DB error');

    expect(pool.mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(pool.mockClient.release).toHaveBeenCalled();
  });

  it('should ROLLBACK on HttpException without ERROR log', async () => {
    const { service, pool } = createService();

    await expect(
      service.transaction(async () => {
        throw new ConflictException('Key already exists');
      }),
    ).rejects.toThrow('Key already exists');

    expect(pool.mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(pool.mockClient.release).toHaveBeenCalled();
  });

  it('should set tenant context when tenantId provided', async () => {
    const { service, pool } = createService();

    await service.transaction(async () => 'ok', { tenantId: 42 });

    expect(pool.mockClient.query).toHaveBeenCalledWith(expect.stringContaining('app.tenant_id'), [
      '42',
    ]);
  });

  it('should set user context when userId provided', async () => {
    const { service, pool } = createService();

    await service.transaction(async () => 'ok', { userId: 7 });

    expect(pool.mockClient.query).toHaveBeenCalledWith(expect.stringContaining('app.user_id'), [
      '7',
    ]);
  });
});

// ============================================
// tenantTransaction
// ============================================

describe('tenantTransaction', () => {
  it('should read tenantId and userId from CLS', async () => {
    const cls = createMockCls({ tenantId: 10, userId: 5 });
    const { service, pool } = createService(undefined, cls);

    await service.tenantTransaction(async () => 'ok');

    expect(cls.get).toHaveBeenCalledWith('tenantId');
    expect(cls.get).toHaveBeenCalledWith('userId');
    expect(pool.mockClient.query).toHaveBeenCalledWith(expect.stringContaining('app.tenant_id'), [
      '10',
    ]);
  });
});

// ============================================
// getTenantId / getUserId
// ============================================

describe('getTenantId / getUserId', () => {
  it('should return tenantId from CLS', () => {
    const cls = createMockCls({ tenantId: 42 });
    const { service } = createService(undefined, cls);

    expect(service.getTenantId()).toBe(42);
  });

  it('should return undefined when tenantId not in CLS', () => {
    const { service } = createService();

    expect(service.getTenantId()).toBeUndefined();
  });

  it('should return userId from CLS', () => {
    const cls = createMockCls({ userId: 7 });
    const { service } = createService(undefined, cls);

    expect(service.getUserId()).toBe(7);
  });
});

// ============================================
// isHealthy / closePool
// ============================================

describe('isHealthy', () => {
  it('should return true when pool responds', async () => {
    const { service } = createService();

    expect(await service.isHealthy()).toBe(true);
  });

  it('should return false when pool throws', async () => {
    const pool = createMockPool();
    pool.query.mockRejectedValue(new Error('connection refused'));
    const { service } = createService(pool);

    expect(await service.isHealthy()).toBe(false);
  });
});

describe('closePool', () => {
  it('should call pool.end()', async () => {
    const { service, pool } = createService();

    await service.closePool();

    expect(pool.end).toHaveBeenCalled();
  });
});
