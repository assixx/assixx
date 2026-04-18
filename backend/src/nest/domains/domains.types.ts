/**
 * Domain types for the tenant-domain-verification module.
 *
 * Two shapes live side-by-side:
 *   - `TenantDomainRow` — raw DB row (snake_case columns, `Date` for timestamps,
 *     matches the `tenant_domains` table created in migration
 *     `20260417223358319_create-tenant-domains.ts`).
 *   - `TenantDomain` — outward-facing API response (camelCase, ISO strings).
 *
 * `TenantDomain.verificationInstructions` is populated ONLY on the immediate
 * response to `POST /domains` so the root user can copy the exact TXT host
 * and value into their DNS console. Never returned on subsequent GETs — the
 * token lives in `tenant_domains.verification_token` and is not surfaced to
 * the API consumer afterwards (§0.2.5 #10 — persistent token, no rotation).
 *
 * @see docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §2.2
 * @see docs/infrastructure/adr/ADR-048-tenant-domain-verification.md (pending Phase 6)
 */

export type TenantDomainStatus = 'pending' | 'verified' | 'failed' | 'expired';

export interface TenantDomainRow {
  id: string; // uuidv7
  tenant_id: number;
  domain: string;
  status: TenantDomainStatus;
  verification_token: string;
  verified_at: Date | null;
  is_primary: boolean;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

export interface TenantDomain {
  id: string;
  tenantId: number;
  domain: string;
  status: TenantDomainStatus;
  isPrimary: boolean;
  verifiedAt: string | null; // ISO
  createdAt: string;
  updatedAt: string;
  /** only surfaced to root during "add" response to show TXT instructions */
  verificationInstructions?: {
    txtHost: string; // "_assixx-verify.firma.de"
    txtValue: string; // "assixx-verify=<token>"
  };
}
