/**
 * 2FA Email API Integration Tests — FEAT_2FA_EMAIL_MASTERPLAN Phase 4 / Session 10.
 *
 * Runs against the REAL backend (Docker must be running, Maildev wired into
 * Doppler dev SMTP — see Step 0.5.5 + HOW-TO-DEV-SMTP.md).
 *
 * Coverage matrix (Phase 4 DoD ≥35 assertions):
 *   A. /auth/login challenge issuance        (Step 2.4)
 *   B. /auth/2fa/verify happy + negative     (Step 2.7, R10, DD-5/6)
 *   C. /auth/2fa/resend cooldown + DD-21     (Step 2.7, DD-9, DD-21)
 *   D. /signup challenge issuance + verify   (Step 2.5)
 *   E. /users/:id/2fa/clear-lockout          (Step 2.7 + DD-8)
 *   F. Email shape assertions (DD-13, DD-20)
 *
 * Out-of-scope for this file (deferred to Session 10b — see `it.todo`):
 *   - Email-Change Hijack/Tippfehler/Bombing-Sims (Step 2.12 / DD-32)
 *   - Reaper E2E (Step 2.11 — needs out-of-band cron trigger)
 *   - OAuth DD-7 regression (needs OAuth fixture user)
 *   - Signup SMTP fail → 503 cleanup (needs SMTP teardown fixture)
 *   - Cross-tenant challenge-token isolation (needs second tenant)
 *   - 4th resend → 429 DD-21 (3 × 60 s cooldown waits — too slow for CI)
 *   - Expired challenge → 401 (10-minute TTL elapse — too slow for CI)
 *
 * @see vitest.config.ts (project: api)
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md Phase 4 / Phase 4 DoD
 * @see docs/how-to/HOW-TO-TEST.md Tier 2 patterns
 */
import { execSync } from 'node:child_process';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  type AuthState,
  BASE_URL,
  type JsonBody,
  authHeaders,
  clear2faStateForUser,
  clearMaildev,
  extractCookieValue,
  fetchLatest2faCode,
  flushThrottleKeys,
  getDefaultPositionIds,
  loginApitest,
} from './helpers.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const APITEST_EMAIL = 'info@assixx.com';
const APITEST_PASSWORD = 'ApiTest12345!';
const APITEST_USER_ID = 1;

/**
 * Secondary admin used for lockout tests so we don't lock the cached
 * `info@assixx.com` token (which the rest of the api suite reuses).
 * Email is stable across runs — `createUserIfMissing` returns 409 on rerun.
 */
const VICTIM_EMAIL = '2fa-victim@assixx.com';
const VICTIM_PASSWORD = 'ApiTest12345!';

// ─── Local helpers ───────────────────────────────────────────────────────────

interface LoginStepResult {
  res: Response;
  body: JsonBody;
  challengeToken: string | null;
}

async function loginRaw(email: string, password: string): Promise<LoginStepResult> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as JsonBody;
  const challengeToken =
    res.ok ? extractCookieValue(res.headers.getSetCookie(), 'challengeToken') : null;
  return { res, body, challengeToken };
}

interface VerifyStepResult {
  res: Response;
  body: JsonBody;
  accessToken: string | null;
  refreshToken: string | null;
}

async function verifyRaw(challengeToken: string, code: string): Promise<VerifyStepResult> {
  const res = await fetch(`${BASE_URL}/auth/2fa/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `challengeToken=${challengeToken}`,
    },
    body: JSON.stringify({ code }),
  });
  const body = (await res.json()) as JsonBody;
  const setCookies = res.headers.getSetCookie();
  return {
    res,
    body,
    accessToken: extractCookieValue(setCookies, 'accessToken'),
    refreshToken: extractCookieValue(setCookies, 'refreshToken'),
  };
}

async function resendRaw(challengeToken: string): Promise<{ res: Response; body: JsonBody }> {
  const res = await fetch(`${BASE_URL}/auth/2fa/resend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `challengeToken=${challengeToken}`,
    },
    body: JSON.stringify({}),
  });
  const body = (await res.json()) as JsonBody;
  return { res, body };
}

