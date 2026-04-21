/**
 * Tenant Host Resolver Module
 *
 * Provides:
 *   1. A dedicated ioredis client with `keyPrefix: 'tenant:'` — mirrors the
 *      OAuth + throttler pattern (one Redis use-case = one keyspace = one
 *      audit surface).
 *   2. The `TenantHostResolverMiddleware` itself as an injectable provider.
 *
 * This module is imported by `AppModule`, which then mounts the middleware
 * globally via `MiddlewareConsumer.apply(TenantHostResolverMiddleware)
 * .forRoutes('*')` inside a `configure()` hook. NestJS does NOT auto-apply
 * class-based middleware from providers — the explicit consumer.apply() is
 * mandatory.
 *
 * `DatabaseService` is injected into the middleware and comes from the
 * `@Global()` `DatabaseModule` — no explicit import needed here.
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §Decision
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 2 Step 2.2
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import { TenantHostResolverMiddleware } from './tenant-host-resolver.middleware.js';
import { TENANT_HOST_REDIS_CLIENT } from './tenant-host-resolver.tokens.js';

@Module({
  // ConfigModule is global (`isGlobal: true` in AppModule), but we import it
  // explicitly here so the useFactory's `inject: [ConfigService]` is
  // self-documenting — matches the OAuth + throttler convention.
  imports: [ConfigModule],
  providers: [
    {
      provide: TENANT_HOST_REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const host = config.get<string>('REDIS_HOST', 'redis');
        const port = config.get<number>('REDIS_PORT', 6379);
        const password = config.get<string>('REDIS_PASSWORD');

        return new Redis({
          host,
          port,
          // SECURITY: only attach password when actually configured — mirrors
          // throttler + oauth patterns. An empty password would cause the
          // connection to send `AUTH ""` which modern Redis rejects.
          ...(password !== undefined && password !== '' && { password }),
          keyPrefix: 'tenant:',
          lazyConnect: true,
          maxRetriesPerRequest: 3,
          connectTimeout: 5000,
        });
      },
    },
    TenantHostResolverMiddleware,
  ],
  // Both must be exported: the middleware class itself (so AppModule can
  // reference it in `MiddlewareConsumer.apply()`) AND the Redis token it
  // depends on. NestJS re-resolves the middleware's constructor dependencies
  // in the HOST MODULE of the `.apply()` call (= AppModule), not in this
  // module's container — so the token needs to cross the module boundary
  // explicitly or NestJS throws UnknownDependenciesException at bootstrap.
  exports: [TENANT_HOST_REDIS_CLIENT, TenantHostResolverMiddleware],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class TenantHostResolverModule {}
