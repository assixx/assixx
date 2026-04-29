/**
 * Throttler Module - Rate Limiting for NestJS
 *
 * Provides multi-tier rate limiting with Redis storage for distributed deployments.
 * Tiers: auth (10/5min), public (100/15min), user (1000/15min), admin (2000/15min),
 * upload (20/hour), export (1/min), domain-verify (10/10min), 2fa-verify (5/10min,
 * keyed on challengeToken), 2fa-resend (1/60s, keyed on challengeToken).
 */
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { type ExecutionContext, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { type ThrottlerLimitDetail, ThrottlerModule } from '@nestjs/throttler';
import { Redis } from 'ioredis';

/** Time constants in milliseconds */
const MS_MINUTE = 60_000;
const MS_HOUR = 3_600_000;

/**
 * Per-tier `getTracker` for the 2FA tiers (Step 2.8 / ADR-054, masterplan §2.8).
 *
 * Why challengeToken instead of IP:
 *   Industrial customers sit behind a single NAT egress IP — 50–500 employees
 *   on one IP. With an IP-keyed tier, the 6th legitimate user during a
 *   shift-change login wave would be blocked despite each user hitting
 *   verify/resend at most a handful of times. Keying on the challenge token
 *   (which is per-session) restores per-user fairness without weakening
 *   brute-force protection (that lives in `TwoFactorAuthService` via
 *   `record.attemptCount` per challenge + `2fa:fail-streak:{userId}` per user;
 *   masterplan §2.3 / DD-5 / DD-6).
 *
 * Fallback to IP when no cookie is present (e.g. malformed first request) is
 * the safe default — better an aggressive limit than no limit at all. The IP
 * fallback can never be exploited to lift the per-challenge cap because the
 * service-layer cap is independent of throttler keying.
 *
 * Per-tier `getTracker` is honored by `ThrottlerGuard.handleRequest` (it calls
 * `getTracker?.(req, context) ?? this.getTracker(...)`), so this overrides the
 * `CustomThrottlerGuard.getTracker` (user|ip default) only for the 2fa-verify
 * and 2fa-resend tiers. Other tiers continue to use the guard's user|ip key.
 */
function get2faTracker(req: Record<string, unknown>): string {
  const cookies = req['cookies'] as Record<string, string> | undefined;
  const token = cookies?.['challengeToken'];
  if (typeof token === 'string' && token !== '') {
    return `challenge:${token}`;
  }
  const ip = req['ip'];
  return typeof ip === 'string' && ip !== '' ? `ip:${ip}` : 'unknown';
}

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisHost = config.get<string>('REDIS_HOST', 'redis');

        const redisPort = config.get<number>('REDIS_PORT', 6379);
        const redisPassword = config.get<string>('REDIS_PASSWORD');

        const redisClient = new Redis({
          host: redisHost,
          port: redisPort,
          // SECURITY: Redis authentication - only include password if configured
          ...(redisPassword !== undefined && redisPassword !== '' && { password: redisPassword }),
          keyPrefix: 'throttle:',
          lazyConnect: true,
          maxRetriesPerRequest: 3,
          connectTimeout: 5000,
        });

        return {
          throttlers: [
            // Auth: 10 requests per 5 minutes (brute-force protection)
            { name: 'auth', ttl: 5 * MS_MINUTE, limit: 10 },
            // Public: 100 requests per 15 minutes
            { name: 'public', ttl: 15 * MS_MINUTE, limit: 100 },
            // User: 1000 requests per 15 minutes
            { name: 'user', ttl: 15 * MS_MINUTE, limit: 1000 },
            // Admin: 2000 requests per 15 minutes
            { name: 'admin', ttl: 15 * MS_MINUTE, limit: 2000 },
            // Upload: 20 requests per hour
            { name: 'upload', ttl: MS_HOUR, limit: 20 },
            // Export: 1 request per minute (audit log export)
            { name: 'export', ttl: MS_MINUTE, limit: 1 },
            // Domain-Verify: 10 requests per 10 minutes
            // Tight cap because `POST /domains/:id/verify` is the only endpoint
            // emitting outbound DNS. Protects upstream resolvers + defends R11
            // (Docker bridge DNS exhaustion). Masterplan §2.7, ADR-048.
            { name: 'domain-verify', ttl: 10 * MS_MINUTE, limit: 10 },
            // 2FA verify: 5 requests per 10 minutes per challenge token.
            // v0.5.0 P2-Fix (masterplan §2.8): tracker keyed on `challengeToken`
            // cookie instead of IP, so industrial customers behind one NAT egress
            // (50–500 users) cannot block each other during shift-change login
            // waves. Brute-force defence lives in service-layer
            // (`record.attemptCount`, `2fa:fail-streak:{userId}`); this tier is
            // anti-spam, not anti-brute-force.
            { name: '2fa-verify', ttl: 10 * MS_MINUTE, limit: 5, getTracker: get2faTracker },
            // 2FA resend: 1 request per 60 s per challenge token.
            // Same NAT-fairness rationale as 2fa-verify. The 60 s aligns with
            // the user-facing resend cooldown (DD-9, RESEND_COOLDOWN_SEC) so
            // the throttler and the service-layer cap converge on the same UX
            // ("wait 60 s") instead of producing two different 429 paths.
            { name: '2fa-resend', ttl: MS_MINUTE, limit: 1, getTracker: get2faTracker },
          ],
          storage: new ThrottlerStorageRedisService(redisClient),
          // Custom error message with retry info (v6.5.0+)
          errorMessage: (
            _context: ExecutionContext,
            throttlerLimitDetail: ThrottlerLimitDetail,
          ): string =>
            `Rate limit exceeded. Please wait ${Math.ceil(throttlerLimitDetail.timeToExpire / 1000)} seconds before retrying.`,
        };
      },
    }),
  ],
  exports: [ThrottlerModule],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class AppThrottlerModule {}
