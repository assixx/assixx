/**
 * Shift Handover — Shared DTO Schemas.
 *
 * Schemas referenced by multiple DTOs in this module plus re-exports of
 * the local field-validators so controller-adjacent code only has to
 * reach into `./dto` (no deep `../field-validators` imports scattered
 * across controllers).
 *
 * The Zod schemas re-exported below moved out of `@assixx/shared` on
 * 2026-04-23 per ADR-030 §7 (Spec Deviation #8) so the SvelteKit client
 * never imports Zod. See `../field-validators.ts` for the source.
 *
 * @see docs/infrastructure/adr/ADR-030-zod-validation-architecture.md §7
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §2.1
 */
import { z } from 'zod';

import { SHIFT_HANDOVER_SLOTS, type ShiftHandoverSlot } from '../shift-handover.types.js';

export {
  ShiftHandoverFieldDefSchema,
  ShiftHandoverTemplateFieldsSchema,
} from '../field-validators.js';

/** V1 shift-key whitelist (plan §R13). Mirrors DB CHECK on `shift_handover_entries`. */
export const ShiftKeySchema = z.enum([...SHIFT_HANDOVER_SLOTS] as [
  ShiftHandoverSlot,
  ...ShiftHandoverSlot[],
]);

/**
 * Date-only ISO-8601 (`YYYY-MM-DD`). Matches the DB `DATE` column semantics
 * for `shift_handover_entries.shift_date` — time zones resolved later in the
 * active-shift resolver (plan §R5, Europe/Berlin pin).
 */
export const ShiftDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
