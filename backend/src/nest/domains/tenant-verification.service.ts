/**
 * Tenant Verification Service — the KISS gate (§0.2.5 #1).
 *
 * Single entry point `assertVerified(tenantId)` called at the top of every
 * user-creation service method in Step 2.9 (UsersService, AuthService,
 * RootService, RootAdminService, DummyUsersService). Throws
 * `ForbiddenException({ code: 'TENANT_NOT_VERIFIED' })` if no `tenant_domains`
 * row with `status='verified' AND is_active=${IS_ACTIVE.ACTIVE}` exists for
 * the tenant.
 *
 * MUST use `db.queryAsTenant(sql, params, tenantId)` — NOT `db.query()` —
 * because RLS-strict mode returns zero rows without a tenant context set
 * (fourth-pass regression caught in v0.3.2 D16 before it could ship). The
 * arch-test in Step 2.11 locks this invariant via a spy-based unit test.
 *
 * @see docs/infrastructure/adr/ADR-049-tenant-domain-verification.md (Layer 2: Domain-Verification Gate, KISS, single helper)
 *
 * @see docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §2.6
 * @see docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §0.2.5 #1
 * @see docs/infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md §6b (queryAsTenant)
 * @see docs/TYPESCRIPT-STANDARDS.md §7.4 (IS_ACTIVE constants, no magic numbers)
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { ForbiddenException, Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class TenantVerificationService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Returns true iff the tenant has at least one `tenant_domains` row with
   * `status='verified' AND is_active=${IS_ACTIVE.ACTIVE}`. Pure read, no
   * side effects; safe to call from any context that has a known `tenantId`
   * (HTTP handler via CLS, WebSocket, worker, background job).
   */
  async isVerified(tenantId: number): Promise<boolean> {
    // WHY queryAsTenant, not query (ADR-019 §6b + database.service.ts:142):
    //   - `db.query()` uses `app_user` pool WITHOUT calling `set_config('app.tenant_id', ...)`.
    //     Under RLS-strict mode every `tenant_domains` SELECT without that GUC returns 0 rows
    //     (`NULLIF('', '')::integer` → NULL, `tenant_id = NULL` never matches).
    //     → `isVerified()` would ALWAYS return false → `assertVerified()` would 403 EVERY
    //       user-creation attempt, deadlocking the whole feature.
    //   - `db.queryAsTenant(sql, params, tenantId)` runs the SELECT inside a transaction
    //     that injects the passed-in tenantId into the RLS context. Works both inside
    //     authenticated HTTP requests (where CLS also carries tenantId) AND from WebSocket
    //     / worker / background-job paths where CLS may be empty — the helper takes the
    //     tenantId as an explicit parameter, so the call site is the single source of truth.
    //   - The explicit `WHERE tenant_id = $1` is defence-in-depth with the same value RLS
    //     uses, so a typo or a mismatched parameter would surface as 0 rows (fail-closed)
    //     rather than leak cross-tenant data.
    //   - `is_active = ${IS_ACTIVE.ACTIVE}` uses the shared constant per TYPESCRIPT-STANDARDS
    //     §7.4 — hardcoded `is_active = 1` is blocked by the arch-test regex in
    //     `shared/src/architectural.test.ts`. `IS_ACTIVE.ACTIVE` is a compile-time literal
    //     from `@assixx/shared/constants`, not user input, so template-literal interpolation
    //     is SQL-injection-safe.
    const rows = await this.db.queryAsTenant<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM tenant_domains
         WHERE tenant_id = $1 AND status = 'verified' AND is_active = ${IS_ACTIVE.ACTIVE}
       ) AS exists`,
      [tenantId],
      tenantId,
    );
    return rows[0]?.exists === true;
  }

  /**
   * Throws `ForbiddenException({ code: 'TENANT_NOT_VERIFIED' })` if no
   * verified domain exists for the tenant. Call at the top of every
   * user-creation service method (Step 2.9). The German message points the
   * root user at `/settings/company-profile/domains` where the DNS-TXT
   * verification dance can be completed (Phase 5).
   */
  async assertVerified(tenantId: number): Promise<void> {
    if (!(await this.isVerified(tenantId))) {
      throw new ForbiddenException({
        code: 'TENANT_NOT_VERIFIED',
        message: `Dein Tenant hat noch keine verifizierte Domain. Bitte verifiziere zuerst Deine Firmen-Domain unter /settings/company-profile/domains.`,
      });
    }
  }
}
