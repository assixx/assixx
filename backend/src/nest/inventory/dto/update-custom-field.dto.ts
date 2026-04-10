/**
 * Update Custom Field DTO
 *
 * Partial update for custom field definitions.
 * fieldType change is allowed but may invalidate existing values.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { InventoryFieldTypeSchema } from './common.dto.js';

export const UpdateCustomFieldSchema = z.object({
  fieldName: z
    .string()
    .trim()
    .min(1, 'Feldname ist erforderlich')
    .max(100, 'Feldname darf maximal 100 Zeichen lang sein')
    .optional(),
  fieldType: InventoryFieldTypeSchema.optional(),
  fieldOptions: z
    .array(z.string().trim().min(1).max(255))
    .min(2, 'Select-Felder benötigen mindestens 2 Optionen')
    .max(50, 'Maximal 50 Optionen')
    .nullish(),
  fieldUnit: z.string().trim().max(20, 'Einheit darf maximal 20 Zeichen lang sein').nullish(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

export class UpdateCustomFieldDto extends createZodDto(UpdateCustomFieldSchema) {}
