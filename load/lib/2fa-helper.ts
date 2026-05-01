/**
 * 2FA Mailpit-Bridge for k6 load tests.
 *
 * ADR-054 + FEAT_2FA_EMAIL_MASTERPLAN (DD-10 Removal v0.5.0) hardcode
 * mandatory email-2FA on every password login. k6 cannot complete the
 * email-code step from inside goja, so this helper bridges via Mailpit's
 * REST API: poll for a fresh code mail addressed to `email`, extract the
 * 6-char Crockford-Base32 code from the plain-text body, then submit it
 * to `/auth/2fa/verify`. Returns the same `AuthState` shape that the
 * pre-2FA login emitted — `loginGeneric` callers stay unchanged.
 *
 * Why Mailpit-bridge (vs. backend test-only endpoint or DB-flag bypass):
 *   - **Zero new backend surface.** No test-only route, no NODE_ENV branch,
 *     no DB column, no feature flag. DD-10 stance ("kein Einstellung
 *     auszustellen, period") preserved.
 *   - **Mailpit is already the dev-SMTP standard** — see HOW-TO-DEV-SMTP
 *     and ADR-027 §"Image Pinning Discipline". With `--network=host`, the
 *     k6 container reaches Mailpit at `localhost:8025` without extra wiring.
 *   - **Validates the SMTP pipeline as a side-effect.** A broken
 *     `send2faCode` path manifests as a smoke threshold-fail (no fresh
 *     mail in 15 s → `fail()`), not a silent skip.
 *   - **Mirrors `backend/test/helpers.ts:fetchLatest2faCode` 1:1** — same
 *     regex (`/Ihr Code:\s*([A-HJKMNP-Z2-9]{6})/`), same `sinceMs` filter
 *     against `Mailpit's Created` field. Drift between Vitest + k6
 *     extractors is impossible because both anchor on the template's
 *     `Ihr Code: ${code}` line in `2fa-code.template.ts:326`
 *     (`renderCodeMailText`).
 *
 * Limitation (queued for FEAT_2FA_EMAIL_MASTERPLAN §Phase 7):
 *   Only works against runs that route SMTP through Mailpit (i.e. dev /
 *   CI). Staging/Prod-targeted load runs would need an out-of-band
 *   token-mint via `loginWithVerifiedUser()` (DD-7 OAuth-equivalent) —
 *   not implemented here, YAGNI per `load/README.md` (smoke + baseline
 *   are local-only today).
 *
 * @see docs/infrastructure/adr/ADR-054-mandatory-email-2fa.md (Layer 0
 *      gate, DD-7 OAuth-exempt, R13 load-test resolution)
 * @see docs/how-to/HOW-TO-DEV-SMTP.md (Mailpit setup, REST API pattern)
 * @see backend/src/utils/email-templates/2fa-code.template.ts:326
 *      (`renderCodeMailText` — single source of truth for the code line)
 * @see backend/test/helpers.ts:163 (`_extract2faCode` — sibling regex)
 */
import { fail, sleep } from 'k6';
import http from 'k6/http';

import type { AuthState } from './auth.ts';
import { BASE_URL, MAILPIT_URL } from './config.ts';

/**
 * Subset of Mailpit's `/api/v1/messages` envelope. Probed 2026-05-01:
 * `{ total, unread, count, messages_count, start, tags, messages: [...] }`.
 * We only care about `messages[*].{ID, Created, To}` — narrowed here to
 * keep the type minimal and document the dependency surface.
 */
interface MailpitMessageSummary {
  ID: string;
  Created: string;
  To: { Address: string }[];
}
interface MailpitSearchEnvelope {
  messages: MailpitMessageSummary[];
}
interface MailpitMessageDetail {
  ID: string;
  Text: string;
}

/**
 * Subset of `TwoFactorVerifyResponse` (`two-factor-auth.types.ts:103`).
 * Cookies (accessToken, refreshToken, accessTokenExp) carry the tokens
 * per R8 ("tokens never in body") — body has only `user`. We narrow to
 * the fields k6 actually reads.
 *
 * `handoff` is only present on signup-purpose verifies; load tests use
 * pre-existing tenants (login-purpose), so we do not consume it. It
 * remains in the type for forward-compat documentation.
 */
