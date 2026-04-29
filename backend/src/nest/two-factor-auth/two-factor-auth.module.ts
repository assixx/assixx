/**
 * TwoFactorAuthModule — Mandatory email-based 2FA for password authentication.
 *
 * STATUS (after Step 2.3):
 *   - Step 2.1 shipped: types, constants, DTOs, module skeleton.
 *   - Step 2.2 shipped: dedicated ioredis client + `TwoFactorCodeService`
 *     (crypto/Redis primitives).
 *   - Step 2.3 (this commit): registers `TwoFactorAuthService` (orchestration —
 *     issue / verify / resend / clearLockout) plus its dependencies
 *     (`MailerService` for SMTP transport — DD-14 fail-loud).
 *   - Step 2.7 (later): registers `TwoFactorAuthController` with the
 *     three endpoints (`/2fa/verify`, `/2fa/resend`,
 *     `/users/:id/2fa/clear-lockout`).
 *
 * Why a dedicated ioredis client (not `@nestjs/cache-manager`):
 *   The project doesn't use cache-manager — the throttler module
 *   (`throttler.module.ts:28`) and OAuth module (`oauth.module.ts:63`) both
 *   use raw ioredis. Staying consistent with the existing pattern keeps the
 *   dependency surface small and the keyspace (`2fa:` prefix) clearly
 *   separated from other Redis users.
 *
 * Why `MailerService` is provider-local:
 *   `MailerService` is not exported from a shared MailerModule — every
 *   consuming module declares it as a local provider (see
 *   `auth.module.ts:31`, `feedback.module.ts:21`). This keeps the SMTP
 *   transport surface scoped to where it's actually used. `DatabaseService`
 *   is `@Global()` (`database.module.ts`), so no import needed.
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 2 §2.2 + §2.3)
 * @see ADR-054 (drafted in Phase 6): Mandatory Email-Based 2FA.
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import { MailerService } from '../common/services/mailer.service.js';
import { TwoFactorAuthService } from './two-factor-auth.service.js';
import { TWO_FA_REDIS } from './two-factor-auth.tokens.js';
import { TwoFactorCodeService } from './two-factor-code.service.js';

// Re-export so future consumers can `import { TWO_FA_REDIS } from
// './two-factor-auth.module.js'` if they prefer the module-scoped reference
// (mirrors the OAuth module pattern).
export { TWO_FA_REDIS } from './two-factor-auth.tokens.js';

@Module({
  imports: [ConfigModule],
  controllers: [],
  providers: [
    {
      provide: TWO_FA_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const host = config.get<string>('REDIS_HOST', 'redis');
        const port = config.get<number>('REDIS_PORT', 6379);
        const password = config.get<string>('REDIS_PASSWORD');
        return new Redis({
          host,
          port,
          // SECURITY: only attach password if actually configured
          // (mirrors throttler.module.ts:32 + oauth.module.ts:67).
          ...(password !== undefined && password !== '' && { password }),
          keyPrefix: '2fa:',
          lazyConnect: true,
          maxRetriesPerRequest: 3,
          connectTimeout: 5000,
        });
      },
    },
    TwoFactorCodeService,
    TwoFactorAuthService,
    MailerService,
  ],
  // Export TwoFactorAuthService so AuthModule (login) and SignupModule
  // (signup) can call issueChallenge() in Step 2.4 + 2.5 without re-wiring
  // the underlying primitives.
  exports: [TWO_FA_REDIS, TwoFactorCodeService, TwoFactorAuthService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design (matches oauth.module.ts:92)
export class TwoFactorAuthModule {}
