import { execSync } from 'node:child_process';

/**
 * Global setup for the E2E suite — runs once before any spec.
 *
 * Two cleanups, both belt-and-braces against cross-run state pollution:
 *
 * 1. **Redis FLUSHDB** — same approach as API integration tests
 *    (`flushThrottleKeys` in `backend/test/helpers.ts`). FLUSHDB wipes
 *    `throttle:*` (rate-limit buckets), `2fa:lock:*` (15-min lockouts after
 *    5 wrong codes — DD-6), `2fa:fail-streak:*` (24h cumulative fail counter —
 *    DD-5), and any pending `2fa:*` challenge records left over from a prior
 *    failed run. Auth tokens are cached in the Node test process, NOT in
 *    Redis, so this flush is safe.
 *
 * 2. **Mailpit DELETE** — wipe stale 2FA mails so the `since`-filtered poll
 *    in `e2e/helpers.ts:fetchLatest2faCode` cannot accidentally consume an
 *    old code from a previous suite run. Each helper call already filters
 *    by `loginStartedAt` (set by the caller before clicking submit), so this
 *    is defence in depth — protects against worst-case clock-drift edge
 *    cases between the host kernel clock and the Mailpit container clock
 *    (Docker shares the host kernel clock, so drift is sub-ms in practice).
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §Phase 5 + §Spec Deviations D5
 * @see backend/test/helpers.ts (`clearMailpit`, `fetchLatest2faCode`)
 */
export default async function globalSetup(): Promise<void> {
  try {
    execSync(
      `docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' --no-auth-warning FLUSHDB`,
      { stdio: 'pipe' },
    );
  } catch {
    console.warn('Warning: Could not flush Redis. Rate-limit / 2FA-state tests may fail.');
  }

  try {
    const res = await fetch('http://localhost:8025/api/v1/messages', { method: 'DELETE' });
    if (!res.ok) throw new Error(`Mailpit DELETE returned HTTP ${String(res.status)}`);
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : 'unknown';
    console.warn(`Warning: Could not clear Mailpit (${reason}). 2FA tests may use stale codes.`);
  }
}
