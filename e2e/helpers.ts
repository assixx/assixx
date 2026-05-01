/**
 * Shared utilities for Playwright E2E tests.
 *
 * Mirrors `backend/test/helpers.ts` Mailpit-2FA dance into the browser-driver
 * world: the backend now hardcodes email-based 2FA on every password login
 * (ADR-054 / FEAT_2FA_EMAIL_MASTERPLAN Phase 2 Step 2.4, DONE 2026-04-29), so
 * Playwright — which IS the user — must complete the verify step itself.
 *
 * **Why a dedicated helper instead of duplicating across the 3 call sites:**
 * `auth.setup.ts`, `unverified-auth.setup.ts`, and `login.spec.ts` all need
 * the identical {Mailpit poll → 6-box OTP fill → click "Bestätigen"} sequence.
 * Centralising here keeps the dance in ONE place and makes future changes (e.g.
 * code-format swap from Crockford-Base32 to TOTP) a one-file diff.
 *
 * @see backend/test/helpers.ts — API-test counterpart (cross-worker `since` filter
 *      is the source pattern; Playwright runs `workers: 1` so the race risk is
 *      lower, but mirroring the filter still saves us from stale-mail confusion
 *      between back-to-back suite runs).
 * @see frontend/src/routes/(public)/login/_lib/TwoFactorVerifyForm.svelte —
 *      DOM contract the helper drives.
 * @see frontend/src/routes/(public)/_lib/2fa-shared.ts — `CODE_LENGTH=6`,
 *      Crockford-Base32 alphabet `[A-HJKMNP-Z2-9]`.
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §Phase 5 (inline-card UX) +
 *      §Spec Deviations D5 (audit row #4 miss).
 */
import type { Page } from '@playwright/test';

/** Mailpit Web-UI / REST endpoint — host port mapping per docker-compose.yml. */
const MAILPIT_URL = 'http://localhost:8025';
/** Poll cadence — matches backend/test/helpers.ts:MAIL_POLL_INTERVAL_MS. */
const POLL_INTERVAL_MS = 200;
/** Total wait budget for a 2FA mail to land in Mailpit after credentials POST. */
const POLL_TIMEOUT_MS = 10_000;
/** OTP code length — mirror of `CODE_LENGTH` in (public)/_lib/2fa-shared.ts. */
const CODE_LENGTH = 6;
/**
 * Anchor: backend renderCodeMailText (`2fa-code.template.ts`) writes
 * `Ihr Code: ${code}` as the dedicated code-carrier line. The 6-char Crockford
 * alphabet `[A-HJKMNP-Z2-9]` excludes confusable 0/1/I/L/O (DD-1).
 * Bytewise identical to backend/test/helpers.ts:_extract2faCode regex.
 */
const CODE_REGEX = /Ihr Code:\s*([A-HJKMNP-Z2-9]{6})/;

interface MailpitMessageSummary {
  ID: string;
  To: { Address: string }[];
  Created: string;
}
interface MailpitMessagesEnvelope {
  messages: MailpitMessageSummary[];
}
interface MailpitMessageDetail {
  Text: string;
}

/**
 * Poll Mailpit for the most recent 2FA code mail addressed to `recipient` AND
 * created strictly after `since`. Returns the 6-char Crockford-Base32 code.
 *
 * The `since`-filter (set by callers to `new Date()` BEFORE the credentials
 * submit) guarantees we never pick up a stale mail from a prior run — even
 * after `global-setup.ts` already wiped Mailpit. Belt + braces: clock drift
 * between the host (Playwright wall clock) and the Mailpit container is
 * sub-ms because Docker shares the host kernel clock, so direct `Date.parse`
 * comparison is safe.
 *
 * Mailpit returns messages newest-first by default (verified 2026-04-29). The
 * list endpoint omits the body, so for each candidate we fetch
 * `/api/v1/message/{ID}` to read `Text` — one extra round-trip per match,
 * negligible at suite scale.
 *
 * @throws if no matching mail arrives within {@link POLL_TIMEOUT_MS}.
 */
export async function fetchLatest2faCode(recipient: string, since: Date): Promise<string> {
  const lower = recipient.toLowerCase();
  const sinceMs = since.getTime();
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/messages`);
    const env = (await res.json()) as MailpitMessagesEnvelope;
    for (const m of env.messages) {
      if (Date.parse(m.Created) <= sinceMs) continue;
      if (!m.To.some((t) => t.Address.toLowerCase() === lower)) continue;
      const detailRes = await fetch(`${MAILPIT_URL}/api/v1/message/${m.ID}`);
      const detail = (await detailRes.json()) as MailpitMessageDetail;
      const match = CODE_REGEX.exec(detail.Text);
      if (match?.[1] !== undefined) return match[1];
    }
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`No 2FA code mail for ${recipient} within ${POLL_TIMEOUT_MS}ms`);
}

/**
 * Drive the inline 2FA-verify card from credentials-submit to dashboard-redirect:
 *   1. wait for the verify stage to render (`.otp-input` becomes visible after
 *      the backend's `stage='challenge_required'` 303 reloads /login),
 *   2. fetch the 6-char code from Mailpit (filtered by `since`),
 *   3. fill each of the 6 `<input maxlength="1">` boxes individually — Svelte's
 *      `oninput`/`handleDigitInput` writes `digits[i]` and auto-advances focus,
 *   4. click `.verify-submit` ("Bestätigen") — manual-submit-only since
 *      2026-04-30 (auto-submit-on-6th-char was removed by user request, see
 *      TwoFactorVerifyForm.svelte:127–133).
 *
 * Caller is responsible for the post-verify `waitForURL('**\/root-dashboard')`.
 *
 * @param page Playwright Page already at `/login` post-credentials-submit.
 * @param recipient Email address that should have received the 2FA mail.
 * @param since `new Date()` captured BEFORE the credentials submit click.
 */
export async function complete2faChallenge(
  page: Page,
  recipient: string,
  since: Date,
): Promise<void> {
  // Wait for the verify stage to materialise. The credentials → verify swap is
  // a full 303 reload, not a client-side state flip, so the OTP boxes don't
  // exist in the DOM until SvelteKit re-renders. `.first()` keeps strict-mode
  // happy (the locator matches 6 elements; `waitFor` needs exactly one).
  await page.locator('.otp-input input').first().waitFor({ state: 'visible' });

  const code = await fetchLatest2faCode(recipient, since);

  // Per-box `.fill()` exercises the real user path (`oninput` → `digits[i]` →
  // hidden `name="code"` field). Playwright's auto-wait handles enabled/visible
  // for each element. Auto-advance focus after each box is incidental — we
  // address each box by index, not by current focus, so the navigation is
  // independent of the auto-advance behaviour.
  const boxes = page.locator('.otp-input input');
  for (let i = 0; i < CODE_LENGTH; i++) {
    await boxes.nth(i).fill(code[i] ?? '');
  }

  // `canSubmit` flips to `true` once `code.length === CODE_LENGTH`; Playwright's
  // `.click()` auto-waits for actionability, so no separate `toBeEnabled` wait
  // needed. The verify action issues a SvelteKit redirect to the role-based
  // dashboard; `enhanceVerify`'s `result.type === 'redirect'` handler turns it
  // into a full-page `window.location.href` navigation that Playwright detects.
  await page.locator('.verify-submit').click();
}
