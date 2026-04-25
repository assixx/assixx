/**
 * Shift Handover — Zod Schemas (template + entry-value validators).
 *
 * Backend-only home for ALL Zod runtime schemas of the shift-handover
 * module. Consumed by:
 *   - `dto/common.dto.ts` — re-exports `ShiftHandoverFieldDefSchema` /
 *     `ShiftHandoverTemplateFieldsSchema` for DTO composition.
 *   - `shift-handover-templates.service.ts` — validates template-fields
 *     input on upsert (`ShiftHandoverTemplateFieldsSchema.parse`).
 *   - `shift-handover-entries.service.ts` — builds the dynamic
 *     entry-value schema from the persisted `schema_snapshot`
 *     (`buildEntryValuesSchema`) on `updateDraft` + `submitEntry`
 *     (Plan §R2 drift-safety).
 *
 * Pure TypeScript types + const arrays live in
 * `@assixx/shared/shift-handover/field-types` (Zod-free, browser-safe).
 *
 * ARCHITECTURAL CONTRACT (ADR-030 §7):
 *   Zod stays backend-only. The shared package contains only plain
 *   TypeScript types and constants. Frontend validation uses local
 *   manual checks (see `frontend/src/routes/(app)/(shared)/
 *   shift-handover-templates/_lib/state-templates.svelte.ts`); the
 *   backend remains the authoritative validator.
 *
 * MOVED 2026-04-23 from `shared/src/shift-handover/{field-types,
 * field-validators}.ts` — see Spec Deviation #8 in
 * `docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md`. Move was triggered by a
 * CSP violation in the browser: Zod v4's one-time `allowsEval()`
 * capability probe (`new Function("")`) tripped the strict nonce-based
 * `script-src` policy declared in `frontend/svelte.config.js`. The
 * probe is harmless (graceful catch) but the browser still logs every
 * blocked eval — an ADR-030 violation surfaced as visible noise.
 *
 * @see docs/infrastructure/adr/ADR-030-zod-validation-architecture.md §7
 * @see docs/infrastructure/adr/ADR-015-shared-package-architecture.md
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §2.1 + §R2 + §R7
 */
import {
  SHIFT_HANDOVER_SIMPLE_FIELD_TYPES,
  type ShiftHandoverFieldDef,
  type ShiftHandoverSimpleFieldType,
} from '@assixx/shared/shift-handover';
import { z } from 'zod';

/**
 * Field-key regex: lowercase-start, lowercase-alphanumeric-underscore.
 * 30-char cap keeps builder UI readable and leaves headroom for JSONB key storage.
 */
const FIELD_KEY_REGEX = /^[a-z][a-z0-9_]*$/;

// Date-only ISO-8601 (YYYY-MM-DD) — matches DB `DATE` column semantics.
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
// 24-hour clock, seconds optional (HH:MM or HH:MM:SS).
const ISO_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

const OptionSchema = z.object({
  value: z.string().min(1).max(100),
  label: z.string().min(1).max(100),
});

const BaseFieldShape = {
  key: z
    .string()
    .min(1)
    .max(30)
    .regex(FIELD_KEY_REGEX, 'key must start lowercase and contain only [a-z0-9_]'),
  label: z.string().min(1).max(100),
  required: z.boolean().default(false),
};

const SimpleFieldDefSchema = z.object({
  ...BaseFieldShape,
  type: z.enum([...SHIFT_HANDOVER_SIMPLE_FIELD_TYPES] as [
    ShiftHandoverSimpleFieldType,
    ...ShiftHandoverSimpleFieldType[],
  ]),
});

const SelectFieldDefSchema = z.object({
  ...BaseFieldShape,
  type: z.literal('select'),
  options: z.array(OptionSchema).min(1).max(50),
});

/**
 * One field definition. Union over `type`; `z.literal('select')` and the
 * simple-type enum are disjoint, so the union resolves unambiguously
 * without needing `z.discriminatedUnion` (not used elsewhere in this repo).
 */
export const ShiftHandoverFieldDefSchema = z.union([SimpleFieldDefSchema, SelectFieldDefSchema]);

/**
 * Full template fields array — max 30 per template (plan §2.2) and no
 * duplicate keys. The per-item schema checks structure; this wrapper
 * checks list-level invariants.
 */
export const ShiftHandoverTemplateFieldsSchema = z
  .array(ShiftHandoverFieldDefSchema)
  .max(30, 'Template can hold at most 30 fields')
  .refine(
    (fields: ShiftHandoverFieldDef[]) =>
      new Set(fields.map((f: ShiftHandoverFieldDef) => f.key)).size === fields.length,
    { message: 'Duplicate field keys are not allowed' },
  );

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
 * Validation mode for `buildEntryValuesSchema`.
 *
 * - **`'strict'`** — required fields must be present and pass type validation.
 *   Used by `submitEntry` to enforce the full template contract before the
 *   entry is sealed (snapshot + status flip).
 *
 * - **`'draft'`** — every field is treated as optional regardless of its
 *   `required` flag. Type validation still runs on whatever IS provided
 *   (e.g. a `decimal` field with the value `"hello"` is rejected). Used by
 *   `updateDraft` so partial fills round-trip cleanly without the user
 *   being forced to populate every required field on each save.
 *
 * Rationale: a draft is by definition incomplete. Forcing required-field
 *   completeness at every PATCH defeats the purpose of drafts and produces
 *   400s on legitimate intermediate states (Session 23 finding 2026-04-25).
 *   Submit-time strict validation remains the authoritative gate on
 *   completeness.
 *
 * Mirrors the validation split used by KVP suggestions and Inventory custom
 * fields where partial-edit roundtrips are first-class.
 */
export type EntryValuesValidationMode = 'draft' | 'strict';

/**
 * Build a Zod object schema that validates `custom_values` against the
 * given field definitions.
 *
 *  - In `strict` mode required fields are non-optional; non-required fields
 *    allow the key to be missing (NOT explicitly `undefined`, per the
 *    project's `exactOptionalPropertyTypes` rule).
 *  - In `draft` mode every field is `.optional()` — partial fills are valid;
 *    only the type of provided values is checked.
 *
 * Unknown keys are rejected via `.strict()` in both modes so a `custom_values`
 * payload can only carry keys declared by the template snapshot.
 */
export function buildEntryValuesSchema(
  fields: readonly ShiftHandoverFieldDef[],
  mode: EntryValuesValidationMode = 'strict',
): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodType> = {};
  for (const field of fields) {
    const base = buildFieldSchema(field);
    const isRequired = mode === 'strict' && field.required;
    shape[field.key] = isRequired ? base : base.optional();
  }
  return z.object(shape).strict();
}
