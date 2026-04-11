import { execSync } from 'node:child_process';

/**
 * Flush Redis rate-limit keys before E2E tests.
 * Same approach as API integration tests (flushThrottleKeys in helpers.ts).
 * Auth tokens are cached in the Node process, NOT in Redis — safe to flush.
 */
export default function globalSetup(): void {
  try {
    execSync(
      `docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' --no-auth-warning FLUSHDB`,
      { stdio: 'pipe' },
    );
  } catch {
    console.warn('Warning: Could not flush Redis. Rate-limit tests may fail.');
  }
}
