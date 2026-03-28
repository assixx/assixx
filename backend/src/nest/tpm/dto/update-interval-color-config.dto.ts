/**
 * Update Interval Color Config DTO
 *
 * Zod schema for customizing interval type colors per tenant.
 * Each entry maps an interval type key to a hex color and display label.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { HexColorSchema, TpmIntervalTypeSchema } from './common.dto.js';

export const UpdateIntervalColorConfigSchema = z.object({
  intervalKey: TpmIntervalTypeSchema,
  colorHex: HexColorSchema,
  label: z
    .string()
    .trim()
    .min(1, 'Label ist erforderlich')
    .max(50, 'Label darf maximal 50 Zeichen lang sein'),
  includeInCard: z.boolean().optional(),
});

export class UpdateIntervalColorConfigDto extends createZodDto(UpdateIntervalColorConfigSchema) {}