interface VerifyResponseBody {
  data: {
    stage: 'authenticated';
    user: { id: number; tenantId: number };
  };
}

const POLL_INTERVAL_MS = 250;
const POLL_TIMEOUT_MS = 15_000; // generous for slow SMTP roundtrips
/**
 * Skew tolerance between host clock (k6's `Date.now()`) and Mailpit's
 * `Created` timestamp. Both share the host kernel clock under Docker,
 * but Mailpit writes `Created` AFTER receiving + persisting the mail —
 * a 5 s buffer absorbs that lag without admitting genuinely stale mails
 * (which would be at least minutes old from prior test runs).
 */
const CLOCK_SKEW_MS = 5_000;

/**
 * Crockford-Base32 6-char code anchored on `Ihr Code:` prefix written by
 * `renderCodeMailText` (`2fa-code.template.ts:326`). DD-13 mandates a
 * generic subject, so the body is the only place the token appears —
 * this is the single anchor point.
 *
 * Alphabet `[A-HJKMNP-Z2-9]` excludes confusables `0/1/I/L/O` per DD-1.
 * Deliberately mirrors `backend/test/helpers.ts:165` so a future template
 * tweak that breaks the marker breaks BOTH test rigs at the same commit
 * (no silent drift between Vitest + k6).
 */
const CODE_REGEX = /Ihr Code:\s*([A-HJKMNP-Z2-9]{6})/;

/**
 * Try to extract a 2FA code from a single Mailpit message summary.
 * Returns `null` and falls through silently on every reject path —
 * keeps `scanForCode`'s loop body trivial (sonarjs complexity ≤ 10).
 *
 * Reject conditions (each a single `return null`):
 *   1. Mail older than `sinceMs` (stale from prior runs).
 *   2. Recipient does not match `lowerRecipient` (cross-tenant mail
 *      in the same Mailpit instance).
 *   3. `/api/v1/message/{ID}` non-200 (transient Mailpit hiccup —
 *      caller will retry on the next poll cycle).
 *   4. Body lacks the `Ihr Code: XXXXXX` marker (template drift,
 *      will surface as a `pollMailpitForCode` timeout).
 */
function tryExtractCodeFromSummary(
  summary: MailpitMessageSummary,
  lowerRecipient: string,
  sinceMs: number,
): string | null {
  if (Date.parse(summary.Created) <= sinceMs) return null;
  if (!summary.To.some((t) => t.Address.toLowerCase() === lowerRecipient)) return null;
  const detailRes = http.get(`${MAILPIT_URL}/api/v1/message/${summary.ID}`, {
    tags: { name: 'mailpit_message' },
  });
  if (detailRes.status !== 200) return null;
  const detail = detailRes.json() as unknown as MailpitMessageDetail;
  if (typeof detail.Text !== 'string') return null;
  const m = CODE_REGEX.exec(detail.Text);
  if (m?.[1] === undefined || m[1] === '') return null;
  return m[1];
}

/**
 * Walk one Mailpit search snapshot for a 2FA mail addressed to
 * `lowerRecipient` AND newer than `sinceMs`. Per summary: delegates to
 * `tryExtractCodeFromSummary`. Returns `null` if no fresh match found in
 * this snapshot — caller sleeps + retries until `POLL_TIMEOUT_MS`.
 */
function scanForCode(
  envelope: MailpitSearchEnvelope,
  lowerRecipient: string,
  sinceMs: number,
): string | null {
  for (const summary of envelope.messages) {
    const code = tryExtractCodeFromSummary(summary, lowerRecipient, sinceMs);
    if (code !== null) return code;
  }
  return null;
}

/**
 * Poll Mailpit for the freshest 2FA code mail addressed to `email` AND
 * created at or after `issuedAtMs - CLOCK_SKEW_MS`.
 *
 * Caller MUST capture `issuedAtMs = Date.now()` BEFORE issuing the
 * `/auth/login` request — Mailpit retains its mailbox in `mailpit.db`
 * across container restarts (HOW-TO-DEV-SMTP §5), so without a time
 * filter a stale code from a prior run would be picked up first.
 *
 * Fails loud on timeout — silently using a stale code would surface as
 * a 401 storm in the iteration phase, far harder to root-cause than a
 * setup-time abort with a Mailpit URL pointer.
 */
