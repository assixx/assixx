/**
 * `POST /auth/oauth/handoff` — body validation.
 *
 * Consumed exclusively by the SvelteKit subdomain page at
 * `/signup/oauth-complete` when it receives a handoff-token from the apex
 * OAuth callback (ADR-050 §OAuth, masterplan §Step 2.5f).
 *
 * Token shape: 64 hex chars (32 random bytes hex-encoded). Regex-anchored
 * so any structurally invalid token is rejected at the edge, before the
 * Redis lookup — a small DoS-hardening win.
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §OAuth
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 2 Step 2.5f
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const HANDOFF_TOKEN_REGEX = /^[a-f0-9]{64}$/;

export const HandoffBodySchema = z.object({
  token: z.string().regex(HANDOFF_TOKEN_REGEX, 'Invalid handoff token format'),
});

export class HandoffBodyDto extends createZodDto(HandoffBodySchema) {}
