/**
 * Shared utilities for Vitest API integration tests.
 *
 * Constants, types, and helper functions used by all API test files.
 * Each test file imports from here and calls loginApitest() in beforeAll.
 *
 * With isolate: false, this module is cached across all test files in the suite.
 * The login result is cached so only ONE login request is made for the entire run.
 *
 * Test-Tenant: subdomain `assixx`, email-domain `assixx.com`.
 * WHY: Migration weg von der frueheren Test-Domain (fremde reale Domain → Catch-All-Risiko
 * bei Password-Reset / Notification-Mails). `assixx.com` ist projekt-eigene Domain.
 * Variable-Namen (APITEST_EMAIL/PASSWORD) historisch beibehalten zur Diff-Minimierung;
 * funktional sind sie der Test-Tenant-Admin-Login.
 */
import { execSync } from 'node:child_process';

export const BASE_URL = 'http://localhost:3000/api/v2';
const APITEST_EMAIL = 'info@assixx.com';
export const APITEST_PASSWORD = 'ApiTest12345!';

/** Integration tests validate response shapes via assertions, not static types. */

export type JsonBody = Record<string, any>;

export interface AuthState {
  authToken: string;
  refreshToken: string;
  userId: number;
  tenantId: number;
}

// ─── Module-level cache (persists across all test files with isolate: false) ──

let _cachedAuth: AuthState | null = null;
let _authPromise: Promise<AuthState> | null = null;

/**
 * Login as test-tenant admin (`info@assixx.com`, subdomain `assixx`) and return auth state.
 * Cached: only the first call makes a real HTTP request.
 * All subsequent calls (from other test files) return the cached result.
 *
 * Function-Name `loginApitest` historisch beibehalten — Test-Tenant heißt seit
 * 2026-04 nicht mehr `apitest`, aber Rename würde alle 30+ Test-Files anfassen.
 */
export async function loginApitest(): Promise<AuthState> {
  if (_cachedAuth) return _cachedAuth;
  if (_authPromise) return _authPromise;

  _authPromise = _performLogin();
  return _authPromise;
}

/**
 * Drop the cached `_cachedAuth` so the next `loginApitest()` triggers a
 * fresh login + 2FA verify round-trip.
 *
 * WHY this exists (2026-04-30 incident):
 *   `auth-password-reset.api.test.ts` deliberately changes the test-tenant
 *   root password mid-suite. Its legacy cleanup `it()` block written for
 *   the pre-2FA contract did `auth.authToken = verifyBody.data.accessToken`
 *   — but post-DD-10 the login response no longer carries `data.accessToken`
 *   on the success path (it carries `data.stage = 'challenge_required'`
 *   instead, see ADR-005 + FEAT_2FA_EMAIL_MASTERPLAN §2). So the assignment
 *   silently wrote `undefined` into `_cachedAuth.authToken`, and every
 *   subsequent file using `loginApitest()` sent
 *   `Authorization: Bearer undefined` → 401-cascade across ~47 api-test files.
 *
 *   The proper post-2FA cleanup is: restore the password (via direct SQL
 *   UPDATE in `afterAll`, see auth-password-reset.api.test.ts), then call
 *   THIS function so the next consumer rebuilds the cache via the full
 *   2FA flow against the restored password.
 *
 * SAFE TO CALL multiple times — idempotent (just nulls two refs).
 *
 * @see backend/test/auth-password-reset.api.test.ts (`afterAll`)
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §Phase 4 Session 10b
 */
