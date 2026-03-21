import { IS_ACTIVE } from '@assixx/shared/constants';
import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  ERROR_CODES,
  buildUserUpdateFields,
  handleDuplicateEntryError,
  isPgUniqueViolation,
  mapDbLogToAdminLog,
  mapDbUserToAdminUser,
  mapDbUserToRootUser,
} from './root.helpers.js';
import type { DbRootLogRow, DbUserRow, UpdateUserRequest } from './root.types.js';

// ============================================================================
// MOCK DATA FACTORIES
// ============================================================================

function createMockDbUserRow(overrides?: Partial<DbUserRow>): DbUserRow {
  return {
    id: 1,
    username: 'john.doe@example.com',
    email: 'john.doe@example.com',
    first_name: 'John',
    last_name: 'Doe',
    role: 'admin',
    position: null,
    notes: null,
    employee_number: '',
    employee_id: null,
    is_active: IS_ACTIVE.ACTIVE,
    tenant_id: 10,
    created_at: new Date('2025-01-15'),
    updated_at: new Date('2025-01-20'),
    ...overrides,
  };
}

function createMockDbLogRow(overrides?: Partial<DbRootLogRow>): DbRootLogRow {
  return {
    id: 100,
    user_id: 1,
    action: 'CREATE',
    entity_type: 'user',
    entity_id: null,
    details: null,
    ip_address: null,
    user_agent: null,
    created_at: new Date('2025-06-01'),
    ...overrides,
  };
}

// ============================================================================
// ERROR_CODES
// ============================================================================

describe('ERROR_CODES', () => {
  it('should contain all expected error code keys', () => {
    expect(ERROR_CODES.NOT_FOUND).toBe('NOT_FOUND');
    expect(ERROR_CODES.DUPLICATE_EMAIL).toBe('DUPLICATE_EMAIL');
    expect(ERROR_CODES.DUPLICATE_USERNAME).toBe('DUPLICATE_USERNAME');
    expect(ERROR_CODES.DUPLICATE_EMPLOYEE_NUMBER).toBe('DUPLICATE_EMPLOYEE_NUMBER');
    expect(ERROR_CODES.SELF_DELETE).toBe('SELF_DELETE');
    expect(ERROR_CODES.LAST_ROOT_USER).toBe('LAST_ROOT_USER');
    expect(ERROR_CODES.INSUFFICIENT_ROOT_USERS).toBe('INSUFFICIENT_ROOT_USERS');
    expect(ERROR_CODES.ALREADY_SCHEDULED).toBe('ALREADY_SCHEDULED');
  });

  it('should have exactly 8 error codes', () => {
    expect(Object.keys(ERROR_CODES)).toHaveLength(8);
  });
});

// ============================================================================
// MAPPERS
// ============================================================================

describe('mapDbUserToAdminUser', () => {
  it('should map required fields', () => {
    const row = createMockDbUserRow();
    const result = mapDbUserToAdminUser(row);

    expect(result.id).toBe(1);
    expect(result.username).toBe('john.doe@example.com');
    expect(result.email).toBe('john.doe@example.com');
    expect(result.firstName).toBe('John');
    expect(result.lastName).toBe('Doe');
    expect(result.isActive).toBe(1);
    expect(result.tenantId).toBe(10);
    expect(result.createdAt).toEqual(new Date('2025-01-15'));
    expect(result.updatedAt).toEqual(new Date('2025-01-20'));
  });

  it('should default firstName and lastName to empty string when null', () => {
    const row = createMockDbUserRow({ first_name: null, last_name: null });
    const result = mapDbUserToAdminUser(row);
    expect(result.firstName).toBe('');
    expect(result.lastName).toBe('');
  });

  it('should include optional fields when non-null', () => {
    const row = createMockDbUserRow({
      notes: 'Some notes',
      position: 'Manager',
      employee_number: 'EMP001',
    });
    const result = mapDbUserToAdminUser({
      ...row,
      tenant_name: 'Acme Corp',
      profile_picture: '/avatars/1.jpg',
    });
    expect(result.notes).toBe('Some notes');
    expect(result.position).toBe('Manager');
    expect(result.employeeNumber).toBe('EMP001');
    expect(result.tenantName).toBe('Acme Corp');
    expect(result.profilePicture).toBe('/avatars/1.jpg');
  });

  it('should include lastLogin when defined and not null', () => {
    const lastLogin = new Date('2025-06-01');
    const row = createMockDbUserRow({ last_login: lastLogin });
    const result = mapDbUserToAdminUser(row);
    expect(result.lastLogin).toEqual(lastLogin);
  });

  it('should NOT include employeeNumber when empty string', () => {
    const row = createMockDbUserRow({ employee_number: '' });
    const result = mapDbUserToAdminUser(row);
    expect(result.employeeNumber).toBeUndefined();
  });
});

describe('mapDbUserToRootUser', () => {
  it('should map required fields', () => {
    const row = createMockDbUserRow();
    const result = mapDbUserToRootUser(row);

    expect(result.id).toBe(1);
    expect(result.username).toBe('john.doe@example.com');
    expect(result.email).toBe('john.doe@example.com');
    expect(result.firstName).toBe('John');
    expect(result.lastName).toBe('Doe');
    expect(result.isActive).toBe(1);
  });

  it('should include optional fields when present', () => {
    const row = createMockDbUserRow({
      position: 'CTO',
      notes: 'Root user',
      employee_number: 'RT001',
      department_id: 3,
      employee_id: 'SCSRT101',
    });
    const result = mapDbUserToRootUser(row);
    expect(result.position).toBe('CTO');
    expect(result.notes).toBe('Root user');
    expect(result.employeeNumber).toBe('RT001');
    expect(result.departmentId).toBe(3);
    expect(result.employeeId).toBe('SCSRT101');
  });

  it('should NOT include department_id when null', () => {
    const row = createMockDbUserRow({ department_id: null });
    const result = mapDbUserToRootUser(row);
    expect(result.departmentId).toBeUndefined();
  });
});

