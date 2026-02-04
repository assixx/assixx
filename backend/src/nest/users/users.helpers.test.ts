import { describe, expect, it } from 'vitest';

import {
  buildUpdateFields,
  buildUserListWhereClause,
  isUniqueConstraintViolation,
  mapSortField,
} from './users.helpers.js';

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
    expect(whereClause).toContain('is_active != 4');
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
    expect(whereClause).not.toContain('is_active != 4');
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
