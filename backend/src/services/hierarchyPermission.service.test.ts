/**
 * Unit tests for HierarchyPermissionService
 *
 * Phase 13 Batch C (C2): HOCH — hasAccess flow + getAccessible*Ids with mocked execute().
 * Uses vi.mock() for utils/db.js and utils/logger.js.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Import AFTER mocking
import { hierarchyPermissionService } from './hierarchyPermission.service.js';

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));

vi.mock('../utils/db.js', () => ({
  execute: mockExecute,
  RowDataPacket: class {},
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// ============================================
// Helpers
// ============================================

/** Mock execute to return [rows, []] tuple */
function mockExecuteReturn(rows: unknown[]) {
  mockExecute.mockResolvedValueOnce([rows, []]);
}

/** Shortcut for mocking user query (always the first execute call in hasAccess) */
function mockUser(role: string, hasFullAccess: boolean) {
  mockExecuteReturn([{ id: 1, role, has_full_access: hasFullAccess }]);
}

/** Mock user not found */
function mockUserNotFound() {
  mockExecuteReturn([]);
}

beforeEach(() => {
  mockExecute.mockReset();
});

// ============================================
// hasAccess — Core Flow
// ============================================

describe('hasAccess', () => {
  it('should return false when user not found', async () => {
    mockUserNotFound();

    const result = await hierarchyPermissionService.hasAccess(
      999,
      1,
      'area',
      1,
    );

    expect(result).toBe(false);
  });

  it('should return true for root user', async () => {
    mockUser('root', false);

    const result = await hierarchyPermissionService.hasAccess(1, 1, 'area', 1);

    expect(result).toBe(true);
  });

  it('should return true for user with has_full_access', async () => {
    mockUser('admin', true);

    const result = await hierarchyPermissionService.hasAccess(
      1,
      1,
      'department',
      5,
    );

    expect(result).toBe(true);
  });

  it('should return false for unknown resource type', async () => {
    mockUser('employee', false);

    const result = await hierarchyPermissionService.hasAccess(
      1,
      1,
      'unknown' as never,
      1,
    );

    expect(result).toBe(false);
  });

  it('should return false on error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB down'));

    const result = await hierarchyPermissionService.hasAccess(1, 1, 'area', 1);

    expect(result).toBe(false);
  });

  it('should default permission to read', async () => {
    mockUser('employee', false);
    // Area permission check: can_read=true
    mockExecuteReturn([
      { can_read: true, can_write: false, can_delete: false },
    ]);

    const result = await hierarchyPermissionService.hasAccess(1, 1, 'area', 1);

    expect(result).toBe(true);
  });
});

// ============================================
// hasAccess — Area Access
// ============================================

