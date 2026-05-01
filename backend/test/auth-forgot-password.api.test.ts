/**
 * ADR-051 Forgot-Password Role-Gate + Root-Initiated Reset — API Integration Tests
 *
 * Tests the two-gate defense-in-depth for self-service password reset
 * (§2.1 request-gate + §2.6 redemption-gate) plus the Root-only
 * admin-initiated reset-link endpoint (§2.7 / §2.8).
 *
 * Complements `auth-password-reset.api.test.ts` which covers the generic
 * happy-path (root user via `info@assixx.com` — role='root' despite the
 * misleading name, verified via DB) and standard validation scenarios.
 *
 * Test users (apitest tenant):
 *   - info@assixx.com         id=1   role='root'      — cached by loginApitest()
 *   - perm-test-admin@assixx.com id=13 role='admin'   — used for admin target + admin caller
 *   - employee@assixx.com      id=5   role='employee' — used for employee target + employee caller
 *
 * Cleanup discipline:
 *   - `resetTokensFor(userId)` DELETEs rows (burn is not enough — the
 *     per-pair rate-limit in §2.7 reads MAX(created_at) regardless of
 *     `used`, so stale burned tokens still trigger 429).
 *
 * @see docs/FEAT_FORGOT_PASSWORD_ROLE_GATE_MASTERPLAN.md §2.1 / §2.6 / §2.7 / §2.8
 * @see docs/infrastructure/adr/ADR-051-forgot-password-role-gate.md (pending Phase 6)
 */
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

import {
  APITEST_PASSWORD,
  type AuthState,
  BASE_URL,
  type JsonBody,
  authHeaders,
  clear2faStateForUser,
  ensureTestEmployee,
  extractCookieValue,
  fetchLatest2faCode,
  flushThrottleKeys,
  loginApitest,
} from './helpers.js';

// ───────────────────────────────────────────────────────────────────
// Test fixtures — cached across describe-blocks.
// ───────────────────────────────────────────────────────────────────

const ROOT_EMAIL = 'info@assixx.com';
const ADMIN_EMAIL = 'perm-test-admin@assixx.com';
const EMPLOYEE_EMAIL = 'employee@assixx.com';

let rootAuth: AuthState;
let adminAuth: AuthState;
let employeeAuth: AuthState;
let adminUserId: number;
let employeeUserId: number;

/**
 * Lookup a user's id by email via direct psql (assixx_user, BYPASSRLS). Used
 * by `loginAs` below to clear stale 2FA lockouts before the login attempt.
 *
 * Returns `null` if the user does not exist (caller can decide to skip the
 * pre-clean — the next test will fail loudly with 401 anyway).
 */
