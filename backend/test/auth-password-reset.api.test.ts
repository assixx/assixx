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
  invalidateAuthCache,
  loginApitest,
} from './helpers.js';

/**
 * Pre-generated bcrypt hash of `ApiTest12345!` (12 rounds, $2b$).
 *
 * Used by the `afterAll` cleanup in 'Reset Password: Full E2E flow' to
 * GUARANTEE the test-tenant root password is restored even if any prior
 * `it()` in the describe block throws. The previous-generation cleanup
 * was an `it('should restore original password')` block that skipped
 * silently when an earlier `it()` threw, leaving the persisted hash on
 * `NewApiTestPass123!` for the next suite run and breaking every
 * downstream test with 401 "E-Mail oder Passwort falsch" (root cause
 * traced 2026-04-30, see commit message). The `it` is retained as an
 * API-level smoke test; the `afterAll` is the durable correctness guard.
 *
 * Why hardcoded vs computed at runtime:
 *   - pgcrypto is NOT enabled on this DB (only `pg_partman`), so
 *     `crypt() + gen_salt('bf')` is unavailable.
 *   - bcrypt is not in the test's `package.json` runtime deps; pulling
 *     it in just for cleanup would balloon the test surface.
 *   - bcrypt salts are non-deterministic, but `bcrypt.compare()` extracts
 *     the salt from the stored hash on every check — the exact bytes are
 *     not security-relevant for a known-public test password.
 *
 * Regenerate with (any valid hash of the same password works):
 *   python3 -c "import bcrypt; print(bcrypt.hashpw(b'ApiTest12345!', bcrypt.gensalt(rounds=12)).decode())"
 */
const APITEST_PASSWORD_HASH = '$2b$12$prrw1rbzjK7Z0cuYiu1Y7uNabZqGQPsVhNmgGyt7hQK66RZ79cLZK';

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
      body: JSON.stringify({ email: 'info@assixx.com' }),
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

  // Defense-in-depth cleanup: even if an `it()` below throws (or the
  // dedicated 'should restore original password' it() fails), this
  // afterAll runs unconditionally and atomically restores the password
  // hash via direct SQL UPDATE — no /reset-password API call, no token
  // round-trip, no throttle dependency. See APITEST_PASSWORD_HASH JSDoc
  // for the root-cause incident this guards against.
  //
  // CRITICAL: SQL is piped via STDIN, not embedded in the `-c` argument.
  // bcrypt hashes contain literal `$2b$12$` sequences. When the SQL is
  // embedded in a shell command-line argument, `execSync(cmd)` runs it
  // through `/bin/sh -c <cmd>`; the inner shell then treats `$2`/`$12`
  // as POSITIONAL PARAMETERS (empty) and silently mangles the hash to
  // `'b$mangled-rest'`, corrupting the DB row. Symptoms: every login
  // for `info@assixx.com` returns 401 across the entire next suite run
  // until manual repair. The same pattern is used safely in
  // `global-teardown.ts:209-213` — stdin avoids both layers of shell
  // expansion. See git history for the 2026-04-30 incident.
  afterAll(() => {
    const sql = `UPDATE users SET password = '${APITEST_PASSWORD_HASH}', updated_at = NOW() WHERE email = 'info@assixx.com';`;
    execSync('docker exec -i assixx-postgres psql -U assixx_user -d assixx -v ON_ERROR_STOP=1', {
      input: sql,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    flushThrottleKeys();
    // Drop the cached auth so the next file's `loginApitest()` rebuilds via
    // a fresh login + 2FA verify against the just-restored password. The
    // 'should restore original password (cleanup)' it() above writes
    // `auth.authToken = verifyBody.data.accessToken` — but post-2FA that
    // value is `undefined` (success-response now carries `data.stage`,
    // see ADR-005). Without this nullification the cached `authToken`
    // stays `undefined` for the rest of the suite → 401-cascade across
    // ~47 downstream files. invalidateAuthCache() doc carries the full
    // root-cause incident write-up.
    invalidateAuthCache();
  });

  it('should create a reset token in DB via forgot-password', async () => {
    flushThrottleKeys();

    // Trigger forgot-password for apitest admin
    const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'info@assixx.com' }),
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
        email: 'info@assixx.com',
        password: 'NewApiTestPass123!',
      }),
    });
    const body = (await res.json()) as JsonBody;

    // Post-DD-10: `/auth/login` issues a 2FA challenge instead of tokens
    // (FEAT_2FA_EMAIL Step 2.4 + ADR-005). The credential check is what we
    // care about here — `stage: 'challenge_required'` proves the password
    // change worked. We deliberately don't run the 2FA verify step: an
    // accepted credential is the signal under test, and the afterAll SQL
    // restore cleans up the password without needing a fresh JWT here.
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.stage).toBe('challenge_required');
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

    // Verify original password works.
    // Post-DD-10: `/auth/login` returns `stage: 'challenge_required'` for any
    // valid credentials — that 200 + challenge-shape IS the credential-check
    // signal. Token refresh is handled by `invalidateAuthCache()` in
    // afterAll: the next file's `loginApitest()` rebuilds via fresh
    // login + 2FA verify. Direct mutation of `auth.authToken` (which used to
    // happen here) silently wrote `undefined` into the shared cache and
    // cascaded 401s across ~47 downstream files — see invalidateAuthCache()
    // JSDoc + the 2026-04-30 incident write-up.
    flushThrottleKeys();
    const verifyRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'info@assixx.com',
        password: APITEST_PASSWORD,
      }),
    });
    const verifyBody = (await verifyRes.json()) as JsonBody;

    expect(verifyRes.status).toBe(200);
    expect(verifyBody.success).toBe(true);
    expect(verifyBody.data.stage).toBe('challenge_required');
  });
});
