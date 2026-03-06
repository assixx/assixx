/**
 * Update Category Color Config DTO
 *
 * Zod schema for customizing card category colors per tenant.
 * Maps a category key (reinigung/wartung/inspektion) to a hex color.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { HexColorSchema, TpmCardCategorySchema } from './common.dto.js';

export const UpdateCategoryColorConfigSchema = z.object({
  categoryKey: TpmCardCategorySchema,
  colorHex: HexColorSchema,
  label: z
    .string()
    .trim()
    .min(1, 'Label ist erforderlich')
    .max(50, 'Label darf maximal 50 Zeichen lang sein'),
});

export class UpdateCategoryColorConfigDto extends createZodDto(
  UpdateCategoryColorConfigSchema,
) {}
