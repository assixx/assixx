/**
 * Signup API Integration Tests — Phase 4 hardening (ADR-048 §4).
 *
 * Covers the three-layer business-email gate (§2.3 email-validator) enforced at
 * `POST /api/v2/signup`:
 *   1. Layer 1 (shape) → 400 `INVALID_FORMAT`
 *   2. Layer 2 (`mailchecker` — disposable/burner) → 400 `DISPOSABLE_EMAIL`
 *   3. Layer 3 (committed freemail Set) → 400 `FREE_EMAIL_PROVIDER`
 *
 * Plus the positive path: a valid `.test`-TLD signup creates the tenant and
 * seeds a `tenant_domains(pending, is_primary=true)` row with a 64-hex
 * `verification_token` — locked in by the masterplan DoD §4.
 *
 * ── Scope / out-of-scope ──────────────────────────────────────────────────────
 *   Covered at this layer (HTTP + real backend):
 *     - Layer 1/2/3 rejections with exact error codes
 *     - Positive signup side-effects (row shape in `tenant_domains`)
 *
 *   Deferred to unit / Phase 6 manual smoke (explicit rationale per file):
 *     - OAuth-signup integration (backend-process HTTP mocking of Microsoft
 *       callback unavailable at this layer; covered at unit level in
 *       `backend/src/nest/signup/signup.service.test.ts`, matches the existing
 *       `oauth.api.test.ts` precedent where full callback flows are Phase 6).
 *
 * @see docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §4
 * @see backend/src/nest/domains/email-validator.ts
 * @see backend/src/nest/signup/signup.service.ts (seedPendingDomain)
 */
import { execSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BASE_URL, type JsonBody, flushThrottleKeys } from './helpers.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Unique suffix anchored to test-file start. Guarantees fresh subdomains +
 * emails across repeated runs (prevents 409 `SUBDOMAIN_TAKEN` on rerun before
 * the afterAll cleanup fires).
 */
const RUN_SUFFIX = Date.now();

/**
 * Subdomains created by this test file. afterAll drops all of them via direct
 * psql to keep the DB clean. Prefix matches `deleteTenantBySubdomain` in
 * `oauth.api.test.ts` for operational consistency.
 */
const CREATED_SUBDOMAINS: string[] = [];

/**
 * Base signup body. Tests override `email`, `adminEmail`, and `subdomain` as
 * needed; required fields (phone, address) stay constant.
 */
function buildSignupBody(overrides: Partial<JsonBody>): JsonBody {
  return {
    companyName: 'Phase 4 Signup Test',
    subdomain: `p4s-${RUN_SUFFIX}`,
    email: `contact-${RUN_SUFFIX}@p4s.test`,
    phone: '+49123456789',
    street: 'Musterstraße',
    houseNumber: '1',
    postalCode: '10115',
    city: 'Berlin',
    countryCode: 'DE',
    adminEmail: `root-${RUN_SUFFIX}@p4s.test`,
    adminPassword: 'ApiTest12345!',
    // NameSchema regex forbids digits — 'Phase4'/'Tester4' would trip Zod
    // before the email gate fires; use pure-alpha names so Layer 1/2/3 see
    // the email first (which is the actual test subject).
    adminFirstName: 'Phase',
    adminLastName: 'Tester',
    ...overrides,
  };
}

/**
 * Delete a tenant by subdomain. Follows the same dependency order as
 * `deleteTenantBySubdomain` in `oauth.api.test.ts` (tenant_addons → tenant_
 * storage → users → tenants) plus `tenant_domains` (not in the OAuth helper
 * because the OAuth file predates tenant_domains). `users` CASCADEs OAuth
 * links, so those clean up automatically.
 */
