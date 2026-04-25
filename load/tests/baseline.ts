/**
 * Baseline Load Test — Assixx API + Chat WebSocket
 *
 * Purpose: Establish a regression-grade performance baseline for the
 * production hot-path under 70% reads / 30% writes mix, with optional
 * persistent WebSocket-Soak in parallel.
 *
 * THROTTLER-CONSTRAINT (ADR-001 — non-negotiable):
 *   Rate limits are tracked PER JWT user-id. Tiers:
 *     • `admin`  = 2000 reqs / 15 min  → ~2.2 req/sec sustained
 *     • `user`   = 1000 reqs / 15 min  → ~1.1 req/sec sustained
 *   That means a SINGLE-tenant baseline is throttle-bound, not pg-pool-
 *   bound — at >5 VU the test produces 429s instead of latency data.
 *   To find the actual capacity ceiling, you MUST provide a multi-tenant
 *   login pool via __ENV.LOGINS (one user per tenant).
 *
 * Two profiles (PROFILE env):
 *
 *   PROFILE=light (DEFAULT) — single-tenant safe
 *     Stages: 15s→2 VU, 2m sustain @2, 30s→5, 1m sustain @5, 15s→0.
 *     Total ~5 min, peak 5 VU. ~1700 reqs total → fits inside admin
 *     2000/15min budget. Catches functional regressions + p95 drift,
 *     does NOT find pool saturation (use `full` for that).
 *
 *   PROFILE=full — requires LOGINS pool ≥5
 *     Stages: 30s→5, 2m→50, 3m sustain @250, 2m→500, 30s→0. Total ~8 min.
 *     With 5+ tenant logins round-robined, per-user req-rate stays under
 *     throttle ceiling while aggregate hits realistic SaaS-load levels.
 *     setup() refuses to start if pool < 5.
 *
 * Why per-tag thresholds?
 *   Smoke's p95<500/p99<1000 are meaningless against real load. ADR-048
 *   documents Assixx p95 typically <50ms — so:
 *     read  → p95<100, p99<300 (4× Smoke = real regression)
 *     write → p95<250, p99<800 (RLS write-path + audit_trail per ADR-009)
 *     ws    → handshake<500ms
 *
 * Multi-tenant pool:
 *   Set __ENV.LOGINS to JSON `[{"email":…,"password":…}, …]`. Each VU
 *   round-robins over the pool, surfacing RLS noisy-neighbor effects
 *   (set_config + policy-check overhead per tenant context switch).
 *   Pool seeding is operator's responsibility — see load/README.md §Multi-tenant.
 *
 * Cleanup:
 *   Writes tagged `LOAD-<runId>-vu<n>-iter<m>` (see lib/payloads.ts).
 *   Post-run:
 *     docker exec assixx-postgres psql -U assixx_user -d assixx -c \
 *       "DELETE FROM blackboard_entries WHERE title LIKE 'LOAD-%';"
 *
 * Execution:
 *   pnpm run test:load:baseline                                              # PROFILE=light
 *   WS=1 pnpm run test:load:baseline                                         # +WS-Soak
 *   PROFILE=full LOGINS='[…5+ tenants…]' pnpm run test:load:baseline         # capacity test
 *
 * @see ADR-001 (rate-limit tiers — the throttle math behind the profiles)
 * @see ADR-005 (auth — WS query-param token for handshake)
 * @see ADR-009 (audit-trail write-amplification — every POST → ≥1 audit row)
 * @see ADR-019 (RLS — set_config per request, surfaced by multi-tenant pool)
 * @see ADR-048 (tail-sampling — 200ms threshold catches every trace this produces)
 * @see load/lib/payloads.ts — write-DTO source of truth + cleanup tag format
 */
import { check, fail, group, sleep } from 'k6';
import http from 'k6/http';
import ws from 'k6/ws';

import { type AuthState, authHeaders, authOnly, loginApitest } from '../lib/auth.ts';
import { APITEST_EMAIL, APITEST_PASSWORD, BASE_URL, HEALTH_URL } from '../lib/config.ts';
import { blackboardEntry, makeRunId } from '../lib/payloads.ts';

declare const __ENV: Record<string, string | undefined>;
declare const __VU: number;
declare const __ITER: number;

interface Login {
  email: string;
  password: string;
}

/** Parse __ENV.LOGINS or fall back to single apitest. Failure aborts setup() loud. */
function resolveLoginPool(): Login[] {
  const raw = __ENV.LOGINS;
  if (raw === undefined || raw === '') {
    return [{ email: APITEST_EMAIL, password: APITEST_PASSWORD }];
  }
  try {
    const parsed = JSON.parse(raw) as Login[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      fail('__ENV.LOGINS must be a non-empty JSON array of {email,password}');
    }
    return parsed;
  } catch (err: unknown) {
    fail(`__ENV.LOGINS is not valid JSON: ${String(err)}`);
  }
}

/** k6 contract: unreachable, fail() throws — but TS needs the return-path. */
function neverReturns(): never {
  throw new Error('unreachable');
}

interface SetupData {
  runId: string;
  /** One AuthState per login in the pool — resolved once, reused by every VU. */
  auths: AuthState[];
  wsUrl: string;
}