export function invalidateAuthCache(): void {
  _cachedAuth = null;
  _authPromise = null;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// ─── 2FA / Mailpit helpers (FEAT_2FA_EMAIL_MASTERPLAN Session 10) ────────────
//
// Phase 2 hardcoded email-based 2FA on every password login (DD-10 removed —
// no flag, no opt-out). Every test that needs an authenticated session now has
// to: log in → capture `challengeToken` cookie → fetch the code mail from
// Mailpit → POST /auth/2fa/verify → extract access/refresh tokens from cookies.
//
// `info@assixx.com` is the test-tenant root (users.id=1, verified via psql
// probe 2026-04-29). `_performLogin` below caches the resulting token pair
// once per suite run (`_cachedAuth`) — only the first call pays the 2FA cost.
//
// Mailpit runs on `localhost:8025` (Web-UI + REST), SMTP on `mailpit:1025`
// (internal Docker network). Doppler `dev` SMTP_HOST/PORT point at mailpit so
// the backend's nodemailer transport lands every dev mail in the catcher.
// See docker-compose.yml `mailpit` service + HOW-TO-DEV-SMTP.md (DD-25).
//
// Migration 2026-04-29: replaces maildev (port 1080, GET /email, DELETE
// /email/all). Mailpit's REST API uses an envelope shape (`{messages: [...]}`)
// with PascalCase fields and requires a per-ID fetch for the message body —
// the list endpoint returns metadata + truncated `Snippet` only.

const MAILPIT_URL = 'http://localhost:8025';
const MAIL_POLL_INTERVAL_MS = 200;
const MAIL_POLL_TIMEOUT_MS = 10_000;
/** Test root user id — `info@assixx.com` (verified 2026-04-29 via psql). */
const APITEST_USER_ID = 1;
const REDIS_AUTH = 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0';

interface MailpitMessageSummary {
  ID: string;
  To: Array<{ Address: string }>;
  Subject: string;
  Created: string;
}

interface MailpitMessagesEnvelope {
  total: number;
  messages: MailpitMessageSummary[];
}

interface MailpitMessageDetail {
  ID: string;
  Text: string;
}

/**
 * Wipe Mailpit's mailbox. Idempotent; safe to call in `beforeEach` for tests
 * that read 2FA codes — keeps each test's email lookup deterministic.
 */
export async function clearMailpit(): Promise<void> {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' });
}

/**
 * Read the 6-char Crockford-Base32 code from a Mailpit message detail.
 *
 * Anchored on the `Ihr Code:` prefix that `renderCodeMailText` in
 * `2fa-code.template.ts` writes as the dedicated code-carrier line
 * (`Ihr Code: ${code}`). Per DD-13 the subject is generic and code-free
 * (`'Ihr Bestätigungscode für Assixx'`), so the body is the only place
 * the 6-char token appears — that is what we anchor against.
 *
 * History: the prior `Ihr Bestätigungscode:` regex was a latent bug
 * pre-existing the most recent commit — the §2.9b Klarna-DE redesign
 * locked the body wording to `Ihr Code: ${code}` (kürzer = besser),
 * leaving the helper marker stale. The Cross-Worker-Race fix in v0.7.2
 * (FEAT_2FA_EMAIL §0.5.5) removed the prior global `clearMailpit()`
 * call, which had been masking this mismatch by killing each worker's
 * mail before the regex ran. Once the race was gone, the stale marker
 * surfaced as a deterministic 10 s timeout across the whole api suite.
 *
 * Returns `null` when the body is empty or the marker is absent.
 *
 * @see backend/src/utils/email-templates/2fa-code.template.ts (`renderCodeMailText`)
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §2.9b + §0.5.5 v0.7.2
 */
function _extract2faCode(detail: MailpitMessageDetail): string | null {
  if (typeof detail.Text !== 'string') return null;
  const m = /Ihr Code:\s*([A-HJKMNP-Z2-9]{6})/.exec(detail.Text);
  return m?.[1] !== undefined && m[1] !== '' ? m[1] : null;
}

/**
 * Walk one Mailpit list-snapshot looking for a 2FA code addressed to
 * `lowerRecipient` AND newer than `sinceMs` (UNIX-ms). Per match:
 * GET /api/v1/message/{ID} → regex against `Text`. Splitting this out keeps
 * `fetchLatest2faCode` below the SonarJS cognitive-complexity-10 ceiling
 * (`eslint.config.mjs`).
 *
 * The `sinceMs` filter is what makes the helper safe under cross-worker
 * parallelism (FEAT_2FA_EMAIL §0.5.5 v0.7.2): even when other vitest workers
 * are sending 2FA mails for different recipients into the same Mailpit
 * instance, we only consume mails whose `Created` is strictly after our
 * own login-request start.
 */
async function _scanForCode(
  envelope: MailpitMessagesEnvelope,
  lowerRecipient: string,
  sinceMs: number,
): Promise<string | null> {
  for (const summary of envelope.messages) {
    // Mailpit's `Created` is ISO-8601; backend + Mailpit share the host
    // kernel clock under Docker, so direct comparison is safe.
    if (Date.parse(summary.Created) <= sinceMs) continue;
    const matches = summary.To.some((t) => t.Address.toLowerCase() === lowerRecipient);
    if (!matches) continue;
    const detailRes = await fetch(`${MAILPIT_URL}/api/v1/message/${summary.ID}`);
    const detail = (await detailRes.json()) as MailpitMessageDetail;
    const code = _extract2faCode(detail);
    if (code !== null) return code;
  }
  return null;
}

/**
 * Poll Mailpit for the most recent 2FA code mail addressed to `recipient`
 * AND created after `since`. Returns the 6-char Crockford-Base32 code from
 * the plain-text body.
 *
 * Mailpit returns messages newest-first by default (verified via API probe
 * 2026-04-29). The list endpoint omits the body, so for each candidate we
 * GET /api/v1/message/{ID} to read `Text` — one extra round-trip per match,
 * negligible at test-suite scale.
 *
 * The `since` cut-off (default = epoch, i.e. no filter — backward-compat
 * for direct test-body callers) is the cross-worker safety net introduced
 * in v0.7.2 (FEAT_2FA_EMAIL §0.5.5). When called from `_performLogin` it
 * is set to the moment just before `POST /auth/login` — guarantees we
 * never consume another worker's mail or a stale mail from a prior run.
 *
 * @throws if no matching mail arrives within `timeoutMs`.
 */
export async function fetchLatest2faCode(
  recipient: string,
  timeoutMs = MAIL_POLL_TIMEOUT_MS,
  since: Date = new Date(0),
): Promise<string> {
  const lower = recipient.toLowerCase();
  const sinceMs = since.getTime();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/messages`);
    const envelope = (await res.json()) as MailpitMessagesEnvelope;
    const code = await _scanForCode(envelope, lower, sinceMs);
    if (code !== null) return code;
    await new Promise((r) => setTimeout(r, MAIL_POLL_INTERVAL_MS));
  }
  throw new Error(`No 2FA code mail for ${recipient} within ${timeoutMs} ms`);
}

/**
 * DEL Redis keys that survive across suite runs and would otherwise poison
 * subsequent tests:
 *   - `2fa:lock:{userId}`         (15-min lockout from 5 wrong attempts, DD-6)
 *   - `2fa:fail-streak:{userId}`  (24-h cumulative fail counter, DD-5)
 *
 * Keys carry the `2fa:` keyPrefix from `two-factor-auth.module.ts`. Run
 * synchronously via `docker exec` — same pattern as `flushThrottleKeys()`.
 */
export function clear2faStateForUser(userId: number): void {
  execSync(
    `docker exec assixx-redis redis-cli -a '${REDIS_AUTH}' --no-auth-warning DEL '2fa:lock:${userId}' '2fa:fail-streak:${userId}'`,
    { stdio: 'pipe' },
  );
}

/**
 * Extract a single cookie value from a `Set-Cookie` header array
 * (`Headers.getSetCookie()`, Node 19.7+). Returns `null` if absent or empty
 * (cleared cookies emit `name=; Max-Age=0` — the empty value counts as absent
 * for our purposes).
 */
export function extractCookieValue(setCookies: string[], name: string): string | null {
  for (const sc of setCookies) {
    const m = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(sc);
    if (m && m[1] !== undefined && m[1] !== '') return m[1];
  }
  return null;
}

async function _runLoginRequest(): Promise<Response> {
  return await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: APITEST_EMAIL, password: APITEST_PASSWORD }),
  });
}

async function _runVerifyRequest(challengeToken: string, code: string): Promise<Response> {
  return await fetch(`${BASE_URL}/auth/2fa/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `challengeToken=${challengeToken}`,
    },
    body: JSON.stringify({ code }),
  });
}

