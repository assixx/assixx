import { describe, expect, it } from 'vitest';

import {
  DateSchema,
  DocumentMimeTypes,
  EmailSchema,
  IdSchema,
  PaginationSchema,
  PasswordSchema,
  RoleSchema,
  SearchQuerySchema,
  TenantIdSchema,
  TimeSchema,
  UsernameSchema,
} from './common.schema.js';

// =============================================================
// IdSchema
// =============================================================

describe('IdSchema', () => {
  it('should parse numeric string to number', () => {
    const result = IdSchema.safeParse('42');

    expect(result.success).toBe(true);
    expect(result.data).toBe(42);
  });

  it('should pass through valid number', () => {
    const result = IdSchema.safeParse(5);

    expect(result.success).toBe(true);
    expect(result.data).toBe(5);
  });

  it('should fail for empty string', () => {
    expect(IdSchema.safeParse('').success).toBe(false);
  });

  it('should fail for non-numeric string', () => {
    expect(IdSchema.safeParse('abc').success).toBe(false);
  });

  it('should fail for null', () => {
    expect(IdSchema.safeParse(null).success).toBe(false);
  });

  it('should fail for zero', () => {
    expect(IdSchema.safeParse(0).success).toBe(false);
  });

  it('should fail for negative number', () => {
    expect(IdSchema.safeParse(-1).success).toBe(false);
  });

  it('should truncate float string to integer via parseInt', () => {
    const result = IdSchema.safeParse('3.7');

    expect(result.success).toBe(true);
    expect(result.data).toBe(3);
  });
});

// =============================================================
// EmailSchema
// =============================================================

describe('EmailSchema', () => {
  it('should accept valid email', () => {
    const result = EmailSchema.safeParse('user@example.com');

    expect(result.success).toBe(true);
    expect(result.data).toBe('user@example.com');
  });

  it('should normalize to lowercase', () => {
    const result = EmailSchema.safeParse('USER@EXAMPLE.COM');

    expect(result.success).toBe(true);
    expect(result.data).toBe('user@example.com');
  });

  it('should fail for email with leading/trailing spaces (trim runs after regex)', () => {
    // NOTE: Schema applies .trim() AFTER .regex(), so spaces fail regex first.
    // This documents actual behavior — not a test bug.
    expect(EmailSchema.safeParse('  user@example.com  ').success).toBe(false);
  });

  it('should fail for empty string', () => {
    expect(EmailSchema.safeParse('').success).toBe(false);
  });

  it('should fail for missing @', () => {
    expect(EmailSchema.safeParse('userexample.com').success).toBe(false);
  });

  it('should fail for missing TLD', () => {
    expect(EmailSchema.safeParse('user@example').success).toBe(false);
  });
});

// =============================================================
// PasswordSchema (NIST 800-63B)
// =============================================================

describe('PasswordSchema', () => {
  it('should accept valid password with 3 categories (lower+upper+number)', () => {
    const result = PasswordSchema.safeParse('SecurePass123');

    expect(result.success).toBe(true);
  });

  it('should accept valid password with 3 categories (lower+upper+special)', () => {
    expect(PasswordSchema.safeParse('SecurePass!!xx').success).toBe(true);
  });

  it('should accept valid password with 3 categories (lower+number+special)', () => {
    expect(PasswordSchema.safeParse('securepass1!!').success).toBe(true);
  });

  it('should accept valid password with all 4 categories', () => {
    expect(PasswordSchema.safeParse('SecurePass1!!').success).toBe(true);
  });

  it('should fail for password shorter than 12 characters', () => {
    expect(PasswordSchema.safeParse('Short1!').success).toBe(false);
  });

  it('should fail for password longer than 72 characters', () => {
    const longPassword = 'A'.repeat(73);

    expect(PasswordSchema.safeParse(longPassword).success).toBe(false);
  });

  it('should fail with only 2 categories (lower+upper)', () => {
    expect(PasswordSchema.safeParse('OnlyLettersHere').success).toBe(false);
  });

  it('should fail with only 1 category (all lowercase)', () => {
    expect(PasswordSchema.safeParse('alllowercase!').success).toBe(false);
  });
});

// =============================================================
// UsernameSchema
// =============================================================

describe('UsernameSchema', () => {
  it('should transform to lowercase and trim', () => {
    const result = UsernameSchema.safeParse('  JohnDoe  ');

    expect(result.success).toBe(true);
    expect(result.data).toBe('johndoe');
  });

  it('should accept email-like username', () => {
    const result = UsernameSchema.safeParse('john@example.com');

    expect(result.success).toBe(true);
  });

  it('should fail for username shorter than 3 characters', () => {
    expect(UsernameSchema.safeParse('ab').success).toBe(false);
  });

  it('should accept exactly 3 characters', () => {
    expect(UsernameSchema.safeParse('abc').success).toBe(true);
  });
});

// =============================================================
// RoleSchema
// =============================================================

