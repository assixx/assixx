/**
 * Shift Key Param DTO
 *
 * Zod schema for shift key enum and path parameter validation.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Valid shift keys */
export const ShiftKeySchema = z.enum(['early', 'late', 'night'], {
  message: 'Shift key must be early, late, or night',
});

/** Shift key path parameter */
export const ShiftKeyParamSchema = z.object({
  shiftKey: ShiftKeySchema,
});

export class ShiftKeyParamDto extends createZodDto(ShiftKeyParamSchema) {}
