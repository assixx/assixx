/**
 * Domains Service — CRUD for `tenant_domains` (plan §2.5).
 *
 * Five public methods, all wrapped in `db.tenantTransaction()` per ADR-019 so
 * every SQL statement runs inside an RLS context (`set_config('app.tenant_id',
 * …)`). The explicit `WHERE tenant_id = $N` in every query is defence-in-depth
 * with the RLS policy — they use the same value, so a mismatch fails closed
 * (0 rows) rather than leaking cross-tenant data.
 *
 * Two partial UNIQUE indexes in the schema are the real arbiters of
 * uniqueness — the service lets the DB decide and catches `23505` to return
 * user-friendly 409s:
 *
 *   - `tenant_domains_tenant_domain_unique (tenant_id, domain) WHERE is_active=1`
 *     — fires on `addDomain()` INSERT when the same tenant already has this
 *     domain ACTIVE (soft-deleted rows are excluded from the index predicate,
 *     so re-add after `DELETE /domains/:id` works). Mapped to
 *     `ConflictException({ code: 'DOMAIN_ALREADY_ADDED' })`. Shipped as a
 *     plain UNIQUE CONSTRAINT in migration `20260417223358319_create-tenant-
 *     domains.ts`; promoted to partial UNIQUE INDEX in
 *     `20260419002936537_partial-tenant-domain-uniqueness.ts` (2026-04-19)
 *     to match the soft-delete semantics of the sibling indexes — live
 *     smoke-test uncovered that the §3 D22 soft-delete-round-trip unit test
 *     only passed because the mock bypassed PostgreSQL's constraint check.
 *   - `idx_tenant_domains_domain_verified (domain) WHERE status='verified' AND
 *     is_active=1` — fires on `triggerVerify()` UPDATE when another tenant has
 *     already verified this domain (v0.3.2 D17: promoted from plain INDEX to
 *     UNIQUE INDEX so race-concurrent verify-flips can't both win). Mapped to
 *     `ConflictException({ code: 'DOMAIN_ALREADY_CLAIMED' })`.
 *
 * Cross-tenant pre-check (2026-04-20 post-v1 hardening, "Option A"):
 * `addDomain()` runs a `systemQuery` (BYPASSRLS — tenantTransaction's RLS
 * context would hide the conflicting row) BEFORE the INSERT, checking whether
 * ANY other tenant has this domain in `status='verified'` + `is_active=1`.
 * If so, surface `DOMAIN_ALREADY_CLAIMED` immediately instead of letting the
 * user add a pending row that can never verify (DNS ownership is elsewhere).
 * The `idx_tenant_domains_domain_verified` race-safety-net inside
 * `flipToVerified()` STAYS — it covers the narrow window between pre-check
 * and another tenant's verify landing during this INSERT. Pending-pending
 * coexistence across tenants remains allowed (no squatting-DoS vector).
 *
 * @see docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §2.5
 * @see docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §0.2.5 #4 (freemail at add),
 *      §0.2.5 #10 (verificationInstructions only on add-response).
 * @see docs/infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md §6b (tenantTransaction).
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseError, type PoolClient } from 'pg';

import { DatabaseService } from '../database/database.service.js';
import { DomainVerificationService } from './domain-verification.service.js';
import type { TenantDomain, TenantDomainRow } from './domains.types.js';
import { type EmailValidationFailure, validateBusinessDomain } from './email-validator.js';

// PostgreSQL SQLSTATE for unique_violation. Checked against `err.code` on the
// `pg` library's `DatabaseError` subclass — together with `err.constraint` for
// which index fired (per-tenant-domain vs global-verified).
const PG_UNIQUE_VIOLATION = '23505';

// Exact DB constraint / index names from the migration. Must stay in sync with
// `database/migrations/20260417223358319_create-tenant-domains.ts` — a future
// rename there requires editing these two constants (and the matching test).
const CONSTRAINT_PER_TENANT_DOMAIN = 'tenant_domains_tenant_domain_unique';
const CONSTRAINT_VERIFIED_GLOBAL = 'idx_tenant_domains_domain_verified';

@Injectable()
export class DomainsService {
  private readonly logger = new Logger(DomainsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly domainVerification: DomainVerificationService,
  ) {}

  async listForTenant(tenantId: number): Promise<TenantDomain[]> {
    const rows = await this.db.tenantTransaction(async (client: PoolClient) => {
      const result = await client.query<TenantDomainRow>(
        `SELECT * FROM tenant_domains
         WHERE tenant_id = $1 AND is_active = ${IS_ACTIVE.ACTIVE}
         ORDER BY is_primary DESC, created_at ASC`,
        [tenantId],
      );
      return result.rows;
    });
    return rows.map((row: TenantDomainRow) => this.mapToResponse(row));
  }

  async addDomain(tenantId: number, domain: string): Promise<TenantDomain> {
    // Normalize first so both the validator and the INSERT see identical input
    // (the validator does its own `.trim().toLowerCase()` — cheap double work
    // kept for call-site clarity).
    const normalized = domain.trim().toLowerCase();
    const validation = validateBusinessDomain(normalized);
    if (!validation.valid) {
      // `failure` is present whenever `valid === false` (validator contract),
      // but the type stays optional per `EmailValidationResult`; fall back to
      // INVALID_FORMAT so the switch is total without an unreachable default.
      this.throwForValidationFailure(validation.failure ?? 'INVALID_FORMAT');
    }
    // Cross-tenant pre-check (post-v1 "Option A" hardening, 2026-04-20): block
    // the INSERT if ANY other tenant already has this domain verified.
    // Without this, Tenant B could add a pending row for Tenant A's verified
    // domain — the row can never verify (Tenant B doesn't control the DNS)
    // but sits around in the UI being confusing. The existing
    // `idx_tenant_domains_domain_verified` partial UNIQUE INDEX (§ADR-049
    // "Database Schema") stays as the race-safety-net at verify-time — this
    // pre-check is a UX-layer earlier-surfacing, not a replacement.
    await this.assertNoCrossTenantVerifiedClaim(tenantId, normalized);
    const token = this.domainVerification.generateToken();

    const row = await this.db.tenantTransaction(async (client: PoolClient) => {
      try {
        const result = await client.query<TenantDomainRow>(
          `INSERT INTO tenant_domains
             (tenant_id, domain, status, verification_token, is_primary)
           VALUES ($1, $2, 'pending', $3, false)
           RETURNING *`,
          [tenantId, normalized, token],
        );
        const first = result.rows[0];
        if (first === undefined) {
          throw new Error('INSERT RETURNING produced no row');
        }
        return first;
      } catch (err: unknown) {
        if (this.isUniqueViolation(err, CONSTRAINT_PER_TENANT_DOMAIN)) {
          throw new ConflictException({
            code: 'DOMAIN_ALREADY_ADDED',
            message: 'Diese Domain ist bereits für Deinen Tenant angelegt.',
          });
        }
        throw err;
      }
    });

    // Surface TXT instructions ONLY on the immediate add response (§0.2.5 #10).
    // Subsequent list/verify/patch responses never include them — the token is
    // persistent on the row and never re-exposed through the API.
    return this.mapToResponse(row, {
      txtHost: this.domainVerification.txtHostFor(row.domain),
      txtValue: this.domainVerification.txtValueFor(row.verification_token),
    });
  }

  async triggerVerify(tenantId: number, domainId: string): Promise<TenantDomain> {
    return await this.db.tenantTransaction(async (client: PoolClient) => {
      const row = await this.findOneActive(client, tenantId, domainId);
      // Idempotent on already-verified rows — do NOT re-run DNS (avoids a
      // spurious 23505 race if another tenant's verify landed in between).
      if (row.status === 'verified') {
        return this.mapToResponse(row);
      }
      const matched = await this.domainVerification.verify(row);
      if (!matched) {
        // Status stays 'pending' (plan §2.5 — V1 does not flip to 'failed').
        // Frontend polls the same row; user can retry after fixing DNS.
        return this.mapToResponse(row);
      }
      return await this.flipToVerified(client, row);
    });
  }

  async removeDomain(tenantId: number, domainId: string): Promise<void> {
    // Soft-delete (§0.2.5 — is_active = DELETED, row stays for audit trail).
    // Losing the last verified domain re-locks user-creation via assertVerified();
    // existing users stay operational (v0.3.4 D27 graceful-degradation rule).
    const affected = await this.db.tenantTransaction(async (client: PoolClient) => {
      const r = await client.query(
        `UPDATE tenant_domains
           SET is_active = ${IS_ACTIVE.DELETED}, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
        [domainId, tenantId],
      );
      return r.rowCount ?? 0;
    });
    if (affected === 0) {
      throw new NotFoundException('Domain not found');
    }
    this.logger.log(`Soft-deleted domain id=${domainId} tenant=${tenantId}`);
  }

  async setPrimary(tenantId: number, domainId: string): Promise<void> {
    // Two-statement transaction — can't ON CONFLICT out of an UPDATE. The
    // partial UNIQUE INDEX `tenant_domains_one_primary_per_tenant` would 23505
    // if we flipped the target to primary without first clearing any existing
    // primary — order of operations matters.
    const affected = await this.db.tenantTransaction(async (client: PoolClient) => {
      await client.query(
        `UPDATE tenant_domains
           SET is_primary = false, updated_at = NOW()
         WHERE tenant_id = $1 AND is_primary = true AND is_active = ${IS_ACTIVE.ACTIVE}`,
        [tenantId],
      );
      const r = await client.query(
        `UPDATE tenant_domains
           SET is_primary = true, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
        [domainId, tenantId],
      );
      return r.rowCount ?? 0;
    });
    if (affected === 0) {
      throw new NotFoundException('Domain not found');
    }
  }

  // ------------------------------ privates ------------------------------

  /**
   * Reject `addDomain()` with 409 DOMAIN_ALREADY_CLAIMED when another tenant
   * already has this domain in `status='verified' AND is_active=1`.
   *
   * MUST run via `systemQuery` (BYPASSRLS) — `tenantTransaction` would apply
   * the per-tenant RLS policy and hide the conflicting row, defeating the
   * whole point (ADR-019 §6b: cross-tenant reads require the system pool).
   *
   * Own tenant is excluded (`tenant_id <> $2`) so the existing per-tenant
   * `tenant_domains_tenant_domain_unique` still owns the "Diese Domain ist
   * bereits für Deinen Tenant angelegt" (DOMAIN_ALREADY_ADDED) error path;
   * this helper purely covers the cross-tenant case.
   */
  private async assertNoCrossTenantVerifiedClaim(
    tenantId: number,
    normalizedDomain: string,
  ): Promise<void> {
    const existing = await this.db.systemQueryOne<{ id: string }>(
      `SELECT id FROM tenant_domains
       WHERE domain = $1
         AND status = 'verified'
         AND is_active = ${IS_ACTIVE.ACTIVE}
         AND tenant_id <> $2
       LIMIT 1`,
      [normalizedDomain, tenantId],
    );
    if (existing !== null) {
      throw new ConflictException({
        code: 'DOMAIN_ALREADY_CLAIMED',
        message: 'Diese Domain ist bereits bei einem anderen Assixx-Tenant verifiziert.',
      });
    }
  }

  private async findOneActive(
    client: PoolClient,
    tenantId: number,
    domainId: string,
  ): Promise<TenantDomainRow> {
    const result = await client.query<TenantDomainRow>(
      `SELECT * FROM tenant_domains
       WHERE id = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [domainId, tenantId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException('Domain not found');
    }
    return row;
  }

  private async flipToVerified(client: PoolClient, row: TenantDomainRow): Promise<TenantDomain> {
    try {
      const result = await client.query<TenantDomainRow>(
        `UPDATE tenant_domains
           SET status = 'verified', verified_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND is_active = ${IS_ACTIVE.ACTIVE}
         RETURNING *`,
        [row.id],
      );
      const updated = result.rows[0];
      if (updated === undefined) {
        throw new Error('UPDATE RETURNING produced no row');
      }
      this.logger.log(`Domain verified: tenant=${row.tenant_id} domain=${row.domain} id=${row.id}`);
      return this.mapToResponse(updated);
    } catch (err: unknown) {
      if (this.isUniqueViolation(err, CONSTRAINT_VERIFIED_GLOBAL)) {
        // Race: another tenant already verified this domain while our DNS
        // check was in flight. Enclosing `tenantTransaction` rolls back
        // automatically — no orphan 'verified' state is written.
        throw new ConflictException({
          code: 'DOMAIN_ALREADY_CLAIMED',
          message: 'Diese Domain gehört bereits einem anderen Assixx-Tenant.',
        });
      }
      throw err;
    }
  }

  private isUniqueViolation(err: unknown, constraint: string): boolean {
    return (
      err instanceof DatabaseError &&
      err.code === PG_UNIQUE_VIOLATION &&
      err.constraint === constraint
    );
  }

  private throwForValidationFailure(failure: EmailValidationFailure): never {
    // Exhaustive switch over the 3-member `EmailValidationFailure` union.
    // No `default:` — adding a 4th member in `email-validator.ts` breaks tsc
    // here (return type `never` no longer provable), forcing a deliberate
    // update. That's stricter than a silent default-fallback.
    switch (failure) {
      case 'INVALID_FORMAT':
        throw new BadRequestException({
          code: 'INVALID_DOMAIN_FORMAT',
          message: 'Die angegebene Domain ist ungültig.',
        });
      case 'DISPOSABLE_EMAIL':
        throw new BadRequestException({
          code: 'DISPOSABLE_DOMAIN',
          message: 'Einmal-/Wegwerf-Domains sind nicht erlaubt.',
        });
      case 'FREE_EMAIL_PROVIDER':
        throw new BadRequestException({
          code: 'FREE_EMAIL_PROVIDER',
          message: 'Freemail-Domains (Gmail, GMX, Web.de, …) sind nicht erlaubt.',
        });
    }
  }

  private mapToResponse(
    row: TenantDomainRow,
    verificationInstructions?: { txtHost: string; txtValue: string },
  ): TenantDomain {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      domain: row.domain,
      status: row.status,
      isPrimary: row.is_primary,
      verifiedAt: row.verified_at === null ? null : row.verified_at.toISOString(),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      // `exactOptionalPropertyTypes: true` — only include the key when defined.
      ...(verificationInstructions !== undefined ? { verificationInstructions } : {}),
    };
  }
}
