/**
 * Unit tests for UserPermissionsService
 *
 * Mocked dependencies: DatabaseService (tenantTransaction + queryOne),
 * PermissionRegistryService. Tests getPermissions(), upsertPermissions(),
 * hasPermission() with all edge cases.
 *
 * IMPORTANT: resolveUserIdFromUuid uses db.queryOne() (explicit tenant_id filter),
 * while all tenant-scoped data goes through tenantTransaction/client (ADR-019).
 *
 * @see docs/USER-PERMISSIONS-UNIT-TEST-PLAN.md — Test-Datei 3
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../activity-logger/activity-logger.service.js';
import type { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';
import type { DatabaseService } from '../database/database.service.js';
import { UserPermissionsService } from './user-permissions.service.js';

// =============================================================
// Mock Types & Factories
// =============================================================

function createMockDb() {
  return {
    query: vi.fn(),
    queryOne: vi.fn(),
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockRegistry() {
  return {
    getAll: vi.fn(),
    getByCode: vi.fn(),
    isValidModule: vi.fn(),
    getAllowedPermissions: vi.fn(),
  };
}
type MockRegistry = ReturnType<typeof createMockRegistry>;

function createMockActivityLogger(): ActivityLoggerService {
  return {
    log: vi.fn(),
    logCreate: vi.fn(),
    logUpdate: vi.fn(),
    logDelete: vi.fn(),
  } as unknown as ActivityLoggerService;
}

function createCategory(
  overrides?: Partial<PermissionCategoryDef>,
): PermissionCategoryDef {
  return {
    code: 'blackboard',
    label: 'Schwarzes Brett',
    icon: 'fa-clipboard',
    modules: [
      {
        code: 'blackboard-posts',
        label: 'Beiträge',
        icon: 'fa-sticky-note',
        allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
      },
    ],
    ...overrides,
  };
}

// =============================================================
// Test Suite
// =============================================================

describe('SECURITY: UserPermissionsService', () => {
  let service: UserPermissionsService;
  let mockDb: MockDb;
  let mockClient: { query: ReturnType<typeof vi.fn> };
  let mockRegistry: MockRegistry;
  let mockActivityLogger: ActivityLoggerService;

  beforeEach(() => {
    mockDb = createMockDb();
    mockClient = { query: vi.fn() };
    mockRegistry = createMockRegistry();
    mockActivityLogger = createMockActivityLogger();

    // tenantTransaction executes callback with mockClient
    mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: typeof mockClient) => Promise<unknown>) => {
        return await callback(mockClient);
      },
    );

    service = new UserPermissionsService(
      mockDb as unknown as DatabaseService,
      mockRegistry as unknown as PermissionRegistryService,
      mockActivityLogger,
    );
  });

  // -----------------------------------------------------------
  // getPermissions()
  // -----------------------------------------------------------

  describe('getPermissions()', () => {
    describe('Happy Path', () => {
      it('should return full category tree with default false values', async () => {
        const category = createCategory();
        mockRegistry.getAll.mockReturnValue([category]);
        mockDb.queryOne.mockResolvedValue({ id: 42 });

        // 1st client.query: tenant_addons
        mockClient.query.mockResolvedValueOnce({
          rows: [{ code: 'blackboard' }],
        });
        // 2nd client.query: user_addon_permissions
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        const result = await service.getPermissions(1, 'user-uuid-1');

        expect(result).toHaveLength(1);
        expect(result[0]?.code).toBe('blackboard');
        expect(result[0]?.modules).toHaveLength(1);
        expect(result[0]?.modules[0]).toEqual(
          expect.objectContaining({
            code: 'blackboard-posts',
            canRead: false,
            canWrite: false,
            canDelete: false,
          }),
        );
      });

      it('should return saved permission values from DB', async () => {
        mockRegistry.getAll.mockReturnValue([createCategory()]);
        mockDb.queryOne.mockResolvedValue({ id: 42 });

        mockClient.query.mockResolvedValueOnce({
          rows: [{ code: 'blackboard' }],
        });
        mockClient.query.mockResolvedValueOnce({
          rows: [
            {
              addon_code: 'blackboard',
              module_code: 'blackboard-posts',
              can_read: true,
              can_write: false,
              can_delete: false,
            },
          ],
        });

        const result = await service.getPermissions(1, 'user-uuid-1');

        expect(result[0]?.modules[0]).toEqual(
          expect.objectContaining({
            canRead: true,
            canWrite: false,
            canDelete: false,
          }),
        );
      });

      it('should merge multiple modules correctly', async () => {
        const category = createCategory({
          modules: [
            {
              code: 'mod-a',
              label: 'A',
              icon: 'fa-a',
              allowedPermissions: ['canRead'],
            },
            {
              code: 'mod-b',
              label: 'B',
              icon: 'fa-b',
              allowedPermissions: ['canRead', 'canWrite'],
            },
            {
              code: 'mod-c',
              label: 'C',
              icon: 'fa-c',
              allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
            },
          ],
        });
        mockRegistry.getAll.mockReturnValue([category]);
        mockDb.queryOne.mockResolvedValue({ id: 42 });

        mockClient.query.mockResolvedValueOnce({
          rows: [{ code: 'blackboard' }],
        });
        mockClient.query.mockResolvedValueOnce({
          rows: [
            {
              addon_code: 'blackboard',
              module_code: 'mod-a',
              can_read: true,
              can_write: false,
              can_delete: false,
            },
            {
              addon_code: 'blackboard',
              module_code: 'mod-c',
              can_read: false,
              can_write: true,
              can_delete: true,
            },
          ],
        });

        const result = await service.getPermissions(1, 'user-uuid-1');
        const modules = result[0]?.modules;

        expect(modules).toHaveLength(3);
        // mod-a: has DB row
        expect(modules?.[0]).toEqual(
          expect.objectContaining({ code: 'mod-a', canRead: true }),
        );
        // mod-b: no DB row → defaults
        expect(modules?.[1]).toEqual(
          expect.objectContaining({
            code: 'mod-b',
            canRead: false,
            canWrite: false,
            canDelete: false,
          }),
        );
        // mod-c: has DB row
        expect(modules?.[2]).toEqual(
          expect.objectContaining({
            code: 'mod-c',
            canWrite: true,
            canDelete: true,
          }),
        );
      });

      it('should merge multiple categories', async () => {
        const categories = [
          createCategory({ code: 'blackboard' }),
          createCategory({ code: 'calendar', label: 'Kalender' }),
          createCategory({ code: 'kvp', label: 'KVP' }),
        ];
        mockRegistry.getAll.mockReturnValue(categories);
        mockDb.queryOne.mockResolvedValue({ id: 42 });

        mockClient.query.mockResolvedValueOnce({
          rows: [{ code: 'blackboard' }, { code: 'calendar' }, { code: 'kvp' }],
        });
        mockClient.query.mockResolvedValueOnce({
          rows: [
            {
              addon_code: 'blackboard',
              module_code: 'blackboard-posts',
              can_read: true,
              can_write: false,
              can_delete: false,
            },
            {
              addon_code: 'kvp',
              module_code: 'blackboard-posts',
              can_read: false,
              can_write: true,
              can_delete: false,
            },
          ],
        });

        const result = await service.getPermissions(1, 'user-uuid-1');

        expect(result).toHaveLength(3);
        expect(result[0]?.code).toBe('blackboard');
        expect(result[1]?.code).toBe('calendar');
        expect(result[2]?.code).toBe('kvp');
      });
    });

    describe('Tenant-Addon-Filtering', () => {
      it('should filter categories by tenant active addons', async () => {
        const categories = [
          createCategory({ code: 'blackboard' }),
          createCategory({ code: 'calendar' }),
          createCategory({ code: 'kvp' }),
        ];
        mockRegistry.getAll.mockReturnValue(categories);
        mockDb.queryOne.mockResolvedValue({ id: 42 });

        // Tenant only has blackboard + calendar addons active
        mockClient.query.mockResolvedValueOnce({
          rows: [{ code: 'blackboard' }, { code: 'calendar' }],
        });
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        const result = await service.getPermissions(1, 'user-uuid-1');

        expect(result).toHaveLength(2);
        expect(result.map((c) => c.code)).toEqual(['blackboard', 'calendar']);
      });

      it('should return empty tree when tenant has no active addons', async () => {
        mockRegistry.getAll.mockReturnValue([createCategory()]);
        mockDb.queryOne.mockResolvedValue({ id: 42 });

        mockClient.query.mockResolvedValueOnce({ rows: [] });
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        const result = await service.getPermissions(1, 'user-uuid-1');

        expect(result).toHaveLength(0);
      });

      it('should return empty tree when no categories match tenant addons', async () => {
        mockRegistry.getAll.mockReturnValue([
          createCategory({ code: 'blackboard' }),
        ]);
        mockDb.queryOne.mockResolvedValue({ id: 42 });

        // Tenant has calendar addon, but registry only knows blackboard
        mockClient.query.mockResolvedValueOnce({
          rows: [{ code: 'calendar' }],
        });
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        const result = await service.getPermissions(1, 'user-uuid-1');

        expect(result).toHaveLength(0);
      });
    });

    describe('allowedRoles Filtering', () => {
      it('should exclude modules where user role is not in allowedRoles', async () => {
        const category = createCategory({
          modules: [
            {
              code: 'admin-only-mod',
              label: 'Admin Only',
              icon: 'fa-lock',
              allowedPermissions: ['canRead'],
              allowedRoles: ['admin', 'root'],
            },
            {
              code: 'all-roles-mod',
              label: 'All Roles',
              icon: 'fa-users',
              allowedPermissions: ['canRead'],
            },
          ],
        });
        mockRegistry.getAll.mockReturnValue([category]);
        // User is employee — not in allowedRoles ['admin', 'root']
        mockDb.queryOne.mockResolvedValue({ id: 42, role: 'employee' });

        mockClient.query.mockResolvedValueOnce({
          rows: [{ code: 'blackboard' }],
        });
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        const result = await service.getPermissions(1, 'user-uuid-1');

        expect(result).toHaveLength(1);
        // admin-only-mod filtered out, only all-roles-mod remains
        expect(result[0]?.modules).toHaveLength(1);
        expect(result[0]?.modules[0]?.code).toBe('all-roles-mod');
      });
    });

    describe('allowedPermissions Filtering', () => {
      it('should include allowedPermissions metadata in response', async () => {
        const category = createCategory({
          modules: [
            {
              code: 'readonly-mod',
              label: 'Read Only',
              icon: 'fa-eye',
              allowedPermissions: ['canRead'],
            },
          ],
        });
        mockRegistry.getAll.mockReturnValue([category]);
        mockDb.queryOne.mockResolvedValue({ id: 42 });

        mockClient.query.mockResolvedValueOnce({
          rows: [{ code: 'blackboard' }],
        });
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        const result = await service.getPermissions(1, 'user-uuid-1');
        const mod = result[0]?.modules[0];

        expect(mod?.allowedPermissions).toEqual(['canRead']);
      });

      it('should include all three permissions when all allowed', async () => {
        mockRegistry.getAll.mockReturnValue([createCategory()]);
        mockDb.queryOne.mockResolvedValue({ id: 42 });

        mockClient.query.mockResolvedValueOnce({
          rows: [{ code: 'blackboard' }],
        });
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        const result = await service.getPermissions(1, 'user-uuid-1');
        const mod = result[0]?.modules[0];

        expect(mod?.allowedPermissions).toEqual([
          'canRead',
          'canWrite',
          'canDelete',
        ]);
        expect(mod).toHaveProperty('canRead');
        expect(mod).toHaveProperty('canWrite');
        expect(mod).toHaveProperty('canDelete');
      });
    });

    describe('Error Cases', () => {
      it('should throw NotFoundException when UUID does not resolve to a user', async () => {
        mockDb.queryOne.mockResolvedValue(null);

        await expect(
          service.getPermissions(1, 'nonexistent-uuid'),
        ).rejects.toThrow(NotFoundException);
      });

      it('should use tenantTransaction (not db.query) for tenant-scoped access', async () => {
        mockRegistry.getAll.mockReturnValue([createCategory()]);
        mockDb.queryOne.mockResolvedValue({ id: 42 });

        mockClient.query.mockResolvedValueOnce({
          rows: [{ code: 'blackboard' }],
        });
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        await service.getPermissions(1, 'user-uuid-1');

        expect(mockDb.tenantTransaction).toHaveBeenCalledOnce();
        expect(mockDb.query).not.toHaveBeenCalled();
      });
    });

    describe('DB-Call Verification', () => {
      it('should query user_addon_permissions with correct user_id', async () => {
        mockRegistry.getAll.mockReturnValue([createCategory()]);
        mockDb.queryOne.mockResolvedValue({ id: 42 });

        mockClient.query.mockResolvedValueOnce({
          rows: [{ code: 'blackboard' }],
        });
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        await service.getPermissions(1, 'user-uuid-1');

        // Second client.query call is for user_addon_permissions
        const secondCall = mockClient.query.mock.calls[1];
        expect(secondCall?.[1]).toContain(42);
      });

      it('should query tenant_addons for active addons', async () => {
        mockRegistry.getAll.mockReturnValue([createCategory()]);
        mockDb.queryOne.mockResolvedValue({ id: 42 });

        mockClient.query.mockResolvedValueOnce({
          rows: [{ code: 'blackboard' }],
        });
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        await service.getPermissions(1, 'user-uuid-1');

        // First client.query call is for tenant_addons
        const firstCallSql = mockClient.query.mock.calls[0]?.[0] as string;
        expect(firstCallSql).toContain('tenant_addons');
        expect(firstCallSql).toContain(`is_active = ${IS_ACTIVE.ACTIVE}`);
      });
    });
  });

  // -----------------------------------------------------------
  // upsertPermissions()
  // -----------------------------------------------------------

  describe('upsertPermissions()', () => {
    describe('Happy Path', () => {
      it('should execute UPSERT SQL with ON CONFLICT', async () => {
        mockDb.queryOne.mockResolvedValue({ id: 42 });
        mockRegistry.isValidModule.mockReturnValue(true);
        mockRegistry.getAllowedPermissions.mockReturnValue([
          'canRead',
          'canWrite',
          'canDelete',
        ]);
        mockClient.query.mockResolvedValue({ rows: [] });

        await service.upsertPermissions(
          1,
          'user-uuid-1',
          [
            {
              addonCode: 'blackboard',
              moduleCode: 'blackboard-posts',
              canRead: true,
              canWrite: false,
              canDelete: false,
            },
          ],
          99,
        );

        // calls[0] = capturePermissionState, calls[1] = UPSERT
        const sql = mockClient.query.mock.calls[1]?.[0] as string;
        expect(sql).toContain('INSERT INTO user_addon_permissions');
        expect(sql).toContain('ON CONFLICT');
      });

      it('should pass correct values to UPSERT', async () => {
        mockDb.queryOne.mockResolvedValue({ id: 42 });
        mockRegistry.isValidModule.mockReturnValue(true);
        mockRegistry.getAllowedPermissions.mockReturnValue([
          'canRead',
          'canWrite',
          'canDelete',
        ]);
        mockClient.query.mockResolvedValue({ rows: [] });

        await service.upsertPermissions(
          1,
          'user-uuid-1',
          [
            {
              addonCode: 'blackboard',
              moduleCode: 'blackboard-posts',
              canRead: true,
              canWrite: false,
              canDelete: false,
            },
          ],
          99,
        );

        // calls[0] = capturePermissionState, calls[1] = UPSERT
        const params = mockClient.query.mock.calls[1]?.[1] as unknown[];
        expect(params).toContain(1); // tenantId
        expect(params).toContain(42); // userId
        expect(params).toContain('blackboard'); // addonCode
        expect(params).toContain('blackboard-posts'); // moduleCode
        expect(params).toContain(true); // canRead
        expect(params).toContain(99); // assignedBy
      });

      it('should set assignedBy from caller', async () => {
        mockDb.queryOne.mockResolvedValue({ id: 42 });
        mockRegistry.isValidModule.mockReturnValue(true);
        mockRegistry.getAllowedPermissions.mockReturnValue([
          'canRead',
          'canWrite',
          'canDelete',
        ]);
        mockClient.query.mockResolvedValue({ rows: [] });

        await service.upsertPermissions(
          1,
          'user-uuid-1',
          [
            {
              addonCode: 'blackboard',
              moduleCode: 'blackboard-posts',
              canRead: true,
              canWrite: false,
              canDelete: false,
            },
          ],
          99,
        );

        // calls[0] = capturePermissionState, calls[1] = UPSERT
        const params = mockClient.query.mock.calls[1]?.[1] as unknown[];
        // assignedBy is the last parameter
        expect(params?.[7]).toBe(99);
      });

      it('should handle multiple permissions in one call', async () => {
        mockDb.queryOne.mockResolvedValue({ id: 42 });
        mockRegistry.isValidModule.mockReturnValue(true);
        mockRegistry.getAllowedPermissions.mockReturnValue([
          'canRead',
          'canWrite',
          'canDelete',
        ]);
        mockClient.query.mockResolvedValue({ rows: [] });

        await service.upsertPermissions(
          1,
          'user-uuid-1',
          [
            {
              addonCode: 'blackboard',
              moduleCode: 'blackboard-posts',
              canRead: true,
              canWrite: false,
              canDelete: false,
            },
            {
              addonCode: 'calendar',
              moduleCode: 'calendar-events',
              canRead: true,
              canWrite: true,
              canDelete: false,
            },
            {
              addonCode: 'kvp',
              moduleCode: 'kvp-proposals',
              canRead: false,
              canWrite: false,
              canDelete: false,
            },
          ],
          99,
        );

        // 1 capturePermissionState + 3 UPSERTs
        expect(mockClient.query).toHaveBeenCalledTimes(4);
      });

      it('should handle empty permissions array', async () => {
        mockDb.queryOne.mockResolvedValue({ id: 42 });
        mockClient.query.mockResolvedValue({ rows: [] });

        await service.upsertPermissions(1, 'user-uuid-1', [], 99);

        // 1 capturePermissionState, no UPSERT calls
        expect(mockClient.query).toHaveBeenCalledTimes(1);
      });

      it('should capture existing permission state before upserting', async () => {
        mockDb.queryOne.mockResolvedValue({ id: 42 });
        mockRegistry.isValidModule.mockReturnValue(true);
        mockRegistry.getAllowedPermissions.mockReturnValue([
          'canRead',
          'canWrite',
          'canDelete',
        ]);

        // capturePermissionState returns existing rows
        mockClient.query.mockResolvedValueOnce({
          rows: [
            {
              addon_code: 'blackboard',
              module_code: 'blackboard-posts',
              can_read: true,
              can_write: false,
              can_delete: false,
            },
          ],
        });
        // UPSERT call
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        await service.upsertPermissions(
          1,
          'user-uuid-1',
          [
            {
              addonCode: 'blackboard',
              moduleCode: 'blackboard-posts',
              canRead: true,
              canWrite: true,
              canDelete: false,
            },
          ],
          99,
        );

        // capturePermissionState queried user_addon_permissions
        const captureCall = mockClient.query.mock.calls[0];
        const captureSql = captureCall?.[0] as string;
        expect(captureSql).toContain('user_addon_permissions');
        expect(captureCall?.[1]).toContain(42);
      });

      it('should not log when upserted permissions are identical to existing state', async () => {
        mockDb.queryOne.mockResolvedValue({ id: 42 });
        mockRegistry.isValidModule.mockReturnValue(true);
        mockRegistry.getAllowedPermissions.mockReturnValue([
          'canRead',
          'canWrite',
          'canDelete',
        ]);

        // Old state matches new values exactly → no diff
        mockClient.query.mockResolvedValueOnce({
          rows: [
            {
              addon_code: 'blackboard',
              module_code: 'blackboard-posts',
              can_read: true,
              can_write: false,
              can_delete: false,
            },
          ],
        });
        // UPSERT call
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        await service.upsertPermissions(
          1,
          'user-uuid-1',
          [
            {
              addonCode: 'blackboard',
              moduleCode: 'blackboard-posts',
              canRead: true,
              canWrite: false,
              canDelete: false,
            },
          ],
          99,
        );

        expect(mockActivityLogger.logUpdate).not.toHaveBeenCalled();
      });
    });

    describe('allowedPermissions Enforcement', () => {
      it('should force canWrite to false when not in allowedPermissions', async () => {
        mockDb.queryOne.mockResolvedValue({ id: 42 });
        mockRegistry.isValidModule.mockReturnValue(true);
        // Module only allows canRead
        mockRegistry.getAllowedPermissions.mockReturnValue(['canRead']);
        mockClient.query.mockResolvedValue({ rows: [] });

        await service.upsertPermissions(
          1,
          'user-uuid-1',
          [
            {
              addonCode: 'blackboard',
              moduleCode: 'readonly-mod',
              canRead: true,
              canWrite: true, // Should be forced to false
              canDelete: false,
            },
          ],
          99,
        );

        // calls[0] = capturePermissionState, calls[1] = UPSERT
        const params = mockClient.query.mock.calls[1]?.[1] as unknown[];
        // params: [tenantId, userId, addonCode, moduleCode, canRead, canWrite, canDelete, assignedBy]
        expect(params?.[4]).toBe(true); // canRead allowed
        expect(params?.[5]).toBe(false); // canWrite forced to false
      });

      it('should force canDelete to false when not in allowedPermissions', async () => {
        mockDb.queryOne.mockResolvedValue({ id: 42 });
        mockRegistry.isValidModule.mockReturnValue(true);
        mockRegistry.getAllowedPermissions.mockReturnValue([
          'canRead',
          'canWrite',
        ]);
        mockClient.query.mockResolvedValue({ rows: [] });

        await service.upsertPermissions(
          1,
          'user-uuid-1',
          [
            {
              addonCode: 'blackboard',
              moduleCode: 'rw-mod',
              canRead: true,
              canWrite: true,
              canDelete: true, // Should be forced to false
            },
          ],
          99,
        );

        // calls[0] = capturePermissionState, calls[1] = UPSERT
        const params = mockClient.query.mock.calls[1]?.[1] as unknown[];
        expect(params?.[4]).toBe(true); // canRead
        expect(params?.[5]).toBe(true); // canWrite
        expect(params?.[6]).toBe(false); // canDelete forced to false
      });

      it('should force canRead to false when not in allowedPermissions', async () => {
        mockDb.queryOne.mockResolvedValue({ id: 42 });
        mockRegistry.isValidModule.mockReturnValue(true);
        // Module only allows canWrite — canRead is NOT allowed
        mockRegistry.getAllowedPermissions.mockReturnValue(['canWrite']);
        mockClient.query.mockResolvedValue({ rows: [] });

        await service.upsertPermissions(
          1,
          'user-uuid-1',
          [
            {
              addonCode: 'blackboard',
              moduleCode: 'write-only-mod',
              canRead: true, // Should be forced to false
              canWrite: true,
              canDelete: false,
            },
          ],
          99,
        );

        const params = mockClient.query.mock.calls[1]?.[1] as unknown[];
        expect(params?.[4]).toBe(false); // canRead forced to false
        expect(params?.[5]).toBe(true); // canWrite allowed
      });

      it('should keep all permissions when all are allowed', async () => {
        mockDb.queryOne.mockResolvedValue({ id: 42 });
        mockRegistry.isValidModule.mockReturnValue(true);
        mockRegistry.getAllowedPermissions.mockReturnValue([
          'canRead',
          'canWrite',
          'canDelete',
        ]);
        mockClient.query.mockResolvedValue({ rows: [] });

        await service.upsertPermissions(
          1,
          'user-uuid-1',
          [
            {
              addonCode: 'blackboard',
              moduleCode: 'blackboard-posts',
              canRead: true,
              canWrite: true,
              canDelete: true,
            },
          ],
          99,
        );

        // calls[0] = capturePermissionState, calls[1] = UPSERT
        const params = mockClient.query.mock.calls[1]?.[1] as unknown[];
        expect(params?.[4]).toBe(true);
        expect(params?.[5]).toBe(true);
        expect(params?.[6]).toBe(true);
      });
    });

    describe('Validation against Registry', () => {
      it('should throw BadRequestException for unknown addonCode', async () => {
        mockDb.queryOne.mockResolvedValue({ id: 42 });
        mockRegistry.isValidModule.mockReturnValue(false);
        mockClient.query.mockResolvedValue({ rows: [] });

        await expect(
          service.upsertPermissions(
            1,
            'user-uuid-1',
            [
              {
                addonCode: 'unknown',
                moduleCode: 'unknown-mod',
                canRead: true,
                canWrite: false,
                canDelete: false,
              },
            ],
            99,
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for unknown moduleCode', async () => {
        mockDb.queryOne.mockResolvedValue({ id: 42 });
        mockRegistry.isValidModule.mockReturnValue(false);
        mockClient.query.mockResolvedValue({ rows: [] });

        await expect(
          service.upsertPermissions(
            1,
            'user-uuid-1',
            [
              {
                addonCode: 'blackboard',
                moduleCode: 'unknown',
                canRead: true,
                canWrite: false,
                canDelete: false,
              },
            ],
            99,
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('should stop on first invalid entry and throw', async () => {
        mockDb.queryOne.mockResolvedValue({ id: 42 });
        // First entry: valid, second: invalid, third: valid
        mockRegistry.isValidModule
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(false)
          .mockReturnValueOnce(true);
        mockRegistry.getAllowedPermissions.mockReturnValue([
          'canRead',
          'canWrite',
          'canDelete',
        ]);
        mockClient.query.mockResolvedValue({ rows: [] });

        await expect(
          service.upsertPermissions(
            1,
            'user-uuid-1',
            [
              {
                addonCode: 'blackboard',
                moduleCode: 'blackboard-posts',
                canRead: true,
                canWrite: false,
                canDelete: false,
              },
              {
                addonCode: 'invalid',
                moduleCode: 'invalid-mod',
                canRead: true,
                canWrite: false,
                canDelete: false,
              },
              {
                addonCode: 'kvp',
                moduleCode: 'kvp-proposals',
                canRead: true,
                canWrite: false,
                canDelete: false,
              },
            ],
            99,
          ),
        ).rejects.toThrow(BadRequestException);

        // 1 capturePermissionState + 1 UPSERT for valid entry before error
        // Atomicity is guaranteed by DB transaction rollback
        expect(mockClient.query).toHaveBeenCalledTimes(2);
      });
    });

    describe('Error Cases', () => {
      it('should throw NotFoundException when UUID does not resolve', async () => {
        mockDb.queryOne.mockResolvedValue(null);

        await expect(
          service.upsertPermissions(
            1,
            'nonexistent-uuid',
            [
              {
                addonCode: 'blackboard',
                moduleCode: 'blackboard-posts',
                canRead: true,
                canWrite: false,
                canDelete: false,
              },
            ],
            99,
          ),
        ).rejects.toThrow(NotFoundException);
      });

      it('should use tenantTransaction (not db.query)', async () => {
        mockDb.queryOne.mockResolvedValue({ id: 42 });
        mockRegistry.isValidModule.mockReturnValue(true);
        mockRegistry.getAllowedPermissions.mockReturnValue([
          'canRead',
          'canWrite',
          'canDelete',
        ]);
        mockClient.query.mockResolvedValue({ rows: [] });

        await service.upsertPermissions(
          1,
          'user-uuid-1',
          [
            {
              addonCode: 'blackboard',
              moduleCode: 'blackboard-posts',
              canRead: true,
              canWrite: false,
              canDelete: false,
            },
          ],
          99,
        );

        expect(mockDb.tenantTransaction).toHaveBeenCalledOnce();
        expect(mockDb.query).not.toHaveBeenCalled();
      });
    });
  });

  // -----------------------------------------------------------
  // getActiveAddonsForTenant() — indirectly via getPermissions
  // -----------------------------------------------------------

  describe('getActiveAddonsForTenant() — indirect', () => {
    it(`should return only is_active = ${IS_ACTIVE.ACTIVE} addons`, async () => {
      const categories = [
        createCategory({ code: 'blackboard' }),
        createCategory({ code: 'calendar' }),
        createCategory({ code: 'kvp' }),
      ];
      mockRegistry.getAll.mockReturnValue(categories);
      mockDb.queryOne.mockResolvedValue({ id: 42 });

      // SQL filters by is_active = 1 — mock returns only active addons
      mockClient.query.mockResolvedValueOnce({
        rows: [{ code: 'blackboard' }, { code: 'calendar' }],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getPermissions(1, 'user-uuid-1');

      expect(result).toHaveLength(2);
      expect(result.map((c) => c.code)).toEqual(['blackboard', 'calendar']);
    });

    it('should return empty Set when no addons exist', async () => {
      mockRegistry.getAll.mockReturnValue([createCategory()]);
      mockDb.queryOne.mockResolvedValue({ id: 42 });

      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getPermissions(1, 'user-uuid-1');

      expect(result).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------
  // getReadableAddonCodes() — ADR-020 notification filtering
  // -----------------------------------------------------------

  describe('getReadableAddonCodes()', () => {
    it('should return Set of addon codes with can_read = true', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ addon_code: 'blackboard' }, { addon_code: 'calendar' }],
      });

      const result = await service.getReadableAddonCodes(42);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(2);
      expect(result.has('blackboard')).toBe(true);
      expect(result.has('calendar')).toBe(true);
    });

    it('should return empty Set when user has no readable addons', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      const result = await service.getReadableAddonCodes(42);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it('should use DISTINCT to avoid duplicates', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ addon_code: 'blackboard' }],
      });

      await service.getReadableAddonCodes(42);

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('DISTINCT');
      expect(sql).toContain('can_read = true');
    });

    it('should query with correct userId parameter', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.getReadableAddonCodes(99);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('user_addon_permissions'),
        [99],
      );
    });

    it('should use tenantTransaction for RLS compliance', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.getReadableAddonCodes(42);

      expect(mockDb.tenantTransaction).toHaveBeenCalledOnce();
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------
  // hasPermission() — Phase 5b Enforcement
  // -----------------------------------------------------------

  describe('hasPermission()', () => {
    describe('Happy Path', () => {
      it('should return true when can_read is true and action=canRead', async () => {
        mockClient.query.mockResolvedValue({
          rows: [{ can_read: true, can_write: false, can_delete: false }],
        });

        const result = await service.hasPermission(
          42,
          'blackboard',
          'blackboard-posts',
          'canRead',
        );

        expect(result).toBe(true);
      });

      it('should return true when can_write is true and action=canWrite', async () => {
        mockClient.query.mockResolvedValue({
          rows: [{ can_read: false, can_write: true, can_delete: false }],
        });

        const result = await service.hasPermission(
          42,
          'blackboard',
          'blackboard-posts',
          'canWrite',
        );

        expect(result).toBe(true);
      });

      it('should return true when can_delete is true and action=canDelete', async () => {
        mockClient.query.mockResolvedValue({
          rows: [{ can_read: false, can_write: false, can_delete: true }],
        });

        const result = await service.hasPermission(
          42,
          'blackboard',
          'blackboard-posts',
          'canDelete',
        );

        expect(result).toBe(true);
      });

      it('should return false when can_read is false and action=canRead', async () => {
        mockClient.query.mockResolvedValue({
          rows: [{ can_read: false, can_write: true, can_delete: true }],
        });

        const result = await service.hasPermission(
          42,
          'blackboard',
          'blackboard-posts',
          'canRead',
        );

        expect(result).toBe(false);
      });

      it('should return false when can_write is false and action=canWrite', async () => {
        mockClient.query.mockResolvedValue({
          rows: [{ can_read: true, can_write: false, can_delete: true }],
        });

        const result = await service.hasPermission(
          42,
          'blackboard',
          'blackboard-posts',
          'canWrite',
        );

        expect(result).toBe(false);
      });

      it('should return false when can_delete is false and action=canDelete', async () => {
        mockClient.query.mockResolvedValue({
          rows: [{ can_read: true, can_write: true, can_delete: false }],
        });

        const result = await service.hasPermission(
          42,
          'blackboard',
          'blackboard-posts',
          'canDelete',
        );

        expect(result).toBe(false);
      });
    });

    describe('Fail-Closed (no row = denied)', () => {
      it('should return false when no permission row exists', async () => {
        mockClient.query.mockResolvedValue({ rows: [] });

        const result = await service.hasPermission(
          42,
          'blackboard',
          'blackboard-posts',
          'canRead',
        );

        expect(result).toBe(false);
      });
    });

    describe('DB-Call Verification', () => {
      it('should query with correct userId, addonCode, moduleCode', async () => {
        mockClient.query.mockResolvedValue({ rows: [] });

        await service.hasPermission(42, 'blackboard', 'posts', 'canRead');

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('user_addon_permissions'),
          [42, 'blackboard', 'posts'],
        );
      });

      it('should use tenantTransaction (not db.query) for RLS compliance', async () => {
        mockClient.query.mockResolvedValue({ rows: [] });

        await service.hasPermission(42, 'blackboard', 'posts', 'canRead');

        expect(mockDb.tenantTransaction).toHaveBeenCalledOnce();
        expect(mockDb.query).not.toHaveBeenCalled();
      });
    });
  });
});
