/**
 * Tenants Module — public branding endpoint backing the subdomain login flow.
 *
 * Provides:
 *   1. A dedicated ioredis client with `keyPrefix: 'tenants-branding:'` —
 *      mirrors the `TenantHostResolverModule` pattern (one Redis use-case
 *      = one keyspace = one audit surface). Separate from the host-resolver
 *      cache so the 5-minute branding TTL doesn't collide with the 60-second
 *      slug→id TTL.
 *   2. `TenantsService` — cache-through branding lookup.
 *   3. `TenantsController` — public `GET /api/v2/tenants/branding/:slug`.
 *
 * `DatabaseService` is injected from the `@Global()` `DatabaseModule` — no
 * explicit import needed here.
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §Decision
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 5 Step 5.3
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import { TenantsController } from './tenants.controller.js';
import { TenantsService } from './tenants.service.js';
import { TENANTS_BRANDING_REDIS_CLIENT } from './tenants.tokens.js';

@Module({
  // ConfigModule is global (isGlobal: true in AppModule), imported explicitly
  // here so the useFactory's `inject: [ConfigService]` is self-documenting —
  // matches the OAuth + throttler + host-resolver convention.
  imports: [ConfigModule],
  controllers: [TenantsController],
  providers: [
    {
      provide: TENANTS_BRANDING_REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const host = config.get<string>('REDIS_HOST', 'redis');
        const port = config.get<number>('REDIS_PORT', 6379);
        const password = config.get<string>('REDIS_PASSWORD');

        return new Redis({
          host,
          port,
          // SECURITY: only attach password when actually configured (mirrors
          // throttler + oauth + host-resolver). An empty password would cause
          // the connection to send `AUTH ""` which modern Redis rejects.
          ...(password !== undefined && password !== '' && { password }),
          keyPrefix: 'tenants-branding:',
          lazyConnect: true,
          maxRetriesPerRequest: 3,
          connectTimeout: 5000,
        });
      },
    },
    TenantsService,
  ],
  exports: [TenantsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class TenantsModule {}
