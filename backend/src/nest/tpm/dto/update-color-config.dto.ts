/**
 * Update Color Config DTO
 *
 * Zod schema for customizing status colors per tenant.
 * Each entry maps a status key to a hex color and display label.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { HexColorSchema, TpmCardStatusSchema } from './common.dto.js';

export const UpdateColorConfigSchema = z.object({
  statusKey: TpmCardStatusSchema,
  colorHex: HexColorSchema,
  label: z
    .string()
    .trim()
    .min(1, 'Label ist erforderlich')
    .max(50, 'Label darf maximal 50 Zeichen lang sein'),
});

export class UpdateColorConfigDto extends createZodDto(UpdateColorConfigSchema) {}
