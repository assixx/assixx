/**
 * E2E Key Escrow Module
 *
 * Provides zero-knowledge encrypted private key backup endpoints.
 * The server stores only encrypted blobs — it cannot decrypt them.
 *
 * Also provides the cross-origin unlock-ticket transport (ADR-050 × ADR-022):
 * a short-lived Redis-backed, single-use ticket carrying the client-derived
 * wrappingKey from apex-login to subdomain-handoff. Mirrors the ioredis wiring
 * in `auth/oauth/oauth.module.ts` with its own `escrow:` keyspace.
 *
 * @see ADR-022 (E2E Key Escrow)
 * @see ADR-050 (Tenant Subdomain Routing — cross-origin handoff)
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import { E2eEscrowController } from './e2e-escrow.controller.js';
import { E2eEscrowService } from './e2e-escrow.service.js';
// Tokens live in their own leaf file to avoid service<->module import cycles
// (same pattern as oauth.tokens.ts).
import { ESCROW_REDIS_CLIENT } from './e2e-escrow.tokens.js';
import { EscrowUnlockTicketService } from './escrow-unlock-ticket.service.js';

// Re-export tokens so consumers can import `from './e2e-escrow.module.js'`
// if they prefer the module-scoped reference.
export { ESCROW_REDIS_CLIENT } from './e2e-escrow.tokens.js';

@Module({
  imports: [ConfigModule],
  controllers: [E2eEscrowController],
  providers: [
    {
      provide: ESCROW_REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const host = config.get<string>('REDIS_HOST', 'redis');
        const port = config.get<number>('REDIS_PORT', 6379);
        const password = config.get<string>('REDIS_PASSWORD');

        return new Redis({
          host,
          port,
          // SECURITY: only attach password if actually configured (mirrors
          // throttler.module.ts + oauth.module.ts).
          ...(password !== undefined && password !== '' && { password }),
          keyPrefix: 'escrow:',
          lazyConnect: true,
          maxRetriesPerRequest: 3,
          connectTimeout: 5000,
        });
      },
    },
    E2eEscrowService,
    EscrowUnlockTicketService,
  ],
  exports: [E2eEscrowService, EscrowUnlockTicketService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class E2eEscrowModule {}
