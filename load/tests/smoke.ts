/**
 * Smoke Test — Assixx API Hot Path
 *
 * Purpose: pre-release regression guard. Detects if a change pushes p95/p99
 * latency above the baseline on the 10 most-hit endpoints. NOT a capacity
 * test (1 VU × 1 min). Capacity/stress tests are separate scenarios.
 *
 * Scope rationale (10 endpoints):
 *   1. /health              — baseline (no auth, no DB)
 *   2. /users/me/org-scope  — Hot-Path (ADR-035/036/039, called on nearly every request)
 *   3. /users               — list + pagination
 *   4. /departments         — hierarchy read (ADR-034)
 *   5. /teams               — hierarchy read (ADR-034)
 *   6. /blackboard          — RLS-filtered list (ADR-019)
 *   7. /notifications       — sidebar load
 *   8. /calendar/events     — date-range filter (heavy query)
 *   9. /tpm/plans           — list + pagination (Addon: tpm, see ADR-033)
 *  10. /addons              — tenant addon catalog
 *
 * Prerequisites (see load/README.md):
 *   - Docker backend healthy on :3000
 *   - `assixx` tenant seeded (HOW-TO-CREATE-TEST-USER.md)
 *   - Redis throttle keys flushed (recommended — see README)
 *
 * Execution:
 *   pnpm run test:load:smoke
 */
import { check, group, sleep } from 'k6';
import http from 'k6/http';

import { type AuthState, authOnly, loginApitest } from '../lib/auth.ts';
import { BASE_URL, HEALTH_URL, SMOKE_THRESHOLDS } from '../lib/config.ts';

export const options = {
  vus: 1,
  duration: '1m',
  thresholds: SMOKE_THRESHOLDS,
};

/**
 * Runs once before VU iterations. Login token is passed to default()
 * so every iteration reuses it — zero throttle pressure.
 */
export function setup(): AuthState {
  return loginApitest();
}

export default function (auth: AuthState): void {
  const headers = authOnly(auth.authToken);

  group('01 health', () => {
    const res = http.get(HEALTH_URL, { tags: { name: 'health' } });
    check(res, { 'health 200': (r) => r.status === 200 });
  });

  group('02 org-scope', () => {
    const res = http.get(`${BASE_URL}/users/me/org-scope`, {
      headers,
      tags: { name: 'org_scope' },
    });
    check(res, { 'org-scope 200': (r) => r.status === 200 });
  });

  group('03 users', () => {
    const res = http.get(`${BASE_URL}/users?limit=10`, {
      headers,
      tags: { name: 'users_list' },
    });
    check(res, { 'users 200': (r) => r.status === 200 });
  });

  group('04 departments', () => {
    const res = http.get(`${BASE_URL}/departments`, {
      headers,
      tags: { name: 'departments_list' },
    });
    check(res, { 'departments 200': (r) => r.status === 200 });
  });

  group('05 teams', () => {
    const res = http.get(`${BASE_URL}/teams`, {
      headers,
      tags: { name: 'teams_list' },
    });
    check(res, { 'teams 200': (r) => r.status === 200 });
  });

  group('06 blackboard', () => {
    const res = http.get(`${BASE_URL}/blackboard/entries`, {
      headers,
      tags: { name: 'blackboard_entries' },
    });
    check(res, { 'blackboard 200': (r) => r.status === 200 });
  });

  group('07 notifications', () => {
    const res = http.get(`${BASE_URL}/notifications`, {
      headers,
      tags: { name: 'notifications_list' },
    });
    check(res, { 'notifications 200': (r) => r.status === 200 });
  });

  group('08 calendar', () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
    const res = http.get(
      `${BASE_URL}/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { headers, tags: { name: 'calendar_events' } },
    );
    check(res, { 'calendar 200': (r) => r.status === 200 });
  });

  group('09 tpm plans', () => {
    const res = http.get(`${BASE_URL}/tpm/plans`, {
      headers,
      tags: { name: 'tpm_plans' },
    });
    check(res, { 'tpm-plans 200': (r) => r.status === 200 });
  });

  group('10 addons', () => {
    const res = http.get(`${BASE_URL}/addons`, {
      headers,
      tags: { name: 'addons_list' },
    });
    check(res, { 'addons 200': (r) => r.status === 200 });
  });

  // Pacing — prevents accidental burst that trips rate limiters.
  sleep(1);
}
