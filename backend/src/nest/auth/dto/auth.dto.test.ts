import { describe, expect, it } from 'vitest';

import { ConnectionTicketSchema } from './connection-ticket.dto.js';
import { ForgotPasswordDto, ForgotPasswordSchema } from './forgot-password.dto.js';
import { LoginSchema } from './login.dto.js';
import { RefreshSchema } from './refresh.dto.js';
import { RegisterSchema } from './register.dto.js';
import { ResetPasswordDto, ResetPasswordSchema } from './reset-password.dto.js';

// =============================================================
// LoginSchema
// =============================================================

describe('LoginSchema', () => {
  const valid = { email: 'user@example.com', password: 'TestPass123!' };

  it('should accept valid login data', () => {
    expect(LoginSchema.safeParse(valid).success).toBe(true);
  });

  it('should reject missing email', () => {
    expect(LoginSchema.safeParse({ password: 'TestPass123!' }).success).toBe(false);
  });

  it('should reject missing password', () => {
    expect(LoginSchema.safeParse({ email: valid.email }).success).toBe(false);
  });

  it('should reject invalid email format', () => {
    expect(LoginSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
  });
});

// =============================================================
// RegisterSchema
// =============================================================

describe('RegisterSchema', () => {
  const valid = {
    email: 'user@example.com',
    password: 'Strong@1pass',
    firstName: 'John',
    lastName: 'Doe',
  };

  it('should accept valid registration with default role', () => {
    const data = RegisterSchema.parse(valid);

    expect(data.role).toBe('employee');
  });

  it('should accept explicit admin role', () => {
    const data = RegisterSchema.parse({ ...valid, role: 'admin' });

    expect(data.role).toBe('admin');
  });

  it('should reject password shorter than 8 characters', () => {
    expect(RegisterSchema.safeParse({ ...valid, password: 'Sh@1t' }).success).toBe(false);
  });

  it('should reject password without uppercase letter', () => {
    expect(RegisterSchema.safeParse({ ...valid, password: 'strong@1pass' }).success).toBe(false);
  });

  it('should reject password without lowercase letter', () => {
    expect(RegisterSchema.safeParse({ ...valid, password: 'STRONG@1PASS' }).success).toBe(false);
  });

  it('should reject password without number', () => {
    expect(RegisterSchema.safeParse({ ...valid, password: 'Strong@pass!' }).success).toBe(false);
  });

  it('should reject password without special character', () => {
    expect(RegisterSchema.safeParse({ ...valid, password: 'Strong1pass' }).success).toBe(false);
  });

  it('should reject name shorter than 2 characters', () => {
    expect(RegisterSchema.safeParse({ ...valid, firstName: 'J' }).success).toBe(false);
  });

  it('should reject name longer than 50 characters', () => {
    expect(RegisterSchema.safeParse({ ...valid, lastName: 'A'.repeat(51) }).success).toBe(false);
  });

  it('should reject invalid role', () => {
    expect(RegisterSchema.safeParse({ ...valid, role: 'superadmin' }).success).toBe(false);
  });
});

// =============================================================
// RefreshSchema
// =============================================================

describe('RefreshSchema', () => {
  it('should accept a refresh token string', () => {
    const data = RefreshSchema.parse({ refreshToken: 'jwt-token-here' });

    expect(data.refreshToken).toBe('jwt-token-here');
  });

  it('should default to empty string when no token provided', () => {
    const data = RefreshSchema.parse({});

    expect(data.refreshToken).toBe('');
  });
});

// =============================================================
// ConnectionTicketSchema
// =============================================================

describe('ConnectionTicketSchema', () => {
  it.each(['websocket', 'sse'] as const)('should accept purpose=%s', (purpose) => {
    expect(ConnectionTicketSchema.safeParse({ purpose }).success).toBe(true);
  });

  it('should reject invalid purpose', () => {
    expect(ConnectionTicketSchema.safeParse({ purpose: 'http' }).success).toBe(false);
  });

  it('should reject missing purpose', () => {
    expect(ConnectionTicketSchema.safeParse({}).success).toBe(false);
  });
});

// =============================================================
// ForgotPasswordSchema + DTO class
// =============================================================

describe('ForgotPasswordSchema', () => {
  it('should accept a valid email', () => {
    const result = ForgotPasswordSchema.safeParse({ email: 'user@example.com' });

    expect(result.success).toBe(true);
  });

  it('should lowercase email after validation (EmailSchema normalization)', () => {
    const result = ForgotPasswordSchema.parse({ email: 'User@Example.COM' });

    expect(result.email).toBe('user@example.com');
  });

  it('should reject missing email', () => {
    expect(ForgotPasswordSchema.safeParse({}).success).toBe(false);
  });

  it('should reject invalid email format', () => {
    expect(ForgotPasswordSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });

  it('should reject email with surrounding whitespace (regex precedes trim)', () => {
    expect(ForgotPasswordSchema.safeParse({ email: '  user@example.com  ' }).success).toBe(false);
  });

  it('should expose a DTO class via createZodDto', () => {
    // Forces evaluation of the `class extends createZodDto(...)` line
    expect(ForgotPasswordDto).toBeDefined();
    expect(typeof ForgotPasswordDto).toBe('function');
  });
});

// =============================================================
// ResetPasswordSchema + DTO class
// =============================================================

describe('ResetPasswordSchema', () => {
  const valid = { token: 'raw-reset-token-abc', password: 'StrongP@ssword1' };

  it('should accept valid token + strong password (12+ chars, 3-of-4 categories)', () => {
    expect(ResetPasswordSchema.safeParse(valid).success).toBe(true);
  });

  it('should reject empty token', () => {
    expect(ResetPasswordSchema.safeParse({ ...valid, token: '' }).success).toBe(false);
  });

  it('should reject missing token', () => {
    expect(ResetPasswordSchema.safeParse({ password: valid.password }).success).toBe(false);
  });

  it('should reject missing password', () => {
    expect(ResetPasswordSchema.safeParse({ token: valid.token }).success).toBe(false);
  });

  it('should reject password shorter than 12 characters (NIST 800-63B)', () => {
    expect(ResetPasswordSchema.safeParse({ ...valid, password: 'Sh@1tabc' }).success).toBe(false);
  });

  it('should reject password with only 2 character categories (lowercase + digits)', () => {
    expect(ResetPasswordSchema.safeParse({ ...valid, password: 'lowercase123' }).success).toBe(
      false,
    );
  });

  it('should accept password with 3-of-4 categories (lowercase + digits + special)', () => {
    // Documents the NIST 3-of-4 contract — uppercase NOT mandatory.
    expect(ResetPasswordSchema.safeParse({ ...valid, password: 'lowercase@123' }).success).toBe(
      true,
    );
  });

  it('should reject password longer than 72 characters (bcrypt limit)', () => {
    expect(
      ResetPasswordSchema.safeParse({ ...valid, password: `StrongP@ss1${'a'.repeat(70)}` }).success,
    ).toBe(false);
  });

  it('should expose a DTO class via createZodDto', () => {
    expect(ResetPasswordDto).toBeDefined();
    expect(typeof ResetPasswordDto).toBe('function');
  });
});