async function _performLogin(attempt = 1): Promise<AuthState> {
  // Pre-clean: wipe stale 2FA state from prior failed runs (lockouts /
  // fail-streaks). Per-user Redis DELs are idempotent and isolated.
  // WARN: do NOT call `clearMailpit()` here. Mailpit is GLOBAL state shared
  // across all vitest workers; concurrent clear+send from sibling workers
  // races and consumes our own freshly-arrived 2FA mail before the poll
  // reads it (FEAT_2FA_EMAIL §0.5.5 v0.7.2). Instead, scope the mail lookup
  // by `since: loginStartedAt` so we only ever read mails landed after our
  // own login request — works under any parallelism.
  clear2faStateForUser(APITEST_USER_ID);

  const loginStartedAt = new Date();

  // Step 1: submit credentials → expect `stage: 'challenge_required'`.
  const loginRes = await _runLoginRequest();
  // 429 handling: AuthThrottle is 10 req / 5 min (auth.controller.ts:356,
  // throttle.decorators.ts:42). Earlier files in the api suite can drain the
  // bucket via @AuthThrottle endpoints (/login, /2fa/verify, /refresh, /logout,
  // /oauth/*) — by the time a later file calls loginApitest(), the bucket is
  // empty and we get 429 + anti-enumeration 401 follow-ups. The throttle TTL
  // is 5 min; the previous sleep-and-retry (2/4/6 s) was too short to recover.
  // Fix: flush `throttle:*` keys directly (Redis-side, idempotent) and retry
  // immediately. Safe in this code path because:
  //   - This helper is an internal cache primer, never called from a "this
  //     test asserts on 429" code path.
  //   - Throttle-aware tests (auth-forgot-password, two-factor-auth's
  //     "AuthThrottle 429" cases) manage their bucket explicitly via
  //     flushThrottleKeys() in their own beforeEach/it blocks — they never
  //     route through loginApitest().
  //   - flushThrottleKeys() targets only `throttle:*` keys, leaving 2FA
  //     lockouts (`2fa:lock:*`) and fail-streaks (`2fa:fail-streak:*`)
  //     untouched (those have their own per-user clear above).
  if (loginRes.status === 429 && attempt < MAX_RETRIES) {
    _authPromise = null;
    flushThrottleKeys();
    return _performLogin(attempt + 1);
  }
  if (!loginRes.ok) {
    _authPromise = null;
    throw new Error(`Login failed: ${loginRes.status} ${loginRes.statusText}`);
  }

  const loginBody = (await loginRes.json()) as JsonBody;
  if (loginBody.data.stage !== 'challenge_required') {
    // Defensive: under v0.5.0 (DD-10 removed) `/auth/login` never returns
    // `'authenticated'`. If it ever does, OAuth was misrouted — fail loud.
    _authPromise = null;
    throw new Error(`Unexpected login stage: ${String(loginBody.data.stage)}`);
  }

  const challengeToken = extractCookieValue(loginRes.headers.getSetCookie(), 'challengeToken');
  if (challengeToken === null) {
    _authPromise = null;
    throw new Error('challengeToken cookie missing from /auth/login response');
  }

  // Step 2: fetch the code from Mailpit + verify. Time-window scoped to
  // mails landed after our login request — see WARN above.
  const code = await fetchLatest2faCode(APITEST_EMAIL, MAIL_POLL_TIMEOUT_MS, loginStartedAt);
  const verifyRes = await _runVerifyRequest(challengeToken, code);
  if (!verifyRes.ok) {
    _authPromise = null;
    throw new Error(`2FA verify failed: ${verifyRes.status} ${verifyRes.statusText}`);
  }

  const verifyBody = (await verifyRes.json()) as JsonBody;
  const setCookies = verifyRes.headers.getSetCookie();
  const accessToken = extractCookieValue(setCookies, 'accessToken');
  const refreshToken = extractCookieValue(setCookies, 'refreshToken');
  if (accessToken === null || refreshToken === null) {
    _authPromise = null;
    throw new Error('access/refresh token cookies missing from /auth/2fa/verify response');
  }

  _cachedAuth = {
    authToken: accessToken,
    refreshToken,
    userId: verifyBody.data.user.id as number,
    tenantId: verifyBody.data.user.tenantId as number,
  };
  return _cachedAuth;
}

