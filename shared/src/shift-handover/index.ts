/**
 * `@assixx/shared/shift-handover` — public API barrel.
 *
 * Single source of truth for custom-field type definitions and dynamic
 * entry-value validators. Imported by backend (DTO/service validation)
 * and frontend (form-builder + pre-submit guard) so the two layers
 * cannot drift out of sync (Plan §Risk R7).
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §2.1
 */
export {
  SHIFT_HANDOVER_FIELD_TYPES,
  SHIFT_HANDOVER_SIMPLE_FIELD_TYPES,
  ShiftHandoverFieldDefSchema,
  ShiftHandoverTemplateFieldsSchema,
} from './field-types.js';
export type {
  ShiftHandoverFieldDef,
  ShiftHandoverFieldOption,
  ShiftHandoverFieldType,
  ShiftHandoverSimpleFieldType,
} from './field-types.js';
export { buildEntryValuesSchema } from './field-validators.js';
