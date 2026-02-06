import { describe, expect, it } from 'vitest';

import { CheckUserRoleSchema } from './check-user-role.dto.js';
import { RoleEnumSchema, RoleIdParamSchema } from './role-id-param.dto.js';

// =============================================================
// RoleEnumSchema
// =============================================================

describe('RoleEnumSchema', () => {
  it('should accept admin', () => {
    expect(RoleEnumSchema.safeParse('admin').success).toBe(true);
  });

  it('should accept employee', () => {
    expect(RoleEnumSchema.safeParse('employee').success).toBe(true);
  });

  it('should accept root', () => {
    expect(RoleEnumSchema.safeParse('root').success).toBe(true);
  });

  it('should reject invalid role', () => {
    expect(RoleEnumSchema.safeParse('manager').success).toBe(false);
    expect(RoleEnumSchema.safeParse('superadmin').success).toBe(false);
  });

  it('should reject empty string', () => {
    expect(RoleEnumSchema.safeParse('').success).toBe(false);
  });
});

// =============================================================
// RoleIdParamSchema
// =============================================================

describe('RoleIdParamSchema', () => {
  it('should accept valid role as id', () => {
    expect(RoleIdParamSchema.safeParse({ id: 'admin' }).success).toBe(true);
    expect(RoleIdParamSchema.safeParse({ id: 'root' }).success).toBe(true);
  });

  it('should reject invalid role', () => {
    expect(RoleIdParamSchema.safeParse({ id: 'invalid' }).success).toBe(false);
  });

  it('should reject missing id', () => {
    expect(RoleIdParamSchema.safeParse({}).success).toBe(false);
  });
});

// =============================================================
// CheckUserRoleSchema
// =============================================================

describe('CheckUserRoleSchema', () => {
  const valid = { userId: 1, requiredRole: 'admin' as const };

  it('should accept valid check request', () => {
    expect(CheckUserRoleSchema.safeParse(valid).success).toBe(true);
  });

  it('should reject non-positive userId', () => {
    expect(CheckUserRoleSchema.safeParse({ ...valid, userId: 0 }).success).toBe(
      false,
    );
    expect(
      CheckUserRoleSchema.safeParse({ ...valid, userId: -1 }).success,
    ).toBe(false);
  });

  it('should reject non-integer userId', () => {
    expect(
      CheckUserRoleSchema.safeParse({ ...valid, userId: 1.5 }).success,
    ).toBe(false);
  });

  it('should reject invalid requiredRole', () => {
    expect(
      CheckUserRoleSchema.safeParse({ ...valid, requiredRole: 'manager' })
        .success,
    ).toBe(false);
  });

  it('should reject missing fields', () => {
    expect(CheckUserRoleSchema.safeParse({}).success).toBe(false);
    expect(CheckUserRoleSchema.safeParse({ userId: 1 }).success).toBe(false);
  });
});