/**
 * Lookup user-id by email via direct psql (assixx_user, BYPASSRLS). Returns
 * `null` if the user does not exist. Used by `loginNonRoot` below to
 * pre-clear stale 2FA lockouts and fail-streaks before a login attempt.
 *
 * Public so dedicated test files can also use it for assertion-side DB
 * probes (root-self-termination, two-factor-auth, tenant-domains, ...).
 */
export function queryUserIdByEmail(email: string): number | null {
  const out = execSync(
    `docker exec assixx-postgres psql -U assixx_user -d assixx -t -A -c "SELECT id FROM users WHERE email = '${email}' LIMIT 1"`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
  if (out === '') return null;
  const id = Number.parseInt(out, 10);
  return Number.isFinite(id) ? id : null;
}

/**
 * Run the full 2-step 2FA login dance for a NON-cached user (typically the
 * test-tenant employee or a fixture admin). Mirrors the cached
 * `loginApitest()` flow but returns only the access-token cookie value;
 * use for files that just need "give me a token for user X" without the
 * full `AuthState` shape. Pre-clears `2fa:lock:{userId}` +
 * `2fa:fail-streak:{userId}` so a poisoned prior run cannot block.
 *
 * Mailpit lookup is `since`-scoped via `loginStartedAt` — never call
 * `clearMailpit()` here (cross-worker race per FEAT_2FA_EMAIL §0.5.5
 * v0.7.2). The fetcher reads only mails landed after our login request.
 *
 * Why this lives in helpers.ts (instead of being duplicated per file):
 * after Phase 2 Step 2.4 hardcoded 2FA on every password login, every
 * file that previously did `body.data.accessToken` after `/auth/login`
 * is broken until it runs this dance. ~7 files needed the same fix in
 * Session 10b — consolidating here trades 7 × 50 LOC for 1 shared helper.
 *
 * @see backend/test/00-auth.api.test.ts:loginAndVerify (canonical pattern)
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §Phase 4 / Session 10b
 */
export async function loginNonRoot(email: string, password: string): Promise<string> {
  const preLookupId = queryUserIdByEmail(email);
  if (preLookupId !== null) clear2faStateForUser(preLookupId);

  const loginStartedAt = new Date();
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!loginRes.ok) {
    throw new Error(`loginNonRoot(${email}) failed: HTTP ${String(loginRes.status)}`);
  }
  const loginBody = (await loginRes.json()) as JsonBody;
  if (loginBody.data?.stage !== 'challenge_required') {
    throw new Error(`unexpected login stage for ${email}: ${String(loginBody.data?.stage)}`);
  }
  const challengeToken = extractCookieValue(loginRes.headers.getSetCookie(), 'challengeToken');
  if (challengeToken === null) {
    throw new Error(`no challengeToken cookie for ${email}`);
  }

  const code = await fetchLatest2faCode(email, MAIL_POLL_TIMEOUT_MS, loginStartedAt);
  const verifyRes = await fetch(`${BASE_URL}/auth/2fa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `challengeToken=${challengeToken}` },
    body: JSON.stringify({ code }),
  });
  if (!verifyRes.ok) {
    throw new Error(`2fa verify failed for ${email}: HTTP ${String(verifyRes.status)}`);
  }
  const accessToken = extractCookieValue(verifyRes.headers.getSetCookie(), 'accessToken');
  if (accessToken === null) {
    throw new Error(`no accessToken cookie for ${email}`);
  }
  return accessToken;
}

/**
 * Same as `loginNonRoot` but returns the full `AuthState` shape (access +
 * refresh tokens + user.id + tenant.id). For files that need to mutate the
 * refresh token or assert on tenant scope.
 */
export async function loginNonRootFull(email: string, password: string): Promise<AuthState> {
  const preLookupId = queryUserIdByEmail(email);
  if (preLookupId !== null) clear2faStateForUser(preLookupId);

  const loginStartedAt = new Date();
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!loginRes.ok) {
    throw new Error(`loginNonRootFull(${email}) failed: HTTP ${String(loginRes.status)}`);
  }
  const loginBody = (await loginRes.json()) as JsonBody;
  if (loginBody.data?.stage !== 'challenge_required') {
    throw new Error(`unexpected login stage for ${email}: ${String(loginBody.data?.stage)}`);
  }
  const challengeToken = extractCookieValue(loginRes.headers.getSetCookie(), 'challengeToken');
  if (challengeToken === null) {
    throw new Error(`no challengeToken cookie for ${email}`);
  }

  const code = await fetchLatest2faCode(email, MAIL_POLL_TIMEOUT_MS, loginStartedAt);
  const verifyRes = await fetch(`${BASE_URL}/auth/2fa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `challengeToken=${challengeToken}` },
    body: JSON.stringify({ code }),
  });
  if (!verifyRes.ok) {
    throw new Error(`2fa verify failed for ${email}: HTTP ${String(verifyRes.status)}`);
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

/**
 * Headers for authenticated requests WITH a JSON body (POST, PUT, PATCH).
 * Includes Content-Type: application/json.
 */
export function authHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Headers for authenticated requests WITHOUT a body (GET, DELETE, PUT-no-body).
 * Fastify rejects Content-Type: application/json when no body is present.
 */
export function authOnly(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Build an `X-Forwarded-Host` header for a given tenant slug (ADR-050,
 * masterplan §Session 9b / D8 scope reduction).
 *
 * Why only here (not applied globally to every test): the existing 47 API
 * tests hit `localhost:3000`. `extractSlug('localhost')` returns `null`
 * (apex/dev case), so `TenantHostResolverMiddleware` sets
 * `req.hostTenantId = null` and `JwtAuthGuard` skips the cross-check. Those
 * tests remain green unchanged. This helper exists so the dedicated
 * subdomain-routing test file can *opt into* host-based tenant resolution
 * without poisoning the shared helpers.
 *
 * Compose with other headers via spread:
 *   `{ ...authOnly(token), ...withTenantHost('firma-b') }`
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §"Backend:
 *   Pre-Auth Host Resolver + Post-Auth Cross-Check"
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md §Phase 4 / D8
 */
export function withTenantHost(slug: string): Record<string, string> {
  return { 'X-Forwarded-Host': `${slug}.assixx.com` };
}

/**
 * Fetch with 429 retry. Use for any endpoint that might be rate-limited.
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retries = MAX_RETRIES,
): Promise<Response> {
  const res = await fetch(url, options);
  if (res.status === 429 && retries > 0) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return fetchWithRetry(url, options, retries - 1);
  }
  return res;
}

/**
 * Flush throttle/rate-limit keys from Redis.
 * Required for logs/export tests where ExportThrottle allows only 1 req/min.
 * Auth tokens are cached in-process (_cachedAuth), not in Redis -- safe to flush.
 */
export function flushThrottleKeys(): void {
  execSync(
    "docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' --no-auth-warning EVAL \"local keys = redis.call('KEYS', 'throttle:*') for i, key in ipairs(keys) do redis.call('DEL', key) end return #keys\" 0",
    { stdio: 'pipe' },
  );
}

// ─── Position helper (cached) ────────────────────────────────────────────────

let _cachedPositionIds: string[] | null = null;

let _cachedPositions: Array<{ id: string; name: string; roleCategory: string }> | null = null;

/** Fetch all positions from the catalog. Cached. */
async function fetchPositions(
  token: string,
): Promise<Array<{ id: string; name: string; roleCategory: string }>> {
  if (_cachedPositions) return _cachedPositions;

  const res = await fetch(`${BASE_URL}/organigram/positions`, {
    headers: authOnly(token),
  });
  if (!res.ok) throw new Error(`Failed to fetch positions: ${res.status}`);

  const body = (await res.json()) as JsonBody;
  _cachedPositions = body.data as Array<{ id: string; name: string; roleCategory: string }>;
  return _cachedPositions;
}

/**
 * Fetch a default employee position UUID from the position catalog.
 * Cached: only the first call makes a real HTTP request.
 */
export async function getDefaultPositionIds(token: string): Promise<string[]> {
  if (_cachedPositionIds) return _cachedPositionIds;

  const positions = await fetchPositions(token);
  const employeePos = positions.find(
    (p: { roleCategory: string }) => p.roleCategory === 'employee',
  );
  if (!employeePos) throw new Error('No employee position found in position_catalog');

  _cachedPositionIds = [employeePos.id];
  return _cachedPositionIds;
}

/**
 * Get position UUID by name (e.g. 'team_lead', 'team_deputy_lead').
 * Returns a single-element array suitable for positionIds field.
 */
export async function getPositionIdsByName(token: string, name: string): Promise<string[]> {
  const positions = await fetchPositions(token);
  const pos = positions.find((p: { name: string }) => p.name === name);
  if (!pos) throw new Error(`Position '${name}' not found in position_catalog`);
  return [pos.id];
}

/**
 * Create a test employee and return their ID.
 * Used by modules that need a second user (chat, etc.).
 */
export async function ensureTestEmployee(token: string): Promise<number> {
  const positionIds = await getDefaultPositionIds(token);
  // Try to create
  const createRes = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      email: 'employee@assixx.com',
      password: APITEST_PASSWORD,
      firstName: 'Test',
      lastName: 'Employee',
      role: 'employee',
      phone: '+49123456780',
      positionIds,
    }),
  });

  if (createRes.status === 201) {
    const body = (await createRes.json()) as JsonBody;
    return body.data.id as number;
  }

  // Already exists -- find them in users list. Use role filter + higher limit:
  // the test-tenant carries 50+ users now (kvp fixtures, 2fa victims, ...),
  // and `employee@assixx.com` no longer fits in the first 10 alphabetically.
  // Mirrors the `?role=admin&limit=50` pattern already used by
  // admin-permissions.api.test.ts (Step 2.4 fixture-growth survival rule).
  const listRes = await fetch(`${BASE_URL}/users?role=employee&limit=100`, {
    headers: authOnly(token),
  });
  const listBody = (await listRes.json()) as JsonBody;
  const users = listBody.data as Array<{ id: number; email: string }>;
  const employee = users.find((u) => u.email === 'employee@assixx.com');

  if (!employee) {
    throw new Error('Test employee not found after create attempt');
  }

  return employee.id;
}