function queryUserIdByEmail(email: string): number | null {
  const out = execSync(
    `docker exec assixx-postgres psql -U assixx_user -d assixx -t -A -c "SELECT id FROM users WHERE email = '${email}' LIMIT 1"`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
  if (out === '') return null;
  const id = Number.parseInt(out, 10);
  return Number.isFinite(id) ? id : null;
}

/**
 * Run the full 2-step 2FA login dance for a fixture user and return the
 * resulting `AuthState` (access/refresh from Set-Cookie, user.id/tenantId from
 * the verify body). Pre-cleans `2fa:lock:{userId}` + `2fa:fail-streak:{userId}`
 * so a poisoned prior run cannot block this attempt.
 *
 * Mirrors `00-auth.api.test.ts:loginAndVerify()` (FEAT_2FA_EMAIL §Phase 4 /
 * Session 10b — adapts pre-existing files broken by Step 2.4 token-shape
 * change). Mailpit lookup is `since`-scoped — never call `clearMailpit()`
 * here (cross-worker race per §0.5.5 v0.7.2).
 */
async function loginAs(email: string, password: string): Promise<AuthState> {
  const preLookupId = queryUserIdByEmail(email);
  if (preLookupId !== null) clear2faStateForUser(preLookupId);

  const loginStartedAt = new Date();

  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!loginRes.ok) {
    throw new Error(`login failed for ${email}: ${String(loginRes.status)}`);
  }
  const loginBody = (await loginRes.json()) as JsonBody;
  if (loginBody.data?.stage !== 'challenge_required') {
    throw new Error(`unexpected login stage for ${email}: ${String(loginBody.data?.stage)}`);
  }
  const challengeToken = extractCookieValue(loginRes.headers.getSetCookie(), 'challengeToken');
  if (challengeToken === null) {
    throw new Error(`no challengeToken cookie for ${email}`);
  }

  const code = await fetchLatest2faCode(email, 10_000, loginStartedAt);
  const verifyRes = await fetch(`${BASE_URL}/auth/2fa/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `challengeToken=${challengeToken}`,
      // ADR-050 + ADR-054: pin the verify to the apitest tenant subdomain
      // so the same-origin Set-Cookie branch fires (helpers.ts mirror).
      'X-Forwarded-Host': 'assixx.assixx.com',
    },
    body: JSON.stringify({ code }),
  });
  if (!verifyRes.ok) {
    throw new Error(`2fa verify failed for ${email}: ${String(verifyRes.status)}`);
  }
  const verifyBody = (await verifyRes.json()) as JsonBody;
  const setCookies = verifyRes.headers.getSetCookie();
  const accessToken = extractCookieValue(setCookies, 'accessToken');
  const refreshToken = extractCookieValue(setCookies, 'refreshToken');
  if (accessToken === null || refreshToken === null) {
    throw new Error(`no token cookies for ${email}`);
  }

  return {
    authToken: accessToken,
    refreshToken,
    userId: verifyBody.data.user.id as number,
    tenantId: verifyBody.data.user.tenantId as number,
  };
}

beforeAll(async () => {
  flushThrottleKeys();

  // info@assixx.com is actually role='root' — cached login returns Root JWT.
  rootAuth = await loginApitest();

  // Idempotent — creates employee@assixx.com if missing with APITEST_PASSWORD.
  employeeUserId = await ensureTestEmployee(rootAuth.authToken);

  // Separate JWTs for 403 RBAC tests on the Root-only endpoint. Cached
  // per-run to avoid auth-throttle churn.
  adminAuth = await loginAs(ADMIN_EMAIL, APITEST_PASSWORD);
  employeeAuth = await loginAs(EMPLOYEE_EMAIL, APITEST_PASSWORD);
  adminUserId = adminAuth.userId;

  flushThrottleKeys();
});

/**
 * DELETE all password-reset tokens for a user.
 *
 * `burn` (UPDATE used=true) is NOT sufficient for cleanup across tests: the
 * per-pair rate-limit in §2.7 reads `MAX(created_at)` regardless of `used`,
 * so a burned token from a prior test still triggers 429 within 15 min.
 */
function resetTokensFor(userId: number): void {
  execSync(
    `docker exec assixx-postgres psql -U assixx_user -d assixx -c "DELETE FROM password_reset_tokens WHERE user_id=${userId};"`,
    { stdio: 'pipe' },
  );
}

function countOpenTokens(userId: number): number {
  const out = execSync(
    `docker exec assixx-postgres psql -U assixx_user -d assixx -tAc "SELECT COUNT(*) FROM password_reset_tokens WHERE user_id=${userId} AND used=false AND expires_at > NOW();"`,
  )
    .toString()
    .trim();
  return parseInt(out, 10);
}

function countTokensByInitiator(userId: number, initiatorId: number): number {
  const out = execSync(
    `docker exec assixx-postgres psql -U assixx_user -d assixx -tAc "SELECT COUNT(*) FROM password_reset_tokens WHERE user_id=${userId} AND initiated_by_user_id=${initiatorId};"`,
  )
    .toString()
    .trim();
  return parseInt(out, 10);
}

/**
 * Insert a reset token directly via SQL and return the RAW token (bypasses
 * the §2.1 request-gate — needed to test §2.6/§2.8 redemption in isolation
 * from the request-gate).
 *
 * `initiatorId = null` → self-service shape; `initiatorId = <rootId>` →
 * admin-initiated shape (§2.8 origin-check branch).
 */
function insertResetToken(userId: number, initiatorId: number | null = null): string {
  const raw = `api-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const initCol = initiatorId !== null ? ', initiated_by_user_id' : '';
  const initVal = initiatorId !== null ? `, ${initiatorId}` : '';
  execSync(
    `docker exec assixx-postgres psql -U assixx_user -d assixx -c "INSERT INTO password_reset_tokens (user_id, token, expires_at, used${initCol}) VALUES (${userId}, '${hash}', NOW() + INTERVAL '1 hour', false${initVal});"`,
    { stdio: 'pipe' },
  );
  return raw;
}

// ═══════════════════════════════════════════════════════════════════
// §2.1 REQUEST GATE — role-based block + R1 enumeration contract
// ═══════════════════════════════════════════════════════════════════

describe('ADR-051 §2.1 — Request Gate', () => {
  it('should block admin with blocked=true + reason=ROLE_NOT_ALLOWED (no token created)', async () => {
    flushThrottleKeys();
    resetTokensFor(adminUserId);

    const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.blocked).toBe(true);
    expect(body.data.reason).toBe('ROLE_NOT_ALLOWED');
    expect(body.data.message).toContain('Falls ein Konto');

    // Block path is side-effect-free on the DB — no token row created.
    expect(countOpenTokens(adminUserId)).toBe(0);
  });

  it('should block employee with same blocked-response shape', async () => {
    flushThrottleKeys();
    resetTokensFor(employeeUserId);

    const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMPLOYEE_EMAIL }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.blocked).toBe(true);
    expect(body.data.reason).toBe('ROLE_NOT_ALLOWED');
    expect(countOpenTokens(employeeUserId)).toBe(0);
  });

  it('should return byte-identical body for root happy-path vs silent-drop (R1 enumeration-safe)', async () => {
    flushThrottleKeys();
    resetTokensFor(rootAuth.userId);

    // Root happy path → real token issued
    const rootRes = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ROOT_EMAIL }),
    });
    const rootBody = (await rootRes.json()) as JsonBody;

    flushThrottleKeys();

    // Silent-drop for non-existent email
    const silentRes = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent-ghost-xyz@nowhere.de' }),
    });
    const silentBody = (await silentRes.json()) as JsonBody;

    // Same HTTP status, same envelope, same message, NO `blocked` / `reason`.
    // This is the R1 invariant: an attacker cannot distinguish "email exists
    // as root" from "email doesn't exist" via the response shape.
    expect(rootRes.status).toBe(silentRes.status);
    expect(rootBody.data.message).toBe(silentBody.data.message);
    expect(rootBody.data.blocked).toBeUndefined();
    expect(rootBody.data.reason).toBeUndefined();
    expect(silentBody.data.blocked).toBeUndefined();
    expect(silentBody.data.reason).toBeUndefined();

    // Cleanup — the root path left a real token behind.
    resetTokensFor(rootAuth.userId);
  });
});

