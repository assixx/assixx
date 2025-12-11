/**
 * @deprecated This file is DEPRECATED and will be removed in a future version.
 *
 * MIGRATION: Use `custom-rotation-types.ts` instead.
 *
 * All types and constants have been moved to:
 * - `custom-rotation-types.ts` (new file)
 *
 * Old → New mapping:
 * - KontischichtPattern → CustomRotationPattern
 *
 * Other types remain the same:
 * - DaySchedule (unchanged)
 * - WeekData (unchanged)
 * - PatternTemplate (unchanged)
 * - PATTERN_TEMPLATES (unchanged)
 * - SHIFT_ROW_SELECTOR (unchanged)
 *
 * This file is kept temporarily for reference only.
 * DELETE THIS FILE after confirming all imports have been updated.
 *
 * @see custom-rotation-types.ts
 */

// Re-export everything from new location for backwards compatibility (TEMPORARY)
export {
  type DaySchedule,
  type WeekData,
  type CustomRotationPattern as KontischichtPattern,
  type PatternTemplate,
  PATTERN_TEMPLATES,
  SHIFT_ROW_SELECTOR,
} from './custom-rotation-types';