/** Login each pool entry once. setup() runs in a single goja VM before VUs spawn. */
function loginAll(pool: Login[]): AuthState[] {
  const out: AuthState[] = [];
  for (const login of pool) {
    if (login.email === APITEST_EMAIL && login.password === APITEST_PASSWORD) {
      out.push(loginApitest());
      continue;
    }
    // Generic login path for non-apitest tenants. Mirrors loginApitest() shape.
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email: login.email, password: login.password }),
      { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth_login' } },
    );
    if (res.status !== 200) {
      fail(`Login failed for ${login.email}: status=${res.status} body=${res.body as string}`);
    }
    const body = res.json() as {
      data: { accessToken: string; refreshToken: string; user: { id: number; tenantId: number } };
    };
    out.push({
      authToken: body.data.accessToken,
      refreshToken: body.data.refreshToken,
      userId: body.data.user.id,
      tenantId: body.data.user.tenantId,
    });
  }
  return out;
}

const ENABLE_WS = __ENV.WS === '1';
const WS_URL = __ENV.WS_URL ?? 'ws://localhost:3000/chat-ws';

/**
 * Per-tag thresholds. `op` tag splits read vs. write so a write-side
 * regression doesn't get diluted by faster reads in the global p95.
 *
 * The trailing `,abortOnFail:true` would short-circuit a clearly broken
 * run — left off here intentionally so the operator can see the full
 * curve even when one threshold trips (helps root-cause).
 */
const baselineThresholds = {
  // Auth must work — if this fails, every subsequent metric is noise.
  'http_req_duration{name:auth_login}': ['p(95)<800'],
  // Read mix — current Smoke p95=24ms, so 100ms = ~4× regression budget.
  'http_req_duration{op:read}': ['p(95)<100', 'p(99)<300'],
  // Writes hit RLS write-path + audit_trail (ADR-009) → looser, but still tight.
  'http_req_duration{op:write}': ['p(95)<250', 'p(99)<800'],
  // Global error budget — anything above 0.1% is a real bug under this load.
  http_req_failed: ['rate<0.001'],
  checks: ['rate>0.999'],
  // WS — only meaningful if scenario is enabled, else metric is empty/no-op.
  'ws_connecting{scenario:ws_soak}': ['p(95)<500'],
  ws_session_duration: ['p(95)<60000'],
} as const;

type Profile = 'light' | 'full';
const PROFILE: Profile = __ENV.PROFILE === 'full' ? 'full' : 'light';
const MIN_POOL_FOR_FULL = 5;

/**
 * Light profile: single-tenant safe under ADR-001 admin throttle (2000/15min).
 * 5-min total wall-time, peak 5 VU, ~1700 reqs total — fits the budget.
 * Detects functional regressions + p95 drift, NOT pool-saturation.
 */
const lightStages = [
  { duration: '15s', target: 2 }, // warm
  { duration: '2m', target: 2 }, // sustained baseline (~1.5 req/s)
  { duration: '30s', target: 5 }, // mini-stress
  { duration: '1m', target: 5 }, // hold for percentile sample-size
  { duration: '15s', target: 0 }, // cool — flush audit_trail writes
];

/**
 * Full profile: capacity test — requires LOGINS pool ≥5 (validated in setup).
 * 8-min total wall-time, ramps 5 → 50 → 250 → 500 VU. With 5 tenants round-
 * robined, per-user req-rate stays inside admin 2000/15min ceiling while
 * aggregate hits 250+ concurrent (real SaaS-customer-load proxy).
 */
const fullStages = [
  { duration: '30s', target: 5 }, // warm-up — fills auth/DB pool
  { duration: '2m', target: 50 }, // ramp to realistic per-tenant load
  { duration: '3m', target: 250 }, // sustain — the Baseline number
  { duration: '2m', target: 500 }, // stress — find pool-saturation knee
  { duration: '30s', target: 0 }, // cool-down — flush pending audit writes
];

const httpRampStages = PROFILE === 'full' ? fullStages : lightStages;

const wsScenario = ENABLE_WS
  ? {
      ws_soak: {
        executor: 'constant-vus' as const,
        exec: 'runWsSoak',
        vus: 50,
        duration: '8m', // matches httpRampStages total
        startTime: '0s',
        tags: { scenario: 'ws_soak' },
      },
    }
  : {};

