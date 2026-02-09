import { describe, expect, it } from 'vitest';

import { AdminDepartmentParamSchema } from './admin-department-param.dto.js';
import { AdminGroupParamSchema } from './admin-group-param.dto.js';
import { AdminIdParamSchema } from './admin-id-param.dto.js';
import { BulkUpdatePermissionsSchema } from './bulk-update-permissions.dto.js';
import { CheckAccessParamSchema } from './check-access-param.dto.js';
import { SetAreaPermissionsSchema } from './set-area-permissions.dto.js';
import { SetFullAccessSchema } from './set-full-access.dto.js';
import { SetPermissionsSchema } from './set-permissions.dto.js';
import { UserAreaParamSchema } from './user-area-param.dto.js';
import { UserIdParamSchema } from './user-id-param.dto.js';

// =============================================================
// Param Schemas
// =============================================================

describe('SECURITY: AdminIdParamSchema (admin-permissions)', () => {
  it('should accept valid adminId', () => {
    expect(AdminIdParamSchema.safeParse({ adminId: 1 }).success).toBe(true);
  });

  it('should coerce string', () => {
    const result = AdminIdParamSchema.safeParse({ adminId: '5' });
    expect(result.success).toBe(true);
  });

  it('should reject zero', () => {
    expect(AdminIdParamSchema.safeParse({ adminId: 0 }).success).toBe(false);
  });
});

describe('SECURITY: AdminDepartmentParamSchema', () => {
  it('should accept valid params', () => {
    expect(
      AdminDepartmentParamSchema.safeParse({ adminId: 1, departmentId: 2 })
        .success,
    ).toBe(true);
  });

  it('should reject zero adminId', () => {
    expect(
      AdminDepartmentParamSchema.safeParse({ adminId: 0, departmentId: 1 })
        .success,
    ).toBe(false);
  });

  it('should reject zero departmentId', () => {
    expect(
      AdminDepartmentParamSchema.safeParse({ adminId: 1, departmentId: 0 })
        .success,
    ).toBe(false);
  });
});

describe('SECURITY: AdminGroupParamSchema', () => {
  it('should accept valid params', () => {
    expect(
      AdminGroupParamSchema.safeParse({ adminId: 1, groupId: 2 }).success,
    ).toBe(true);
  });

  it('should reject zero groupId', () => {
    expect(
      AdminGroupParamSchema.safeParse({ adminId: 1, groupId: 0 }).success,
    ).toBe(false);
  });
});

describe('SECURITY: CheckAccessParamSchema', () => {
  it('should accept valid params with default permissionLevel', () => {
    const result = CheckAccessParamSchema.safeParse({
      adminId: 1,
      departmentId: 2,
    });
    expect(result.success).toBe(true);
    const data = (
      result as { success: true; data: { permissionLevel: string } }
    ).data;
    expect(data.permissionLevel).toBe('read');
  });

  it('should accept explicit permission levels', () => {
    for (const level of ['read', 'write', 'delete']) {
      expect(
        CheckAccessParamSchema.safeParse({
          adminId: 1,
          departmentId: 2,
          permissionLevel: level,
        }).success,
      ).toBe(true);
    }
  });

  it('should reject invalid permission level', () => {
    expect(
      CheckAccessParamSchema.safeParse({
        adminId: 1,
        departmentId: 2,
        permissionLevel: 'admin',
      }).success,
    ).toBe(false);
  });
});

describe('SECURITY: UserIdParamSchema (admin-permissions)', () => {
  it('should accept valid userId', () => {
    expect(UserIdParamSchema.safeParse({ userId: 1 }).success).toBe(true);
  });

  it('should reject zero', () => {
    expect(UserIdParamSchema.safeParse({ userId: 0 }).success).toBe(false);
  });
});

