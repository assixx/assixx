/**
 * Load Test Configuration
 *
 * Single source of truth for k6 scripts. Mirrors `backend/test/helpers.ts`
 * conventions (BASE_URL, assixx test credentials) so load and integration tests
 * target the same tenant and have identical response-shape expectations.
 *
 * Why hardcoded assixx test credentials?
 *   Same reason as ADR-018 / HOW-TO-TEST: isolated test tenant,
 *   no real user data, no Doppler round-trip needed. Prod-grade load tests
 *   would use a dedicated benchmark tenant injected via __ENV.
 *
 * Override via Docker `-e` flag, e.g.:
 *   docker run ... -e BASE_URL=http://host:3000/api/v2 grafana/k6 run ...
 */

/** k6 globals — available at runtime via the grafana/k6 binary. */
declare const __ENV: Record<string, string | undefined>;

export const BASE_URL = __ENV.BASE_URL ?? 'http://localhost:3000/api/v2';
export const HEALTH_URL = __ENV.HEALTH_URL ?? 'http://localhost:3000/health';

export const APITEST_EMAIL = __ENV.EMAIL ?? 'info@assixx.com';
export const APITEST_PASSWORD = __ENV.PASSWORD ?? 'ApiTest12345!';

/**
 * Mailpit dev-SMTP capture base URL — required for k6's 2FA bridge
 * (`load/lib/2fa-helper.ts`).
 *
 * ADR-054 / FEAT_2FA_EMAIL_MASTERPLAN: every password login emits a 2FA
 * challenge mail. k6 cannot read the inbox from goja, so the bridge polls
 * Mailpit's HTTP API for the freshly-issued code. With `--network=host`
 * the k6 container reaches Mailpit's host-bound port directly — see
 * `docker/docker-compose.yml` (`assixx-mailpit` exposes 8025) +
 * HOW-TO-DEV-SMTP.md (Mailpit is the dev-SMTP standard, ADR-027).
 *
 * Override via `-e MAILPIT_URL=http://other-host:8025` for runs that
 * target a non-default capture target (rare).
 */
export const MAILPIT_URL = __ENV.MAILPIT_URL ?? 'http://localhost:8025';

/**
 * Smoke thresholds — initial baseline.
 * Tighten once 3-5 runs establish realistic p95 range per endpoint.
 *
 * - `checks`: >99 % of `check()` assertions must pass (catches 4xx/5xx)
 * - `http_req_failed`: <1 % request-error rate (catches transport/5xx)
 * - `http_req_duration`: global p95 <500 ms, p99 <1000 ms
 *
 * Global duration thresholds intentionally loose. Per-endpoint thresholds
 * can be added later via `tags: { name: 'endpoint' }` + custom metric.
 */
export const SMOKE_THRESHOLDS = {
  checks: ['rate>0.99'],
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
} as const;
