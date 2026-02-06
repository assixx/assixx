/**
 * Unit tests for HierarchyPermissionService
 *
 * Phase 13 Batch C (C2): hasAccess flow + getAccessible*Ids.
 * Migrated from services/ — uses DI bypass pattern (no vi.mock).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { HierarchyPermissionService } from './hierarchy-permission.service.js';

// ============================================
// Mock Setup — DI bypass pattern
// ============================================

const mockDb = {
  query: vi.fn(),
} as unknown as DatabaseService;

let service: HierarchyPermissionService;

beforeEach(() => {
  vi.resetAllMocks();
  service = new HierarchyPermissionService(mockDb);
});

// ============================================
// Helpers
// ============================================

/** Mock db.query to return rows (DatabaseService.query returns T[] directly) */
function mockQueryReturn(rows: unknown[]) {
  (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce(rows);
}

/** Shortcut for mocking user query (always the first query in hasAccess) */
function mockUser(role: string, hasFullAccess: boolean) {
  mockQueryReturn([{ id: 1, role, has_full_access: hasFullAccess }]);
}

/** Mock user not found */
function mockUserNotFound() {
  mockQueryReturn([]);
}

// ============================================
// hasAccess — Core Flow
// ============================================

describe('hasAccess', () => {
  it('should return false when user not found', async () => {
    mockUserNotFound();

    const result = await service.hasAccess(999, 1, 'area', 1);

    expect(result).toBe(false);
  });

  it('should return true for root user', async () => {
    mockUser('root', false);

    const result = await service.hasAccess(1, 1, 'area', 1);

    expect(result).toBe(true);
  });

  it('should return true for user with has_full_access', async () => {
    mockUser('admin', true);

    const result = await service.hasAccess(1, 1, 'department', 5);

    expect(result).toBe(true);
  });

  it('should return false for unknown resource type', async () => {
    mockUser('employee', false);

    const result = await service.hasAccess(1, 1, 'unknown' as never, 1);

    expect(result).toBe(false);
  });

  it('should return false on error', async () => {
    (mockDb.query as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('DB down'),
    );

    const result = await service.hasAccess(1, 1, 'area', 1);

    expect(result).toBe(false);
  });

  it('should default permission to read', async () => {
    mockUser('employee', false);
    // Area permission check: can_read=true
    mockQueryReturn([{ can_read: true, can_write: false, can_delete: false }]);

    const result = await service.hasAccess(1, 1, 'area', 1);

    expect(result).toBe(true);
  });
});

// ============================================
// hasAccess — Area Access
// ============================================

describe('hasAccess — area', () => {
  it('should grant access when user has area permission with read', async () => {
    mockUser('admin', false);
    mockQueryReturn([{ can_read: true, can_write: false, can_delete: false }]);

    const result = await service.hasAccess(1, 1, 'area', 10, 'read');

    expect(result).toBe(true);
  });

  it('should deny access when user has no area permission', async () => {
    mockUser('admin', false);
    mockQueryReturn([]);

    const result = await service.hasAccess(1, 1, 'area', 10, 'write');

    expect(result).toBe(false);
  });

  it('should deny access when permission level insufficient', async () => {
    mockUser('admin', false);
    mockQueryReturn([{ can_read: true, can_write: false, can_delete: false }]);

    const result = await service.hasAccess(1, 1, 'area', 10, 'delete');

    expect(result).toBe(false);
  });
});

// ============================================
// hasAccess — Department Access (with Area inheritance)
// ============================================

describe('hasAccess — department', () => {
  it('should grant access with direct department permission', async () => {
    mockUser('admin', false);
    // Direct dept permission
    mockQueryReturn([{ can_read: true, can_write: true, can_delete: false }]);

    const result = await service.hasAccess(1, 1, 'department', 5, 'write');

    expect(result).toBe(true);
  });

  it('should inherit access from area when direct dept permission absent', async () => {
    mockUser('admin', false);
    // No direct dept permission
    mockQueryReturn([]);
    // Department info with area_id
    mockQueryReturn([{ id: 5, area_id: 3 }]);
    // Area permission check
    mockQueryReturn([{ can_read: true, can_write: false, can_delete: false }]);

    const result = await service.hasAccess(1, 1, 'department', 5, 'read');

    expect(result).toBe(true);
  });

  it('should deny when no dept permission and dept has no area', async () => {
    mockUser('admin', false);
    // No direct dept permission
    mockQueryReturn([]);
    // Department info with null area_id
    mockQueryReturn([{ id: 5, area_id: null }]);

    const result = await service.hasAccess(1, 1, 'department', 5, 'read');

    expect(result).toBe(false);
  });
});

// ============================================
// hasAccess — Team Access
// ============================================

describe('hasAccess — team', () => {
  it('should grant access when user is team member', async () => {
    mockUser('employee', false);
    // 1. isTeamMember — is a member
    mockQueryReturn([{ user_id: 1 }]);

    const result = await service.hasAccess(1, 1, 'team', 10);

    expect(result).toBe(true);
  });

  it('should deny when not team member and no dept inheritance', async () => {
    mockUser('employee', false);
    // 1. isTeamMember — not a member
    mockQueryReturn([]);
    // 2. getTeamInfo — team with null department_id
    mockQueryReturn([{ id: 10, department_id: null }]);

    const result = await service.hasAccess(1, 1, 'team', 10);

    expect(result).toBe(false);
  });
});

// ============================================
// getAccessibleAreaIds
// ============================================

describe('getAccessibleAreaIds', () => {
  it('should return all areas for root user', async () => {
    mockUser('root', false);
    mockQueryReturn([{ id: 1 }, { id: 2 }, { id: 3 }]);

    const result = await service.getAccessibleAreaIds(1, 1);

    expect(result).toEqual([1, 2, 3]);
  });

  it('should return empty when user not found', async () => {
    mockUserNotFound();

    const result = await service.getAccessibleAreaIds(999, 1);

    expect(result).toEqual([]);
  });

  it('should return directly assigned areas for regular user', async () => {
    mockUser('admin', false);
    mockQueryReturn([{ area_id: 10 }, { area_id: 20 }]);

    const result = await service.getAccessibleAreaIds(1, 1);

    expect(result).toEqual([10, 20]);
  });
});

// ============================================
// getAccessibleDepartmentIds
// ============================================

describe('getAccessibleDepartmentIds', () => {
  it('should return all departments for root user', async () => {
    mockUser('root', false);
    mockQueryReturn([{ id: 1 }, { id: 2 }]);

    const result = await service.getAccessibleDepartmentIds(1, 1);

    expect(result).toEqual([1, 2]);
  });

  it('should return empty when user not found', async () => {
    mockUserNotFound();

    const result = await service.getAccessibleDepartmentIds(999, 1);

    expect(result).toEqual([]);
  });

  it('should combine direct + inherited departments', async () => {
    mockUser('admin', false);
    // Direct department permissions
    mockQueryReturn([{ department_id: 10 }]);
    // getAccessibleAreaIds flow: getUserInfo (again)
    mockUser('admin', false);
    // getAccessibleAreaIds: area permissions
    mockQueryReturn([{ area_id: 5 }]);
    // Inherited departments from area
    mockQueryReturn([{ id: 20 }]);

    const result = await service.getAccessibleDepartmentIds(1, 1);

    expect(result).toContain(10);
    expect(result).toContain(20);
  });
});

// ============================================
// getAccessibleTeamIds
// ============================================

describe('getAccessibleTeamIds', () => {
  it('should return all teams for user with full access', async () => {
    mockUser('admin', true);
    mockQueryReturn([{ id: 1 }, { id: 2 }, { id: 3 }]);

    const result = await service.getAccessibleTeamIds(1, 1);

    expect(result).toEqual([1, 2, 3]);
  });

  it('should return empty when user not found', async () => {
    mockUserNotFound();

    const result = await service.getAccessibleTeamIds(999, 1);

    expect(result).toEqual([]);
  });
});
