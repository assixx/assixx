/**
 * Security Settings Controller
 *
 * HTTP endpoints:
 * - GET /security-settings/user-password-change-policy
 *     Returns `{ allowed: boolean }` for the caller's tenant.
 *     Auth-only — every authenticated user needs this flag because
 *     Frontend gates the password-change UI with it (admin-profile +
 *     employee-profile render the card conditionally).
 *
 * - PUT /security-settings/user-password-change-policy
 *     Root-only. Body `{ allowed: boolean }`. Upserts the flag and
 *     writes a root_logs audit entry.
 *
 * Both endpoints live under `/api/v2/security-settings/` (global `/api/v2`
 * prefix is applied in `main.ts`).
 *
 * @see ADR-045 — Layer-1 management gate for "Passwort selbst ändern".
 */
import { Body, Controller, Get, Headers, Ip, Put } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { JwtPayload } from '../common/interfaces/auth.interface.js';
import { UpdateUserPasswordChangePolicyDto } from './dto/update-user-password-change-policy.dto.js';
import { SecuritySettingsService } from './security-settings.service.js';

/** Response shape for the GET endpoint. Flat boolean keeps the contract KISS. */
interface PolicyResponse {
  allowed: boolean;
}

@Controller('security-settings')
export class SecuritySettingsController {
  constructor(private readonly securitySettings: SecuritySettingsService) {}

  /**
   * GET /security-settings/user-password-change-policy
   *
   * Open to every authenticated role because Frontend needs the flag on
   * every page-load to render/hide the password card. RLS + tenant-scope
   * via the `@TenantId()` decorator ensures users only see their own
   * tenant's value.
   */
  @Get('user-password-change-policy')
  async getUserPasswordChangePolicy(@TenantId() tenantId: number): Promise<PolicyResponse> {
    const allowed = await this.securitySettings.getUserPasswordChangePolicy(tenantId);
    return { allowed };
  }

  /**
   * PUT /security-settings/user-password-change-policy
   *
   * Root-only. Intentionally bypasses the generic settings endpoint to
   * enforce the "root-only" requirement without loosening
   * `@RequirePermission(settings, settings-tenant, canWrite)` for admins
   * on unrelated settings.
   */
  @Put('user-password-change-policy')
  @Roles('root')
  async setUserPasswordChangePolicy(
    @Body() dto: UpdateUserPasswordChangePolicyDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<PolicyResponse> {
    await this.securitySettings.setUserPasswordChangePolicy(
      tenantId,
      user.id,
      dto.allowed,
      ip,
      userAgent,
    );
    return { allowed: dto.allowed };
  }
}
