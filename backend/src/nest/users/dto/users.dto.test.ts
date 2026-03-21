import { describe, expect, it } from 'vitest';

import { AvailabilityHistoryQuerySchema } from './availability-history-query.dto.js';
import { ChangePasswordSchema } from './change-password.dto.js';
import { CreateUserSchema } from './create-user.dto.js';
import { ListUsersQuerySchema } from './list-users-query.dto.js';
import { UpdateAvailabilityEntrySchema } from './update-availability-entry.dto.js';
import { UpdateAvailabilitySchema } from './update-availability.dto.js';
import { UpdateProfileSchema } from './update-profile.dto.js';
import { UpdateUserSchema } from './update-user.dto.js';
import { UserIdParamSchema } from './user-id-param.dto.js';

// =============================================================
// ChangePasswordSchema
// =============================================================

describe('ChangePasswordSchema', () => {
  const valid = {
    currentPassword: 'OldPassword1!',
    newPassword: 'NewStrongPass12',
    confirmPassword: 'NewStrongPass12',
  };

  it('should accept valid password change', () => {
    expect(ChangePasswordSchema.safeParse(valid).success).toBe(true);
  });

  it('should reject when newPassword equals currentPassword', () => {
    const result = ChangePasswordSchema.safeParse({
      ...valid,
      newPassword: 'OldPassword1!',
      confirmPassword: 'OldPassword1!',
    });

    expect(result.success).toBe(false);
  });

  it('should reject when confirmPassword does not match newPassword', () => {
    const result = ChangePasswordSchema.safeParse({
      ...valid,
      confirmPassword: 'Mismatch12345',
    });

    expect(result.success).toBe(false);
  });

  it('should reject newPassword shorter than 12 characters', () => {
    expect(
      ChangePasswordSchema.safeParse({
        ...valid,
        newPassword: 'Short1!',
        confirmPassword: 'Short1!',
      }).success,
    ).toBe(false);
  });

  it('should reject newPassword longer than 72 characters', () => {
    const longPassword = 'A'.repeat(73);

    expect(
      ChangePasswordSchema.safeParse({
        ...valid,
        newPassword: longPassword,
        confirmPassword: longPassword,
      }).success,
    ).toBe(false);
  });

  it('should reject empty currentPassword', () => {
    expect(ChangePasswordSchema.safeParse({ ...valid, currentPassword: '' }).success).toBe(false);
  });
});

// =============================================================
// UserIdParamSchema
// =============================================================

describe('UserIdParamSchema', () => {
  it('should coerce string id to number', () => {
    const data = UserIdParamSchema.parse({ id: '42' });

    expect(data.id).toBe(42);
  });

  it('should reject zero', () => {
    expect(UserIdParamSchema.safeParse({ id: '0' }).success).toBe(false);
  });
});

// =============================================================
// UpdateProfileSchema
// =============================================================

describe('UpdateProfileSchema', () => {
  it('should accept empty object (all optional)', () => {
    expect(UpdateProfileSchema.safeParse({}).success).toBe(true);
  });

  it('should accept valid phone number', () => {
    const result = UpdateProfileSchema.safeParse({ phone: '+491234567890' });

    expect(result.success).toBe(true);
  });

  it('should reject phone without leading +', () => {
    expect(UpdateProfileSchema.safeParse({ phone: '491234567890' }).success).toBe(false);
  });

  it('should accept valid employee number', () => {
    expect(UpdateProfileSchema.safeParse({ employeeNumber: 'EMP-123' }).success).toBe(true);
  });

  it('should reject employee number longer than 10 characters', () => {
    expect(UpdateProfileSchema.safeParse({ employeeNumber: 'EMP-12345678' }).success).toBe(false);
  });

  it('should reject empty firstName when provided', () => {
    expect(UpdateProfileSchema.safeParse({ firstName: '' }).success).toBe(false);
  });
});

// =============================================================
// CreateUserSchema
// =============================================================

describe('CreateUserSchema', () => {
  const valid = {
    email: 'new@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    password: 'TestPass123!',
  };

  it('should accept valid minimal user', () => {
    expect(CreateUserSchema.safeParse(valid).success).toBe(true);
  });

  it('should default role to employee', () => {
    const data = CreateUserSchema.parse(valid);

    expect(data.role).toBe('employee');
  });

  it('should accept arrays for departmentIds and teamIds', () => {
    const result = CreateUserSchema.safeParse({
      ...valid,
      departmentIds: [1, 2],
      teamIds: [3],
    });

    expect(result.success).toBe(true);
  });

  it('should reject missing email', () => {
    const { email: _email, ...noEmail } = valid;

    expect(CreateUserSchema.safeParse(noEmail).success).toBe(false);
  });

  it('should reject missing firstName', () => {
    const { firstName: _fn, ...noFirstName } = valid;

    expect(CreateUserSchema.safeParse(noFirstName).success).toBe(false);
  });

  it('should reject availabilityNotes longer than 500 characters', () => {
    expect(
      CreateUserSchema.safeParse({
        ...valid,
        availabilityNotes: 'N'.repeat(501),
      }).success,
    ).toBe(false);
  });

  it.each(['available', 'vacation', 'sick', 'unavailable', 'training', 'other'] as const)(
    'should accept availabilityStatus=%s',
    (status) => {
      expect(
        CreateUserSchema.safeParse({
          ...valid,
          availabilityStatus: status,
        }).success,
      ).toBe(true);
    },
  );
});

