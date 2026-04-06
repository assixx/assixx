/**
 * Create Custom Field DTO
 *
 * Zod schema for adding a custom field definition to an inventory list.
 * Max 30 fields per list (enforced by service, not DB).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { InventoryFieldTypeSchema } from './common.dto.js';

export const CreateCustomFieldSchema = z
  .object({
    fieldName: z
      .string()
      .trim()
      .min(1, 'Feldname ist erforderlich')
      .max(100, 'Feldname darf maximal 100 Zeichen lang sein'),
    fieldType: InventoryFieldTypeSchema.default('text'),
    fieldOptions: z
      .array(z.string().trim().min(1).max(255))
      .min(2, 'Select-Felder benötigen mindestens 2 Optionen')
      .max(50, 'Maximal 50 Optionen')
      .nullish(),
    fieldUnit: z.string().trim().max(20, 'Einheit darf maximal 20 Zeichen lang sein').nullish(),
    isRequired: z.boolean().default(false),
    sortOrder: z.number().int().min(0).max(999).default(0),
  })
  .refine(
    (data: { fieldType: string; fieldOptions?: string[] | null | undefined }) => {
      if (data.fieldType === 'select') {
        return Array.isArray(data.fieldOptions) && data.fieldOptions.length >= 2;
      }
      return true;
    },
    { message: 'Select-Felder benötigen mindestens 2 Optionen', path: ['fieldOptions'] },
  );

export class CreateCustomFieldDto extends createZodDto(CreateCustomFieldSchema) {}