// ═══════════════════════════════════════════════════════════════════
// §2.6 REDEMPTION GATE — self-service tokens for non-root targets
// ═══════════════════════════════════════════════════════════════════

describe('ADR-051 §2.6 — Redemption Gate', () => {
  it('should burn token + 403 when self-service token targets admin', async () => {
    flushThrottleKeys();
    resetTokensFor(adminUserId);
    // Bypass §2.1 — insert directly to isolate the redemption-gate.
    const rawToken = insertResetToken(adminUserId, null);

    const res = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rawToken, password: 'NewStrongPass123!' }),
    });

    // 403 ForbiddenException — code marker is in the response body; the
    // exact envelope shape (body.error vs body.data.code) depends on the
    // global exception filter, so we check the serialized body for the
    // code string rather than pinning a specific path.
    expect(res.status).toBe(403);
    const bodyStr = await res.text();
    expect(bodyStr).toContain('ROLE_NOT_ALLOWED');

    // Token was burned — retry impossible (R9).
    expect(countOpenTokens(adminUserId)).toBe(0);
  });

  it('should burn token + 403 when self-service token targets employee', async () => {
    flushThrottleKeys();
    resetTokensFor(employeeUserId);
    const rawToken = insertResetToken(employeeUserId, null);

    const res = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rawToken, password: 'NewStrongPass123!' }),
    });

    expect(res.status).toBe(403);
    expect(countOpenTokens(employeeUserId)).toBe(0);
  });

  it('should return 401 + burn token when target became inactive after issuance (generic — no role leak)', async () => {
    flushThrottleKeys();
    // Use an existing soft-deleted employee (is_active=4) from seed data.
    // Modifying a live user's is_active would corrupt other tests.
    const raw = execSync(
      `docker exec assixx-postgres psql -U assixx_user -d assixx -tAc "SELECT id FROM users WHERE tenant_id=1 AND is_active=4 AND role='employee' LIMIT 1;"`,
    )
      .toString()
      .trim();
    if (raw === '') {
      // No soft-deleted seed user — skip silently. The DB query at the top
      // of this test file showed 10+ such users under tenant 1.
      return;
    }
    const inactiveId = parseInt(raw, 10);
    resetTokensFor(inactiveId);
    const token = insertResetToken(inactiveId, null);

    const res = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: 'NewStrongPass123!' }),
    });

    // Generic 401 — keeps role + is_active private. Token burned for retry.
    expect(res.status).toBe(401);
    expect(countOpenTokens(inactiveId)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// §2.7 ROOT-INITIATED ENDPOINT — POST /users/:id/send-password-reset-link
// Strict @Roles('root') — narrower than ADR-045 Layer-1 (§0.2.5 #13).
// Per-pair rate-limit 1/15 min via DB-check on MAX(created_at).
// ═══════════════════════════════════════════════════════════════════

describe('ADR-051 §2.7 — Root-Initiated Reset Endpoint', () => {
  it('should issue token with initiated_by_user_id and return 200 for Root → active admin target', async () => {
    flushThrottleKeys();
    resetTokensFor(adminUserId);

    const res = await fetch(`${BASE_URL}/users/${adminUserId}/send-password-reset-link`, {
      method: 'POST',
      headers: authHeaders(rootAuth.authToken),
      body: JSON.stringify({}),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.message).toContain('E-Mail gesendet');

    // THE invariant §2.8 origin-check depends on: initiated_by_user_id
    // column carries the initiator Root's user-id.
    expect(countTokensByInitiator(adminUserId, rootAuth.userId)).toBe(1);

    resetTokensFor(adminUserId);
  });

  it('should issue token for Root → active employee target', async () => {
    flushThrottleKeys();
    resetTokensFor(employeeUserId);

    const res = await fetch(`${BASE_URL}/users/${employeeUserId}/send-password-reset-link`, {
      method: 'POST',
      headers: authHeaders(rootAuth.authToken),
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    expect(countTokensByInitiator(employeeUserId, rootAuth.userId)).toBe(1);

    resetTokensFor(employeeUserId);
  });

  it('should return 400 INVALID_TARGET_ROLE when Root targets another Root (prevents Root-takeover chains)', async () => {
    flushThrottleKeys();
    // §0.2.5 #12: Root-on-Root rejected. Root targeting themselves hits
    // the same guard — no test-tenant-wide side-effect setup needed.
    const res = await fetch(`${BASE_URL}/users/${rootAuth.userId}/send-password-reset-link`, {
      method: 'POST',
      headers: authHeaders(rootAuth.authToken),
      body: JSON.stringify({}),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(400);
    expect(JSON.stringify(body)).toContain('INVALID_TARGET_ROLE');
    // No token for Root — rejected before the INSERT.
    expect(countTokensByInitiator(rootAuth.userId, rootAuth.userId)).toBe(0);
  });

  it('should return 403 Forbidden when caller is admin (narrower than ADR-045 Layer-1)', async () => {
    flushThrottleKeys();
    // Admin (not Root) calling the Root-only endpoint — RolesGuard rejects
    // BEFORE the service logic runs. hasFullAccess is NOT sufficient.
    const res = await fetch(`${BASE_URL}/users/${employeeUserId}/send-password-reset-link`, {
      method: 'POST',
      headers: authHeaders(adminAuth.authToken),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  it('should return 403 Forbidden when caller is employee', async () => {
    flushThrottleKeys();
    const res = await fetch(`${BASE_URL}/users/${adminUserId}/send-password-reset-link`, {
      method: 'POST',
      headers: authHeaders(employeeAuth.authToken),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  it('should return 401 Unauthorized when unauthenticated', async () => {
    flushThrottleKeys();
    const res = await fetch(`${BASE_URL}/users/${adminUserId}/send-password-reset-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it('should return 429 RATE_LIMIT on 2nd request within 15 min from same (root, target) pair', async () => {
    flushThrottleKeys();
    // Per-pair rate-limit is DB-based (MAX(created_at)) — completely
    // independent of the IP-throttle. resetTokensFor clears the window.
    resetTokensFor(adminUserId);

    const res1 = await fetch(`${BASE_URL}/users/${adminUserId}/send-password-reset-link`, {
      method: 'POST',
      headers: authHeaders(rootAuth.authToken),
      body: JSON.stringify({}),
    });
    expect(res1.status).toBe(200);

    flushThrottleKeys(); // exclude IP-throttle noise

    const res2 = await fetch(`${BASE_URL}/users/${adminUserId}/send-password-reset-link`, {
      method: 'POST',
      headers: authHeaders(rootAuth.authToken),
      body: JSON.stringify({}),
    });
    const body2 = (await res2.json()) as JsonBody;

    expect(res2.status).toBe(429);
    expect(JSON.stringify(body2)).toContain('RATE_LIMIT');

    // Only 1 token exists (2nd was rejected before INSERT).
    expect(countTokensByInitiator(adminUserId, rootAuth.userId)).toBe(1);
    resetTokensFor(adminUserId);
  });
});

// ═══════════════════════════════════════════════════════════════════
// §2.8 ADMIN-INITIATED REDEMPTION — origin-check + initiator-lifecycle
// ═══════════════════════════════════════════════════════════════════

describe('ADR-051 §2.8 — Admin-Initiated Token Redemption', () => {
  it('should allow redemption of admin-initiated token for admin target (bypasses §2.6 role-gate)', async () => {
    flushThrottleKeys();
    resetTokensFor(adminUserId);

    // admin target (perm-test-admin@assixx.com) — §2.6 self-service gate
    // would 403 this, but §2.8 origin-check recognizes the admin-initiated
    // token (initiated_by_user_id = rootAuth.userId) and routes around it.
    const rawToken = insertResetToken(adminUserId, rootAuth.userId);
    const newPassword = 'AdminTempPass789!';

    const res = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rawToken, password: newPassword }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.message).toContain('erfolgreich');

    // Verify password actually changed — login with new password succeeds.
    // Under the post-DD-10 contract `/auth/login` returns 200 +
    // `stage: 'challenge_required'` for any user with valid credentials, so
    // we assert on the discriminated-union shape rather than completing the
    // 2FA dance (the credential check is what proves the password change
    // worked; verifying the 2FA code adds Mailpit round-trips for no extra
    // signal here).
    flushThrottleKeys();
    clear2faStateForUser(adminUserId);
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: newPassword }),
    });
    const loginBody = (await loginRes.json()) as JsonBody;
    expect(loginRes.status).toBe(200);
    expect(loginBody.data.stage).toBe('challenge_required');

    // Restore original password — also via admin-initiated token so we
    // don't need a separate bcrypt-hash fixture. resetTokensFor clears the
    // rate-limit window from the test above.
    flushThrottleKeys();
    resetTokensFor(adminUserId);
    const restoreRaw = insertResetToken(adminUserId, rootAuth.userId);
    const restoreRes = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: restoreRaw, password: APITEST_PASSWORD }),
    });
    expect(restoreRes.status).toBe(200);
  });

  it('should fall through to §2.6 role-gate (burn + 403) when initiated_by_user_id is NULL on admin target', async () => {
    // Simulates the FK ON DELETE SET NULL scenario: Root deleted →
    // initiated_by_user_id becomes NULL → token looks like self-service →
    // §2.6 role-gate triggers → 403 + burn. This is THE defensive default
    // documented in the Phase 1 migration header comment (ghost initiator
    // degrades to STRICTER path, not looser).
    flushThrottleKeys();
    resetTokensFor(adminUserId);
    const rawToken = insertResetToken(adminUserId, null); // NULL = ghost initiator

    const res = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rawToken, password: 'NewStrongPass123!' }),
    });

    expect(res.status).toBe(403);
    expect(countOpenTokens(adminUserId)).toBe(0);
  });
});