/**
 * Create N assets for the test tenant and return their UUIDs.
 * Each asset gets a unique name to avoid conflicts.
 * Caller is responsible for cleanup via deleteAssets().
 */
export async function createAssets(token: string, count: number): Promise<string[]> {
  const uuids: string[] = [];

  for (let i = 0; i < count; i++) {
    const res = await fetch(`${BASE_URL}/assets`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        name: `Test Asset ${i + 1} ${Date.now()}`,
        model: `TM-${String(i + 1).padStart(3, '0')}`,
        manufacturer: 'Test Corp',
        assetType: 'production',
        status: 'operational',
        location: 'Test Location',
      }),
    });

    if (res.status !== 201) {
      throw new Error(`Asset creation failed: ${res.status}`);
    }

    const body = (await res.json()) as JsonBody;
    uuids.push(body.data.uuid as string);
  }

  return uuids;
}

/**
 * Delete assets by UUID. Silently ignores 404/409 errors.
 */
export async function deleteAssets(token: string, uuids: string[]): Promise<void> {
  for (const uuid of uuids) {
    await fetch(`${BASE_URL}/assets/${uuid}`, {
      method: 'DELETE',
      headers: authOnly(token),
    });
  }
}

/**
 * Create a department + team for the test tenant and return their IDs.
 * Caller is responsible for cleanup.
 */
