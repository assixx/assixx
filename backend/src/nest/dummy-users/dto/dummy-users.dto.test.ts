/**
 * Dummy Users DTO Validation Tests
 *
 * Tests: CreateDummyUserSchema, UpdateDummyUserSchema,
 *        ListDummyUsersQuerySchema, UuidParamSchema, IsActiveSchema
 * Pattern: ADR-018 — Zod .safeParse() assertions.
 */
import { describe, expect, it } from 'vitest';

import { IsActiveSchema, UuidParamSchema } from './common.dto.js';
import { CreateDummyUserSchema } from './create-dummy-user.dto.js';
import { ListDummyUsersQuerySchema } from './list-dummy-users-query.dto.js';
import { UpdateDummyUserSchema } from './update-dummy-user.dto.js';

const VALID_UUID = '019c9547-9fc0-771a-b022-3767e233d6f3';

// =============================================================
// CreateDummyUserSchema
// =============================================================

describe('CreateDummyUserSchema', () => {
  const validInput = {
    displayName: 'Halle 1 Display',
    password: 'SuperSicher123!',
  };

  it('should accept valid input with all fields', () => {
    const result = CreateDummyUserSchema.safeParse({
      ...validInput,
      teamIds: [1, 2, 3],
    });
    expect(result.success).toBe(true);
  });

  it('should accept input without optional teamIds', () => {
    const result = CreateDummyUserSchema.parse(validInput);
    expect(result.teamIds).toEqual([]);
  });

  // displayName validation
  it('should reject empty displayName', () => {
    const result = CreateDummyUserSchema.safeParse({
      ...validInput,
      displayName: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject whitespace-only displayName', () => {
    const result = CreateDummyUserSchema.safeParse({
      ...validInput,
      displayName: '   ',
    });
    expect(result.success).toBe(false);
  });

  it('should reject displayName over 100 chars', () => {
    const result = CreateDummyUserSchema.safeParse({
      ...validInput,
      displayName: 'A'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('should accept displayName at 100 chars', () => {
    const result = CreateDummyUserSchema.safeParse({
      ...validInput,
      displayName: 'A'.repeat(100),
    });
    expect(result.success).toBe(true);
  });

  it('should trim displayName whitespace', () => {
    const result = CreateDummyUserSchema.parse({
      ...validInput,
      displayName: '  Halle 1  ',
    });
    expect(result.displayName).toBe('Halle 1');
  });

  // password validation
  it('should reject password under 12 chars', () => {
    const result = CreateDummyUserSchema.safeParse({
      ...validInput,
      password: 'Short123!',
    });
    expect(result.success).toBe(false);
  });

  it('should reject password over 72 chars (BCrypt limit)', () => {
    const result = CreateDummyUserSchema.safeParse({
      ...validInput,
      password: 'A'.repeat(73),
    });
    expect(result.success).toBe(false);
  });

  it('should accept password at 12 chars', () => {
    const result = CreateDummyUserSchema.safeParse({
      ...validInput,
      password: 'ExactlyTwelv',
    });
    expect(result.success).toBe(true);
  });

  it('should accept password at 72 chars', () => {
    const result = CreateDummyUserSchema.safeParse({
      ...validInput,
      password: 'A'.repeat(72),
    });
    expect(result.success).toBe(true);
  });

  // teamIds validation
  it('should reject negative teamIds', () => {
    const result = CreateDummyUserSchema.safeParse({
      ...validInput,
      teamIds: [-1],
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer teamIds', () => {
    const result = CreateDummyUserSchema.safeParse({
      ...validInput,
      teamIds: [1.5],
    });
    expect(result.success).toBe(false);
  });

  it('should reject zero in teamIds', () => {
    const result = CreateDummyUserSchema.safeParse({
      ...validInput,
      teamIds: [0],
    });
    expect(result.success).toBe(false);
  });

  // missing required fields
  it('should reject missing displayName', () => {
    const result = CreateDummyUserSchema.safeParse({
      password: 'SuperSicher123!',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing password', () => {
    const result = CreateDummyUserSchema.safeParse({
      displayName: 'Test Display',
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================
// UpdateDummyUserSchema
// =============================================================

describe('UpdateDummyUserSchema', () => {
  it('should accept empty object (all fields optional)', () => {
    const result = UpdateDummyUserSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept valid displayName only', () => {
    const result = UpdateDummyUserSchema.safeParse({
      displayName: 'Neuer Name',
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid password only', () => {
    const result = UpdateDummyUserSchema.safeParse({
      password: 'NeuesPasswort12',
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid isActive only', () => {
    const result = UpdateDummyUserSchema.safeParse({ isActive: 0 });
    expect(result.success).toBe(true);
  });

  it('should reject isActive = 4 (soft-delete not via DTO)', () => {
    const result = UpdateDummyUserSchema.safeParse({ isActive: 4 });
    expect(result.success).toBe(false);
  });

  it('should reject isActive = 2 (invalid status)', () => {
    const result = UpdateDummyUserSchema.safeParse({ isActive: 2 });
    expect(result.success).toBe(false);
  });

  it.each([0, 1, 3])('should accept isActive = %d', (value: number) => {
    const result = UpdateDummyUserSchema.safeParse({ isActive: value });
    expect(result.success).toBe(true);
  });

  it('should reject empty displayName', () => {
    const result = UpdateDummyUserSchema.safeParse({ displayName: '' });
    expect(result.success).toBe(false);
  });

  it('should reject password under 12 chars', () => {
    const result = UpdateDummyUserSchema.safeParse({ password: 'short' });
    expect(result.success).toBe(false);
  });

  it('should accept all fields together', () => {
    const result = UpdateDummyUserSchema.safeParse({
      displayName: 'Updated Name',
      password: 'NewPassword123!',
      teamIds: [1, 2],
      isActive: 1,
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================
// ListDummyUsersQuerySchema
// =============================================================

describe('ListDummyUsersQuerySchema', () => {
  it('should accept empty query (all defaults)', () => {
    const result = ListDummyUsersQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('should coerce string page to number', () => {
    const result = ListDummyUsersQuerySchema.parse({ page: '3' });
    expect(result.page).toBe(3);
  });

  it('should reject page = 0', () => {
    const result = ListDummyUsersQuerySchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject limit > 100', () => {
    const result = ListDummyUsersQuerySchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it('should accept search string', () => {
    const result = ListDummyUsersQuerySchema.parse({ search: 'Halle' });
    expect(result.search).toBe('Halle');
  });

  it('should accept isActive filter', () => {
    const result = ListDummyUsersQuerySchema.safeParse({ isActive: '1' });
    expect(result.success).toBe(true);
  });
});

// =============================================================
// UuidParamSchema
// =============================================================

describe('UuidParamSchema', () => {
  it('should accept valid UUID', () => {
    const result = UuidParamSchema.safeParse({ uuid: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it('should reject invalid UUID format', () => {
    const result = UuidParamSchema.safeParse({ uuid: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('should reject empty string', () => {
    const result = UuidParamSchema.safeParse({ uuid: '' });
    expect(result.success).toBe(false);
  });
});

// =============================================================
// IsActiveSchema
// =============================================================

describe('IsActiveSchema', () => {
  it.each([0, 1, 3])('should accept %d', (value: number) => {
    expect(IsActiveSchema.safeParse(value).success).toBe(true);
  });

  it('should reject 2', () => {
    expect(IsActiveSchema.safeParse(2).success).toBe(false);
  });

  it('should reject 4 (soft-delete)', () => {
    expect(IsActiveSchema.safeParse(4).success).toBe(false);
  });

  it('should coerce string to number', () => {
    const result = IsActiveSchema.safeParse('1');
    expect(result.success).toBe(true);
  });
});
