/**
 * TwoFactorAuthModule — Mandatory email-based 2FA for password authentication.
 *
 * STATUS (after Step 2.7):
 *   - Step 2.1 shipped: types, constants, DTOs, module skeleton.
 *   - Step 2.2 shipped: dedicated ioredis client + `TwoFactorCodeService`
 *     (crypto/Redis primitives).
 *   - Step 2.3 shipped: `TwoFactorAuthService` (orchestration —
 *     issue / verify / resend / clearLockout) plus its dependencies
 *     (`MailerService` for SMTP transport — DD-14 fail-loud).
 *   - Step 2.7 shipped: registers BOTH 2FA controllers
 *     (`TwoFactorAuthController` for `/auth/2fa/*` verify+resend,
 *     `TwoFactorLockoutController` for `/users/:id/2fa/clear-lockout`)
 *     and adds `TwoFactorAuthService.markVerified` for the post-verify
 *     user-table state write.
 *   - Step 2.11 (this commit): registers `TwoFactorReaperService`
 *     (`@Cron('0 *\/15 * * * *')` stale-pending sweep). No new module
 *     imports — `ScheduleModule.forRoot()` is global in `app.module.ts`,
 *     `DatabaseService` is `@Global()`. Cron only fires in main backend
 *     (`AppModule`); the deletion-worker container loads
 *     `DeletionWorkerModule`, so single-fire is guaranteed on V1.
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
 * Why `forwardRef(() => AuthModule)` (Step 2.7):
 *   The verify endpoint delegates token issuance to
 *   `AuthService.loginWithVerifiedUser` and the apex→subdomain handoff to
 *   `OAuthHandoffService` (re-exported transitively via AuthModule's
 *   `forwardRef(() => OAuthModule)`). AuthModule already imports
 *   TwoFactorAuthModule (for `TwoFactorAuthService.issueChallenge` in
 *   `AuthService.login` — Step 2.4); both edges now require `forwardRef`
 *   to break the cycle. This mirrors the canonical AuthModule ↔ OAuthModule
 *   resolution (auth.module.ts:36 — also `forwardRef`-paired).
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 2 §2.2, §2.3, §2.7, §2.8)
 * @see ADR-054 (drafted in Phase 6): Mandatory Email-Based 2FA.
 */
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

// eslint-disable-next-line import-x/no-cycle -- justified: canonical NestJS forwardRef pattern (Step 2.7); mirrors AuthModule ↔ OAuthModule.
import { AuthModule } from '../auth/auth.module.js';
// OAuthModule for `OAuthHandoffService` consumed by `TwoFactorAuthController.verify`
// on the signup branch (apex → subdomain handoff per ADR-050). The indirect
// cycle TwoFactorAuthModule → OAuthModule → SignupModule → forwardRef(TwoFactorAuthModule)
// is broken at the last edge by `signup.module.ts`'s `forwardRef` wrapper
// (Step 2.7). DD-7 keeps OAuth itself off the 2FA path; this edge is purely
// for the handoff primitive reuse.
// eslint-disable-next-line import-x/no-cycle -- justified: canonical NestJS forwardRef pattern (Step 2.7); cycle broken by signup.module.ts forwardRef.
import { OAuthModule } from '../auth/oauth/oauth.module.js';
import { MailerService } from '../common/services/mailer.service.js';
import { TwoFactorReaperService } from './two-factor-auth-reaper.service.js';
import { TwoFactorAuthController } from './two-factor-auth.controller.js';
import { TwoFactorAuthService } from './two-factor-auth.service.js';
import { TWO_FA_REDIS } from './two-factor-auth.tokens.js';
import { TwoFactorCodeService } from './two-factor-code.service.js';
import { TwoFactorLockoutController } from './two-factor-lockout.controller.js';

// Re-export so future consumers can `import { TWO_FA_REDIS } from
// './two-factor-auth.module.js'` if they prefer the module-scoped reference
// (mirrors the OAuth module pattern).
export { TWO_FA_REDIS } from './two-factor-auth.tokens.js';

@Module({
  imports: [ConfigModule, forwardRef(() => AuthModule), OAuthModule],
  controllers: [TwoFactorAuthController, TwoFactorLockoutController],
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
    // Step 2.11: stale-pending reaper. @Cron decorator is auto-discovered
    // by `ScheduleModule.forRoot()` (global, registered in app.module.ts).
    // No exports — the cron is internal to this module; nothing else calls
    // `reap()` directly outside of unit/integration tests.
    TwoFactorReaperService,
    MailerService,
  ],
  // Export TwoFactorAuthService so AuthModule (login) and SignupModule
  // (signup) can call issueChallenge() in Step 2.4 + 2.5 without re-wiring
  // the underlying primitives.
  exports: [TWO_FA_REDIS, TwoFactorCodeService, TwoFactorAuthService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design (matches oauth.module.ts:92)
export class TwoFactorAuthModule {}