describe('mapDbLogToAdminLog', () => {
  it('should map required fields', () => {
    const row = createMockDbLogRow();
    const result = mapDbLogToAdminLog(row);

    expect(result.id).toBe(100);
    expect(result.userId).toBe(1);
    expect(result.action).toBe('CREATE');
    expect(result.entityType).toBe('user');
    expect(result.createdAt).toEqual(new Date('2025-06-01'));
  });

  it('should default entityType to empty string when null', () => {
    const row = createMockDbLogRow({ entity_type: null });
    const result = mapDbLogToAdminLog(row);
    expect(result.entityType).toBe('');
  });

  it('should include optional fields when non-null', () => {
    const row = createMockDbLogRow({
      entity_id: 42,
      details: 'Created admin user',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
    });
    const result = mapDbLogToAdminLog(row);
    expect(result.entityId).toBe(42);
    expect(result.description).toBe('Created admin user');
    expect(result.ipAddress).toBe('192.168.1.1');
    expect(result.userAgent).toBe('Mozilla/5.0');
  });

  it('should NOT include optional fields when null', () => {
    const row = createMockDbLogRow();
    const result = mapDbLogToAdminLog(row);
    expect(result.entityId).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.ipAddress).toBeUndefined();
    expect(result.userAgent).toBeUndefined();
  });
});

// ============================================================================
// QUERY BUILDERS
// ============================================================================

describe('buildUserUpdateFields', () => {
  it('should return empty arrays for empty request', () => {
    const data: UpdateUserRequest = {};
    const result = buildUserUpdateFields(data);
    expect(result.fields).toHaveLength(0);
    expect(result.values).toHaveLength(0);
    expect(result.nextIndex).toBe(1);
  });

  it('should normalize email to lowercase and set username to same value', () => {
    const data: UpdateUserRequest = { email: '  John@Example.COM  ' };
    const result = buildUserUpdateFields(data);
    expect(result.fields).toEqual(['email = $1', 'username = $2']);
    expect(result.values).toEqual(['john@example.com', 'john@example.com']);
    expect(result.nextIndex).toBe(3);
  });

  it('should build firstName field', () => {
    const data: UpdateUserRequest = { firstName: 'Jane' };
    const result = buildUserUpdateFields(data);
    expect(result.fields).toEqual(['first_name = $1']);
    expect(result.values).toEqual(['Jane']);
  });

  it('should build all simple fields', () => {
    const data: UpdateUserRequest = {
      lastName: 'Doe',
      position: 'Manager',
      notes: 'Updated',
      employeeNumber: 'EMP002',
      isActive: 0,
      role: 'employee',
    };
    const result = buildUserUpdateFields(data);
    expect(result.fields).toHaveLength(6);
    expect(result.values).toHaveLength(6);
  });

  it('should increment paramIndex correctly with multiple fields', () => {
    const data: UpdateUserRequest = {
      email: 'test@test.com',
      firstName: 'A',
      lastName: 'B',
    };
    const result = buildUserUpdateFields(data);
    // email=$1, username=$2, first_name=$3, last_name=$4 → nextIndex=5
    expect(result.nextIndex).toBe(5);
    expect(result.fields).toHaveLength(4);
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

describe('isPgUniqueViolation', () => {
  it('should return true for error with code 23505', () => {
    const error = { code: '23505', message: 'unique violation' };
    expect(isPgUniqueViolation(error)).toBe(true);
  });

  it('should return false for different error code', () => {
    const error = { code: '23503', message: 'foreign key violation' };
    expect(isPgUniqueViolation(error)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isPgUniqueViolation(null)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(isPgUniqueViolation('error')).toBe(false);
    expect(isPgUniqueViolation(42)).toBe(false);
  });

  it('should return false for object without code', () => {
    expect(isPgUniqueViolation({ message: 'error' })).toBe(false);
  });

  it('should return false for object without message', () => {
    expect(isPgUniqueViolation({ code: '23505' })).toBe(false);
  });
});

describe('handleDuplicateEntryError', () => {
  it('should throw ConflictException for employee_number violation', () => {
    const error = {
      code: '23505',
      message: 'Key (employee_number)=(EMP1) already exists',
    };
    expect(() => handleDuplicateEntryError(error)).toThrow(ConflictException);
  });

  it('should throw ConflictException with DUPLICATE_EMAIL for email violation', () => {
    const error = {
      code: '23505',
      message: 'Key (email)=(a@b.com) already exists',
    };
    expect(() => handleDuplicateEntryError(error)).toThrow(ConflictException);
  });

  it('should throw ConflictException with DUPLICATE_USERNAME for username violation', () => {
    const error = {
      code: '23505',
      message: 'Key (username)=(john) already exists',
    };
    expect(() => handleDuplicateEntryError(error)).toThrow(ConflictException);
  });

  it('should NOT throw for non-unique-violation errors', () => {
    const error = { code: '23503', message: 'foreign key violation' };
    expect(() => handleDuplicateEntryError(error)).not.toThrow();
  });

  it('should NOT throw for non-object errors', () => {
    expect(() => handleDuplicateEntryError('random error')).not.toThrow();
  });

  it('should NOT throw for unique violation with unknown field', () => {
    const error = {
      code: '23505',
      message: 'Key (some_other_field)=(x) already exists',
    };
    expect(() => handleDuplicateEntryError(error)).not.toThrow();
  });
});
