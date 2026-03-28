import { describe, expect, it } from 'vitest';

import { AdminIdParamSchema } from './admin-id-param.dto.js';
import { AdminLogsQuerySchema } from './admin-logs-query.dto.js';
import {
  EmailSchema,
  EmployeeNumberSchema,
  NameSchema,
  NotesSchema,
  PasswordSchema,
  PositionSchema,
  UsernameSchema,
} from './admin.schemas.js';
import { CreateAdminSchema } from './create-admin.dto.js';
import { CreateRootUserSchema } from './create-root-user.dto.js';
import { DeletionApprovalBodySchema } from './deletion-approval-body.dto.js';
import { DeletionRejectionBodySchema } from './deletion-rejection-body.dto.js';
import { RootApiFiltersSchema } from './query.dto.js';
import { QueueIdParamSchema } from './queue-id-param.dto.js';
import { RootUserIdParamSchema } from './root-user-id-param.dto.js';
import { TenantDeletionRequestSchema } from './tenant-deletion-request.dto.js';
import { UpdateAdminSchema } from './update-admin.dto.js';
import { UpdateRootUserSchema } from './update-root-user.dto.js';

// =============================================================
// Shared Schemas
// =============================================================

describe('EmailSchema (root)', () => {
  it('should accept valid email and lowercase', () => {
    const result = EmailSchema.safeParse('Admin@EXAMPLE.com');
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: string }).data;
    expect(data).toBe('admin@example.com');
  });

  it('should reject invalid email', () => {
    expect(EmailSchema.safeParse('not-email').success).toBe(false);
  });
});

describe('PasswordSchema (root)', () => {
  it('should accept valid password', () => {
    expect(PasswordSchema.safeParse('StrongPass1!').success).toBe(true);
  });

  it('should reject password under 8 chars', () => {
    expect(PasswordSchema.safeParse('Ab1!').success).toBe(false);
  });

  it('should reject password without uppercase', () => {
    expect(PasswordSchema.safeParse('weakpass1!').success).toBe(false);
  });
});

describe('NameSchema (root)', () => {
  it('should accept German characters', () => {
    expect(NameSchema.safeParse('Müller').success).toBe(true);
    expect(NameSchema.safeParse("O'Brien").success).toBe(true);
  });

  it('should reject empty', () => {
    expect(NameSchema.safeParse('').success).toBe(false);
  });

  it('should trim whitespace', () => {
    const result = NameSchema.safeParse(' Max ');
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: string }).data;
    expect(data).toBe('Max');
  });
});

describe('UsernameSchema', () => {
  it('should lowercase and trim', () => {
    const result = UsernameSchema.safeParse(' Admin ');
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: string }).data;
    expect(data).toBe('admin');
  });

  it('should reject under 3 chars', () => {
    expect(UsernameSchema.safeParse('ab').success).toBe(false);
  });
});

describe('NotesSchema', () => {
  it('should accept optional undefined', () => {
    expect(NotesSchema.safeParse(undefined).success).toBe(true);
  });

  it('should reject over 500 chars', () => {
    expect(NotesSchema.safeParse('a'.repeat(501)).success).toBe(false);
  });
});

describe('PositionSchema', () => {
  it('should accept optional undefined', () => {
    expect(PositionSchema.safeParse(undefined).success).toBe(true);
  });

  it('should reject over 100 chars', () => {
    expect(PositionSchema.safeParse('a'.repeat(101)).success).toBe(false);
  });
});

describe('EmployeeNumberSchema', () => {
  it('should accept optional undefined', () => {
    expect(EmployeeNumberSchema.safeParse(undefined).success).toBe(true);
  });

  it('should reject over 50 chars', () => {
    expect(EmployeeNumberSchema.safeParse('a'.repeat(51)).success).toBe(false);
  });
});

// =============================================================
// Param Schemas
// =============================================================

describe('AdminIdParamSchema', () => {
  it('should accept positive integer', () => {
    expect(AdminIdParamSchema.safeParse({ id: 1 }).success).toBe(true);
  });

  it('should coerce string', () => {
    const result = AdminIdParamSchema.safeParse({ id: '5' });
    expect(result.success).toBe(true);
  });

  it('should reject zero', () => {
    expect(AdminIdParamSchema.safeParse({ id: 0 }).success).toBe(false);
  });
});

describe('RootUserIdParamSchema', () => {
  it('should accept positive integer', () => {
    expect(RootUserIdParamSchema.safeParse({ id: 1 }).success).toBe(true);
  });

  it('should reject zero', () => {
    expect(RootUserIdParamSchema.safeParse({ id: 0 }).success).toBe(false);
  });
});

describe('QueueIdParamSchema', () => {
  it('should accept positive integer', () => {
    expect(QueueIdParamSchema.safeParse({ queueId: 1 }).success).toBe(true);
  });

  it('should coerce string', () => {
    const result = QueueIdParamSchema.safeParse({ queueId: '10' });
    expect(result.success).toBe(true);
  });

  it('should reject zero', () => {
    expect(QueueIdParamSchema.safeParse({ queueId: 0 }).success).toBe(false);
  });
});

// =============================================================
// Query Schemas
// =============================================================

describe('AdminLogsQuerySchema', () => {
  it('should default days to 30', () => {
    const result = AdminLogsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> }).data;
    expect(data.days).toBe(30);
  });

  it('should accept days in range 1-365', () => {
    expect(AdminLogsQuerySchema.safeParse({ days: 1 }).success).toBe(true);
    expect(AdminLogsQuerySchema.safeParse({ days: 365 }).success).toBe(true);
  });

  it('should reject days over 365', () => {
    expect(AdminLogsQuerySchema.safeParse({ days: 366 }).success).toBe(false);
  });

  it('should reject days under 1', () => {
    expect(AdminLogsQuerySchema.safeParse({ days: 0 }).success).toBe(false);
  });
});

