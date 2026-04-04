/**
 * User Repository – Unit Tests
 *
 * Tests all public methods across 4 sections:
 * - Safe methods (always filter is_active = 1)
 * - Auth methods (special password/login handling)
 * - Admin methods (include deleted users)
 * - Utility methods (UUID/ID resolution, email uniqueness)
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database.service.js';
import { UserRepository } from './user.repository.js';

// =============================================================
// Constants & Helpers
// =============================================================

const TENANT_ID = 42;
const USER_ID = 7;
const USER_UUID = '019539a0-0000-7000-8000-000000000001';

function createMockDb() {
  const qf = vi.fn();
  const qof = vi.fn();
  const sqf = vi.fn();
  const sqof = vi.fn();
  return {
    query: qf,
    tenantQuery: qf,
    queryOne: qof,
    tenantQueryOne: qof,
    systemQuery: sqf,
    systemQueryOne: sqof,
  };
}
type MockDb = ReturnType<typeof createMockDb>;

function createUserRow(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: USER_ID,
    uuid: USER_UUID,
    tenant_id: TENANT_ID,
    email: 'max@example.com',
    username: 'mmueller',
    first_name: 'Max',
    last_name: 'Müller',
    role: 'employee',
    is_active: 1,
    position: 'Techniker',
    profile_picture: null,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

// =============================================================
// Tests
// =============================================================

describe('UserRepository – safe methods', () => {
  let repo: UserRepository;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    repo = new UserRepository(mockDb as unknown as DatabaseService);
  });

  // -----------------------------------------------------------
  // findById
  // -----------------------------------------------------------

  describe('findById()', () => {
    it('should return user when found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(createUserRow());

      const result = await repo.findById(USER_ID, TENANT_ID);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(USER_ID);
      expect(result?.email).toBe('max@example.com');
    });

    it('should return null when not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await repo.findById(999, TENANT_ID);

      expect(result).toBeNull();
    });

    it('should query with IS_ACTIVE filter', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await repo.findById(USER_ID, TENANT_ID);

      const sql = mockDb.queryOne.mock.calls[0]?.[0] as string;
      expect(sql).toContain('is_active = 1');
      expect(sql).toContain('id = $1');
      expect(sql).toContain('tenant_id = $2');
    });
  });

  // -----------------------------------------------------------
  // findByUuid
  // -----------------------------------------------------------

  describe('findByUuid()', () => {
    it('should return user when found by UUID', async () => {
      mockDb.queryOne.mockResolvedValueOnce(createUserRow());

      const result = await repo.findByUuid(USER_UUID, TENANT_ID);

      expect(result?.uuid).toBe(USER_UUID);
      const params = mockDb.queryOne.mock.calls[0]?.[1] as unknown[];
      expect(params).toEqual([USER_UUID, TENANT_ID]);
    });

    it('should return null when UUID not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await repo.findByUuid('nonexistent', TENANT_ID);

      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------
  // findByEmail
  // -----------------------------------------------------------

  describe('findByEmail()', () => {
    it('should query with case-insensitive email', async () => {
      mockDb.queryOne.mockResolvedValueOnce(createUserRow());

      await repo.findByEmail('Max@Example.COM', TENANT_ID);

      const sql = mockDb.queryOne.mock.calls[0]?.[0] as string;
      expect(sql).toContain('LOWER(email) = LOWER($1)');
    });
  });

  // -----------------------------------------------------------
  // findMinimalByUuid / findMinimalById
  // -----------------------------------------------------------

  describe('findMinimalByUuid()', () => {
    it('should return minimal fields', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        id: USER_ID,
        uuid: USER_UUID,
        first_name: 'Max',
        last_name: 'Müller',
        email: 'max@example.com',
      });

      const result = await repo.findMinimalByUuid(USER_UUID, TENANT_ID);

      expect(result?.id).toBe(USER_ID);
      expect(result?.first_name).toBe('Max');
    });
  });

  describe('findMinimalById()', () => {
    it('should return minimal fields by ID', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        id: USER_ID,
        uuid: USER_UUID,
        first_name: 'Max',
        last_name: 'Müller',
        email: 'max@example.com',
      });

      const result = await repo.findMinimalById(USER_ID, TENANT_ID);

      expect(result?.uuid).toBe(USER_UUID);
    });
  });

  // -----------------------------------------------------------
  // countByRole / countAll
  // -----------------------------------------------------------

  describe('countByRole()', () => {
    it('should return parsed count', async () => {
      mockDb.systemQueryOne.mockResolvedValueOnce({ count: '15' });

      const result = await repo.countByRole('employee', TENANT_ID);

      expect(result).toBe(15);
    });

    it('should return 0 when no result', async () => {
      mockDb.systemQueryOne.mockResolvedValueOnce(null);

      const result = await repo.countByRole('admin', TENANT_ID);

      expect(result).toBe(0);
    });
  });

  describe('countAll()', () => {
    it('should return total active user count', async () => {
      mockDb.systemQueryOne.mockResolvedValueOnce({ count: '100' });

      const result = await repo.countAll(TENANT_ID);

      expect(result).toBe(100);
    });

    it('should return 0 when null result', async () => {
      mockDb.systemQueryOne.mockResolvedValueOnce(null);

      const result = await repo.countAll(TENANT_ID);

      expect(result).toBe(0);
    });
  });

  // -----------------------------------------------------------
  // findMany
  // -----------------------------------------------------------

  describe('findMany()', () => {
    it('should return users with default options', async () => {
      mockDb.query.mockResolvedValueOnce([createUserRow(), createUserRow({ id: 8 })]);

      const result = await repo.findMany(TENANT_ID);

      expect(result).toHaveLength(2);
      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('ORDER BY created_at DESC');
      expect(sql).toContain("role != 'dummy'");
    });

    it('should filter by role when provided', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await repo.findMany(TENANT_ID, { role: 'admin' });

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('role = $2');
      expect(sql).not.toContain("role != 'dummy'");
    });

    it('should sanitize orderBy to prevent SQL injection', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await repo.findMany(TENANT_ID, { orderBy: 'DROP TABLE; --' });

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('ORDER BY created_at');
      expect(sql).not.toContain('DROP');
    });

    it('should accept valid orderBy columns', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await repo.findMany(TENANT_ID, { orderBy: 'email', orderDir: 'ASC' });

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('ORDER BY email ASC');
    });

    it('should sanitize orderDir to only allow ASC/DESC', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await repo.findMany(TENANT_ID, {
        orderDir: 'INVALID' as 'ASC' | 'DESC',
      });

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('DESC');
      expect(sql).not.toContain('INVALID');
    });

    it('should apply limit and offset params', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await repo.findMany(TENANT_ID, { limit: 25, offset: 50 });

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toContain(25);
      expect(params).toContain(50);
    });
  });

  // -----------------------------------------------------------
  // exists / existsByUuid
  // -----------------------------------------------------------

  describe('exists()', () => {
    it('should return true when user exists', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ exists: true });

      const result = await repo.exists(USER_ID, TENANT_ID);

      expect(result).toBe(true);
    });

    it('should return false when user does not exist', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ exists: false });

      const result = await repo.exists(999, TENANT_ID);

      expect(result).toBe(false);
    });

    it('should return false when queryOne returns null', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await repo.exists(USER_ID, TENANT_ID);

      expect(result).toBe(false);
    });
  });

  describe('existsByUuid()', () => {
    it('should check existence by UUID', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ exists: true });

      const result = await repo.existsByUuid(USER_UUID, TENANT_ID);

      expect(result).toBe(true);
      const params = mockDb.queryOne.mock.calls[0]?.[1] as unknown[];
      expect(params).toEqual([USER_UUID, TENANT_ID]);
    });

    it('should return false when null', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await repo.existsByUuid('none', TENANT_ID);

      expect(result).toBe(false);
    });
  });

  // -----------------------------------------------------------
  // filterActiveIds
  // -----------------------------------------------------------

  describe('filterActiveIds()', () => {
    it('should return only active user IDs', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1 }, { id: 3 }]);

      const result = await repo.filterActiveIds([1, 2, 3], TENANT_ID);

      expect(result).toEqual([1, 3]);
      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('ANY($1::int[])');
    });

    it('should return empty array for empty input', async () => {
      const result = await repo.filterActiveIds([], TENANT_ID);

      expect(result).toEqual([]);
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------
  // getRole
  // -----------------------------------------------------------

  describe('getRole()', () => {
    it('should return role string', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ role: 'admin' });

      const result = await repo.getRole(USER_ID, TENANT_ID);

      expect(result).toBe('admin');
    });

    it('should return null when user not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await repo.getRole(999, TENANT_ID);

      expect(result).toBeNull();
    });
  });
});

// =============================================================
// Auth Methods
// =============================================================

describe('UserRepository – auth methods', () => {
  let repo: UserRepository;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    repo = new UserRepository(mockDb as unknown as DatabaseService);
  });

  describe('findForAuth()', () => {
    it('should return user with password regardless of status', async () => {
      mockDb.systemQueryOne.mockResolvedValueOnce(
        createUserRow({ password: 'hashed', last_login: null }),
      );

      const result = await repo.findForAuth('max@example.com');

      expect(result).not.toBeNull();
      const sql = mockDb.systemQueryOne.mock.calls[0]?.[0] as string;
      expect(sql).toContain('password');
      // No is_active filter in WHERE — only in SELECT column list
      expect(sql).not.toMatch(/WHERE.*is_active\s*=/s);
    });

    it('should query with case-insensitive email', async () => {
      mockDb.systemQueryOne.mockResolvedValueOnce(null);

      await repo.findForAuth('MAX@EXAMPLE.COM');

      const sql = mockDb.systemQueryOne.mock.calls[0]?.[0] as string;
      expect(sql).toContain('LOWER(email) = LOWER($1)');
    });
  });

  describe('findForAuthById()', () => {
    it('should return user with password without is_active filter', async () => {
      mockDb.systemQueryOne.mockResolvedValueOnce(
        createUserRow({ password: 'hashed', last_login: null }),
      );

      const result = await repo.findForAuthById(USER_ID, TENANT_ID);

      expect(result).not.toBeNull();
      const sql = mockDb.systemQueryOne.mock.calls[0]?.[0] as string;
      expect(sql).toContain('password');
      // No is_active filter in WHERE — only in SELECT column list
      expect(sql).not.toMatch(/WHERE.*is_active\s*=/s);
    });
  });

  describe('getPasswordHash()', () => {
    it('should return password hash for active user', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ password: 'bcrypt-hash' });

      const result = await repo.getPasswordHash(USER_ID, TENANT_ID);

      expect(result).toBe('bcrypt-hash');
      const sql = mockDb.queryOne.mock.calls[0]?.[0] as string;
      expect(sql).toContain('is_active = 1');
    });

    it('should return null when user not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await repo.getPasswordHash(999, TENANT_ID);

      expect(result).toBeNull();
    });
  });

  describe('updateLastLogin()', () => {
    it('should update last_login timestamp', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]);

      await repo.updateLastLogin(USER_ID);

      const sql = mockDb.systemQuery.mock.calls[0]?.[0] as string;
      expect(sql).toContain('UPDATE users SET last_login = NOW()');
      const params = mockDb.systemQuery.mock.calls[0]?.[1] as unknown[];
      expect(params).toEqual([USER_ID]);
    });
  });
});

// =============================================================
// Admin Methods
// =============================================================

describe('UserRepository – admin methods', () => {
  let repo: UserRepository;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    repo = new UserRepository(mockDb as unknown as DatabaseService);
  });

  describe('findByIdIncludeDeleted()', () => {
    it('should return user without is_active filter', async () => {
      mockDb.queryOne.mockResolvedValueOnce(createUserRow({ is_active: 4 }));

      const result = await repo.findByIdIncludeDeleted(USER_ID, TENANT_ID);

      expect(result).not.toBeNull();
      const sql = mockDb.queryOne.mock.calls[0]?.[0] as string;
      // No is_active filter in WHERE — only in SELECT column list
      expect(sql).not.toMatch(/WHERE.*is_active\s*=/s);
    });
  });

  describe('countByStatus()', () => {
    it('should count users with specific status', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '3' });

      const result = await repo.countByStatus(IS_ACTIVE.DELETED, TENANT_ID);

      expect(result).toBe(3);
      const params = mockDb.queryOne.mock.calls[0]?.[1] as unknown[];
      expect(params).toEqual([4, TENANT_ID]);
    });

    it('should return 0 when null result', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await repo.countByStatus(IS_ACTIVE.ACTIVE, TENANT_ID);

      expect(result).toBe(0);
    });
  });

  describe('getStatusCounts()', () => {
    it('should return Map with status counts', async () => {
      mockDb.query.mockResolvedValueOnce([
        { is_active: 0, count: '2' },
        { is_active: 1, count: '50' },
        { is_active: 3, count: '5' },
        { is_active: 4, count: '10' },
      ]);

      const result = await repo.getStatusCounts(TENANT_ID);

      expect(result).toBeInstanceOf(Map);
      expect(result.get(IS_ACTIVE.ACTIVE)).toBe(50);
      expect(result.get(IS_ACTIVE.INACTIVE)).toBe(2);
      expect(result.get(IS_ACTIVE.ARCHIVED)).toBe(5);
      expect(result.get(IS_ACTIVE.DELETED)).toBe(10);
    });

    it('should return empty Map when no users', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await repo.getStatusCounts(TENANT_ID);

      expect(result.size).toBe(0);
    });
  });
});

// =============================================================
// Utility Methods
// =============================================================

describe('UserRepository – utility methods', () => {
  let repo: UserRepository;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    repo = new UserRepository(mockDb as unknown as DatabaseService);
  });

  describe('resolveUuidToId()', () => {
    it('should return numeric ID for UUID', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: USER_ID });

      const result = await repo.resolveUuidToId(USER_UUID, TENANT_ID);

      expect(result).toBe(USER_ID);
    });

    it('should return null when UUID not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await repo.resolveUuidToId('nonexistent', TENANT_ID);

      expect(result).toBeNull();
    });
  });

  describe('resolveIdToUuid()', () => {
    it('should return UUID for numeric ID', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ uuid: USER_UUID });

      const result = await repo.resolveIdToUuid(USER_ID, TENANT_ID);

      expect(result).toBe(USER_UUID);
    });

    it('should return null when ID not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await repo.resolveIdToUuid(999, TENANT_ID);

      expect(result).toBeNull();
    });
  });

  describe('isEmailTaken()', () => {
    it('should return true when email exists', async () => {
      mockDb.systemQueryOne.mockResolvedValueOnce({ exists: true });

      const result = await repo.isEmailTaken('taken@example.com', TENANT_ID);

      expect(result).toBe(true);
    });

    it('should return false when email available', async () => {
      mockDb.systemQueryOne.mockResolvedValueOnce({ exists: false });

      const result = await repo.isEmailTaken('free@example.com', TENANT_ID);

      expect(result).toBe(false);
    });

    it('should exclude own user ID when provided', async () => {
      mockDb.systemQueryOne.mockResolvedValueOnce({ exists: false });

      await repo.isEmailTaken('my@example.com', TENANT_ID, USER_ID);

      const sql = mockDb.systemQueryOne.mock.calls[0]?.[0] as string;
      expect(sql).toContain('id != $3');
      const params = mockDb.systemQueryOne.mock.calls[0]?.[1] as unknown[];
      expect(params).toEqual(['my@example.com', TENANT_ID, USER_ID]);
    });

    it('should not add exclude clause when excludeId undefined', async () => {
      mockDb.systemQueryOne.mockResolvedValueOnce({ exists: false });

      await repo.isEmailTaken('test@example.com', TENANT_ID);

      const sql = mockDb.systemQueryOne.mock.calls[0]?.[0] as string;
      expect(sql).not.toContain('id !=');
    });

    it('should lowercase email before querying', async () => {
      mockDb.systemQueryOne.mockResolvedValueOnce({ exists: false });

      await repo.isEmailTaken('Test@Example.COM', TENANT_ID);

      const params = mockDb.systemQueryOne.mock.calls[0]?.[1] as unknown[];
      expect(params[0]).toBe('test@example.com');
    });

    it('should return false when systemQueryOne returns null', async () => {
      mockDb.systemQueryOne.mockResolvedValueOnce(null);

      const result = await repo.isEmailTaken('x@x.com', TENANT_ID);

      expect(result).toBe(false);
    });
  });
});

// =============================================================
// IS_ACTIVE constant (from @assixx/shared/constants)
// =============================================================

describe('IS_ACTIVE', () => {
  it('should have correct values', () => {
    expect(IS_ACTIVE.INACTIVE).toBe(0);
    expect(IS_ACTIVE.ACTIVE).toBe(1);
    expect(IS_ACTIVE.ARCHIVED).toBe(3);
    expect(IS_ACTIVE.DELETED).toBe(4);
  });
});
