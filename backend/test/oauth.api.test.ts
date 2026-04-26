/**
 * OAuth API Integration Tests (plan §4).
 *
 * Runs against the REAL backend (Docker must be running). No in-process mocks —
 * the test pattern is HTTP against the running `assixx-backend` container, same
 * as every other `*.api.test.ts` file in this directory.
 *
 * ── Scope / coverage map ──────────────────────────────────────────────────────
 *   Covered at this layer (HTTP + real backend):
 *     - /authorize — Zod, PKCE S256 + state UUID in redirect URL, prompt=consent gate
 *     - /callback  — Zod, provider-error branch, state-replay (R2), error-reason sanitising
 *     - /complete-signup — Zod, expired/unknown ticket, happy path via Redis-seeded ticket
 *                          (cookies set, tenant+user+oauth-link row created)
 *     - V2 link/unlink stubs — 401 unauth + 501 stub
 *     - Rate limiting — burst → 429
 *
 *   Deferred to Phase 6 manual smoke (requires Microsoft-signed id_token;
 *   backend-process HTTP mocking is not supported by this infra):
 *     - Full /callback success path with real MS code exchange
 *     - email_verified=false rejection end-to-end
 *     - Wrong `iss` rejection end-to-end
 *     - R3 duplicate-link on signup path (covered at unit level, oauth.service.test.ts)
 *     - R8 concurrent-signup race (covered at unit level)
 *
 * ── Seed strategy ─────────────────────────────────────────────────────────────
 *   Redis is reachable only via `docker exec assixx-redis redis-cli` — the host
 *   does not expose port 6379. We seed `oauth:state:{uuid}` and
 *   `oauth:signup-ticket:{uuid}` keys via execSync so callback + complete-signup
 *   paths can be exercised without a real authorize round-trip.
 */
import { execSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type AuthState,
  BASE_URL,
  type JsonBody,
  authHeaders,
  authOnly,
  loginApitest,
} from './helpers.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const OAUTH_URL = `${BASE_URL}/auth/oauth/microsoft`;
const REDIS_PASSWORD = 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0';
const MS_AUTHORIZE_ORIGIN = 'https://login.microsoftonline.com';

// ─── Redis helpers (via docker exec — Redis port 6379 is NOT exposed to host) ──

/**
 * Write a key to Redis. Value fed via stdin (-x) to avoid shell-escaping JSON.
 * TTL applied in a second command (tiny race, irrelevant for tests).
 */