function pollMailpitForCode(email: string, issuedAtMs: number): string {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  const minCreatedMs = issuedAtMs - CLOCK_SKEW_MS;
  const lowerRecipient = email.toLowerCase();
  // Mailpit search syntax: `to:<email>` filters recipient (verified via
  // probe 2026-05-01 — see masterplan §0.5.5). Limit 5 keeps the snapshot
  // small even when prior runs left dozens of mails for the same address.
  const query = encodeURIComponent(`to:${email}`);
  let lastErr = `no fresh mail to ${email} within ${POLL_TIMEOUT_MS}ms`;

  while (Date.now() < deadline) {
    const searchRes = http.get(`${MAILPIT_URL}/api/v1/search?query=${query}&limit=5`, {
      tags: { name: 'mailpit_search' },
    });
    if (searchRes.status === 200) {
      const envelope = searchRes.json() as unknown as MailpitSearchEnvelope;
      const code = scanForCode(envelope, lowerRecipient, minCreatedMs);
      if (code !== null) return code;
    } else {
      lastErr = `mailpit search returned ${searchRes.status}`;
    }
    sleep(POLL_INTERVAL_MS / 1000);
  }
  fail(`pollMailpitForCode: ${lastErr} (Mailpit at ${MAILPIT_URL})`);
}

/**
 * Submit `/auth/2fa/verify` with the Mailpit-extracted code.
 *
 * The `challengeToken` cookie set by the prior `/auth/login` response
 * is automatically forwarded by k6's per-VM cookie jar (same host,
 * same path scope `/`). The verify endpoint sets `accessToken` /
 * `refreshToken` / `accessTokenExp` cookies (R8 — tokens never in body)
 * and returns `{ stage, user }` in the body.
 *
 * Cookie lookup goes through `noUncheckedIndexedAccess` — every step is
 * `T | undefined`, so explicit guards are mandatory before returning.
 */
function submitVerify(code: string, email: string): AuthState {
  const verifyRes = http.post(`${BASE_URL}/auth/2fa/verify`, JSON.stringify({ code }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'auth_2fa_verify' },
  });
  if (verifyRes.status !== 200) {
    fail(
      `2FA verify failed for ${email}: status=${verifyRes.status} ` +
        `body=${verifyRes.body as string}`,
    );
  }
  const body = verifyRes.json() as unknown as VerifyResponseBody;
  const accessToken = verifyRes.cookies['accessToken']?.[0]?.value;
  const refreshToken = verifyRes.cookies['refreshToken']?.[0]?.value;
  if (typeof accessToken !== 'string' || accessToken === '') {
    fail(
      `2FA verify response for ${email} missing accessToken cookie — ` +
        `setAuthCookies misconfigured? See backend/src/nest/auth/auth.controller.ts:174.`,
    );
  }
  if (typeof refreshToken !== 'string' || refreshToken === '') {
    fail(
      `2FA verify response for ${email} missing refreshToken cookie — ` +
        `setAuthCookies misconfigured? See backend/src/nest/auth/auth.controller.ts:174.`,
    );
  }
  return {
    authToken: accessToken,
    refreshToken,
    userId: body.data.user.id,
    tenantId: body.data.user.tenantId,
  };
}

/**
 * Complete a `challenge_required` login by polling Mailpit for the
 * 2FA code and submitting it to `/auth/2fa/verify`.
 *
 * Caller MUST capture `issuedAtMs = Date.now()` BEFORE the
 * `/auth/login` POST so stale mails from prior runs are filtered out
 * (Mailpit persists the mailbox in `assixx_mailpit_data` volume).
 *
 * Returns the same `AuthState` shape `loginGeneric` always emitted —
 * downstream callers (`smoke.ts`, `baseline.ts`) stay unchanged.
 */
export function completeChallengeViaMailpit(email: string, issuedAtMs: number): AuthState {
  const code = pollMailpitForCode(email, issuedAtMs);
  return submitVerify(code, email);
}
