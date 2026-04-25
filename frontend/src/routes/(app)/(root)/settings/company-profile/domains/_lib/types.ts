/**
 * Tenant Domain Verification — Frontend Types
 *
 * Mirrors the backend's `TenantDomain` API response shape from
 * `backend/src/nest/domains/domains.types.ts`. Snake_case DB columns are NOT
 * exposed here — backend's ResponseInterceptor converts to camelCase.
 *
 * @see ADR-048 (Tenant Domain Verification — Phase 6 deliverable)
 * @see masterplan §2.2 (backend types) + §5.1 (frontend page)
 */

export type TenantDomainStatus = 'pending' | 'verified' | 'failed' | 'expired';

/**
 * DNS TXT record instructions surfaced ONLY on `POST /domains` response per
 * masterplan §0.2.5 #10. List/Get responses omit this field — we MUST NOT rely
 * on it being present on subsequent reads (the verification token is persistent
 * server-side, but only emitted at add-time as a one-shot UX affordance).
 */
export interface VerificationInstructions {
  txtHost: string;
  txtValue: string;
}

/** API-shape (camelCase) — matches backend's `TenantDomain` interface. */
export interface TenantDomain {
  /** UUIDv7 (string) — backend uses native PG 18.3 `uuidv7()` per §0.2.5 #13. */
  id: string;
  domain: string;
  status: TenantDomainStatus;
  /** ISO date string when the row was flipped to verified, or null while pending. */
  verifiedAt: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  /** Present ONLY on the response to `POST /domains` (§0.2.5 #10). */
  verificationInstructions?: VerificationInstructions;
}

/** Response shape of `GET /api/v2/domains/verification-status` (§2.7, Q8). */
export interface VerificationStatusResponse {
  verified: boolean;
}