export const options = {
  scenarios: {
    http_ramp: {
      executor: 'ramping-vus' as const,
      exec: 'runHttpMix',
      startVUs: 0,
      stages: httpRampStages,
      gracefulRampDown: '15s',
      tags: { scenario: 'http_ramp' },
    },
    ...wsScenario,
  },
  thresholds: baselineThresholds,
  // Summary export → consumed by scripts/load-diff.ts for CI-grade regression
  // detection. Path is a docker-mount inside the container; the wrapper script
  // (package.json `test:load:baseline`) maps it to `load/results/`.
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

export function setup(): SetupData {
  const runId = makeRunId();
  const pool = resolveLoginPool();

  // Throttle-budget guard (ADR-001). PROFILE=full peaks at 500 VU, which
  // requires the load to spread across ≥5 distinct user-IDs to fit inside
  // the admin 2000/15min ceiling. Fail loud here rather than 429-storm
  // the test halfway through.
  if (PROFILE === 'full' && pool.length < MIN_POOL_FOR_FULL) {
    fail(
      `PROFILE=full requires LOGINS pool ≥${MIN_POOL_FOR_FULL} (got ${pool.length}). ` +
        `Single-tenant cannot exceed admin throttle budget — see ADR-001 + load/README.md §Multi-tenant.`,
    );
  }

  const auths = loginAll(pool);
  // Status-line is printed by k6 in its run-banner via thresholds + scenarios.
  // No console.* here — k6's goja runtime doesn't expose console as a typed
  // global, and adding lib:dom just for one log line is wasteful.
  return { runId, auths, wsUrl: WS_URL };
}

/**
 * Pick a tenant-context for this VU. Round-robin keeps cross-tenant load
 * balanced; for stickier per-VU tenancy use `__VU % auths.length` once at
 * iteration 0 and cache — but pure round-robin is what surfaces RLS noisy-
 * neighbor effects, which is the whole point of multi-tenant testing.
 */
function pickAuth(data: SetupData): AuthState {
  const idx = (__VU + __ITER) % data.auths.length;
  return data.auths[idx] ?? data.auths[0]!;
}

const READ_ENDPOINTS: { name: string; path: string }[] = [
  { name: 'org_scope', path: '/users/me/org-scope' },
  { name: 'users_list', path: '/users?limit=10' },
  { name: 'departments_list', path: '/departments' },
  { name: 'teams_list', path: '/teams' },
  { name: 'blackboard_entries', path: '/blackboard/entries' },
  { name: 'notifications_list', path: '/notifications' },
  { name: 'tpm_plans', path: '/tpm/plans' },
  { name: 'addons_list', path: '/addons' },
];

/**
 * Default exec: 70% reads / 30% writes weighted-random pick.
 * Health endpoint hit every 10 iterations as a no-auth canary.
 */
export function runHttpMix(data: SetupData): void {
  const auth = pickAuth(data);

  if (__ITER % 10 === 0) {
    group('canary health', () => {
      const res = http.get(HEALTH_URL, { tags: { name: 'health', op: 'read' } });
      check(res, { 'health 200': (r) => r.status === 200 });
    });
  }

  const roll = Math.random();
  if (roll < 0.7) {
    // 70%: random read endpoint
    const ep = READ_ENDPOINTS[Math.floor(Math.random() * READ_ENDPOINTS.length)]!;
    const res = http.get(`${BASE_URL}${ep.path}`, {
      headers: authOnly(auth.authToken),
      tags: { name: ep.name, op: 'read' },
    });
    check(res, { [`${ep.name} 2xx`]: (r) => r.status >= 200 && r.status < 300 });
  } else {
    // 30%: write — POST blackboard entry. KVP excluded (team-membership-dep).
    const body = blackboardEntry(data.runId, __VU, __ITER);
    const res = http.post(`${BASE_URL}/blackboard/entries`, JSON.stringify(body), {
      headers: authHeaders(auth.authToken),
      tags: { name: 'blackboard_create', op: 'write' },
    });
    check(res, { 'blackboard_create 2xx': (r) => r.status >= 200 && r.status < 300 });
  }

  // Realistic think-time. Without sleep, k6 hammers harder than any real
  // user — making the test about k6's pacing rather than the API.
  sleep(0.5 + Math.random() * 0.5);
}

/**
 * WS-Soak: open authenticated chat WebSocket, stay idle, expect server
 * not to drop us. JWT is sent via query param per ADR-005 token-extraction
 * order (Header > Cookie > Query — Query is the WS-handshake fallback).
 *
 * If the chat WS path differs in your env, override via __ENV.WS_URL. The
 * default `ws://localhost:3000/chat-ws` matches the docker dev backend
 * (Nginx proxies the same path in production).
 */
export function runWsSoak(data: SetupData): void {
  const auth = pickAuth(data);
  const url = `${data.wsUrl}?token=${encodeURIComponent(auth.authToken)}`;

  const res = ws.connect(url, {}, (socket) => {
    socket.on('open', () => {
      // Hold connection open for 30s, then let session-duration metric
      // record. constant-vus(50) over 8m ⇒ ~16 sessions per VU ⇒ steady
      // ~50 concurrent connections with churn — mirrors real chat behavior.
      socket.setTimeout(() => socket.close(), 30_000);
    });
    // No on('error') handler — k6 surfaces WS-errors via the
    // ws_session_duration threshold + summary stats. Adding a typed
    // handler here adds no signal, only TS friction (k6's
    // ErrorEventHandler signature drifts between minor versions).
  });

  // 101 Switching Protocols = handshake success. Anything else (4xx/5xx)
  // means the WS path or auth flow regressed — surface explicitly.
  check(res, { 'ws handshake 101': (r) => r !== null && r.status === 101 });
}

// Default export required by k6 — unused when scenarios are defined, but
// k6 still validates the module shape. Returning quickly keeps it cheap.
export default function (): void {
  neverReturns();
}