describe('SECURITY: UserAreaParamSchema', () => {
  it('should accept valid params', () => {
    expect(
      UserAreaParamSchema.safeParse({ userId: 1, areaId: 2 }).success,
    ).toBe(true);
  });

  it('should reject zero userId', () => {
    expect(
      UserAreaParamSchema.safeParse({ userId: 0, areaId: 1 }).success,
    ).toBe(false);
  });

  it('should reject zero areaId', () => {
    expect(
      UserAreaParamSchema.safeParse({ userId: 1, areaId: 0 }).success,
    ).toBe(false);
  });
});

// =============================================================
// Body Schemas
// =============================================================

describe('SECURITY: SetFullAccessSchema', () => {
  it('should accept boolean true', () => {
    expect(SetFullAccessSchema.safeParse({ hasFullAccess: true }).success).toBe(
      true,
    );
  });

  it('should accept boolean false', () => {
    expect(
      SetFullAccessSchema.safeParse({ hasFullAccess: false }).success,
    ).toBe(true);
  });

  it('should reject non-boolean', () => {
    expect(
      SetFullAccessSchema.safeParse({ hasFullAccess: 'true' }).success,
    ).toBe(false);
  });

  it('should reject missing field', () => {
    expect(SetFullAccessSchema.safeParse({}).success).toBe(false);
  });
});

describe('SECURITY: SetPermissionsSchema', () => {
  const valid = { adminId: 1 };

  it('should accept minimal data with defaults', () => {
    const result = SetPermissionsSchema.safeParse(valid);
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> })
      .data;
    expect(data.departmentIds).toEqual([]);
    expect(data.groupIds).toEqual([]);
    expect(data.permissions).toEqual({
      canRead: true,
      canWrite: false,
      canDelete: false,
    });
  });

  it('should accept with department and group IDs', () => {
    const data = { ...valid, departmentIds: [1, 2], groupIds: [3] };
    expect(SetPermissionsSchema.safeParse(data).success).toBe(true);
  });

  it('should accept with custom permissions', () => {
    const data = {
      ...valid,
      permissions: { canRead: true, canWrite: true, canDelete: false },
    };
    expect(SetPermissionsSchema.safeParse(data).success).toBe(true);
  });

  it('should reject non-positive adminId', () => {
    expect(SetPermissionsSchema.safeParse({ adminId: 0 }).success).toBe(false);
  });
});

describe('SECURITY: SetAreaPermissionsSchema', () => {
  it('should accept valid area IDs', () => {
    expect(
      SetAreaPermissionsSchema.safeParse({ areaIds: [1, 2, 3] }).success,
    ).toBe(true);
  });

  it('should apply default permissions', () => {
    const result = SetAreaPermissionsSchema.safeParse({ areaIds: [1] });
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> })
      .data;
    expect(data.permissions).toEqual({
      canRead: true,
      canWrite: false,
      canDelete: false,
    });
  });
});

describe('SECURITY: BulkUpdatePermissionsSchema', () => {
  const valid = { adminIds: [1, 2], operation: 'assign' as const };

  it('should accept valid bulk update', () => {
    expect(BulkUpdatePermissionsSchema.safeParse(valid).success).toBe(true);
  });

  it('should accept assign and remove operations', () => {
    expect(
      BulkUpdatePermissionsSchema.safeParse({ ...valid, operation: 'assign' })
        .success,
    ).toBe(true);
    expect(
      BulkUpdatePermissionsSchema.safeParse({ ...valid, operation: 'remove' })
        .success,
    ).toBe(true);
  });

  it('should reject invalid operation', () => {
    expect(
      BulkUpdatePermissionsSchema.safeParse({ ...valid, operation: 'update' })
        .success,
    ).toBe(false);
  });

  it('should reject empty adminIds', () => {
    expect(
      BulkUpdatePermissionsSchema.safeParse({
        adminIds: [],
        operation: 'assign',
      }).success,
    ).toBe(false);
  });

  it('should accept with departmentIds and groupIds', () => {
    const data = { ...valid, departmentIds: [1], groupIds: [2] };
    expect(BulkUpdatePermissionsSchema.safeParse(data).success).toBe(true);
  });
});