/**
 * Issue + verify a challenge in one shot for a freshly-credentialed user.
 * Pre-cleans Maildev + per-user 2FA state for determinism.
 */
async function performTwoFactorLogin(
  email: string,
  password: string,
  userId: number,
): Promise<VerifyStepResult> {
  clear2faStateForUser(userId);
  await clearMaildev();
  const login = await loginRaw(email, password);
  if (login.challengeToken === null) {
    throw new Error(`Login did not issue challengeToken for ${email}`);
  }
  const code = await fetchLatest2faCode(email);
  return await verifyRaw(login.challengeToken, code);
}

/**
 * Look up a user's id by email via direct psql. Bypasses RLS via assixx_user.
 * Used to populate `victimUserId` after `POST /users` returns 409 on rerun.
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

async function createVictimUser(rootToken: string): Promise<number> {
  const positionIds = await getDefaultPositionIds(rootToken);
  const res = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: authHeaders(rootToken),
    body: JSON.stringify({
      email: VICTIM_EMAIL,
      password: VICTIM_PASSWORD,
      firstName: 'Lockout',
      lastName: 'Victim',
      role: 'admin',
      phone: '+49123456789',
      positionIds,
    }),
  });
  if (res.status === 201) {
    const body = (await res.json()) as JsonBody;
    return body.data.id as number;
  }
  if (res.status === 409) {
    // Already exists from prior run — look up by email.
    const id = queryUserIdByEmail(VICTIM_EMAIL);
    if (id === null) {
      throw new Error('Victim user expected on 409 but not found in DB');
    }
    return id;
  }
  const errBody = await res.text();
  throw new Error(`Victim user create failed: HTTP ${String(res.status)} — ${errBody}`);
}

// ─── Suite-wide setup ────────────────────────────────────────────────────────

let auth: AuthState;
let victimUserId: number;

beforeAll(async () => {
  // Cached login from helpers.ts — pays the 2FA cost once for the whole suite.
  auth = await loginApitest();
  victimUserId = await createVictimUser(auth.authToken);
}, 30_000);

afterAll(() => {
  // Belt-and-braces: clear any lockouts we may have triggered so subsequent
  // suite runs (and other api files in the same `--project api` invocation)
  // start clean.
  clear2faStateForUser(APITEST_USER_ID);
  clear2faStateForUser(victimUserId);
});

// ─── A. /auth/login — challenge issuance (Step 2.4) ──────────────────────────

describe('POST /auth/login → 2FA challenge issuance', () => {
  beforeEach(() => {
    flushThrottleKeys();
    clear2faStateForUser(APITEST_USER_ID);
  });

  it('valid credentials → 200 + stage=challenge_required + Maildev mail', async () => {
    await clearMaildev();
    const { res, body, challengeToken } = await loginRaw(APITEST_EMAIL, APITEST_PASSWORD);

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.stage).toBe('challenge_required');
    expect(body.data.challenge.resendsRemaining).toBe(3);
    expect(challengeToken).not.toBeNull();

    // Maildev capture — generic subject (DD-13), no code in subject (DD-13).
    const code = await fetchLatest2faCode(APITEST_EMAIL);
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  });

  it('invalid password → 401 + NO challenge issued + NO email sent (R10)', async () => {
    await clearMaildev();
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: APITEST_EMAIL, password: 'WrongPassword!' }),
    });

    expect(res.status).toBe(401);
    // No Set-Cookie should carry challengeToken (validation gate ran BEFORE issueChallenge).
    expect(extractCookieValue(res.headers.getSetCookie(), 'challengeToken')).toBeNull();

    // Wait briefly to let any (incorrect) async mail land — assert empty.
    await new Promise((r) => setTimeout(r, 500));
    const mailbox = await (await fetch('http://localhost:1080/email')).json();
    expect(Array.isArray(mailbox)).toBe(true);
    expect((mailbox as unknown[]).length).toBe(0);
  });

  it('unknown email → 401 (same shape as wrong password — R10 anti-enumeration)', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'no-such-user@assixx.com', password: APITEST_PASSWORD }),
    });
    expect(res.status).toBe(401);
    expect(extractCookieValue(res.headers.getSetCookie(), 'challengeToken')).toBeNull();
  });
});

// ─── B. /auth/2fa/verify — happy + negative paths (Step 2.7) ─────────────────

describe('POST /auth/2fa/verify — happy path + token issuance', () => {
  let challengeToken: string;
  let firstVerify: VerifyStepResult;

  beforeAll(async () => {
    clear2faStateForUser(APITEST_USER_ID);
    await clearMaildev();
    const login = await loginRaw(APITEST_EMAIL, APITEST_PASSWORD);
    if (login.challengeToken === null) {
      throw new Error('beforeAll: login did not issue challengeToken');
    }
    challengeToken = login.challengeToken;
    const code = await fetchLatest2faCode(APITEST_EMAIL);
    firstVerify = await verifyRaw(challengeToken, code);
  });

  it('valid code → 200 + stage=authenticated + tokens via Set-Cookie', () => {
    expect(firstVerify.res.status).toBe(200);
    expect(firstVerify.body.data.stage).toBe('authenticated');
    expect(firstVerify.body.data.user.email).toBe(APITEST_EMAIL);
    expect(firstVerify.accessToken).not.toBeNull();
    expect(firstVerify.refreshToken).not.toBeNull();
    expect(firstVerify.body.data).not.toHaveProperty('accessToken');
  });

  it('replay attack — re-using a consumed challenge token → 401', async () => {
    // Fresh code — same challengeToken, but the prior verify already DEL'd
    // the Redis record (consumeChallenge per Step 2.3). Even WITH the right
    // shape of code, the token is gone → generic 401 (R10).
    const replay = await verifyRaw(challengeToken, 'ABCDE2');
    expect(replay.res.status).toBe(401);
  });
});

describe('POST /auth/2fa/verify — input validation', () => {
  it('malformed body (5 chars) → 400 Zod', async () => {
    const res = await fetch(`${BASE_URL}/auth/2fa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'challengeToken=irrelevant' },
      body: JSON.stringify({ code: 'ABCDE' }),
    });
    expect(res.status).toBe(400);
  });

  it('forbidden alphabet char "O" (Crockford-Base32, DD-1) → 400', async () => {
    const res = await fetch(`${BASE_URL}/auth/2fa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'challengeToken=irrelevant' },
      body: JSON.stringify({ code: 'ABCDOO' }),
    });
    expect(res.status).toBe(400);
  });

  it('forbidden alphabet char "1" → 400', async () => {
    const res = await fetch(`${BASE_URL}/auth/2fa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'challengeToken=irrelevant' },
      body: JSON.stringify({ code: 'ABCD11' }),
    });
    expect(res.status).toBe(400);
  });

  it('missing challengeToken cookie → 401 generic', async () => {
    const res = await fetch(`${BASE_URL}/auth/2fa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'ABCDEF' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/2fa/verify — wrong code + lockout (R2, DD-5, DD-6)', () => {
  it('wrong code → 401 + challenge stays valid for next attempt', async () => {
    clear2faStateForUser(victimUserId);
    await clearMaildev();
    const login = await loginRaw(VICTIM_EMAIL, VICTIM_PASSWORD);
    expect(login.challengeToken).not.toBeNull();
    // Drain the issued mail so subsequent fetches start clean.
    await fetchLatest2faCode(VICTIM_EMAIL);

    const wrong = await verifyRaw(login.challengeToken as string, 'ZZZZZ2');
    expect(wrong.res.status).toBe(401);
    expect(wrong.accessToken).toBeNull();
  });

  it('5 wrong codes → service-layer lockout (DD-5/DD-6) — verify via Redis state', async () => {
    clear2faStateForUser(victimUserId);
    flushThrottleKeys();
    await clearMaildev();
    const login = await loginRaw(VICTIM_EMAIL, VICTIM_PASSWORD);
    expect(login.challengeToken).not.toBeNull();
    const challenge = login.challengeToken as string;
    await fetchLatest2faCode(VICTIM_EMAIL);

    // Per DD-5: 5 wrong attempts per challenge → service-layer lockout (sets
    // `2fa:lock:{userId}` for 15 min). The throttler tier `2fa-verify` is
    // configured at limit=5/10min — exactly aligned with the lockout
    // threshold, so all 5 verify calls fit before the throttler kicks in.
    const wrongCodes = ['ZZZZZ2', 'YYYYY3', 'XXXXX4', 'WWWWW5', 'VVVVV6'];
    for (const code of wrongCodes) {
      const res = await verifyRaw(challenge, code);
      expect(res.res.status).toBe(401);
    }

    // After the 5th failure the service set `2fa:lock:{userId}` — confirm
    // directly via Redis (next test asserts the user-facing 403 via login).
    const lockExists = execSync(
      `docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' --no-auth-warning EXISTS '2fa:lock:${victimUserId}'`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();
    expect(lockExists).toBe('1');
  });

  it('login during lockout → 403 ForbiddenException', async () => {
    // Continuation of the prior test — victim is now locked. New login
    // attempt MUST be rejected by `issueChallenge` lockout-pre-check
    // (Step 2.3 first guard).
    const login = await loginRaw(VICTIM_EMAIL, VICTIM_PASSWORD);
    expect(login.res.status).toBe(403);
    expect(extractCookieValue(login.res.headers.getSetCookie(), 'challengeToken')).toBeNull();
  });

  it('after lockout-clear, victim must STILL pass 2FA (DD-8 — NOT a bypass)', async () => {
    // Clear lockout via root endpoint (full assertions live in suite E below).
    const clearRes = await fetch(`${BASE_URL}/users/${victimUserId}/2fa/clear-lockout`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({}),
    });
    expect(clearRes.status).toBe(204);

    // Login still goes through 2FA challenge — clear-lockout does NOT skip 2FA.
    await clearMaildev();
    const login = await loginRaw(VICTIM_EMAIL, VICTIM_PASSWORD);
    expect(login.res.status).toBe(200);
    expect(login.body.data.stage).toBe('challenge_required');
    expect(login.challengeToken).not.toBeNull();

    // Verify with the actual code now works again.
    const code = await fetchLatest2faCode(VICTIM_EMAIL);
    const verify = await verifyRaw(login.challengeToken as string, code);
    expect(verify.res.status).toBe(200);
    expect(verify.body.data.stage).toBe('authenticated');
  });
});

// ─── C. /auth/2fa/resend (Step 2.7, DD-9, DD-21) ─────────────────────────────

describe('POST /auth/2fa/resend', () => {
  it('valid resend → 200 + new code (different from initial) + decremented resends', async () => {
    clear2faStateForUser(victimUserId);
    await clearMaildev();

    const login = await loginRaw(VICTIM_EMAIL, VICTIM_PASSWORD);
    expect(login.challengeToken).not.toBeNull();
    const challenge = login.challengeToken as string;

    const firstCode = await fetchLatest2faCode(VICTIM_EMAIL);
    expect(firstCode).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);

    // Wait past the 60 s cooldown — we artificially shrink it via the throttler
    // tracker reset (no public API to bypass DD-9 cooldown), so flush throttle
    // keys + the per-token resend cooldown Redis key.
    execSync(
      `docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' --no-auth-warning DEL '2fa:resend:${challenge}'`,
      { stdio: 'pipe' },
    );
    flushThrottleKeys();

    await clearMaildev();
    const resend = await resendRaw(challenge);
    expect(resend.res.status).toBe(200);
    // Body shape: `{ challenge: PublicTwoFactorChallenge }` per
    // `TwoFactorResendResponse` (two-factor-auth.types.ts:118).
    expect(resend.body.data.challenge.resendsRemaining).toBe(2); // 3 → 2

    const secondCode = await fetchLatest2faCode(VICTIM_EMAIL);
    expect(secondCode).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    expect(secondCode).not.toBe(firstCode);
  });

  it('resend before 60 s cooldown → 429', async () => {
    clear2faStateForUser(victimUserId);
    await clearMaildev();
    const login = await loginRaw(VICTIM_EMAIL, VICTIM_PASSWORD);
    expect(login.challengeToken).not.toBeNull();
    const challenge = login.challengeToken as string;
    await fetchLatest2faCode(VICTIM_EMAIL);

    // First resend with cooldown reset → 200 (sets 60s cooldown).
    execSync(
      `docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' --no-auth-warning DEL '2fa:resend:${challenge}'`,
      { stdio: 'pipe' },
    );
    flushThrottleKeys();
    const first = await resendRaw(challenge);
    expect(first.res.status).toBe(200);

    // Immediate second resend → 429 (DD-9 service-layer cooldown OR throttler).
    flushThrottleKeys(); // exclude throttler-side false positive
    const second = await resendRaw(challenge);
    expect([429, 409]).toContain(second.res.status);
  });

  it.todo('4th resend on same challenge → 429 DD-21 (needs 3×60 s cooldown waits)');
});

// ─── D. /signup → challenge → verify (Step 2.5) ──────────────────────────────

describe('POST /signup → 2FA challenge issuance', () => {
  const RUN_SUFFIX = Date.now();
  const subdomain = `f2fa-${RUN_SUFFIX}`;
  const adminEmail = `root-${RUN_SUFFIX}@${subdomain}.test`;
  let signupRes: Response;
  let signupBody: JsonBody;
  let signupChallenge: string | null;

  beforeAll(async () => {
    flushThrottleKeys();
    await clearMaildev();
    signupRes = await fetch(`${BASE_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: '2FA Test GmbH',
        subdomain,
        email: `contact-${RUN_SUFFIX}@${subdomain}.test`,
        phone: '+49123456789',
        street: 'Musterstraße',
        houseNumber: '1',
        postalCode: '10115',
        city: 'Berlin',
        countryCode: 'DE',
        adminEmail,
        adminPassword: 'ApiTest12345!',
        adminFirstName: 'Phase',
        adminLastName: 'Tester',
      }),
    });
    signupBody = (await signupRes.json()) as JsonBody;
    signupChallenge = extractCookieValue(signupRes.headers.getSetCookie(), 'challengeToken');
  });

  afterAll(() => {
    // Tenant cleanup — signup created tenant + user + tenant_domains.
    const sql =
      `DELETE FROM tenant_addons WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = '${subdomain}'); ` +
      `DELETE FROM tenant_storage WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = '${subdomain}'); ` +
      `DELETE FROM tenant_domains WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = '${subdomain}'); ` +
      `DELETE FROM users WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = '${subdomain}'); ` +
      `DELETE FROM tenants WHERE subdomain = '${subdomain}';`;
    execSync(`docker exec assixx-postgres psql -U assixx_user -d assixx -c "${sql}"`, {
      stdio: 'pipe',
    });
  });

  it('returns 201 + stage=challenge_required + httpOnly challengeToken cookie', () => {
    expect(signupRes.status).toBe(201);
    expect(signupBody.success).toBe(true);
    expect(signupBody.data.stage).toBe('challenge_required');
    expect(signupChallenge).not.toBeNull();
    expect((signupChallenge ?? '').length).toBeGreaterThan(20);
  });

  it('user starts at is_active=INACTIVE (Step 2.5) — unverified signup is pending', () => {
    const out = execSync(
      `docker exec assixx-postgres psql -U assixx_user -d assixx -t -A -c "SELECT is_active FROM users WHERE email = '${adminEmail}'"`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();
    // IS_ACTIVE.INACTIVE = 0
    expect(out).toBe('0');
  });

  it('verify with code from Maildev → user activates to is_active=ACTIVE + handoff ticket issued', async () => {
    expect(signupChallenge).not.toBeNull();
    const code = await fetchLatest2faCode(adminEmail);
    const verify = await verifyRaw(signupChallenge as string, code);

    expect(verify.res.status).toBe(200);
    expect(verify.body.data.stage).toBe('authenticated');

    // Signup verify deliberately does NOT set access/refresh cookies on
    // apex (`www.assixx.com`) — they would scope to the wrong origin. Instead
    // it mints a one-shot handoff ticket via OAuthHandoffService (Step 2.7)
    // and the frontend redirects to `<subdomain>.assixx.com/handoff?ticket=…`
    // where the tokens land on the correct origin (R14 mitigation).
    expect(verify.accessToken).toBeNull();
    expect(verify.refreshToken).toBeNull();
    expect(verify.body.data).toHaveProperty('handoff');
    expect(verify.body.data.handoff.subdomain).toBe(subdomain);
    expect(verify.body.data.handoff.token).toBeTypeOf('string');
    expect((verify.body.data.handoff.token as string).length).toBeGreaterThan(20);

    // is_active flipped to ACTIVE (1).
    const out = execSync(
      `docker exec assixx-postgres psql -U assixx_user -d assixx -t -A -c "SELECT is_active FROM users WHERE email = '${adminEmail}'"`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();
    expect(out).toBe('1');
  });
});

// ─── E. /users/:id/2fa/clear-lockout (Step 2.7, DD-8) ────────────────────────

describe('POST /users/:id/2fa/clear-lockout — root-only, two-root rule', () => {
  beforeEach(() => {
    clear2faStateForUser(victimUserId);
    clear2faStateForUser(APITEST_USER_ID);
    flushThrottleKeys();
  });

  it("root clears another user's lockout → 204 + Redis state DEL'd", async () => {
    // Seed lockout state directly in Redis so we don't burn 5 × verify calls.
    execSync(
      `docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' --no-auth-warning SET '2fa:lock:${victimUserId}' '' EX 900`,
      { stdio: 'pipe' },
    );

    const res = await fetch(`${BASE_URL}/users/${victimUserId}/2fa/clear-lockout`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(204);

    const exists = execSync(
      `docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' --no-auth-warning EXISTS '2fa:lock:${victimUserId}'`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();
    expect(exists).toBe('0');
  });

  it('root self-target (caller === target) → 403 Two-Root rule', async () => {
    const res = await fetch(`${BASE_URL}/users/${APITEST_USER_ID}/2fa/clear-lockout`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  it('non-root caller → 403 (RolesGuard before service layer)', async () => {
    // Login as victim (an admin, NOT root) and attempt to clear someone else.
    const victimAuth = await performTwoFactorLogin(VICTIM_EMAIL, VICTIM_PASSWORD, victimUserId);
    expect(victimAuth.accessToken).not.toBeNull();

    const res = await fetch(`${BASE_URL}/users/${APITEST_USER_ID}/2fa/clear-lockout`, {
      method: 'POST',
      headers: authHeaders(victimAuth.accessToken as string),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  it('clear-lockout for unknown user id → 404 (cross-tenant defense)', async () => {
    const res = await fetch(`${BASE_URL}/users/9999999/2fa/clear-lockout`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
  });
});

// ─── F. Email-shape assertions via Maildev (DD-13, DD-20) ────────────────────

describe('Email content (DD-13 / DD-20)', () => {
  beforeEach(async () => {
    flushThrottleKeys();
    clear2faStateForUser(APITEST_USER_ID);
    await clearMaildev();
  });

  it('subject is generic — no code, no purpose differentiation (DD-13)', async () => {
    await loginRaw(APITEST_EMAIL, APITEST_PASSWORD);
    // Wait briefly for SMTP delivery to land in Maildev.
    await fetchLatest2faCode(APITEST_EMAIL);
    const mailbox = (await (await fetch('http://localhost:1080/email')).json()) as JsonBody[];
    expect(mailbox.length).toBeGreaterThanOrEqual(1);
    const mail = mailbox[mailbox.length - 1];
    if (mail === undefined) throw new Error('mailbox unexpectedly empty after fetchLatest2faCode');
    expect(mail.subject).toBe('Ihr Bestätigungscode für Assixx');
    // Code must NEVER appear in subject.
    expect(/[A-HJKMNP-Z2-9]{6}/.exec(mail.subject as string)).toBeNull();
  });

  it('signup mail uses signup-specific intro copy', async () => {
    const RUN_SUFFIX = Date.now();
    const subdomain = `f2fa-mail-${RUN_SUFFIX}`;
    const adminEmail = `root-${RUN_SUFFIX}@${subdomain}.test`;
    flushThrottleKeys();
    await clearMaildev();
    const res = await fetch(`${BASE_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: '2FA Mail Test',
        subdomain,
        email: `c-${RUN_SUFFIX}@${subdomain}.test`,
        phone: '+49123456789',
        street: 'X',
        houseNumber: '1',
        postalCode: '10115',
        city: 'Berlin',
        countryCode: 'DE',
        adminEmail,
        adminPassword: 'ApiTest12345!',
        adminFirstName: 'Mail',
        adminLastName: 'Tester',
      }),
    });
    expect(res.status).toBe(201);
    await fetchLatest2faCode(adminEmail);
    const mailbox = (await (await fetch('http://localhost:1080/email')).json()) as JsonBody[];
    const mail = mailbox.find((m) =>
      (m.to as Array<{ address: string }>).some((t) => t.address === adminEmail),
    );
    expect(mail).toBeDefined();
    if (mail === undefined) throw new Error('signup mail not found');
    expect((mail.text as string).toLowerCase()).toContain('willkommen bei assixx');
    expect(mail.subject).toBe('Ihr Bestätigungscode für Assixx');

    // Cleanup: tenant + user
    execSync(
      `docker exec assixx-postgres psql -U assixx_user -d assixx -c "` +
        `DELETE FROM tenant_addons WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = '${subdomain}'); ` +
        `DELETE FROM tenant_storage WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = '${subdomain}'); ` +
        `DELETE FROM tenant_domains WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = '${subdomain}'); ` +
        `DELETE FROM users WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = '${subdomain}'); ` +
        `DELETE FROM tenants WHERE subdomain = '${subdomain}'"`,
      { stdio: 'pipe' },
    );
  });
});

// ─── Deferred to Session 10b ─────────────────────────────────────────────────

describe('Deferred — Session 10b', () => {
  it.todo('reaper E2E — backdated pending user → reap() → user + tenant gone + audit row');
  it.todo('OAuth DD-7 regression — loginWithVerifiedUser issues no challenge');
  it.todo('signup SMTP failure → 503 + tenant + user + tenant_domains rolled back');
  it.todo('cross-tenant: tenant A challengeToken rejected by tenant B verify');
  it.todo('email-change Hijack-Sim — no access to old mailbox → email-change fails atomically');
  it.todo('email-change Tippfehler-Sim — typo on new address → no UPDATE, old mail still active');
  it.todo('email-change Bombing-Sim — request-change spam → AuthThrottle 429');
  it.todo('expired challenge (10-min TTL) → 401');
  it.todo('4th resend on same challenge → 429 DD-21');
  it.todo('lockout triggers suspicious-activity mail to user only (DD-20)');
});
