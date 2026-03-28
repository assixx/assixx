import { describe, expect, it } from 'vitest';

import { ConnectionTicketSchema } from './connection-ticket.dto.js';
import { LoginSchema } from './login.dto.js';
import { RefreshSchema } from './refresh.dto.js';
import { RegisterSchema } from './register.dto.js';

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
