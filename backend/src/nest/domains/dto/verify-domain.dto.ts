/**
 * Verify-domain param DTO — standard `:id` UUID route param for endpoints
 * operating on a single `tenant_domains` row: `POST /domains/:id/verify`,
 * `PATCH /domains/:id/primary`, `DELETE /domains/:id`.
 *
 * Re-exports the shared `UuidIdParamDto` / `UuidIdParamSchema` from the
 * central `common/dto` factory per TypeScript-Standards §7.5 — no inline
 * `z.uuid()` to avoid drift with the architectural test.
 *
 * Populated in Phase 2 Step 2.7.
 *
 * @see docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §2.7
 * @see docs/TYPESCRIPT-STANDARDS.md §7.5
 */
export {
  UuidIdParamDto as DomainIdParamDto,
  UuidIdParamSchema as DomainIdParamSchema,
} from '../../common/dto/index.js';