function deleteTenantBySubdomain(subdomain: string): void {
  const sql =
    `DELETE FROM tenant_addons WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = '${subdomain}'); ` +
    `DELETE FROM tenant_storage WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = '${subdomain}'); ` +
    `DELETE FROM tenant_domains WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = '${subdomain}'); ` +
    `DELETE FROM users WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = '${subdomain}'); ` +
    `DELETE FROM tenants WHERE subdomain = '${subdomain}';`;
  execSync(`docker exec assixx-postgres psql -U assixx_user -d assixx -c "${sql}"`, {
    stdio: 'pipe',
  });
}

/**
 * Read a single `tenant_domains` row via direct psql. Bypasses RLS via
 * `assixx_user` (BYPASSRLS). Returns the status/is_primary/token string so
 * tests can assert shape without building a second HTTP path.
 */
function queryDomainByTenantSubdomain(subdomain: string): {
  domain: string;
  status: string;
  isPrimary: string;
  verificationToken: string;
} | null {
  const out = execSync(
    `docker exec assixx-postgres psql -U assixx_user -d assixx -t -A -F '|' -c "SELECT td.domain, td.status::text, td.is_primary::text, td.verification_token FROM tenant_domains td JOIN tenants t ON t.id = td.tenant_id WHERE t.subdomain = '${subdomain}' AND td.is_active = 1 ORDER BY td.created_at ASC LIMIT 1"`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
  if (out === '') return null;
  const parts = out.split('|');
  if (parts.length !== 4) return null;
  const [domain, status, isPrimary, verificationToken] = parts as [string, string, string, string];
  return { domain, status, isPrimary, verificationToken };
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeAll(() => {
  // Prior runs may have left throttle counters near the limit — flush before
  // hitting /signup repeatedly from the rejection tests.
  flushThrottleKeys();
});

afterAll(() => {
  for (const sub of CREATED_SUBDOMAINS) {
    try {
      deleteTenantBySubdomain(sub);
    } catch {
      // Best-effort cleanup; test failures shouldn't block subsequent runs.
    }
  }
});

// ─── Layer 3: Freemail provider rejection ────────────────────────────────────

describe('POST /api/v2/signup — Layer 3 (freemail provider)', () => {
  it('rejects @gmail.com with 400 FREE_EMAIL_PROVIDER', async () => {
    const body = buildSignupBody({
      subdomain: `p4s-free-${RUN_SUFFIX}`,
      email: `contact-${RUN_SUFFIX}@gmail.com`,
      adminEmail: `root-${RUN_SUFFIX}@gmail.com`,
    });
    const res = await fetch(`${BASE_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as JsonBody;

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    // Error envelope: NestJS BadRequestException with code + field in the body.
    // `(message|error).code` path is the standard shape per ResponseInterceptor.
    const code = json.error?.code ?? json.code ?? json.message?.code;
    expect(code).toBe('FREE_EMAIL_PROVIDER');
  });
});

// ─── Layer 2: Disposable / burner rejection ──────────────────────────────────

describe('POST /api/v2/signup — Layer 2 (disposable provider)', () => {
  it('rejects @mailinator.com with 400 DISPOSABLE_EMAIL', async () => {
    const body = buildSignupBody({
      subdomain: `p4s-disp-${RUN_SUFFIX}`,
      email: `contact-${RUN_SUFFIX}@mailinator.com`,
      adminEmail: `root-${RUN_SUFFIX}@mailinator.com`,
    });
    const res = await fetch(`${BASE_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as JsonBody;

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    const code = json.error?.code ?? json.code ?? json.message?.code;
    expect(code).toBe('DISPOSABLE_EMAIL');
  });
});

// ─── Layer 1: Shape rejection ────────────────────────────────────────────────

describe('POST /api/v2/signup — Layer 1 (shape)', () => {
  it('rejects malformed email with 400 (Zod INVALID or validator INVALID_FORMAT)', async () => {
    const body = buildSignupBody({
      subdomain: `p4s-malf-${RUN_SUFFIX}`,
      email: 'not-an-email',
      adminEmail: 'not-an-email',
    });
    const res = await fetch(`${BASE_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as JsonBody;

    // Zod's `z.string().email()` fires FIRST (signup DTO has the shape check),
    // so the body is rejected before the 3-layer validator runs. Both paths
    // produce a 400 with a recognizable code — accept either: `VALIDATION_
    // ERROR` from Zod or `INVALID_FORMAT` from the validator.
    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    const code = json.error?.code ?? json.code ?? json.message?.code;
    expect(['VALIDATION_ERROR', 'INVALID_FORMAT']).toContain(code);
  });
});

// ─── Positive: signup seeds pending tenant_domains row ───────────────────────

describe('POST /api/v2/signup — positive path', () => {
  const subdomain = `p4s-ok-${RUN_SUFFIX}`;
  const adminEmail = `root-${RUN_SUFFIX}@${subdomain}.test`;
  let createdTenantId: number | undefined;
  let responseBody: JsonBody | undefined;

  beforeAll(async () => {
    CREATED_SUBDOMAINS.push(subdomain);
    const body = buildSignupBody({
      subdomain,
      email: `contact-${RUN_SUFFIX}@${subdomain}.test`,
      adminEmail,
    });
    const res = await fetch(`${BASE_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    responseBody = (await res.json()) as JsonBody;
    if (res.status !== 201) {
      throw new Error(
        `Positive signup setup failed: HTTP ${String(res.status)} ${JSON.stringify(responseBody)}`,
      );
    }
    createdTenantId = responseBody.data?.tenantId as number | undefined;
  });

  it('returns 201 with tenantVerificationRequired=true', () => {
    expect(responseBody?.success).toBe(true);
    expect(responseBody?.data?.subdomain).toBe(subdomain);
    expect(responseBody?.data?.tenantId).toBeTypeOf('number');
    // Signup's post-hardening contract: tell the frontend the new tenant must
    // run the DNS-TXT dance before user-creation unlocks (§2.8 + Phase 5 UI).
    expect(responseBody?.data?.tenantVerificationRequired).toBe(true);
  });

  it('seeds a tenant_domains row with status=pending and is_primary=true', () => {
    expect(createdTenantId).toBeDefined();
    const row = queryDomainByTenantSubdomain(subdomain);
    expect(row).not.toBeNull();
    // Per §2.8 seedPendingDomain: adminEmail's domain is the ownership claim.
    expect(row?.domain).toBe(`${subdomain}.test`);
    expect(row?.status).toBe('pending');
    // psql `-A` (unaligned) renders BOOLEAN::text as 'true'/'false' (not 't'/'f'
    // like the aligned default). The `::text` cast in the SELECT locks that.
    expect(row?.isPrimary).toBe('true');
  });

  it('generates a 64-hex verification_token (32 bytes × 2)', () => {
    const row = queryDomainByTenantSubdomain(subdomain);
    expect(row).not.toBeNull();
    // §2.4 generateToken uses crypto.randomBytes(32).toString('hex') → 64 chars.
    // Matches VARCHAR(64) column width from migration 20260417223358319.
    expect(row?.verificationToken).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ─── DEFERRED: OAuth signup integration ──────────────────────────────────────
// Per `oauth.api.test.ts` precedent, full Microsoft OAuth callback flows
// require backend-process HTTP mocking that this infra does NOT support
// (tests run against the real `assixx-backend` container; no way to intercept
// its outbound Microsoft requests from here). The OAuth-verified-signup path
// (seedVerifiedDomain, 23505 conflict race) is exercised at unit level in
// `backend/src/nest/signup/signup.service.test.ts` + `oauth.service.test.ts`.
// Phase 6 manual smoke is the integration-level home for these flows.
//
// Original plan items (§4):
//   - POST /api/v2/auth/oauth/microsoft/callback → 201 + verified tenant_domains
//   - Follow-up POST /api/v2/users as the OAuth root → 201 immediately
