/**
 * `@assixx/shared/shift-handover` — public API barrel.
 *
 * Pure TypeScript types + const arrays for the shift-handover custom-field
 * system. Imported by backend (DTO + service composition) and frontend
 * (form-builder UI + manual validators).
 *
 * ARCHITECTURAL CONTRACT (ADR-030 §7 + ADR-015):
 *   This barrel MUST stay Zod-free. Zod runtime schemas
 *   (`ShiftHandoverFieldDefSchema`, `ShiftHandoverTemplateFieldsSchema`,
 *   `buildEntryValuesSchema`) live in
 *   `backend/src/nest/shift-handover/field-validators.ts`. Re-introducing
 *   Zod here would re-bundle `zod` into the SvelteKit client, tripping
 *   the strict CSP via Zod v4's `allowsEval()` capability probe.
 *
 * UPDATED 2026-04-23 — see Spec Deviation #8 in
 * `docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md`. Previous barrel re-exported
 * three Zod schemas + `buildEntryValuesSchema`; those moved to backend
 * with the rest of the validators.
 *
 * @see docs/infrastructure/adr/ADR-030-zod-validation-architecture.md §7
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §2.1
 */
export { SHIFT_HANDOVER_FIELD_TYPES, SHIFT_HANDOVER_SIMPLE_FIELD_TYPES } from './field-types.js';
export type {
  ShiftHandoverFieldDef,
  ShiftHandoverFieldOption,
  ShiftHandoverFieldType,
  ShiftHandoverSimpleFieldType,
} from './field-types.js';
