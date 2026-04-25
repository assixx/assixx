/**
 * Password Reset API Integration Tests
 *
 * Tests: POST /auth/forgot-password + POST /auth/reset-password
 * Security: email enumeration prevention, token expiry, rate limiting
 *
 * @see ADR-003 (Notification System) for email integration context
 */
import { execSync } from 'node:child_process';

import {
  APITEST_PASSWORD,
  type AuthState,
  BASE_URL,
  type JsonBody,
  flushThrottleKeys,
  loginApitest,
} from './helpers.js';

let auth: AuthState;

beforeAll(async () => {
  auth = await loginApitest();
});

// ─── Forgot Password: Generic Response (Email Enumeration Prevention) ────────

describe('Forgot Password: Existing user', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    flushThrottleKeys();
    res = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@apitest.de' }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return success true', () => {
    expect(body.success).toBe(true);
  });

  it('should return generic message (no email enumeration)', () => {
    expect(body.data.message).toContain('Falls ein Konto');
  });
});

describe('Forgot Password: Non-existing email', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    flushThrottleKeys();
    res = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'does-not-exist-xyz@example.com' }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK (same as existing user)', () => {
    expect(res.status).toBe(200);
  });

  it('should return identical generic message', () => {
    expect(body.success).toBe(true);
    expect(body.data.message).toContain('Falls ein Konto');
  });
});

describe('Forgot Password: Invalid email format', () => {
  let res: Response;

  beforeAll(async () => {
    flushThrottleKeys();
    res = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });
  });

  it('should return 400 Bad Request', () => {
    expect(res.status).toBe(400);
  });
});

describe('Forgot Password: Empty body', () => {
  let res: Response;

  beforeAll(async () => {
    flushThrottleKeys();
    res = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  });

  it('should return 400 Bad Request', () => {
    expect(res.status).toBe(400);
  });
});

// ─── Reset Password: Token Validation ────────────────────────────────────────

describe('Reset Password: Invalid token', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    flushThrottleKeys();
    res = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'invalid-token-that-does-not-exist',
        password: 'NewSecurePassword123!',
      }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 401 Unauthorized', () => {
    expect(res.status).toBe(401);
  });

  it('should return error message about invalid link', () => {
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });
});

describe('Reset Password: Missing token', () => {
  let res: Response;

  beforeAll(async () => {
    flushThrottleKeys();
    res = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: '',
        password: 'NewSecurePassword123!',
      }),
    });
  });

  it('should return 400 Bad Request', () => {
    expect(res.status).toBe(400);
  });
});

describe('Reset Password: Weak password', () => {
  let res: Response;

  beforeAll(async () => {
    flushThrottleKeys();
    res = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'some-token',
        password: 'weak',
      }),
    });
  });

  it('should return 400 Bad Request (password validation)', () => {
    expect(res.status).toBe(400);
  });
});

// ─── Full Flow: Request → Token → Reset → Login ─────────────────────────────

describe('Reset Password: Full E2E flow', () => {
  let resetToken: string;

  it('should create a reset token in DB via forgot-password', async () => {
    flushThrottleKeys();

    // Trigger forgot-password for apitest admin
    const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@apitest.de' }),
    });
    expect(res.status).toBe(200);

    // Extract raw token from DB (in real life, user gets it via email link)
    // We read the HASHED token from DB and need the raw token — but we can't reverse SHA-256.
    // Instead, we'll insert a known token directly for testing purposes.
    const knownToken = 'e2e-test-token-' + Date.now();
    const crypto = await import('node:crypto');
    const tokenHash = crypto.createHash('sha256').update(knownToken).digest('hex');

    // Insert test token for apitest admin (user_id from auth state)
    execSync(
      `docker exec assixx-postgres psql -U assixx_user -d assixx -c "
        INSERT INTO password_reset_tokens (user_id, token, expires_at, used)
        VALUES (${auth.userId}, '${tokenHash}', NOW() + INTERVAL '1 hour', false);"`,
      { stdio: 'pipe' },
    );

    resetToken = knownToken;
  });

  it('should reset password with valid token', async () => {
    flushThrottleKeys();

    const newPassword = 'NewApiTestPass123!';
    const res = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: resetToken,
        password: newPassword,
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.message).toContain('erfolgreich');
  });

  it('should reject reuse of same token', async () => {
    flushThrottleKeys();

    const res = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: resetToken,
        password: 'AnotherPassword123!',
      }),
    });

    expect(res.status).toBe(401);
  });

  it('should login with new password', async () => {
    flushThrottleKeys();

    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@apitest.de',
        password: 'NewApiTestPass123!',
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeTypeOf('string');
  });

  it('should restore original password (cleanup)', async () => {
    flushThrottleKeys();

    // Use the reset-password endpoint itself to restore — avoids bcrypt $-escaping in shell
    const crypto = await import('node:crypto');
    const restoreToken = 'restore-test-token-' + Date.now();
    const restoreHash = crypto.createHash('sha256').update(restoreToken).digest('hex');

    // Insert a fresh reset token for the apitest admin
    execSync(
      `docker exec assixx-postgres psql -U assixx_user -d assixx -c "
        INSERT INTO password_reset_tokens (user_id, token, expires_at, used)
        VALUES (${auth.userId}, '${restoreHash}', NOW() + INTERVAL '1 hour', false);"`,
      { stdio: 'pipe' },
    );

    // Reset to original password via API
    const resetRes = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: restoreToken,
        password: APITEST_PASSWORD,
      }),
    });
    expect(resetRes.status).toBe(200);

    // Verify original password works
    flushThrottleKeys();
    const verifyRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@apitest.de',
        password: APITEST_PASSWORD,
      }),
    });
    const verifyBody = (await verifyRes.json()) as JsonBody;

    expect(verifyRes.status).toBe(200);
    expect(verifyBody.success).toBe(true);

    // Refresh cached auth state for subsequent test files
    auth.authToken = verifyBody.data.accessToken;
    auth.refreshToken = verifyBody.data.refreshToken;
  });
});
