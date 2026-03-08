import { IS_ACTIVE } from '@assixx/shared/constants';
import { describe, expect, it } from 'vitest';

import {
  addDepartmentInfo,
  addTeamInfo,
  buildUpdateFields,
  buildUserListWhereClause,
  isUniqueConstraintViolation,
  mapSortField,
  toSafeUserResponse,
} from './users.helpers.js';
import type {
  SafeUserResponse,
  UserDepartmentRow,
  UserRow,
  UserTeamRow,
} from './users.types.js';

// =============================================================
// Test Fixtures
// =============================================================

function makeUserRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 1,
    uuid: 'test-uuid-v7',
    tenant_id: 10,
    email: 'max@example.com',
    password: 'hashed-secret',
    role: 'employee',
    username: 'maxm',
    first_name: 'Max',
    last_name: 'Mustermann',
    is_active: IS_ACTIVE.ACTIVE,
    last_login: null,
    created_at: new Date('2025-01-01'),
    updated_at: null,
    phone: null,
    address: null,
    position: null,
    employee_number: 'EMP001',
    profile_picture: null,
    emergency_contact: null,
    date_of_birth: null,
    has_full_access: 0,
    ...overrides,
  };
}

function makeEmptyResponse(): SafeUserResponse {
  return {
    id: 0,
    uuid: '',
    tenantId: 0,
    email: '',
    role: '',
    username: '',
    firstName: null,
    lastName: null,
    isActive: 0,
    lastLogin: null,
    createdAt: '',
    updatedAt: null,
    phone: null,
    address: null,
    position: null,
    employeeNumber: null,
    profilePicture: null,
    emergencyContact: null,
    dateOfBirth: null,
    availabilityStatus: null,
    availabilityStart: null,
    availabilityEnd: null,
    availabilityNotes: null,
    hasFullAccess: null,
  };
}

// =============================================================
// toSafeUserResponse
// =============================================================

describe('toSafeUserResponse', () => {
  it('strips password from output', () => {
    const row = makeUserRow();
    const result = toSafeUserResponse(row);

    expect(result).not.toHaveProperty('password');
  });

  it('converts snake_case to camelCase', () => {
    const row = makeUserRow();
    const result = toSafeUserResponse(row);

    expect(result.email).toBe('max@example.com');
    expect(result.firstName).toBe('Max');
    expect(result.lastName).toBe('Mustermann');
    expect(result.employeeNumber).toBe('EMP001');
  });

  it('preserves is_active as number (not boolean)', () => {
    const row = makeUserRow({ is_active: IS_ACTIVE.ARCHIVED });
    const result = toSafeUserResponse(row);

    expect(result.isActive).toBe(3);
  });
});

// =============================================================
// addDepartmentInfo
// =============================================================

describe('addDepartmentInfo', () => {
  it('adds department IDs and names to response', () => {
    const response = makeEmptyResponse();
    const departments: UserDepartmentRow[] = [
      {
        user_id: 1,
        department_id: 10,
        department_name: 'Engineering',
        is_primary: true,
      },
      {
        user_id: 1,
        department_id: 20,
        department_name: 'QA',
        is_primary: false,
      },
    ];

    addDepartmentInfo(response, departments);

    expect(response.departmentIds).toEqual([10, 20]);
    expect(response.departmentNames).toEqual(['Engineering', 'QA']);
  });

  it('handles empty departments array', () => {
    const response = makeEmptyResponse();
    addDepartmentInfo(response, []);

    expect(response.departmentIds).toEqual([]);
    expect(response.departmentNames).toEqual([]);
  });
});

// =============================================================
// addTeamInfo
// =============================================================

describe('addTeamInfo', () => {
  it('adds team IDs, names, and inheritance from primary team', () => {
    const response = makeEmptyResponse();
    const teams: UserTeamRow[] = [
      {
        user_id: 1,
        team_id: 100,
        team_name: 'Alpha',
        team_department_id: 10,
        team_department_name: 'Engineering',
        team_area_id: 5,
        team_area_name: 'Produktion',
      },
      {
        user_id: 1,
        team_id: 200,
        team_name: 'Beta',
        team_department_id: 20,
        team_department_name: 'QA',
        team_area_id: null,
        team_area_name: null,
      },
    ];

    addTeamInfo(response, teams);

    expect(response.teamIds).toEqual([100, 200]);
    expect(response.teamNames).toEqual(['Alpha', 'Beta']);
    // Inheritance from first (primary) team
    expect(response.teamDepartmentId).toBe(10);
    expect(response.teamDepartmentName).toBe('Engineering');
    expect(response.teamAreaId).toBe(5);
    expect(response.teamAreaName).toBe('Produktion');
  });

  it('does not set inheritance fields for empty teams', () => {
    const response = makeEmptyResponse();
    addTeamInfo(response, []);

    expect(response.teamIds).toEqual([]);
    expect(response.teamNames).toEqual([]);
    expect(response.teamDepartmentId).toBeUndefined();
  });
});