describe('RoleSchema', () => {
  it.each(['admin', 'employee', 'root'])(
    'should accept valid role "%s"',
    (role) => {
      expect(RoleSchema.safeParse(role).success).toBe(true);
    },
  );

  it('should fail for invalid role', () => {
    expect(RoleSchema.safeParse('superadmin').success).toBe(false);
  });

  it('should fail for empty string', () => {
    expect(RoleSchema.safeParse('').success).toBe(false);
  });
});

// =============================================================
// PaginationSchema
// =============================================================

describe('PaginationSchema', () => {
  it('should use defaults for empty object', () => {
    const result = PaginationSchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ page: 1, limit: 10 });
  });

  it('should coerce string page and limit to numbers', () => {
    const result = PaginationSchema.safeParse({ page: '3', limit: '25' });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ page: 3, limit: 25 });
  });

  it('should fail for limit exceeding 100', () => {
    expect(PaginationSchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('should fail for page less than 1', () => {
    expect(PaginationSchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it('should parse optional offset', () => {
    const result = PaginationSchema.safeParse({ offset: '20' });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ offset: 20 });
  });

  it('should fail for negative offset', () => {
    expect(PaginationSchema.safeParse({ offset: -1 }).success).toBe(false);
  });

  it('should accept limit at boundary value 100', () => {
    const result = PaginationSchema.safeParse({ limit: 100 });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ limit: 100 });
  });
});

// =============================================================
// SearchQuerySchema
// =============================================================

describe('SearchQuerySchema', () => {
  it('should extend PaginationSchema with search and sort', () => {
    const result = SearchQuerySchema.safeParse({
      page: '2',
      search: 'test',
      sortBy: 'name',
      sortOrder: 'desc',
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      page: 2,
      search: 'test',
      sortBy: 'name',
      sortOrder: 'desc',
    });
  });

  it('should default sortOrder to "asc"', () => {
    const result = SearchQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ sortOrder: 'asc' });
  });

  it('should fail for invalid sortOrder', () => {
    expect(
      SearchQuerySchema.safeParse({ sortOrder: 'random' }).success,
    ).toBe(false);
  });
});

// =============================================================
// TenantIdSchema
// =============================================================

describe('TenantIdSchema', () => {
  it('should accept positive integer', () => {
    expect(TenantIdSchema.safeParse(1).success).toBe(true);
    expect(TenantIdSchema.safeParse(999).success).toBe(true);
  });

  it('should fail for zero', () => {
    expect(TenantIdSchema.safeParse(0).success).toBe(false);
  });

  it('should fail for negative number', () => {
    expect(TenantIdSchema.safeParse(-1).success).toBe(false);
  });

  it('should fail for float', () => {
    expect(TenantIdSchema.safeParse(1.5).success).toBe(false);
  });
});

// =============================================================
// DateSchema
// =============================================================

describe('DateSchema', () => {
  it('should accept valid ISO 8601 date with Z', () => {
    expect(DateSchema.safeParse('2025-01-15T10:30:00Z').success).toBe(true);
  });

  it('should accept valid ISO 8601 date without Z', () => {
    expect(DateSchema.safeParse('2025-01-15T10:30:00').success).toBe(true);
  });

  it('should accept ISO date with milliseconds', () => {
    expect(DateSchema.safeParse('2025-01-15T10:30:00.000Z').success).toBe(true);
  });

  it('should fail for date-only string without time', () => {
    expect(DateSchema.safeParse('2025-01-15').success).toBe(false);
  });

  it('should fail for non-date string', () => {
    expect(DateSchema.safeParse('not-a-date').success).toBe(false);
  });
});

// =============================================================
// TimeSchema
// =============================================================

describe('TimeSchema', () => {
  it('should accept valid HH:MM format', () => {
    expect(TimeSchema.safeParse('14:30').success).toBe(true);
  });

  it('should accept single-digit hour', () => {
    expect(TimeSchema.safeParse('9:05').success).toBe(true);
  });

  it('should accept boundary value 23:59', () => {
    expect(TimeSchema.safeParse('23:59').success).toBe(true);
  });

  it('should fail for hour 24', () => {
    expect(TimeSchema.safeParse('24:00').success).toBe(false);
  });

  it('should fail for minute 60', () => {
    expect(TimeSchema.safeParse('14:60').success).toBe(false);
  });
});

// =============================================================
// DocumentMimeTypes
// =============================================================

describe('DocumentMimeTypes', () => {
  it.each([
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ])('should accept valid MIME type "%s"', (mime) => {
    expect(DocumentMimeTypes.safeParse(mime).success).toBe(true);
  });

  it('should fail for text/plain', () => {
    expect(DocumentMimeTypes.safeParse('text/plain').success).toBe(false);
  });

  it('should fail for application/exe', () => {
    expect(DocumentMimeTypes.safeParse('application/exe').success).toBe(false);
  });

  it('should fail for empty string', () => {
    expect(DocumentMimeTypes.safeParse('').success).toBe(false);
  });
});