// =============================================================
// UpdateUserSchema
// =============================================================

describe('UpdateUserSchema', () => {
  it('should accept empty object (all optional)', () => {
    expect(UpdateUserSchema.safeParse({}).success).toBe(true);
  });

  it.each([0, 1, 3] as const)('should accept isActive=%d', (isActive) => {
    const data = UpdateUserSchema.parse({ isActive });

    expect(data.isActive).toBe(isActive);
  });

  it('should reject isActive=2 (not in union)', () => {
    expect(UpdateUserSchema.safeParse({ isActive: 2 }).success).toBe(false);
  });

  it('should reject availabilityReason longer than 255 characters', () => {
    expect(UpdateUserSchema.safeParse({ availabilityReason: 'R'.repeat(256) }).success).toBe(false);
  });
});

// =============================================================
// ListUsersQuerySchema
// =============================================================

describe('ListUsersQuerySchema', () => {
  it('should accept empty query', () => {
    const data = ListUsersQuerySchema.parse({});

    expect(data.sortOrder).toBe('asc');
  });

  it('should coerce isActive from string to number', () => {
    const data = ListUsersQuerySchema.parse({ isActive: '1' });

    expect(data.isActive).toBe(1);
  });

  it('should reject isActive > 4', () => {
    expect(ListUsersQuerySchema.safeParse({ isActive: '5' }).success).toBe(false);
  });

  it.each(['firstName', 'lastName', 'email', 'createdAt', 'lastLogin'])(
    'should accept sortBy=%s',
    (sortBy) => {
      expect(ListUsersQuerySchema.safeParse({ sortBy }).success).toBe(true);
    },
  );

  it('should reject invalid sortBy', () => {
    expect(ListUsersQuerySchema.safeParse({ sortBy: 'id' }).success).toBe(false);
  });
});

// =============================================================
// UpdateAvailabilitySchema
// =============================================================

describe('UpdateAvailabilitySchema', () => {
  const valid = { availabilityStatus: 'vacation' as const };

  it('should accept valid status', () => {
    expect(UpdateAvailabilitySchema.safeParse(valid).success).toBe(true);
  });

  it('should accept optional ISO date fields', () => {
    expect(
      UpdateAvailabilitySchema.safeParse({
        ...valid,
        availabilityStart: '2025-06-01',
        availabilityEnd: '2025-06-15',
      }).success,
    ).toBe(true);
  });

  it('should reject invalid status', () => {
    expect(UpdateAvailabilitySchema.safeParse({ availabilityStatus: 'holiday' }).success).toBe(
      false,
    );
  });

  it('should reject reason longer than 255 characters', () => {
    expect(
      UpdateAvailabilitySchema.safeParse({
        ...valid,
        availabilityReason: 'R'.repeat(256),
      }).success,
    ).toBe(false);
  });
});

// =============================================================
// UpdateAvailabilityEntrySchema
// =============================================================

describe('UpdateAvailabilityEntrySchema', () => {
  const valid = {
    status: 'sick' as const,
    startDate: '2025-06-01',
    endDate: '2025-06-03',
  };

  it('should accept valid entry', () => {
    expect(UpdateAvailabilityEntrySchema.safeParse(valid).success).toBe(true);
  });

  it('should reject invalid date format', () => {
    expect(
      UpdateAvailabilityEntrySchema.safeParse({
        ...valid,
        startDate: '06/01/2025',
      }).success,
    ).toBe(false);
  });

  it('should reject notes longer than 500 characters', () => {
    expect(
      UpdateAvailabilityEntrySchema.safeParse({
        ...valid,
        notes: 'N'.repeat(501),
      }).success,
    ).toBe(false);
  });

  it('should accept nullable reason', () => {
    const result = UpdateAvailabilityEntrySchema.safeParse({
      ...valid,
      reason: null,
    });

    expect(result.success).toBe(true);
  });
});

// =============================================================
// AvailabilityHistoryQuerySchema
// =============================================================

describe('AvailabilityHistoryQuerySchema', () => {
  it('should accept empty query', () => {
    expect(AvailabilityHistoryQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should accept valid year and month', () => {
    expect(AvailabilityHistoryQuerySchema.safeParse({ year: '2025', month: '06' }).success).toBe(
      true,
    );
  });

  it('should reject year with less than 4 digits', () => {
    expect(AvailabilityHistoryQuerySchema.safeParse({ year: '25' }).success).toBe(false);
  });

  it('should reject month outside 01-12', () => {
    expect(AvailabilityHistoryQuerySchema.safeParse({ month: '13' }).success).toBe(false);
  });

  it('should reject month "00"', () => {
    expect(AvailabilityHistoryQuerySchema.safeParse({ month: '00' }).success).toBe(false);
  });
});
