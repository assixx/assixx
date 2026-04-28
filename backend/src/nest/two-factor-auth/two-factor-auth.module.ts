/**
 * TwoFactorAuthModule — Mandatory email-based 2FA for password authentication.
 *
 * STATUS: SKELETON (Phase 2 Step 2.1).
 *   - Step 2.2 wires the dedicated Redis client + `TwoFactorCodeService`
 *     (crypto/Redis primitives).
 *   - Step 2.3 wires `TwoFactorAuthService` (orchestration: issue/verify/
 *     resend/clearLockout).
 *   - Step 2.7 registers `TwoFactorAuthController` with the three endpoints
 *     (`/2fa/verify`, `/2fa/resend`, `/users/:id/2fa/clear-lockout`).
 *
 * Empty arrays are intentional placeholders — the module is registered in
 * `AppModule.imports` early so subsequent steps can layer providers/
 * controllers without a separate registration commit.
 *
 * References:
 *   - Masterplan: docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 2)
 *   - ADR-054 (drafted in Phase 6): Mandatory Email-Based 2FA.
 */
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module skeleton; controllers/providers added in Step 2.2/2.3/2.7 (see masterplan).
export class TwoFactorAuthModule {}