export async function createDepartmentAndTeam(
  token: string,
): Promise<{ departmentId: number; teamId: number }> {
  // Create department
  const deptRes = await fetch(`${BASE_URL}/departments`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      name: `Test Department ${Date.now()}`,
      description: 'Auto-created for integration tests',
    }),
  });

  if (deptRes.status !== 201) {
    throw new Error(`Department creation failed: ${deptRes.status}`);
  }

  const deptBody = (await deptRes.json()) as JsonBody;
  const departmentId = deptBody.data.id as number;

  // Create team under that department
  const teamRes = await fetch(`${BASE_URL}/teams`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      name: `Test Team ${Date.now()}`,
      departmentId,
      description: 'Auto-created for integration tests',
    }),
  });

  if (teamRes.status !== 201) {
    throw new Error(`Team creation failed: ${teamRes.status}`);
  }

  const teamBody = (await teamRes.json()) as JsonBody;
  const teamId = teamBody.data.id as number;

  return { departmentId, teamId };
}

/**
 * Ensure the authenticated user has an E2E key registered.
 * Idempotent: checks GET /e2e/keys/me first, registers only if absent.
 * Returns { keyVersion } for use in encrypted message tests.
 */
export async function ensureE2eKey(token: string): Promise<{ keyVersion: number }> {
  // Check if key already exists
  const checkRes = await fetch(`${BASE_URL}/e2e/keys/me`, {
    headers: authOnly(token),
  });
  const checkBody = (await checkRes.json()) as JsonBody;

  if (checkBody.data !== null && checkBody.data !== undefined) {
    return { keyVersion: checkBody.data.keyVersion as number };
  }

  // Register a deterministic 32-byte X25519 test key (all zeros, base64)
  const testPublicKey = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
  const registerRes = await fetch(`${BASE_URL}/e2e/keys`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ publicKey: testPublicKey }),
  });

  if (registerRes.status === 409) {
    // Race condition: another process registered between check and register
    const refetchRes = await fetch(`${BASE_URL}/e2e/keys/me`, {
      headers: authOnly(token),
    });
    const refetchBody = (await refetchRes.json()) as JsonBody;
    return { keyVersion: (refetchBody.data?.keyVersion as number) ?? 1 };
  }

  if (!registerRes.ok) {
    throw new Error(`E2E key registration failed: ${registerRes.status} ${registerRes.statusText}`);
  }

  const registerBody = (await registerRes.json()) as JsonBody;
  return { keyVersion: registerBody.data.keyVersion as number };
}