// =============================================================
// mapSortField (SQL injection prevention)
// =============================================================

describe('mapSortField', () => {
  it.each([
    ['firstName', 'first_name'],
    ['lastName', 'last_name'],
    ['email', 'email'],
    ['createdAt', 'created_at'],
    ['lastLogin', 'last_login'],
  ])('should map "%s" to "%s"', (input, expected) => {
    expect(mapSortField(input)).toBe(expected);
  });

  it('should fallback to created_at for unknown field', () => {
    expect(mapSortField('DROP TABLE users')).toBe('created_at');
  });

  it('should fallback to created_at for empty string', () => {
    expect(mapSortField('')).toBe('created_at');
  });
});

// =============================================================
// isUniqueConstraintViolation
// =============================================================

describe('isUniqueConstraintViolation', () => {
  it('should return true for matching PostgreSQL unique violation', () => {
    const error = { code: '23505', constraint: 'users_email_unique' };

    expect(isUniqueConstraintViolation(error, 'email')).toBe(true);
  });

  it('should return false for wrong error code', () => {
    const error = { code: '42P01', constraint: 'users_email_unique' };

    expect(isUniqueConstraintViolation(error, 'email')).toBe(false);
  });

  it('should return false when constraint does not contain field name', () => {
    const error = { code: '23505', constraint: 'users_username_unique' };

    expect(isUniqueConstraintViolation(error, 'email')).toBe(false);
  });

  it('should return false for null error', () => {
    expect(isUniqueConstraintViolation(null, 'email')).toBe(false);
  });

  it('should return false for non-object error', () => {
    expect(isUniqueConstraintViolation('string error', 'email')).toBe(false);
  });
});

// =============================================================
// buildUpdateFields
// =============================================================

describe('buildUpdateFields', () => {
  it('should include updated_at by default', () => {
    const { updates } = buildUpdateFields({}, undefined);

    expect(updates).toContain('updated_at = NOW()');
  });

  it('should build update clause for provided fields', () => {
    const data = { email: 'new@example.com', firstName: 'John' };

    const { updates, params, paramIndex } = buildUpdateFields(data, undefined);

    expect(updates).toContain('email = $1');
    expect(updates).toContain('first_name = $2');
    expect(params).toEqual(['new@example.com', 'John']);
    expect(paramIndex).toBe(3);
  });

  it('should handle isActive as number pass-through', () => {
    const data = { isActive: 3 };

    const { updates, params } = buildUpdateFields(data, undefined);

    expect(updates).toContain('is_active = $1');
    expect(params).toContain(3);
  });

  it('should handle hasFullAccess as 0/1 conversion', () => {
    const { params: paramsTrue } = buildUpdateFields({}, true);
    const { params: paramsFalse } = buildUpdateFields({}, false);

    expect(paramsTrue).toContain(1);
    expect(paramsFalse).toContain(0);
  });
});

// =============================================================
// buildUserListWhereClause
// =============================================================

describe('buildUserListWhereClause', () => {
  it('should always include tenant_id and exclude deleted by default', () => {
    const { whereClause, params } = buildUserListWhereClause(
      42,
      {} as Parameters<typeof buildUserListWhereClause>[1],
    );

    expect(whereClause).toContain('tenant_id = $1');
    expect(whereClause).toContain(`is_active != ${IS_ACTIVE.DELETED}`);
    expect(params[0]).toBe(42);
  });

  it('should filter by role when provided', () => {
    const query = { role: 'admin' } as Parameters<
      typeof buildUserListWhereClause
    >[1];

    const { whereClause, params } = buildUserListWhereClause(1, query);

    expect(whereClause).toContain('role = $2');
    expect(params).toContain('admin');
  });

  it('should use explicit isActive filter instead of default exclusion', () => {
    const query = { isActive: 0 } as Parameters<
      typeof buildUserListWhereClause
    >[1];

    const { whereClause } = buildUserListWhereClause(1, query);

    expect(whereClause).toContain('is_active = $2');
    expect(whereClause).not.toContain(`is_active != ${IS_ACTIVE.DELETED}`);
  });

  it('should add ILIKE search across name and email', () => {
    const query = { search: 'john' } as Parameters<
      typeof buildUserListWhereClause
    >[1];

    const { whereClause, params } = buildUserListWhereClause(1, query);

    expect(whereClause).toContain('first_name ILIKE');
    expect(whereClause).toContain('last_name ILIKE');
    expect(whereClause).toContain('email ILIKE');
    expect(params).toContain('%john%');
  });
});