describe('hasAccess — area', () => {
  it('should grant access when user has area permission with read', async () => {
    mockUser('admin', false);
    mockExecuteReturn([
      { can_read: true, can_write: false, can_delete: false },
    ]);

    const result = await hierarchyPermissionService.hasAccess(
      1,
      1,
      'area',
      10,
      'read',
    );

    expect(result).toBe(true);
  });

  it('should deny access when user has no area permission', async () => {
    mockUser('admin', false);
    mockExecuteReturn([]);

    const result = await hierarchyPermissionService.hasAccess(
      1,
      1,
      'area',
      10,
      'write',
    );

    expect(result).toBe(false);
  });

  it('should deny access when permission level insufficient', async () => {
    mockUser('admin', false);
    mockExecuteReturn([
      { can_read: true, can_write: false, can_delete: false },
    ]);

    const result = await hierarchyPermissionService.hasAccess(
      1,
      1,
      'area',
      10,
      'delete',
    );

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
    mockExecuteReturn([{ can_read: true, can_write: true, can_delete: false }]);

    const result = await hierarchyPermissionService.hasAccess(
      1,
      1,
      'department',
      5,
      'write',
    );

    expect(result).toBe(true);
  });

  it('should inherit access from area when direct dept permission absent', async () => {
    mockUser('admin', false);
    // No direct dept permission
    mockExecuteReturn([]);
    // Department info with area_id
    mockExecuteReturn([{ id: 5, area_id: 3 }]);
    // Area permission check
    mockExecuteReturn([
      { can_read: true, can_write: false, can_delete: false },
    ]);

    const result = await hierarchyPermissionService.hasAccess(
      1,
      1,
      'department',
      5,
      'read',
    );

    expect(result).toBe(true);
  });

  it('should deny when no dept permission and dept has no area', async () => {
    mockUser('admin', false);
    // No direct dept permission
    mockExecuteReturn([]);
    // Department info with null area_id
    mockExecuteReturn([{ id: 5, area_id: null }]);

    const result = await hierarchyPermissionService.hasAccess(
      1,
      1,
      'department',
      5,
      'read',
    );

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
    mockExecuteReturn([{ user_id: 1 }]);

    const result = await hierarchyPermissionService.hasAccess(1, 1, 'team', 10);

    expect(result).toBe(true);
  });

  it('should deny when not team member and no dept inheritance', async () => {
    mockUser('employee', false);
    // 1. isTeamMember — not a member
    mockExecuteReturn([]);
    // 2. getTeamInfo — team with null department_id
    mockExecuteReturn([{ id: 10, department_id: null }]);

    const result = await hierarchyPermissionService.hasAccess(1, 1, 'team', 10);

    expect(result).toBe(false);
  });
});

// ============================================
// getAccessibleAreaIds
// ============================================

describe('getAccessibleAreaIds', () => {
  it('should return all areas for root user', async () => {
    mockUser('root', false);
    mockExecuteReturn([{ id: 1 }, { id: 2 }, { id: 3 }]);

    const result = await hierarchyPermissionService.getAccessibleAreaIds(1, 1);

    expect(result).toEqual([1, 2, 3]);
  });

  it('should return empty when user not found', async () => {
    mockUserNotFound();

    const result = await hierarchyPermissionService.getAccessibleAreaIds(
      999,
      1,
    );

    expect(result).toEqual([]);
  });

  it('should return directly assigned areas for regular user', async () => {
    mockUser('admin', false);
    mockExecuteReturn([{ area_id: 10 }, { area_id: 20 }]);

    const result = await hierarchyPermissionService.getAccessibleAreaIds(1, 1);

    expect(result).toEqual([10, 20]);
  });
});

// ============================================
// getAccessibleDepartmentIds
// ============================================

describe('getAccessibleDepartmentIds', () => {
  it('should return all departments for root user', async () => {
    mockUser('root', false);
    mockExecuteReturn([{ id: 1 }, { id: 2 }]);

    const result = await hierarchyPermissionService.getAccessibleDepartmentIds(
      1,
      1,
    );

    expect(result).toEqual([1, 2]);
  });

  it('should return empty when user not found', async () => {
    mockUserNotFound();

    const result = await hierarchyPermissionService.getAccessibleDepartmentIds(
      999,
      1,
    );

    expect(result).toEqual([]);
  });

  it('should combine direct + inherited departments', async () => {
    mockUser('admin', false);
    // Direct department permissions
    mockExecuteReturn([{ department_id: 10 }]);
    // getAccessibleAreaIds flow: getUserInfo (again)
    mockUser('admin', false);
    // getAccessibleAreaIds: area permissions
    mockExecuteReturn([{ area_id: 5 }]);
    // Inherited departments from area
    mockExecuteReturn([{ id: 20 }]);

    const result = await hierarchyPermissionService.getAccessibleDepartmentIds(
      1,
      1,
    );

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
    mockExecuteReturn([{ id: 1 }, { id: 2 }, { id: 3 }]);

    const result = await hierarchyPermissionService.getAccessibleTeamIds(1, 1);

    expect(result).toEqual([1, 2, 3]);
  });

  it('should return empty when user not found', async () => {
    mockUserNotFound();

    const result = await hierarchyPermissionService.getAccessibleTeamIds(
      999,
      1,
    );

    expect(result).toEqual([]);
  });
});
