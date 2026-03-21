/**
 * Unit tests for ScopeService
 *
 * Tests lazy scope resolution with CLS caching.
 * Covers: cache hit, cache miss + DB, missing CLS context (background jobs).
 */
import type { ClsService } from 'nestjs-cls';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HierarchyPermissionService } from './hierarchy-permission.service.js';
import { FULL_SCOPE } from './organizational-scope.types.js';
import { ScopeService } from './scope.service.js';

function createMockCls() {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn(<T>(key: string): T | undefined => store.get(key) as T | undefined),
    set: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
    }),
    _store: store,
  };
}

function createMockHierarchyPermission() {
  return {
    getScope: vi.fn().mockResolvedValue(FULL_SCOPE),
  };
}

describe('ScopeService', () => {
  let service: ScopeService;
  let mockCls: ReturnType<typeof createMockCls>;
  let mockHierarchy: ReturnType<typeof createMockHierarchyPermission>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCls = createMockCls();
    mockHierarchy = createMockHierarchyPermission();
    service = new ScopeService(
      mockHierarchy as unknown as HierarchyPermissionService,
      mockCls as unknown as ClsService,
    );
  });

  it('should return cached scope on second call (CLS cache hit)', async () => {
    // Setup CLS with userId + tenantId
    mockCls._store.set('userId', 1);
    mockCls._store.set('tenantId', 3);

    // First call → DB query + cache
    const scope1 = await service.getScope();
    expect(scope1.type).toBe('full');
    expect(mockHierarchy.getScope).toHaveBeenCalledOnce();

    // Second call → from CLS cache (orgScope was set by first call)
    const scope2 = await service.getScope();
    expect(scope2.type).toBe('full');
    // Still only 1 DB call — second was from cache
    expect(mockHierarchy.getScope).toHaveBeenCalledOnce();
  });

  it('should call hierarchyPermission.getScope on cache miss', async () => {
    mockCls._store.set('userId', 42);
    mockCls._store.set('tenantId', 3);

    const scope = await service.getScope();

    expect(mockHierarchy.getScope).toHaveBeenCalledWith(42, 3);
    expect(scope).toBe(FULL_SCOPE);
  });

  it('should store scope in CLS after first resolution', async () => {
    mockCls._store.set('userId', 1);
    mockCls._store.set('tenantId', 3);

    await service.getScope();

    expect(mockCls.set).toHaveBeenCalledWith('orgScope', FULL_SCOPE);
  });

  it('should throw Error when userId is missing (background job)', async () => {
    // No userId in CLS → background job context
    mockCls._store.set('tenantId', 3);

    await expect(service.getScope()).rejects.toThrow('ScopeService requires CLS context');
  });

  it('should throw Error when tenantId is missing (background job)', async () => {
    mockCls._store.set('userId', 1);
    // No tenantId

    await expect(service.getScope()).rejects.toThrow('ScopeService requires CLS context');
  });

  it('should throw Error when both userId and tenantId are missing', async () => {
    // Empty CLS → cron job or deletion worker
    await expect(service.getScope()).rejects.toThrow(
      'Cannot be used in background jobs or cron tasks',
    );
  });
});
