/**
 * Throttler Module - Rate Limiting for NestJS
 *
 * Provides multi-tier rate limiting with Redis storage for distributed deployments.
 * Tiers: auth (5/15min), public (100/15min), user (1000/15min), admin (2000/15min), upload (20/hour)
 */
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { type ExecutionContext, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { type ThrottlerLimitDetail, ThrottlerModule } from '@nestjs/throttler';
import { Redis } from 'ioredis';

/** Time constants in milliseconds */
const MS_MINUTE = 60_000;
const MS_HOUR = 3_600_000;

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
            // Auth: 5 requests per 15 minutes (brute-force protection)
            { name: 'auth', ttl: 15 * MS_MINUTE, limit: 5 },
            // Public: 100 requests per 15 minutes
            { name: 'public', ttl: 15 * MS_MINUTE, limit: 100 },
            // User: 1000 requests per 15 minutes
            { name: 'user', ttl: 15 * MS_MINUTE, limit: 1000 },
            // Admin: 2000 requests per 15 minutes
            { name: 'admin', ttl: 15 * MS_MINUTE, limit: 2000 },
            // Upload: 20 requests per hour
            { name: 'upload', ttl: MS_HOUR, limit: 20 },
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
