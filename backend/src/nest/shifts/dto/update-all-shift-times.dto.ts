/**
 * Update All Shift Times DTO
 *
 * Zod schema for bulk-updating all shift time definitions at once.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { TimeSchema } from './common.dto.js';
import { ShiftKeySchema } from './shift-key-param.dto.js';

/** Bulk update all shift times at once */
export const UpdateAllShiftTimesSchema = z.object({
  shiftTimes: z
    .array(
      z.object({
        shiftKey: ShiftKeySchema,
        label: z.string().min(1).max(100),
        startTime: TimeSchema,
        endTime: TimeSchema,
      }),
    )
    .min(1)
    .max(3),
});

export class UpdateAllShiftTimesDto extends createZodDto(
  UpdateAllShiftTimesSchema,
) {}
