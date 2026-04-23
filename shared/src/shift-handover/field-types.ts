/**
 * Shift Handover — Custom-Field Type Definitions (pure types + const).
 *
 * Single source of truth for the 8 field types that a Team-Lead can attach
 * to a shift-handover template (Plan §Product Decisions #6). Consumed by:
 *   - Backend validators (Zod schemas in
 *     `backend/src/nest/shift-handover/field-validators.ts`)
 *   - Backend services + DTOs
 *   - Frontend form-builder UI + state-templates manual validators
 *
 * ARCHITECTURAL CONTRACT (ADR-030 §7 + ADR-015):
 *   This file MUST stay Zod-free and contain only pure TypeScript types
 *   plus `const` arrays. Zod schemas (`ShiftHandoverFieldDefSchema`,
 *   `ShiftHandoverTemplateFieldsSchema`, `buildEntryValuesSchema`) live in
 *   the backend — see file path above. The shared package is browser-safe
 *   per ADR-015; importing Zod here would re-introduce the runtime
 *   validator into the SvelteKit bundle and trip the strict CSP
 *   (`new Function()` capability probe in `zod/v4/core/util.js:157`).
 *
 * REWRITTEN 2026-04-23 — see Spec Deviation #8 in
 * `docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md`. Original file declared
 * everything via `z.infer<typeof Schema>`; new file mirrors the same
 * structural contract with hand-rolled types so backend `z.infer` output
 * and shared manual interfaces remain wire-compatible.
 *
 * @see docs/infrastructure/adr/ADR-030-zod-validation-architecture.md §7
 * @see docs/infrastructure/adr/ADR-015-shared-package-architecture.md
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §2.1 + §R7
 * @see backend/src/nest/shift-handover/field-validators.ts (Zod home)
 */

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
 * Select-field option pair. Backend Zod constraints (each field 1..100 chars)
 * are enforced server-side; client-side manual validators mirror the same
 * limits (see `state-templates.svelte.ts`).
 */
export interface ShiftHandoverFieldOption {
  value: string;
  label: string;
}

/** Common shape for all field definitions. */
interface BaseFieldDef {
  /** Lowercase-start, [a-z0-9_], ≤30 chars (DB-column-safe). Backend regex authoritative. */
  key: string;
  /** Human label, ≤100 chars (backend enforced). */
  label: string;
  /** Whether the field is mandatory at entry-submit time. */
  required: boolean;
}

/** Simple field — primitive value storage, no extra metadata. */
interface SimpleFieldDef extends BaseFieldDef {
  type: ShiftHandoverSimpleFieldType;
}

/** Select field — carries the option list (backend enforces 1..50 options). */
interface SelectFieldDef extends BaseFieldDef {
  type: 'select';
  options: ShiftHandoverFieldOption[];
}

/**
 * One field definition. Discriminated union over `type`; the simple-type
 * union and the literal `'select'` are disjoint so TypeScript narrows
 * correctly on `field.type === 'select'` checks.
 *
 * Wire-compatible with backend `z.infer<typeof ShiftHandoverFieldDefSchema>`.
 */
export type ShiftHandoverFieldDef = SimpleFieldDef | SelectFieldDef;