function redisSet(key: string, value: string, ttlSeconds: number): void {
  execSync(
    `docker exec -i assixx-redis redis-cli -a '${REDIS_PASSWORD}' --no-auth-warning -x SET ${key}`,
    { input: value, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  execSync(
    `docker exec assixx-redis redis-cli -a '${REDIS_PASSWORD}' --no-auth-warning EXPIRE ${key} ${String(ttlSeconds)}`,
    { stdio: 'pipe' },
  );
}

function redisExists(key: string): boolean {
  const out = execSync(
    `docker exec assixx-redis redis-cli -a '${REDIS_PASSWORD}' --no-auth-warning EXISTS ${key}`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
  return out === '1';
}

function redisDeletePattern(pattern: string): void {
  execSync(
    `docker exec assixx-redis redis-cli -a '${REDIS_PASSWORD}' --no-auth-warning EVAL "local keys = redis.call('KEYS', '${pattern}') for i, k in ipairs(keys) do redis.call('DEL', k) end return #keys" 0`,
    { stdio: 'pipe' },
  );
}

function flushThrottleKeys(): void {
  execSync(
    `docker exec assixx-redis redis-cli -a '${REDIS_PASSWORD}' --no-auth-warning EVAL "local keys = redis.call('KEYS', 'throttle:*') for i, key in ipairs(keys) do redis.call('DEL', key) end return #keys" 0`,
    { stdio: 'pipe' },
  );
}

// ─── DB helpers (via docker exec psql) ───────────────────────────────────────

function countOAuthAccountsForEmail(email: string): number {
  const out = execSync(
    `docker exec assixx-postgres psql -U assixx_user -d assixx -t -A -c "SELECT COUNT(*) FROM user_oauth_accounts WHERE email = '${email}'"`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
  return Number.parseInt(out, 10);
}

function deleteTenantBySubdomain(subdomain: string): void {
  // `fk_users_tenant` is RESTRICT (not CASCADE) — delete dependents first.
  // `user_oauth_accounts.user_id` CASCADEs on users delete, so the OAuth link
  // disappears when we delete the user. `tenant_addons` / `tenant_storage`
  // reference tenant_id and need explicit cleanup.
  const sql =
    `DELETE FROM tenant_addons WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = '${subdomain}'); ` +
    `DELETE FROM tenant_storage WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = '${subdomain}'); ` +
    `DELETE FROM users WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = '${subdomain}'); ` +
    `DELETE FROM tenants WHERE subdomain = '${subdomain}';`;
  execSync(`docker exec assixx-postgres psql -U assixx_user -d assixx -c "${sql}"`, {
    stdio: 'pipe',
  });
}

// ─── Auth (for V2-stub auth'd tests) ────────────────────────────────────────

let auth: AuthState;

beforeAll(async () => {
  auth = await loginApitest();
});

// ═════════════════════════════════════════════════════════════════════════════
// A. Authorize — happy path (302 → Microsoft with PKCE + state)
// ═════════════════════════════════════════════════════════════════════════════

describe('OAuth authorize — happy path (login)', () => {
  let res: Response;
  let location: URL;

  beforeAll(async () => {
    flushThrottleKeys();
    res = await fetch(`${OAUTH_URL}/authorize?mode=login`, { redirect: 'manual' });
    const loc = res.headers.get('location');
    if (loc === null) throw new Error('no Location header');
    location = new URL(loc);
  });

  it('returns HTTP 302 Found', () => {
    expect(res.status).toBe(302);
  });

  it('redirects to the Microsoft /organizations/ authorize endpoint', () => {
    expect(location.origin).toBe(MS_AUTHORIZE_ORIGIN);
    expect(location.pathname).toBe('/organizations/oauth2/v2.0/authorize');
  });

  it('includes client_id + response_type=code + redirect_uri', () => {
    expect(location.searchParams.get('client_id')).toBeTruthy();
    expect(location.searchParams.get('response_type')).toBe('code');
    const redirectUri = location.searchParams.get('redirect_uri');
    expect(redirectUri).toContain('/api/v2/auth/oauth/microsoft/callback');
  });

  it('includes PKCE code_challenge with S256 method (R9 defence)', () => {
    const challenge = location.searchParams.get('code_challenge');
    expect(challenge).toBeTruthy();
    expect(challenge!.length).toBeGreaterThanOrEqual(43);
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('includes a UUIDv7-shaped state + response_mode=query', () => {
    const state = location.searchParams.get('state');
    expect(state).toMatch(/^[0-9a-f-]{36}$/);
    expect(location.searchParams.get('response_mode')).toBe('query');
  });

  it('scope is `openid profile email User.Read` — no offline_access (D10) — User.Read added 2026-04-17 for profile-photo sync', () => {
    const scope = location.searchParams.get('scope');
    // D10 invariant: we never request refresh-token storage.
    expect(scope).not.toContain('offline_access');
    // Partial §A4 reversal (FEAT_OAUTH_PROFILE_PHOTO) — User.Read required for Graph /me/photo.
    expect(scope).toBe('openid profile email User.Read');
  });

  it('scope regression guard — User.Read MUST stay in the authorize request (FEAT_OAUTH_PROFILE_PHOTO)', () => {
    const scope = location.searchParams.get('scope');
    // Explicit substring assertion in addition to the full-string match above —
    // makes a failed assertion in this test point straight at the User.Read drop.
    expect(scope).toContain('User.Read');
  });

  it('omits prompt=consent on login mode', () => {
    expect(location.searchParams.get('prompt')).toBeNull();
  });

  it('stores the state in Redis under `oauth:state:{uuid}`', () => {
    const state = location.searchParams.get('state');
    expect(state).not.toBeNull();
    expect(redisExists(`oauth:state:${state!}`)).toBe(true);
  });
});

describe('OAuth authorize — signup mode adds prompt=consent', () => {
  let res: Response;
  let location: URL;

  beforeAll(async () => {
    res = await fetch(`${OAUTH_URL}/authorize?mode=signup`, { redirect: 'manual' });
    const loc = res.headers.get('location');
    if (loc === null) throw new Error('no Location header');
    location = new URL(loc);
  });

  it('returns HTTP 302', () => {
    expect(res.status).toBe(302);
  });

  it('Location includes `prompt=consent` so admin actively approves app permissions', () => {
    expect(location.searchParams.get('prompt')).toBe('consent');
  });
});

describe('OAuth authorize — each call produces a fresh state', () => {
  it('two authorize calls yield distinct state values (entropy check)', async () => {
    const call1 = await fetch(`${OAUTH_URL}/authorize?mode=login`, { redirect: 'manual' });
    const call2 = await fetch(`${OAUTH_URL}/authorize?mode=login`, { redirect: 'manual' });
    const state1 = new URL(call1.headers.get('location') ?? '').searchParams.get('state');
    const state2 = new URL(call2.headers.get('location') ?? '').searchParams.get('state');
    expect(state1).not.toBeNull();
    expect(state2).not.toBeNull();
    expect(state1).not.toBe(state2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B. Authorize — Zod validation
// ═════════════════════════════════════════════════════════════════════════════

describe('OAuth authorize — Zod rejects missing / invalid mode', () => {
  it('rejects request with no `mode` query param (400)', async () => {
    const res = await fetch(`${OAUTH_URL}/authorize`, { redirect: 'manual' });
    expect(res.status).toBe(400);
  });

  it('rejects request with `mode=invalid` (400)', async () => {
    const res = await fetch(`${OAUTH_URL}/authorize?mode=bogus`, { redirect: 'manual' });
    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C. Callback — provider-error branch (no MS round-trip needed)
// ═════════════════════════════════════════════════════════════════════════════

describe('OAuth callback — provider error query param', () => {
  it('?error=access_denied → 302 to /login?oauth=error&reason=access_denied', async () => {
    const res = await fetch(`${OAUTH_URL}/callback?error=access_denied&state=x`, {
      redirect: 'manual',
    });
    expect(res.status).toBe(302);
    const loc = res.headers.get('location') ?? '';
    expect(loc).toContain('/login?oauth=error');
    expect(loc).toContain('reason=access_denied');
  });

  it('sanitises HTML/JS special chars in error reason — angle brackets, quotes, parens stripped', async () => {
    const evil = '<script>alert("x")</script>';
    const res = await fetch(`${OAUTH_URL}/callback?error=${encodeURIComponent(evil)}&state=x`, {
      redirect: 'manual',
    });
    expect(res.status).toBe(302);
    const loc = res.headers.get('location') ?? '';
    // The attack surface is character-based (HTML injection, JS injection via quotes).
    // Plain-word content like "script" is harmless text and is not keyword-blacklisted.
    expect(loc).not.toContain('<');
    expect(loc).not.toContain('>');
    expect(loc).not.toContain('"');
    expect(loc).not.toContain('(');
    expect(loc).not.toContain(')');
  });
});

describe('OAuth callback — Zod refine rejects missing code AND error', () => {
  it('neither code nor error → 400 Zod violation', async () => {
    const res = await fetch(`${OAUTH_URL}/callback?state=x`, { redirect: 'manual' });
    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D. Callback — state replay (R2 defence at HTTP + Redis level)
// ═════════════════════════════════════════════════════════════════════════════

describe('OAuth callback — state single-use (R2)', () => {
  const stateId = `test-state-${Date.now()}`;
  const statePayload = JSON.stringify({
    mode: 'login',
    codeVerifier: 'test-verifier-xyz',
    createdAt: Date.now(),
  });

  beforeAll(() => {
    // Seed a state that will be consumed on first callback.
    redisSet(`oauth:state:${stateId}`, statePayload, 600);
  });

  afterAll(() => {
    redisDeletePattern(`oauth:state:${stateId}`);
  });

  it('seeded state key is present in Redis before callback', () => {
    expect(redisExists(`oauth:state:${stateId}`)).toBe(true);
  });

  it('first callback consumes the state (GETDEL) → state key removed from Redis', async () => {
    const res = await fetch(`${OAUTH_URL}/callback?code=fake-code&state=${stateId}`, {
      redirect: 'manual',
    });
    // Code exchange against real Microsoft fails → backend catches → 302 error.
    expect(res.status).toBe(302);
    expect(redisExists(`oauth:state:${stateId}`)).toBe(false);
  });

  it('second callback with same state → 302 error (state already consumed)', async () => {
    const res = await fetch(`${OAUTH_URL}/callback?code=fake-code&state=${stateId}`, {
      redirect: 'manual',
    });
    expect(res.status).toBe(302);
    const loc = res.headers.get('location') ?? '';
    expect(loc).toContain('/login?oauth=error');
  });

  it('unknown state (never seeded) → 302 error redirect, not 500', async () => {
    const res = await fetch(`${OAUTH_URL}/callback?code=fake&state=never-seeded-state`, {
      redirect: 'manual',
    });
    expect(res.status).toBe(302);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D2. Signup-ticket peek — Plan §5.4 (ADR-046 D17)
// Non-consuming HTTP read used by the /signup/oauth-complete SSR load to
// pre-fill the form. Asserts: field whitelist, idempotency, 404 on unknown,
// 400 on malformed uuid.
// ═════════════════════════════════════════════════════════════════════════════

describe('OAuth signup-ticket peek — happy path (field whitelist)', () => {
  const PEEK_URL = `${OAUTH_URL}/signup-ticket`;
  const ticketId = '019d97c5-1111-7000-8000-abcdef000001';
  const ticketPayload = JSON.stringify({
    provider: 'microsoft',
    providerUserId: 'ms-sub-peek-happy',
    email: 'peek-happy@assixx.com',
    emailVerified: true,
    displayName: 'Peek Happy',
    microsoftTenantId: 'tid-peek',
    // accessToken required since 2026-04-17 (FEAT_OAUTH_PROFILE_PHOTO / D7) — the
    // isSignupTicket type guard rejects payloads without it.
    accessToken: 'ms-access-token-peek-happy',
    createdAt: Date.now(),
  });

  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    redisSet(`oauth:signup-ticket:${ticketId}`, ticketPayload, 900);
    res = await fetch(`${PEEK_URL}/${ticketId}`);
    body = (await res.json()) as JsonBody;
  });

  afterAll(() => {
    redisDeletePattern(`oauth:signup-ticket:${ticketId}`);
  });

  it('returns 200', () => {
    expect(res.status).toBe(200);
  });

  it('exposes only email + displayName (ResponseInterceptor wraps in {success, data})', () => {
    expect(body.success).toBe(true);
    expect(body.data.email).toBe('peek-happy@assixx.com');
    expect(body.data.displayName).toBe('Peek Happy');
  });

  it('NEVER leaks providerUserId / microsoftTenantId / emailVerified', () => {
    expect(body.data).not.toHaveProperty('providerUserId');
    expect(body.data).not.toHaveProperty('microsoftTenantId');
    expect(body.data).not.toHaveProperty('emailVerified');
    expect(body.data).not.toHaveProperty('provider');
    expect(body.data).not.toHaveProperty('createdAt');
  });

  it('is non-consuming — the Redis ticket stays alive after the peek', () => {
    expect(redisExists(`oauth:signup-ticket:${ticketId}`)).toBe(true);
  });
});

describe('OAuth signup-ticket peek — idempotent (two peeks both succeed)', () => {
  const PEEK_URL = `${OAUTH_URL}/signup-ticket`;
  const ticketId = '019d97c5-2222-7000-8000-abcdef000002';
  const ticketPayload = JSON.stringify({
    provider: 'microsoft',
    providerUserId: 'ms-sub-peek-idem',
    email: 'peek-idem@assixx.com',
    emailVerified: true,
    displayName: null,
    microsoftTenantId: null,
    accessToken: 'ms-access-token-peek-idem',
    createdAt: Date.now(),
  });

  let first: Response;
  let second: Response;

  beforeAll(async () => {
    redisSet(`oauth:signup-ticket:${ticketId}`, ticketPayload, 900);
    first = await fetch(`${PEEK_URL}/${ticketId}`);
    second = await fetch(`${PEEK_URL}/${ticketId}`);
  });

  afterAll(() => {
    redisDeletePattern(`oauth:signup-ticket:${ticketId}`);
  });

  it('first peek returns 200', () => {
    expect(first.status).toBe(200);
  });

  it('second peek on same ticket ALSO returns 200 (GETDEL never fired)', () => {
    expect(second.status).toBe(200);
  });

  it('handles null displayName (user without displayName claim) gracefully', async () => {
    const body = (await first.clone().json()) as JsonBody;
    expect(body.data.displayName).toBeNull();
  });
});

describe('OAuth signup-ticket peek — error paths', () => {
  const PEEK_URL = `${OAUTH_URL}/signup-ticket`;

  it('returns 404 for a valid-format UUID that does not exist in Redis', async () => {
    const res = await fetch(`${PEEK_URL}/019d97c5-9999-7000-8000-abcdefffffff`);
    expect(res.status).toBe(404);
  });

  it('returns 400 (Zod) for a malformed non-UUID id', async () => {
    const res = await fetch(`${PEEK_URL}/not-a-uuid`);
    expect(res.status).toBe(400);
  });

  it('returns 400 (Zod) for a near-UUID missing a segment', async () => {
    const res = await fetch(`${PEEK_URL}/019d97c5-1111-7000-abcdef000003`);
    expect(res.status).toBe(400);
  });

  it('returns 400 when the id contains SQL-ish special chars', async () => {
    // Zod regex whitelists only hex + dashes, so this bounces at the pipe level
    // BEFORE the Redis GET is ever issued (shrinks attack surface).
    const res = await fetch(`${PEEK_URL}/'; DROP TABLE users;--`);
    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E. Complete-signup — Zod + ticket validation
// ═════════════════════════════════════════════════════════════════════════════

describe('OAuth complete-signup — request validation', () => {
  it('rejects empty body (400 Zod)', async () => {
    const res = await fetch(`${OAUTH_URL}/complete-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('rejects payload missing required fields (400 Zod)', async () => {
    const res = await fetch(`${OAUTH_URL}/complete-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket: 'x' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects unknown ticket (401 — ticket not in Redis)', async () => {
    const res = await fetch(`${OAUTH_URL}/complete-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticket: 'ghost-ticket',
        companyName: 'Ghost Co',
        subdomain: `ghost-${Date.now()}`,
        phone: '+49 30 12345',
        adminFirstName: 'Ghost',
        adminLastName: 'Ghost',
      }),
    });
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F. Complete-signup — happy path (seed ticket → create tenant+user+link)
// ═════════════════════════════════════════════════════════════════════════════

describe('OAuth complete-signup — happy path via seeded ticket', () => {
  const uniqueSubdomain = `oauth-happy-${Date.now()}`;
  const uniqueEmail = `oauth-happy-${Date.now()}@test.de`;
  const uniqueSub = `ms-sub-happy-${Date.now()}`;
  const ticketId = `happy-ticket-${Date.now()}`;

  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    // Seed a valid SignupTicket payload in Redis (15-min TTL per spec).
    redisSet(
      `oauth:signup-ticket:${ticketId}`,
      JSON.stringify({
        provider: 'microsoft',
        providerUserId: uniqueSub,
        email: uniqueEmail,
        emailVerified: true,
        displayName: 'OAuth Happy Path',
        microsoftTenantId: '00000000-0000-0000-0000-000000000001',
        accessToken: 'ms-access-token-complete-signup-happy',
        createdAt: Date.now(),
      }),
      900,
    );

    res = await fetch(`${OAUTH_URL}/complete-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticket: ticketId,
        companyName: 'OAuth Happy Co',
        subdomain: uniqueSubdomain,
        phone: '+49 30 12345',
        adminFirstName: 'Oauth',
        adminLastName: 'Happy',
      }),
    });
    body = (await res.json()) as JsonBody;
  });

  afterAll(() => {
    // Cleanup: CASCADE removes user_oauth_accounts + users + tenant_addons.
    deleteTenantBySubdomain(uniqueSubdomain);
    redisDeletePattern(`oauth:signup-ticket:${ticketId}`);
  });

  it('returns 201 Created', () => {
    expect(res.status).toBe(201);
  });

  it('response body includes tenantId, userId, subdomain, trialEndsAt, tokens', () => {
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('tenantId');
    expect(body.data).toHaveProperty('userId');
    expect(body.data.subdomain).toBe(uniqueSubdomain);
    expect(body.data.accessToken).toBeTypeOf('string');
    expect(body.data.refreshToken).toBeTypeOf('string');
  });

  it('sets httpOnly accessToken cookie (SSR session bootstrap)', () => {
    const cookies = res.headers.getSetCookie();
    const accessCookie = cookies.find((c) => c.startsWith('accessToken='));
    expect(accessCookie).toBeDefined();
    expect(accessCookie!.toLowerCase()).toContain('httponly');
  });

  it('sets httpOnly refreshToken cookie scoped to /api/v2/auth', () => {
    const cookies = res.headers.getSetCookie();
    const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie!.toLowerCase()).toContain('httponly');
    expect(refreshCookie).toContain('Path=/api/v2/auth');
  });

  // Companion non-httpOnly exp cookie — see auth.controller EXP_COOKIE_OPTIONS.
  // Required so the client-side session-countdown UI works for OAuth flows
  // (302 redirect, no JSON body to hydrate localStorage).
  it('sets non-httpOnly accessTokenExp cookie with a future unix timestamp', () => {
    const cookies = res.headers.getSetCookie();
    const expCookie = cookies.find((c) => c.startsWith('accessTokenExp='));
    expect(expCookie).toBeDefined();
    // Intentionally NOT httpOnly — client JS must read it for timer UI.
    expect(expCookie!.toLowerCase()).not.toContain('httponly');
    const value = /^accessTokenExp=(\d+)/.exec(expCookie!)?.[1];
    expect(value).toBeDefined();
    const exp = Number.parseInt(value!, 10);
    const nowSec = Math.floor(Date.now() / 1000);
    // Access token lives 30 minutes — cookie exp must be well into the future.
    expect(exp).toBeGreaterThan(nowSec);
    expect(exp).toBeLessThanOrEqual(nowSec + 60 * 60); // < 1 hour
  });

  it('consumed the signup ticket from Redis (single-use)', () => {
    expect(redisExists(`oauth:signup-ticket:${ticketId}`)).toBe(false);
  });

  it('inserted the user_oauth_accounts row for the new admin', () => {
    expect(countOAuthAccountsForEmail(uniqueEmail)).toBe(1);
  });

  it('second POST with same (already-consumed) ticket returns 401', async () => {
    const second = await fetch(`${OAUTH_URL}/complete-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticket: ticketId,
        companyName: 'Retry Co',
        subdomain: `${uniqueSubdomain}-2`,
        phone: '+49 30 12345',
        adminFirstName: 'Retry',
        adminLastName: 'Retry',
      }),
    });
    expect(second.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// G. V2 link/unlink stubs
// ═════════════════════════════════════════════════════════════════════════════

describe('OAuth V2 link stub — POST /link', () => {
  it('401 Unauthorized without JWT (global JwtAuthGuard)', async () => {
    const res = await fetch(`${OAUTH_URL}/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it('501 Not Implemented with a valid JWT (V2-reserved)', async () => {
    const res = await fetch(`${OAUTH_URL}/link`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(501);
    const body = (await res.json()) as JsonBody;
    expect(body.data.message ?? body.message).toMatch(/V2|reserved|Not implemented/i);
  });
});

describe('OAuth V2 unlink stub — DELETE /link', () => {
  it('401 Unauthorized without JWT', async () => {
    const res = await fetch(`${OAUTH_URL}/link`, { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('501 Not Implemented with a valid JWT', async () => {
    const res = await fetch(`${OAUTH_URL}/link`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    expect(res.status).toBe(501);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H. Rate limiting — AuthThrottle (10 req / 5 min per IP)
// ═════════════════════════════════════════════════════════════════════════════

describe('OAuth authorize — rate limiting (AuthThrottle: 10/5min)', () => {
  beforeAll(() => {
    flushThrottleKeys();
  });

  afterAll(() => {
    flushThrottleKeys();
  });

  it('11 rapid authorize requests → at least one 429 Too Many Requests', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const r = await fetch(`${OAUTH_URL}/authorize?mode=login`, { redirect: 'manual' });
      statuses.push(r.status);
    }
    expect(statuses).toContain(429);
  });
});
