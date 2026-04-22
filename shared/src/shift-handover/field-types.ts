/**
 * Shift Handover — Custom-Field Type Definitions.
 *
 * Single source of truth for the 8 field types that a Team-Lead can attach
 * to a shift-handover template (Plan §Product Decisions #6). Consumed by
 * both backend (template upsert validation + dynamic entry-value schema)
 * and frontend (form-builder UI + pre-submit guard) to keep validation
 * parity (Plan §Risk R7).
 *
 * Invariants enforced by the Zod schemas below:
 *  - `key` matches a lowercase-start `[a-z0-9_]` pattern (DB-column-safe)
 *  - `select` fields MUST carry a non-empty `options` array
 *  - Simple types reject `options` by the union discriminator
 *  - A template holds at most 30 fields with no duplicate keys
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §2.1 + §R7
 */
import { z } from 'zod';

/**
 * Simple field types — value storage is primitive. `select` is separate
 * because its FieldDef additionally carries `options[]`.
 */
export const SHIFT_HANDOVER_SIMPLE_FIELD_TYPES = [
  'text',
  'textarea',
  'integer',
  'decimal',
  'date',
  'time',
  'boolean',
] as const;

/** All field types (simple + select). Order mirrors plan §Product Decisions #6. */
export const SHIFT_HANDOVER_FIELD_TYPES = [...SHIFT_HANDOVER_SIMPLE_FIELD_TYPES, 'select'] as const;

export type ShiftHandoverSimpleFieldType = (typeof SHIFT_HANDOVER_SIMPLE_FIELD_TYPES)[number];
export type ShiftHandoverFieldType = (typeof SHIFT_HANDOVER_FIELD_TYPES)[number];

/**
 * Field-key regex: lowercase-start, lowercase-alphanumeric-underscore.
 * 30-char cap keeps builder UI readable and leaves headroom for JSONB key storage.
 */
const FIELD_KEY_REGEX = /^[a-z][a-z0-9_]*$/;

const OptionSchema = z.object({
  value: z.string().min(1).max(100),
  label: z.string().min(1).max(100),
});

export type ShiftHandoverFieldOption = z.infer<typeof OptionSchema>;

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
export type ShiftHandoverFieldDef = z.infer<typeof ShiftHandoverFieldDefSchema>;

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
