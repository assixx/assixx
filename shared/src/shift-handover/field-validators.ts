/**
 * Shift Handover — Dynamic Entry-Value Validators.
 *
 * Builds a Zod object schema for `shift_handover_entries.custom_values`
 * (JSONB) from a template's field definitions. Because both backend and
 * frontend build the schema from the same `fields[]` input, validation
 * stays identical on both sides — Plan §Risk R7 mitigation.
 *
 * Backend usage: `updateDraft` + `submitEntry` (Phase 2.5).
 * Frontend usage: entry-modal submit guard (Phase 5.1).
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §2.1 + §R7
 */
import { z } from 'zod';

import type { ShiftHandoverFieldDef } from './field-types.js';

// Date-only ISO-8601 (YYYY-MM-DD) — matches DB `DATE` column semantics.
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
// 24-hour clock, seconds optional (HH:MM or HH:MM:SS).
const ISO_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

/**
 * Build the per-field Zod schema. Kept under the 60-LOC cap by using a
 * single switch and delegating to concise `z.*` helpers.
 *
 * Zod 4 notes: `z.number().int()` already rejects non-safe integers, and
 * `z.number()` already rejects `Infinity`/`NaN` — so no `.safe()`/`.finite()`.
 */
function buildFieldSchema(field: ShiftHandoverFieldDef): z.ZodType {
  switch (field.type) {
    case 'text':
      return z.string().max(1000);
    case 'textarea':
      return z.string().max(10_000);
    case 'integer':
      return z.number().int();
    case 'decimal':
      return z.number();
    case 'date':
      return z.string().regex(ISO_DATE_REGEX, 'must be YYYY-MM-DD');
    case 'time':
      return z.string().regex(ISO_TIME_REGEX, 'must be HH:MM or HH:MM:SS');
    case 'boolean':
      return z.boolean();
    case 'select': {
      // `field.options` is guaranteed non-empty by SelectFieldDefSchema upstream.
      // The assertion + fail-fast guards protect against a caller that constructs
      // a FieldDef by hand without going through the schema.
      const values = field.options.map((o: { value: string }) => o.value);
      const [first, ...rest] = values;
      if (first === undefined) {
        throw new Error(`select field "${field.key}" has no options`);
      }
      return z.enum([first, ...rest] as [string, ...string[]]);
    }
  }
}

/**
 * Build a Zod object schema that validates `custom_values` against the
 * given field definitions. Required fields are non-optional; non-required
 * fields allow the key to be missing (NOT explicitly `undefined`, per the
 * project's `exactOptionalPropertyTypes` rule). Unknown keys are rejected
 * via `.strict()` so a submitted entry can only carry keys declared by
 * the template snapshot.
 */
export function buildEntryValuesSchema(
  fields: readonly ShiftHandoverFieldDef[],
): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodType> = {};
  for (const field of fields) {
    const base = buildFieldSchema(field);
    shape[field.key] = field.required ? base : base.optional();
  }
  return z.object(shape).strict();
}
