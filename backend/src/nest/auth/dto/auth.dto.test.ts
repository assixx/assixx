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

  // ── ADR-056 regression locks ──────────────────────────────────────────
  // WHY: login is bcrypt-compare only (ADR-056 Migration Impact §"Login
  // unaffected"). Re-applying the strict registration PasswordSchema here
  // breaks (a) anti-enumeration (FEAT_2FA_EMAIL §R10 — wrong-password and
  // unknown-email must both 401, never 400) and (b) legacy-user login.
  // These tests pin LoginSchema as the gate-shape contract so any future
  // re-introduction of PasswordSchema at login fails fast.

  it('should accept a 3-of-4 password (would fail PasswordSchema, must pass LoginSchema)', () => {
    // 'WrongPassword!' = upper + lower + special, NO digit → 3-of-4.
    // PasswordSchema (register/reset) rejects this; LoginSchema MUST accept
    // so bcrypt-compare can return 401 instead of Zod returning 400.
    expect(LoginSchema.safeParse({ ...valid, password: 'WrongPassword!' }).success).toBe(true);
  });

  it('should accept a non-ASCII password (legacy user with umlaut must still log in)', () => {
    // Pre-ADR-056 users may have stored passwords containing umlauts. They
    // can't authenticate with anything new (bcrypt hash is fixed), but they
    // MUST still reach bcrypt-compare → 401 on wrong attempts and 200 on
    // the correct stored value. PasswordSchema rejects non-ASCII; LoginSchema
    // does not.
    expect(LoginSchema.safeParse({ ...valid, password: 'Prüfung12345!' }).success).toBe(true);
  });

  it('should reject password longer than 72 characters (bcrypt input-limit DoS guard)', () => {
    expect(LoginSchema.safeParse({ ...valid, password: 'a'.repeat(73) }).success).toBe(false);
  });

  it('should accept empty password (falls through to bcrypt-compare → 401, R10-symmetric)', () => {
    // R10: empty-password and wrong-password must produce the same response
    // shape as unknown-email. Returning 400 here from a min(1) refine would
    // leak that the validator rejected before auth — distinguishable signal.
    expect(LoginSchema.safeParse({ ...valid, password: '' }).success).toBe(true);
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

  it('should reject password shorter than 12 characters', () => {
    // RegisterSchema delegates to PasswordSchema (common) — min 12 chars, all 4 categories.
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
    // 13 chars (>min 12) so this isolates the missing-special-char failure mode,
    // not the length failure mode.
    expect(RegisterSchema.safeParse({ ...valid, password: 'Strong1passXX' }).success).toBe(false);
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

  it('should accept valid token + strong password (12+ chars, all 4 categories)', () => {
    // Policy tightened 2026-04-30: password must contain ALL 4 categories.
    // `valid.password = 'StrongP@ssword1'` already satisfies 4/4 (U+l+d+special).
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

  it('should reject password with only 3-of-4 categories (lowercase + digits + special, no uppercase)', () => {
    // Policy tightened 2026-04-30: ALL 4 categories required — uppercase IS mandatory now.
    // Previously this test asserted success (3-of-4 contract was the rule).
    expect(ResetPasswordSchema.safeParse({ ...valid, password: 'lowercase@123' }).success).toBe(
      false,
    );
  });

  it('should reject password with German umlaut (ASCII-only whitelist 2026-04-30)', () => {
    // Microsoft-style ASCII-only policy: non-ASCII chars rejected at first refine
    // before the category counter runs. Pre-whitelist bug: would have passed
    // silently because /[a-z]/ ignores ü.
    expect(ResetPasswordSchema.safeParse({ ...valid, password: 'Prüfung1234!A' }).success).toBe(
      false,
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
