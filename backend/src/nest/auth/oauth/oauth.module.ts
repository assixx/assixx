/**
 * OAuth Module — sub-module under `auth/`.
 *
 * V1 wires a dedicated ioredis client (mirroring `throttler.module.ts`) for single-use
 * state + signup-ticket storage. Controllers and services arrive in subsequent steps
 * (2.2 OAuthStateService, 2.3 MicrosoftProvider, 2.4 OAuthAccountRepository,
 * 2.5 OAuthService, 2.6 OAuthController, 2.7 SignupService hook).
 *
 * Why own Redis client (not `@nestjs/cache-manager`):
 *   The project does not use cache-manager — the throttler module uses raw ioredis.
 *   Staying consistent with the existing pattern keeps the dependency surface small
 *   and the keyspace (`oauth:` prefix) clearly separated from other Redis users.
 *
 * Spec deviation from plan §2.1 (auth.module.ts checklist line "imports SignupModule"):
 *   SignupModule is imported by THIS module (not AuthModule) — and only when Step 2.7
 *   adds `OAuthService` which actually injects `SignupService`. Importing it now (with
 *   no consumer) would be cargo-cult NestJS wiring.
 *
 * @see docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md (Phase 2)
 */
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import { SignupModule } from '../../signup/signup.module.js';
// eslint-disable-next-line import-x/no-cycle -- justified: canonical NestJS forwardRef pattern (Spec Deviation D15)
import { AuthModule } from '../auth.module.js';
import { OAuthAccountRepository } from './oauth-account.repository.js';
import { OAuthStateService } from './oauth-state.service.js';
import { OAuthController } from './oauth.controller.js';
import { OAuthService } from './oauth.service.js';
// Tokens live in their own leaf file to avoid a service<->module import cycle.
import { OAUTH_REDIS_CLIENT } from './oauth.tokens.js';
// Profile-photo sync (FEAT_OAUTH_PROFILE_PHOTO) — registered but not yet wired
// into OAuthService; Step 2.5 of the masterplan adds the consumer calls.
import { ProfilePhotoService } from './profile-photo.service.js';
import { MicrosoftProvider } from './providers/microsoft.provider.js';

// Re-export tokens so existing import paths (`from './oauth.module.js'`) keep working
// for any future consumer that prefers the module-scoped reference.
export { OAUTH_REDIS_CLIENT } from './oauth.tokens.js';

@Module({
  // SignupModule imported so OAuthService can inject SignupService for the
  // completeSignup -> registerTenantWithOAuth handoff (plan §2.7).
  // forwardRef(AuthModule): OAuthController injects AuthService for
  // loginWithVerifiedUser; AuthModule also imports OAuthModule → circular.
  // Resolved per NestJS canonical pattern (Spec Deviation D15).
  imports: [ConfigModule, SignupModule, forwardRef(() => AuthModule)],
  controllers: [OAuthController],
  providers: [
    {
      provide: OAUTH_REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const host = config.get<string>('REDIS_HOST', 'redis');
        const port = config.get<number>('REDIS_PORT', 6379);
        const password = config.get<string>('REDIS_PASSWORD');

        return new Redis({
          host,
          port,
          // SECURITY: only attach password if actually configured (mirrors throttler pattern).
          ...(password !== undefined && password !== '' && { password }),
          keyPrefix: 'oauth:',
          lazyConnect: true,
          maxRetriesPerRequest: 3,
          connectTimeout: 5000,
        });
      },
    },
    OAuthStateService,
    MicrosoftProvider,
    OAuthAccountRepository,
    ProfilePhotoService,
    OAuthService,
  ],
  exports: [
    OAUTH_REDIS_CLIENT,
    OAuthStateService,
    MicrosoftProvider,
    OAuthAccountRepository,
    ProfilePhotoService,
    OAuthService,
  ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class OAuthModule {}
