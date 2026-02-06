/**
 * Rotation Common Schemas
 *
 * Reusable Zod schemas for rotation validation.
 */
import { z } from 'zod';

/**
 * Shift block type enum (for rotation algorithm)
 */
export const ShiftBlockTypeSchema = z.enum(['early', 'late', 'night'], {
  message: 'Shift type must be early, late, or night',
});

/**
 * Shift group enum (F/S/N)
 */
export const ShiftGroupSchema = z.enum(['F', 'S', 'N'], {
  message: 'Shift group must be F, S, or N',
});

/**
 * Pattern type enum
 */
export const PatternTypeSchema = z.enum(['alternate_fs', 'fixed_n', 'custom'], {
  message: 'Pattern type must be alternate_fs, fixed_n, or custom',
});

/**
 * Special rule: nth weekday free (e.g., every 4th Sunday free)
 */
export const NthWeekdayFreeRuleSchema = z.object({
  type: z.literal('nth_weekday_free'),
  name: z
    .string()
    .min(1, 'Rule name is required')
    .max(100, 'Name cannot exceed 100 characters'),
  weekday: z.number().int().min(0).max(6), // 0-6 (0 = Sunday)
  n: z.number().int().min(1).max(5), // 1-5 (e.g., 4 = "every 4th")
});

/**
 * Pattern configuration schema
 */
export const PatternConfigSchema = z.object({
  weekType: z.enum(['F', 'S']).optional(),
  cycleWeeks: z.number().int().positive().optional(),
  shiftType: z.literal('N').optional(),
  pattern: z
    .array(
      z.object({
        week: z.number().int().positive(),
        shift: ShiftGroupSchema,
      }),
    )
    .optional(),
  skipSaturday: z.boolean().optional(),
  skipSunday: z.boolean().optional(),
  nightShiftStatic: z.boolean().optional(),
  skipWeekends: z.boolean().optional(), // LEGACY
  ignoreNightShift: z.boolean().optional(), // LEGACY
  customPattern: z
    .object({
      week1: z.record(z.string(), z.unknown()),
      week2: z.record(z.string(), z.unknown()),
    })
    .optional(),
  shiftBlockLength: z.number().int().min(1).max(14).optional(),
  freeDays: z.number().int().min(0).max(14).optional(),
  startShift: ShiftBlockTypeSchema.optional(),
  shiftSequence: z.array(ShiftBlockTypeSchema).length(3).optional(),
  specialRules: z.array(NthWeekdayFreeRuleSchema).optional(),
});