describe('RootApiFiltersSchema', () => {
  it('should accept empty query', () => {
    expect(RootApiFiltersSchema.safeParse({}).success).toBe(true);
  });

  it('should accept valid status enum', () => {
    for (const status of ['active', 'inactive', 'suspended', 'deleted']) {
      expect(RootApiFiltersSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it('should reject invalid status', () => {
    expect(RootApiFiltersSchema.safeParse({ status: 'pending' }).success).toBe(false);
  });

  it('should transform isActive string to boolean', () => {
    const result = RootApiFiltersSchema.safeParse({ isActive: 'true' });
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> }).data;
    expect(data.isActive).toBe(true);
  });

  it('should reject search over 100 chars', () => {
    expect(RootApiFiltersSchema.safeParse({ search: 'a'.repeat(101) }).success).toBe(false);
  });
});

// =============================================================
// Body Schemas
// =============================================================

describe('CreateRootUserSchema', () => {
  const valid = {
    email: 'root@example.com',
    password: 'StrongPass1!',
    firstName: 'Root',
    lastName: 'User',
    positionIds: ['019579a0-0000-7000-8000-000000000001'],
  };

  it('should accept valid data', () => {
    expect(CreateRootUserSchema.safeParse(valid).success).toBe(true);
  });

  it('should default isActive to 1', () => {
    const result = CreateRootUserSchema.safeParse(valid);
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> }).data;
    expect(data.isActive).toBe(1);
  });

  it('should reject missing required fields', () => {
    expect(CreateRootUserSchema.safeParse({}).success).toBe(false);
  });
});

describe('CreateAdminSchema', () => {
  const valid = {
    email: 'admin@example.com',
    password: 'StrongPass1!',
    positionIds: ['019579a0-0000-7000-8000-000000000001'],
  };

  it('should accept valid data with optional names', () => {
    expect(CreateAdminSchema.safeParse(valid).success).toBe(true);
  });

  it('should accept with all fields', () => {
    const data = {
      ...valid,
      firstName: 'Admin',
      lastName: 'User',
      notes: 'Test',
    };
    expect(CreateAdminSchema.safeParse(data).success).toBe(true);
  });

  it('should reject missing email', () => {
    expect(CreateAdminSchema.safeParse({ password: 'StrongPass1!' }).success).toBe(false);
  });
});

describe('UpdateRootUserSchema', () => {
  it('should accept empty update (all optional)', () => {
    expect(UpdateRootUserSchema.safeParse({}).success).toBe(true);
  });

  it('should accept partial update', () => {
    expect(UpdateRootUserSchema.safeParse({ firstName: 'Updated' }).success).toBe(true);
  });

  it('should accept isActive values 0-4', () => {
    for (const isActive of [0, 1, 3, 4]) {
      expect(UpdateRootUserSchema.safeParse({ isActive }).success).toBe(true);
    }
  });

  it('should reject isActive over 4', () => {
    expect(UpdateRootUserSchema.safeParse({ isActive: 5 }).success).toBe(false);
  });
});

describe('UpdateAdminSchema', () => {
  it('should accept empty update', () => {
    expect(UpdateAdminSchema.safeParse({}).success).toBe(true);
  });

  it('should accept role change', () => {
    expect(UpdateAdminSchema.safeParse({ role: 'admin' }).success).toBe(true);
    expect(UpdateAdminSchema.safeParse({ role: 'root' }).success).toBe(true);
  });

  it('should reject invalid role', () => {
    expect(UpdateAdminSchema.safeParse({ role: 'employee' }).success).toBe(false);
  });
});

describe('DeletionApprovalBodySchema', () => {
  it('should accept valid approval', () => {
    expect(DeletionApprovalBodySchema.safeParse({ password: 'secret' }).success).toBe(true);
  });

  it('should accept with optional comment', () => {
    expect(
      DeletionApprovalBodySchema.safeParse({
        password: 'secret',
        comment: 'Approved',
      }).success,
    ).toBe(true);
  });

  it('should reject empty password', () => {
    expect(DeletionApprovalBodySchema.safeParse({ password: '' }).success).toBe(false);
  });

  it('should reject comment over 500 chars', () => {
    expect(
      DeletionApprovalBodySchema.safeParse({
        password: 'x',
        comment: 'a'.repeat(501),
      }).success,
    ).toBe(false);
  });
});

describe('DeletionRejectionBodySchema', () => {
  it('should accept valid rejection', () => {
    expect(
      DeletionRejectionBodySchema.safeParse({
        reason: 'Not yet approved by management',
      }).success,
    ).toBe(true);
  });

  it('should reject reason under 10 chars', () => {
    expect(DeletionRejectionBodySchema.safeParse({ reason: 'short' }).success).toBe(false);
  });

  it('should reject reason over 500 chars', () => {
    expect(DeletionRejectionBodySchema.safeParse({ reason: 'a'.repeat(501) }).success).toBe(false);
  });
});

describe('TenantDeletionRequestSchema', () => {
  it('should accept valid request with reason', () => {
    expect(
      TenantDeletionRequestSchema.safeParse({
        reason: 'Company closing operations permanently',
      }).success,
    ).toBe(true);
  });

  it('should accept empty body (reason optional)', () => {
    expect(TenantDeletionRequestSchema.safeParse({}).success).toBe(true);
  });

  it('should reject reason under 10 chars', () => {
    expect(TenantDeletionRequestSchema.safeParse({ reason: 'short' }).success).toBe(false);
  });
});
