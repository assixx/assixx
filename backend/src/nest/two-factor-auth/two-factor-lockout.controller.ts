/**
 * Two-Factor Lockout Controller — Step 2.7 (FEAT_2FA_EMAIL_MASTERPLAN v0.6.0).
 *
 * Houses the single root-only endpoint for clearing a 15-min lockout
 * (DD-5 / DD-6) on a user who burned through MAX_ATTEMPTS wrong codes:
 *
 *   - `POST /api/v2/users/:id/2fa/clear-lockout`
 *
 * Why a separate file from `two-factor-auth.controller.ts`:
 *   - Different URL prefix (`users/:id/2fa/...` vs `auth/2fa/...`).
 *   - The project enforces `max-classes-per-file: 1` (eslint.config.mjs).
 *   - Keeps the public-facing 2FA verify/resend cookie machinery cleanly
 *     separated from the admin tooling that operates on other users.
 *
 * NOT a 2FA bypass (DD-8):
 *   This endpoint clears ONLY the lockout state (Redis `2fa:lock:{userId}`
 *   key + `2fa:fail-streak:{userId}` counter). The user MUST still pass a
 *   fresh 2FA challenge on their next login attempt. The "no in-app recovery"
 *   policy stays intact — lost-mailbox is a corporate-IT problem.
 *
 * Two-Root rule (enforced in `TwoFactorAuthService.clearLockoutForUser`):
 *   The caller (current root) and the target user MUST be different. A root
 *   cannot clear their own lockout — that would defeat the rate-limit. This
 *   is the in-tenant analogue of the "second root required" pattern surfaced
 *   in the masterplan's HOW-TO-2FA-RECOVERY (Phase 6 deliverable).
 *
 * Tenant-membership check:
 *   The lockout key in Redis is keyed by `userId` only (not tenant), so
 *   without a controller-side check, root@A could clear the lockout for
 *   user@B. We pre-verify the target row exists in the caller's tenant
 *   (RLS-protected `queryAsTenant`) — non-existent target → 404 (no
 *   "user exists in another tenant" leak).
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 2 §2.7, DD-5 / DD-6 / DD-8)
 * @see docs/infrastructure/adr/ADR-010-user-role-assignment-permissions.md
 * @see docs/infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md
 */
import {
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AdminThrottle } from '../common/decorators/throttle.decorators.js';
import { CustomThrottlerGuard } from '../common/guards/throttler.guard.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { DatabaseService } from '../database/database.service.js';
import { ClearLockoutParamDto } from './dto/index.js';
import { TwoFactorAuthService } from './two-factor-auth.service.js';

/** Narrow projection used by the tenant-membership pre-check. */
interface UserExistenceRow {
  id: number;
}

@Controller('users')
export class TwoFactorLockoutController {
  constructor(
    private readonly twoFactorAuth: TwoFactorAuthService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * `POST /api/v2/users/:id/2fa/clear-lockout` — root-only lockout reset.
   *
   * Returns HTTP 204 on success (no body). Errors:
   *   - 401 → caller has no JWT (`JwtAuthGuard` rejects).
   *   - 403 → caller is not root (`RolesGuard`) OR caller === target
   *           (`TwoFactorAuthService.clearLockoutForUser` two-root check).
   *   - 404 → target user does not exist in caller's tenant (this method's
   *           pre-check; protects against cross-tenant cleared-lockouts).
   */
  @Post(':id/2fa/clear-lockout')
  @Roles('root')
  @UseGuards(CustomThrottlerGuard)
  @AdminThrottle()
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearLockout(
    @Param() params: ClearLockoutParamDto,
    @CurrentUser() user: NestAuthUser,
  ): Promise<void> {
    const targetUserId = params.id;
    const tenantId = user.tenantId;

    // Tenant-membership pre-check — the lockout key in Redis is global
    // (userId-only), so without this check root@A could clear lockouts in
    // tenant B. queryAsTenant goes through RLS → cross-tenant rows are
    // invisible regardless of what id was passed.
    const rows = await this.db.queryAsTenant<UserExistenceRow>(
      'SELECT id FROM users WHERE id = $1 AND tenant_id = $2 LIMIT 1',
      [targetUserId, tenantId],
      tenantId,
    );
    if (rows.length === 0) {
      throw new NotFoundException({
        code: 'TWO_FA_LOCKOUT_TARGET_NOT_FOUND',
        message: 'User not found.',
      });
    }

    // Service enforces the two-root rule (target !== caller) and emits the
    // (delete, 2fa-lockout) audit row per §A8.
    await this.twoFactorAuth.clearLockoutForUser(targetUserId, user.id, tenantId);
  }
}
