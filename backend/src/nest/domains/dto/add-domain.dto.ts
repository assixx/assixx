/**
 * Add-domain DTO — `POST /domains` request body.
 *
 * Only the `domain` field; the service layer (`DomainsService.addDomain`)
 * calls `validateBusinessDomain()` (Step 2.3) for the freemail / disposable /
 * RFC-1035 checks. This DTO enforces type, format, length, and normalization
 * only — business rules live one layer down.
 *
 * Populated in Phase 2 Step 2.7.
 *
 * @see docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §2.7
 * @see docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §2.3 (validator)
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AddDomainSchema = z.object({
  // RFC 1035 §2.3.4: max domain length 253 octets. `.trim().toLowerCase()`
  // normalizes inputs like " FIRMA.DE " → "firma.de" so the service and the
  // UNIQUE indexes (`tenant_domains_tenant_domain_unique` + verified-global)
  // operate on identical strings. The service layer does its own redundant
  // `.trim().toLowerCase()` for defence-in-depth against non-HTTP callers.
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Domain is required')
    .max(253, 'Domain must not exceed 253 characters'),
});

export class AddDomainDto extends createZodDto(AddDomainSchema) {}
